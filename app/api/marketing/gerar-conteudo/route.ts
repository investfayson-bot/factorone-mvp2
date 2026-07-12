import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Assessora de Marketing (Fase 7): gera 3 sugestões de conteúdo (carrossel/
// reels/story) a partir do prompt do usuário + contexto do negócio.
// POST { prompt } → { sugestoes: [{ tipo, titulo, copy }] }
// POST { agendar: { tipo, titulo, copy, data_pub } } → cria em marketing_conteudo.
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = await req.json().catch(() => ({})) as {
    prompt?: string
    agendar?: { tipo?: string; titulo?: string; copy?: string; data_pub?: string }
  }

  // ── agendar rascunho no calendário editorial ──
  if (body.agendar) {
    const a = body.agendar
    const tipo = ['reel', 'story', 'post_instagram', 'email', 'post_linkedin'].includes(String(a.tipo)) ? a.tipo : 'post_instagram'
    if (!a.titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    const dataPub = a.data_pub && /^\d{4}-\d{2}-\d{2}$/.test(a.data_pub) ? a.data_pub : null
    const { error } = await supabase.from('marketing_conteudo').insert({
      empresa_id: empresaId,
      titulo: a.titulo.trim().slice(0, 120),
      tipo,
      copy: a.copy?.slice(0, 4000) ?? null,
      status: dataPub ? 'agendado' : 'ideia',
      data_pub: dataPub,
      responsavel: 'Assessora IA',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── gerar sugestões ──
  const prompt = String(body.prompt ?? '').trim()
  if (!prompt) return NextResponse.json({ error: 'Descreva o que quer divulgar' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'IA não configurada' }, { status: 500 })

  const { data: site } = await supabase.from('sites').select('nome, sobre, ramo').eq('empresa_id', empresaId).maybeSingle()
  const contexto = site ? `Negócio: ${site.nome ?? ''} (${site.ramo ?? ''}). Sobre: ${site.sobre ?? ''}` : 'Negócio sem cadastro detalhado.'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const completion = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: `Você é assessora de marketing de pequenos negócios brasileiros. Gere EXATAMENTE 3 sugestões de conteúdo em JSON puro (sem markdown): [{"tipo":"post_instagram|reel|story","titulo":"...","copy":"..."}]. Copy pronta pra publicar, em português, com gancho forte na primeira linha, sem hashtag em excesso (máx 4). CONTEXTO: ${contexto}`,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : '[]'
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const i = clean.indexOf('['); const j = clean.lastIndexOf(']')
    const sugestoes = JSON.parse(clean.slice(i, j + 1)) as { tipo: string; titulo: string; copy: string }[]
    return NextResponse.json({ sugestoes: sugestoes.slice(0, 3) })
  } catch {
    return NextResponse.json({ error: 'A IA devolveu um formato inesperado — tenta de novo' }, { status: 502 })
  }
}

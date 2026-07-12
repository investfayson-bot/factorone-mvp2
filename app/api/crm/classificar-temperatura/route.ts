import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { garantirCardPipeline, type TemperaturaLead } from '@/lib/crm/pipeline-auto'

export const runtime = 'nodejs'

// Fase 6 — classificar a temperatura de um lead de QUALQUER tela (ex.:
// dentro de uma conversa) cria/atualiza o card no Pipeline automaticamente
// (spec: comportamento obrigatório). Origem 'humano'.
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { titulo?: string; contato?: string; temperatura?: string; origem_detalhe?: string }
  const titulo = String(body.titulo ?? '').trim()
  const temperatura = String(body.temperatura ?? '')
  if (!titulo) return NextResponse.json({ error: 'Título/nome do lead obrigatório' }, { status: 400 })
  if (!['frio', 'morno', 'quente'].includes(temperatura)) return NextResponse.json({ error: 'Temperatura inválida' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    const r = await garantirCardPipeline(supabase, {
      empresaId,
      titulo,
      contato: body.contato?.trim() || null,
      temperatura: temperatura as TemperaturaLead,
      origem: 'humano',
      detalheOrigem: body.origem_detalhe?.slice(0, 160) || 'Classificado manualmente',
    })
    return NextResponse.json({ ok: true, oportunidade_id: r.id, criado: r.criado })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao classificar' }, { status: 500 })
  }
}

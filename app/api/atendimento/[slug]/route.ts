import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processarMensagemVisitante } from '@/lib/donna/site-agent'
import type { Regra } from '@/lib/donna/regras'

export const runtime = 'nodejs'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// CORS liberado: essa rota é chamada tanto pelo widget embutido em
// app/site/[slug] (mesma origem) quanto pelo snippet embed rodando em
// domínios externos dos clientes (app/widget/[slug] + public/donna-embed.js).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: CORS_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

async function resolverEmpresa(slug: string) {
  const { data } = await db().from('sites').select('empresa_id').eq('slug', slug).eq('publicado', true).maybeSingle()
  return (data?.empresa_id as string) ?? null
}

// Rota pública — widget de chat do site (visitante anônimo). Sem auth, escrita
// via service role, mesmo padrão de app/api/site/public/[slug] e agenda/[token].
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const empresaId = await resolverEmpresa(slug)
  if (!empresaId) return json({ error: 'Site não encontrado' }, { status: 404 })
  const conversaId = req.nextUrl.searchParams.get('conversaId')
  if (!conversaId) return json({ mensagens: [] })
  const { data, error } = await db().from('atendimento_mensagens').select('id,autor,texto,created_at').eq('conversa_id', conversaId).eq('empresa_id', empresaId).eq('pendente_aprovacao', false).order('created_at', { ascending: true })
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ mensagens: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const empresaId = await resolverEmpresa(slug)
  if (!empresaId) return json({ error: 'Site não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { conversaId?: string; mensagem?: string; nome?: string; email?: string }
  const mensagem = (body.mensagem ?? '').trim()
  if (!mensagem) return json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = db()
  let conversaId = body.conversaId
  let statusAtual: string | null = null

  if (conversaId) {
    const { data } = await supabase.from('atendimento_conversas').select('id,status').eq('id', conversaId).eq('empresa_id', empresaId).maybeSingle()
    if (!data) conversaId = undefined
    else statusAtual = data.status as string
  }

  if (!conversaId) {
    const { data, error } = await supabase.from('atendimento_conversas').insert({ empresa_id: empresaId, visitante_nome: body.nome ?? null, visitante_email: body.email ?? null }).select('id,status').single()
    if (error) return json({ error: error.message }, { status: 500 })
    conversaId = data.id as string
    statusAtual = data.status as string
  }

  await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'visitante', texto: mensagem, pendente_aprovacao: false })
  await supabase.from('atendimento_conversas').update({ updated_at: new Date().toISOString() }).eq('id', conversaId)

  // Se já está aguardando um humano, a Donna não tenta responder de novo —
  // deixa o dono ver e responder pelo dashboard.
  if (statusAtual !== 'aguardando_humano') {
    const { data: regras } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
    await processarMensagemVisitante(supabase, empresaId, conversaId, mensagem, (regras ?? []) as Regra[])
  }

  return json({ conversaId })
}

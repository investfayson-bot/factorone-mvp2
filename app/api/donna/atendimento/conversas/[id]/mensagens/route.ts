import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  return { user, supabase, empresaId }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase.from('atendimento_mensagens').select('id,autor,texto,pendente_aprovacao,created_at').eq('conversa_id', id).eq('empresa_id', empresaId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mensagens: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { texto?: string }
  const texto = (body.texto ?? '').trim()
  if (!texto) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
  const { error } = await supabase.from('atendimento_mensagens').insert({ conversa_id: id, empresa_id: empresaId, autor: 'humano', texto, pendente_aprovacao: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('atendimento_conversas').update({ status: 'aberta', updated_at: new Date().toISOString() }).eq('id', id).eq('empresa_id', empresaId)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  return { user, supabase, empresaId }
}

export async function GET(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase.from('fluxogramas').select('id,nome,dados,created_at,updated_at').eq('empresa_id', empresaId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fluxogramas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const nome = body.nome ? String(body.nome) : 'Fluxo'
  const dados = body.dados ?? { nodes: [], edges: [] }
  const { data, error } = await supabase.from('fluxogramas').insert({ empresa_id: empresaId, nome, dados }).select('id,nome,dados,created_at,updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fluxograma: data })
}

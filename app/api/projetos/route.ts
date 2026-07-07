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
  const { data, error } = await supabase.from('projetos').select('id,nome,cor,descricao,created_at').eq('empresa_id', empresaId).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projetos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome do projeto' }, { status: 400 })
  const cor = body.cor ? String(body.cor) : '#3D7A6E'
  const descricao = body.descricao ? String(body.descricao) : null
  const { data, error } = await supabase.from('projetos').insert({ empresa_id: empresaId, nome, cor, descricao }).select('id,nome,cor,descricao,created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projeto: data })
}

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
  const { data, error } = await supabase.from('anotacoes').select('id,titulo,conteudo,cor,created_at,updated_at').eq('empresa_id', empresaId).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ anotacoes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const titulo = body.titulo ? String(body.titulo) : null
  const conteudo = String(body.conteudo || '')
  const cor = body.cor ? String(body.cor) : '#F5EFD8'
  const { data, error } = await supabase.from('anotacoes').insert({ empresa_id: empresaId, titulo, conteudo, cor }).select('id,titulo,conteudo,cor,created_at,updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ anotacao: data })
}

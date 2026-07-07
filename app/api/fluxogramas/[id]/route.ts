import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  return { user, supabase, empresaId }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('nome' in body) patch.nome = body.nome
  if ('dados' in body) patch.dados = body.dados
  const { data, error } = await supabase.from('fluxogramas').update(patch).eq('id', id).eq('empresa_id', empresaId).select('id,nome,dados,created_at,updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fluxograma: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { error } = await supabase.from('fluxogramas').delete().eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

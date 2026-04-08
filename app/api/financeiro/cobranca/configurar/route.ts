import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data, error } = await supabase.from('reguas_cobranca').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data: atual } = await supabase.from('reguas_cobranca').select('id').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (atual?.id) {
    const { error } = await supabase.from('reguas_cobranca').update({ nome: body.nome || 'Régua Padrão', ativo: body.ativo ?? true, notificacoes: body.notificacoes || [] }).eq('id', atual.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }
  const { error } = await supabase.from('reguas_cobranca').insert({ empresa_id: empresaId, nome: body.nome || 'Régua Padrão', ativo: body.ativo ?? true, notificacoes: body.notificacoes || [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

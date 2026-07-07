import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const body = await req.json().catch(() => ({})) as { status?: string }
  if (!['aberta', 'aguardando_humano', 'encerrada'].includes(body.status ?? '')) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  const { error } = await supabase.from('atendimento_conversas').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

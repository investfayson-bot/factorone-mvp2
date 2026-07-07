import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const body = await req.json().catch(() => ({})) as { texto?: string }

  const { data: msg } = await supabase.from('atendimento_mensagens').select('id,conversa_id').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const patch: Record<string, unknown> = { pendente_aprovacao: false }
  if (body.texto?.trim()) patch.texto = body.texto.trim()
  const { error } = await supabase.from('atendimento_mensagens').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('atendimento_conversas').update({ status: 'aberta', updated_at: new Date().toISOString() }).eq('id', msg.conversa_id).eq('empresa_id', empresaId)
  return NextResponse.json({ ok: true })
}

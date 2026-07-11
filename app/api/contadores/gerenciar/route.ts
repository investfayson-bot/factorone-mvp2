import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Revogar/excluir link de acesso por token (tabela contadores, sistema
// legado descontinuado). Antes era escrita direta do client — o próprio
// contador convidado (papel só-leitura) conseguia revogar/excluir os
// acessos da empresa. Gate por papel aqui; a RLS contadores_rls continua
// limitando ao tenant.
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { id?: string; acao?: string }
  const id = String(body.id ?? '')
  const acao = String(body.acao ?? '')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  if (!['revogar', 'excluir'].includes(acao)) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { error } = acao === 'revogar'
    ? await supabase.from('contadores').update({ status: 'revogado' }).eq('id', id).eq('empresa_id', empresaId)
    : await supabase.from('contadores').delete().eq('id', id).eq('empresa_id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

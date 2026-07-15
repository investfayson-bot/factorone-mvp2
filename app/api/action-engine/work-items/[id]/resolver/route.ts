import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Marca um work_item como resolvido manualmente. Papel: contador PODE
// resolver (é o dono do fluxo de bookkeeping, mesma exceção já usada em
// /api/cofre-fiscal); só 'viewer' é bloqueado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { getPapelParaEmpresa } = await import('@/lib/supabase-route')
  const papel = await getPapelParaEmpresa(supabase, user.id, empresaId)
  if (papel === 'viewer') return NextResponse.json({ error: 'Papel viewer tem acesso somente-leitura.' }, { status: 403 })

  const service = svc()
  const { data: item } = await service.from('work_items').select('id, historico, status').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Work item não encontrado' }, { status: 404 })
  if (item.status === 'resolvido') return NextResponse.json({ ok: true, ja_resolvido: true })

  const historico = [...(item.historico as unknown[]), { em: new Date().toISOString(), quem: user.email ?? user.id, acao: 'resolvido_manual' }]
  const { error } = await service.from('work_items').update({ status: 'resolvido', resolved_at: new Date().toISOString(), historico }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

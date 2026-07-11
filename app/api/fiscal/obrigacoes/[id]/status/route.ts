import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const STATUS_VALIDOS = new Set(['pendente', 'enviada', 'pago', 'entregue'])

// Marcar obrigação como paga/entregue. Antes disso a única forma de mudar
// status era escrita direta do client em tax_obrigacoes — a RLS da tabela
// só limita por tenant, não por papel, então contador/viewer (só-leitura)
// conseguiam mudar status de qualquer obrigação da empresa. Mesmo padrão
// de gate do /api/fiscal/registrar-das (Bloco 1).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { status?: string }
  const status = String(body.status ?? '')
  if (!STATUS_VALIDOS.has(status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const service = svc()
  const { data: existente } = await service.from('tax_obrigacoes').select('id').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!existente) return NextResponse.json({ error: 'Obrigação não encontrada' }, { status: 404 })

  const { error } = await service.from('tax_obrigacoes').update({ status }).eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

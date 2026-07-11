import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, empresaPertenceAoUsuario, getPapelParaEmpresa, papelPodeEscrever } from '@/lib/supabase-route'

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
//
// `empresaId` vem explícito no body (a página de Obrigações manda o
// empresa_id da linha, não a empresa ativa do login) porque na visão
// Consolidado/Holding a obrigação pode pertencer a uma empresa do grupo
// diferente da empresa ativa — usar sempre a empresa ativa fazia essa
// escrita falhar (404) pra qualquer obrigação fora dela.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { status?: string; empresaId?: string }
  const status = String(body.status ?? '')
  if (!STATUS_VALIDOS.has(status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const empresaIdBody = String(body.empresaId ?? '').trim()
  let empresaId: string
  if (empresaIdBody) {
    const pertence = await empresaPertenceAoUsuario(supabase, user.id, empresaIdBody)
    if (!pertence) return NextResponse.json({ error: 'Obrigação não encontrada' }, { status: 404 })
    empresaId = empresaIdBody
  } else {
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    empresaId = (u?.empresa_id as string) ?? user.id
  }

  const papel = await getPapelParaEmpresa(supabase, user.id, empresaId)
  if (!papelPodeEscrever(papel)) return NextResponse.json({ error: `Papel ${papel} tem acesso somente-leitura.` }, { status: 403 })

  const service = svc()
  const { data: existente } = await service.from('tax_obrigacoes').select('id').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!existente) return NextResponse.json({ error: 'Obrigação não encontrada' }, { status: 404 })

  const { error } = await service.from('tax_obrigacoes').update({ status }).eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

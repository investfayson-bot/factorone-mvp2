import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const valorPago = Number(body.valor_pago || 0)
  const dataPg = body.data_pagamento || new Date().toISOString().slice(0, 10)
  const { data: conta } = await supabase.from('contas_pagar').select('*').eq('id', id).maybeSingle()
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  const novoValorPago = Number(conta.valor_pago || 0) + valorPago
  const status = novoValorPago >= Number(conta.valor || 0) ? 'paga' : 'parcialmente_paga'
  const { data: tx } = await supabase.from('transacoes').insert({
    empresa_id: conta.empresa_id,
    descricao: `Pagamento: ${conta.descricao}`,
    categoria: conta.categoria,
    tipo: 'saida',
    valor: valorPago,
    status: 'pago',
    data: dataPg,
  }).select('id').single()
  await supabase.from('contas_pagar').update({
    valor_pago: novoValorPago,
    data_pagamento: dataPg,
    status,
    tipo_pagamento: body.tipo_pagamento || conta.tipo_pagamento,
    transaction_id: tx?.id || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  await recalcularDREMes(conta.empresa_id as string, new Date(dataPg))
  return NextResponse.json({ success: true, status, valor_pago: novoValorPago })
}

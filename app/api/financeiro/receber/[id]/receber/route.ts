import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const dataRec = body.data_recebimento || new Date().toISOString().slice(0, 10)
  const { data: conta } = await supabase.from('contas_receber').select('*').eq('id', id).maybeSingle()
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  const valorBase = Number(body.valor_recebido || 0)
  const diasAtraso = Number(conta.dias_atraso || 0)
  const cobrarJuros = Boolean(body.cobrar_juros)
  const juros = cobrarJuros ? valorBase * Number(conta.juros_mora || 0.0033) * Math.max(diasAtraso, 0) : 0
  const multa = cobrarJuros && diasAtraso > 0 ? valorBase * Number(conta.multa || 0.02) : 0
  const valorRecebido = valorBase + juros + multa
  const novoValorRecebido = Number(conta.valor_recebido || 0) + valorRecebido
  const status = novoValorRecebido >= Number(conta.valor || 0) ? 'recebida' : 'parcialmente_recebida'
  const { data: tx } = await supabase.from('transacoes').insert({
    empresa_id: conta.empresa_id,
    descricao: `Recebimento: ${conta.descricao}`,
    categoria: conta.categoria,
    tipo: 'entrada',
    valor: valorRecebido,
    status: 'pago',
    data: dataRec,
  }).select('id').single()
  await supabase.from('contas_receber').update({
    valor_recebido: novoValorRecebido,
    data_recebimento: dataRec,
    status,
    transaction_id: tx?.id || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  await recalcularDREMes(conta.empresa_id as string, new Date(dataRec))
  return NextResponse.json({ success: true, status, juros, multa, valor_total: valorRecebido })
}

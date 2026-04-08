import { NextRequest, NextResponse } from 'next/server'
import { differenceInCalendarDays } from 'date-fns'
import { getSupabaseUser } from '@/lib/supabase-route'

function faixa(dias: number): 'atual' | '1-7' | '8-30' | '31-60' | '61-90' | '>90' {
  if (dias <= 0) return 'atual'
  if (dias <= 7) return '1-7'
  if (dias <= 30) return '8-30'
  if (dias <= 60) return '31-60'
  if (dias <= 90) return '61-90'
  return '>90'
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const [pagar, receber] = await Promise.all([
    supabase.from('contas_pagar').select('fornecedor_nome,data_vencimento,valor,status').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_paga']),
    supabase.from('contas_receber').select('cliente_nome,data_vencimento,valor,status').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_recebida']),
  ])
  const hoje = new Date()
  const build = (rows: Array<{ nome: string; data_vencimento: string; valor: number }>) => {
    const totals: Record<string, number> = { atual: 0, '1-7': 0, '8-30': 0, '31-60': 0, '61-90': 0, '>90': 0 }
    for (const r of rows) {
      const d = differenceInCalendarDays(hoje, new Date(r.data_vencimento))
      totals[faixa(d)] += Number(r.valor || 0)
    }
    return totals
  }
  const pagarRows = (pagar.data || []).map((x) => ({ nome: x.fornecedor_nome, data_vencimento: x.data_vencimento, valor: Number(x.valor || 0) }))
  const receberRows = (receber.data || []).map((x) => ({ nome: x.cliente_nome, data_vencimento: x.data_vencimento, valor: Number(x.valor || 0) }))
  return NextResponse.json({ pagar: build(pagarRows), receber: build(receberRows), pagar_rows: pagarRows, receber_rows: receberRows })
}

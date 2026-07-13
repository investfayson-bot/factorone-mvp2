import { getSupabaseUser } from '@/lib/supabase-route'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { supabase, user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresa_id = ur?.empresa_id

  if (!empresa_id) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const periodo = req.nextUrl.searchParams.get('periodo') || 'mes'
  const dataInicio = req.nextUrl.searchParams.get('data_inicio')
  const dataFim = req.nextUrl.searchParams.get('data_fim')

  let filtro: Record<string, string | { gte?: string; lte?: string }> = { empresa_id }

  if (dataInicio && dataFim) {
    filtro.data_vencimento = { gte: dataInicio, lte: dataFim }
  } else if (periodo === 'mes') {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
    filtro.data_vencimento = { gte: primeiroDia, lte: ultimoDia }
  }

  try {
    const [receitas, despesas, vendas] = await Promise.all([
      supabase.from('contas_receber').select('id,valor,valor_recebido,status,descricao,categoria').match(filtro),
      supabase.from('contas_pagar').select('id,valor,valor_pago,status,descricao,categoria').match(filtro),
      supabase.from('extrato_bancario').select('id,valor,tipo,descricao,categoria').eq('empresa_id', empresa_id).match({ tipo: 'entrada' }),
    ])

    const receitaTotal = receitas.data?.reduce((s, x) => s + Number(x.valor || 0), 0) || 0
    const despesaTotal = despesas.data?.reduce((s, x) => s + Number(x.valor || 0), 0) || 0
    const lucro = receitaTotal - despesaTotal

    const dre = {
      receitas: {
        linhas: [
          { nome: 'Receitas de Vendas', valor: receitaTotal, transacoes: receitas.data || [] },
          { nome: 'Receitas de Serviços', valor: vendas.data?.reduce((s, x) => s + Number(x.valor || 0), 0) || 0, transacoes: vendas.data || [] },
        ],
        total: receitaTotal,
      },
      despesas: {
        linhas: [{ nome: 'Despesas Operacionais', valor: despesaTotal, transacoes: despesas.data || [] }],
        total: despesaTotal,
      },
      lucro: lucro,
      margem: receitaTotal > 0 ? ((lucro / receitaTotal) * 100).toFixed(2) : '0',
    }

    return NextResponse.json(dre)
  } catch (err) {
    console.error('DRE error:', err)
    return NextResponse.json({ error: 'Failed to load DRE' }, { status: 500 })
  }
}

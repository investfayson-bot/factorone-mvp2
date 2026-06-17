import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { belvoFetch } from '@/lib/belvo'

type BelvoTransaction = {
  id: string
  amount?: number
  currency?: string
  description?: string
  value_date?: string
  accounting_date?: string
  type?: string // INFLOW | OUTFLOW
  status?: string
  category?: string
  merchant?: { name?: string } | null
  account?: { name?: string; number?: string } | null
}

function mapTx(t: BelvoTransaction) {
  return {
    id: t.id,
    data: t.value_date || t.accounting_date || null,
    descricao: t.description ?? null,
    categoria: t.category ?? null,
    estabelecimento: t.merchant?.name ?? null,
    conta: t.account?.name ?? t.account?.number ?? null,
    tipo: t.type ?? null,
    valor: t.amount ?? null,
    moeda: t.currency ?? null,
  }
}

/**
 * POST: dado um `link`, busca as transações na Belvo no período informado
 * (default: últimos 90 dias) e devolve normalizadas.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { link, date_from, date_to } = (await req.json()) as {
      link?: string; date_from?: string; date_to?: string
    }
    if (!link) return NextResponse.json({ error: 'link obrigatório' }, { status: 400 })

    const hoje = new Date()
    const ini = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000)
    const df = date_from || ini.toISOString().slice(0, 10)
    const dt = date_to || hoje.toISOString().slice(0, 10)

    const txs = await belvoFetch<BelvoTransaction[]>('/api/transactions/', {
      method: 'POST',
      body: JSON.stringify({ link, date_from: df, date_to: dt }),
    })

    return NextResponse.json({ transacoes: txs.map(mapTx), periodo: { de: df, ate: dt } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}

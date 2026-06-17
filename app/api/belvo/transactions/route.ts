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
  account?: { id?: string; name?: string; number?: string } | null
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
 * POST: busca transações de um `link` no período (default últimos 365 dias),
 * persiste com dedupe (belvo_transacoes) e devolve normalizadas.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { link, date_from, date_to } = (await req.json()) as {
      link?: string; date_from?: string; date_to?: string
    }
    if (!link) return NextResponse.json({ error: 'link obrigatório' }, { status: 400 })

    const hoje = new Date()
    const ini = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000)
    const df = date_from || ini.toISOString().slice(0, 10)
    const dt = date_to || hoje.toISOString().slice(0, 10)

    const txs = await belvoFetch<BelvoTransaction[]>('/api/transactions/', {
      method: 'POST',
      body: JSON.stringify({ link, date_from: df, date_to: dt }),
    })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null

    if (txs.length) {
      await supabase.from('belvo_transacoes').upsert(
        txs.map(t => ({
          belvo_id: t.id,
          link_id: link,
          conta_belvo_id: t.account?.id ?? null,
          empresa_id: empresaId,
          user_id: user.id,
          data: t.value_date || t.accounting_date || null,
          descricao: t.description ?? null,
          categoria: t.category ?? null,
          estabelecimento: t.merchant?.name ?? null,
          conta: t.account?.name ?? t.account?.number ?? null,
          tipo: t.type ?? null,
          valor: t.amount ?? null,
          moeda: t.currency ?? null,
        })),
        { onConflict: 'belvo_id' }
      )
    }

    return NextResponse.json({ transacoes: txs.map(mapTx), periodo: { de: df, ate: dt }, importadas: txs.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}

/** GET: transações já importadas (RLS aplica o escopo). Limite 500. */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('belvo_transacoes')
      .select('belvo_id, data, descricao, categoria, estabelecimento, conta, tipo, valor, moeda')
      .order('data', { ascending: false })
      .limit(500)

    const transacoes = (data ?? []).map(t => ({
      id: t.belvo_id, data: t.data, descricao: t.descricao, categoria: t.categoria,
      estabelecimento: t.estabelecimento, conta: t.conta, tipo: t.tipo, valor: t.valor, moeda: t.moeda,
    }))

    return NextResponse.json({ transacoes })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

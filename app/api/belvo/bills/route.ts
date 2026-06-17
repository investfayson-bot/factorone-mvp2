import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { belvoFetch } from '@/lib/belvo'

type BelvoBill = {
  id: string
  account?: { id?: string } | null
  bill_name?: string
  billing_date?: string
  due_date?: string
  total_amount?: number
  minimum_payment?: number
  currency?: string
  status?: string
}

function mapBill(b: BelvoBill) {
  return {
    id: b.id,
    nome: b.bill_name ?? null,
    fechamento: b.billing_date ?? null,
    vencimento: b.due_date ?? null,
    total: b.total_amount ?? null,
    minimo: b.minimum_payment ?? null,
    moeda: b.currency ?? null,
    status: b.status ?? null,
  }
}

/**
 * POST: busca faturas de cartão (bills) de um `link`, persiste (belvo_bills) e devolve.
 * Nem toda instituição/cartão expõe bills — retorna lista vazia nesse caso.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { link } = (await req.json()) as { link?: string }
    if (!link) return NextResponse.json({ error: 'link obrigatório' }, { status: 400 })

    const bills = await belvoFetch<BelvoBill[]>('/api/bills/', {
      method: 'POST',
      body: JSON.stringify({ link }),
    })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null

    if (bills.length) {
      await supabase.from('belvo_bills').upsert(
        bills.map(b => ({
          belvo_id: b.id,
          link_id: link,
          conta_belvo_id: b.account?.id ?? null,
          empresa_id: empresaId,
          user_id: user.id,
          nome: b.bill_name ?? null,
          data_fechamento: b.billing_date ?? null,
          data_vencimento: b.due_date ?? null,
          valor_total: b.total_amount ?? null,
          valor_minimo: b.minimum_payment ?? null,
          moeda: b.currency ?? null,
          status: b.status ?? null,
        })),
        { onConflict: 'belvo_id' }
      )
    }

    return NextResponse.json({ faturas: bills.map(mapBill) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}

/** GET: faturas já importadas (RLS aplica o escopo). */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('belvo_bills')
      .select('belvo_id, nome, data_fechamento, data_vencimento, valor_total, valor_minimo, moeda, status')
      .order('data_vencimento', { ascending: false })

    const faturas = (data ?? []).map(b => ({
      id: b.belvo_id, nome: b.nome, fechamento: b.data_fechamento, vencimento: b.data_vencimento,
      total: b.valor_total, minimo: b.valor_minimo, moeda: b.moeda, status: b.status,
    }))

    return NextResponse.json({ faturas })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

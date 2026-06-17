import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

type BTx = {
  belvo_id: string
  data: string | null
  descricao: string | null
  estabelecimento: string | null
  categoria: string | null
  conta: string | null
  tipo: string | null
  valor: number | null
}

/**
 * POST: sincroniza as transações já importadas da Belvo (belvo_transacoes)
 * para as tabelas nativas do FactorOne, de forma idempotente (dedupe por
 * belvo_tx_id). PJ → extrato_bancario; PF → despesas_pessoais / receitas_pessoais.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: txs } = await supabase
      .from('belvo_transacoes')
      .select('belvo_id, data, descricao, estabelecimento, categoria, conta, tipo, valor')
      .order('data', { ascending: false })
      .limit(2000)

    const lista = (txs ?? []) as BTx[]
    if (!lista.length) return NextResponse.json({ sincronizadas: 0, destino: null })

    const [{ data: perfil }, { data: u }] = await Promise.all([
      supabase.from('perfil_usuario').select('tipo').eq('user_id', user.id).maybeSingle(),
      supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle(),
    ])
    const empresaId = (u?.empresa_id as string) || null
    const isPJ = perfil?.tipo === 'empresarial' || (!!empresaId && perfil?.tipo !== 'pessoal')

    const desc = (t: BTx) => t.descricao || t.estabelecimento || 'Transação'
    const isOut = (t: BTx) => (t.tipo || '').toUpperCase() === 'OUTFLOW' || (t.valor ?? 0) < 0
    const abs = (t: BTx) => Math.abs(Number(t.valor ?? 0))

    if (isPJ && empresaId) {
      const conta = await supabase.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('status', 'ativa').maybeSingle()
      const rows = lista.map(t => ({
        empresa_id: empresaId,
        conta_bancaria_id: conta.data?.id ?? null,
        tipo: isOut(t) ? 'debito' : 'credito',
        descricao: desc(t),
        data_transacao: t.data,
        valor: abs(t),
        categoria: t.categoria ?? 'Outros',
        origem: 'belvo',
        belvo_tx_id: t.belvo_id,
      }))
      const { error } = await supabase.from('extrato_bancario').upsert(rows, { onConflict: 'belvo_tx_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ sincronizadas: rows.length, destino: 'extrato_bancario' })
    }

    // PF
    const despesas = lista.filter(isOut).map(t => ({
      user_id: user.id,
      descricao: desc(t),
      valor: abs(t),
      categoria: t.categoria ?? 'Outros',
      data_despesa: t.data,
      status: 'pago',
      origem: 'belvo',
      belvo_tx_id: t.belvo_id,
    }))
    const receitas = lista.filter(t => !isOut(t)).map(t => ({
      user_id: user.id,
      descricao: desc(t),
      valor: abs(t),
      categoria: t.categoria ?? 'Outros',
      data_recebimento: t.data,
      belvo_tx_id: t.belvo_id,
    }))

    const [rd, rr] = await Promise.all([
      despesas.length ? supabase.from('despesas_pessoais').upsert(despesas, { onConflict: 'belvo_tx_id' }) : Promise.resolve({ error: null }),
      receitas.length ? supabase.from('receitas_pessoais').upsert(receitas, { onConflict: 'belvo_tx_id' }) : Promise.resolve({ error: null }),
    ])
    if (rd.error) return NextResponse.json({ error: rd.error.message }, { status: 400 })
    if (rr.error) return NextResponse.json({ error: rr.error.message }, { status: 400 })

    return NextResponse.json({ sincronizadas: despesas.length + receitas.length, destino: 'pf', despesas: despesas.length, receitas: receitas.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

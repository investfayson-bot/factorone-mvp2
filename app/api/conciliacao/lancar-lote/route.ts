import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

/**
 * Conciliação em lote: cria transações no caixa para TODOS os extratos
 * bancários não conciliados (crédito -> entrada, débito -> saída) e marca
 * cada extrato como conciliado. Filtro opcional por `origem` (ex.: 'belvo').
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const bloqueio = await bloquearSeLeitura(supabase, user.id)
    if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })

    const { origem } = (await req.json().catch(() => ({}))) as { origem?: string }

    let q = supabase.from('extrato_bancario').select('*').eq('conciliado', false)
    if (origem) q = q.eq('origem', origem)
    const { data: extratos } = await q

    let count = 0
    for (const ex of extratos ?? []) {
      const tipo = ex.tipo === 'credito' ? 'entrada' : 'saida'
      const data = String(ex.data_transacao ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const { data: tx, error } = await supabase.from('transacoes').insert({
        empresa_id: ex.empresa_id,
        descricao: ex.descricao ?? 'Lançamento bancário',
        categoria: ex.categoria ?? 'Outros',
        tipo,
        valor: Number(ex.valor ?? 0),
        status: 'pago',
        data,
      }).select('id').single()
      if (error || !tx) continue
      await supabase.from('extrato_bancario').update({ conciliado: true, transaction_id: tx.id }).eq('id', ex.id)
      count++
    }

    return NextResponse.json({ conciliados: count, total: (extratos ?? []).length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

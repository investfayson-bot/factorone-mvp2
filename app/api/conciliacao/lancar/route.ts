import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

/**
 * Concilia um lançamento do extrato bancário criando a transação correspondente
 * no caixa (transacoes) e marcando o extrato como conciliado.
 * crédito -> entrada · débito -> saída.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { extrato_id } = (await req.json()) as { extrato_id?: string }
    if (!extrato_id) return NextResponse.json({ error: 'extrato_id obrigatório' }, { status: 400 })

    const { data: ex } = await supabase.from('extrato_bancario').select('*').eq('id', extrato_id).maybeSingle()
    if (!ex) return NextResponse.json({ error: 'Extrato não encontrado' }, { status: 404 })
    if (ex.conciliado) return NextResponse.json({ ok: true, ja_conciliado: true })

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
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabase.from('extrato_bancario').update({ conciliado: true, transaction_id: tx.id }).eq('id', extrato_id)

    return NextResponse.json({ ok: true, transacao_id: tx.id, tipo })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

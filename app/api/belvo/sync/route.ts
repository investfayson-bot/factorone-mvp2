import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

type BTx = {
  belvo_id: string
  conta_belvo_id: string | null
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
      .select('belvo_id, conta_belvo_id, data, descricao, estabelecimento, categoria, conta, tipo, valor')
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
      // Cria/acha uma conta bancária nativa por banco conectado (open_finance_id = id da conta na Belvo).
      const { data: bcontas } = await supabase
        .from('belvo_contas')
        .select('belvo_id, nome, instituicao, categoria, saldo, disponivel')
      const mapaConta = new Map<string, string>() // belvo account id -> contas_bancarias.id
      for (const bc of bcontas ?? []) {
        const belvoId = bc.belvo_id as string
        const saldo = bc.saldo ?? 0
        const disponivel = bc.disponivel ?? bc.saldo ?? 0
        const existente = await supabase.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('open_finance_id', belvoId).maybeSingle()
        let contaId = existente.data?.id as string | undefined
        if (contaId) {
          // Atualiza o saldo a cada sync.
          await supabase.from('contas_bancarias').update({ saldo, saldo_disponivel: disponivel }).eq('id', contaId)
        } else {
          const cat = (bc.categoria as string | null ?? '').toUpperCase()
          const tipo = cat.includes('SAV') || cat.includes('POUP') ? 'poupanca' : 'corrente'
          const nova = await supabase.from('contas_bancarias').insert({
            empresa_id: empresaId,
            banco_nome: (bc.instituicao as string | null) || (bc.nome as string | null) || 'Banco (Open Finance)',
            tipo,
            open_finance_id: belvoId,
            saldo,
            saldo_disponivel: disponivel,
            status: 'ativa',
          }).select('id').maybeSingle()
          contaId = nova.data?.id as string | undefined
        }
        if (contaId) mapaConta.set(belvoId, contaId)
      }
      // Fallback: primeira conta ativa (caso a transação não traga conta vinculável).
      const fallback = await supabase.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('status', 'ativa').maybeSingle()
      const fallbackId = fallback.data?.id ?? null

      const rows = lista.map(t => ({
        empresa_id: empresaId,
        conta_bancaria_id: (t.conta_belvo_id && mapaConta.get(t.conta_belvo_id)) || fallbackId,
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
      return NextResponse.json({ sincronizadas: rows.length, destino: 'extrato_bancario', contas: mapaConta.size })
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

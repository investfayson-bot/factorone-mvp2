import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

/**
 * "Quantas parcelas ainda faltam" — junta as 3 fontes que têm parcela hoje
 * (belvo_transacoes, fatura_itens_importados, despesas_pessoais PF) e agrupa
 * por quantas parcelas restam (total_parcelas - parcela_atual), destacando
 * 1 mês e 2 meses restantes (pedido original do cliente).
 * Handoff: docs/handoff-cartao-parcelas-estabelecimento.md
 */

type Linha = { descricao: string; valor: number; restantes: number; origem: string }

function agrupar(linhas: Linha[]) {
  const porRestantes = new Map<number, { valor: number; linhas: Linha[] }>()
  for (const l of linhas) {
    if (!porRestantes.has(l.restantes)) porRestantes.set(l.restantes, { valor: 0, linhas: [] })
    const g = porRestantes.get(l.restantes)!
    g.valor += l.valor
    g.linhas.push(l)
  }
  const get = (r: number) => porRestantes.get(r) ?? { valor: 0, linhas: [] }
  return {
    termina_em_1_mes: get(1),
    termina_em_2_meses: get(2),
    total_restante: linhas.reduce((s, l) => s + l.valor, 0),
    por_restantes: Array.from(porRestantes.entries()).sort((a, b) => a[0] - b[0]).map(([restantes, g]) => ({ restantes, valor: g.valor, quantidade: g.linhas.length })),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null

    let belvoQ = supabase.from('belvo_transacoes').select('descricao,valor,parcela_atual,total_parcelas').not('total_parcelas', 'is', null)
    belvoQ = empresaId ? belvoQ.eq('empresa_id', empresaId) : belvoQ.eq('user_id', user.id)

    let importadoQ = supabase.from('fatura_itens_importados').select('descricao,valor,parcela_atual,total_parcelas').not('total_parcelas', 'is', null)
    importadoQ = empresaId ? importadoQ.eq('empresa_id', empresaId) : importadoQ.eq('user_id', user.id)

    const [belvoR, importadoR, pfR] = await Promise.all([
      belvoQ,
      importadoQ,
      // despesas_pessoais é só PF (user_id) — não existe versão PJ dessa tabela.
      supabase.from('despesas_pessoais').select('descricao,valor,parcela_atual,total_parcelas')
        .eq('user_id', user.id).not('total_parcelas', 'is', null),
    ])

    const linhas: Linha[] = []
    for (const [rows, origem] of [
      [belvoR.data, 'belvo'] as const,
      [importadoR.data, 'import'] as const,
      [pfR.data, 'pf'] as const,
    ]) {
      for (const r of rows ?? []) {
        const atual = Number(r.parcela_atual)
        const total = Number(r.total_parcelas)
        if (!Number.isFinite(atual) || !Number.isFinite(total) || total <= 0) continue
        const restantes = total - atual
        if (restantes < 0) continue
        linhas.push({ descricao: r.descricao ?? '', valor: Number(r.valor) || 0, restantes, origem })
      }
    }

    return NextResponse.json(agrupar(linhas))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

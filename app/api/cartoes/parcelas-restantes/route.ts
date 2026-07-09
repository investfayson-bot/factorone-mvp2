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
type LinhaBruta = { descricao: string; valor: number; parcela_atual: number; total_parcelas: number; origem: string }

/**
 * A Belvo grava uma linha NOVA por mês faturado de uma compra parcelada
 * (parcela 1/10, depois 2/10, depois 3/10...), cada uma com o valor da
 * parcela. Sem deduplicar, a mesma compra é somada uma vez por mês já
 * cobrado, inflando "quanto falta pagar". Aqui agrupamos por compra
 * (origem + descrição + valor da parcela + total) e ficamos só com a
 * linha de maior parcela_atual — o estado mais recente conhecido dela.
 */
function chaveCompra(l: LinhaBruta): string {
  const desc = l.descricao.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${l.origem}|${desc}|${l.valor.toFixed(2)}|${l.total_parcelas}`
}

function deduplicarPorCompra(brutas: LinhaBruta[]): Linha[] {
  const porCompra = new Map<string, LinhaBruta>()
  for (const l of brutas) {
    const chave = chaveCompra(l)
    const existente = porCompra.get(chave)
    if (!existente || l.parcela_atual > existente.parcela_atual) porCompra.set(chave, l)
  }
  return Array.from(porCompra.values()).map(l => ({
    descricao: l.descricao, valor: l.valor, origem: l.origem,
    restantes: l.total_parcelas - l.parcela_atual,
  }))
}

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

    const brutas: LinhaBruta[] = []
    for (const [rows, origem] of [
      [belvoR.data, 'belvo'] as const,
      [importadoR.data, 'import'] as const,
      [pfR.data, 'pf'] as const,
    ]) {
      for (const r of rows ?? []) {
        const atual = Number(r.parcela_atual)
        const total = Number(r.total_parcelas)
        if (!Number.isFinite(atual) || !Number.isFinite(total) || total <= 0 || atual > total) continue
        brutas.push({ descricao: r.descricao ?? '', valor: Math.abs(Number(r.valor) || 0), parcela_atual: atual, total_parcelas: total, origem })
      }
    }

    const linhas = deduplicarPorCompra(brutas).filter(l => l.restantes >= 0)
    return NextResponse.json(agrupar(linhas))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

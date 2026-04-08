/** Linhas alinhadas ao DRE usado em /dashboard/relatorios */

export type TransacaoDRE = {
  tipo: string
  valor: number | string | null
  categoria?: string | null
  data?: string | null
}

export type DREValores = {
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  /** CMV / CSP — custos classificados como `custo` */
  cmv: number
  lucroBruto: number
  ebitda: number
  lucroLiquido: number
}

export function calcDREFromTransacoes(lista: TransacaoDRE[]): DREValores {
  const receitaBruta = lista.filter((i) => i.tipo === 'entrada').reduce((s, i) => s + Number(i.valor || 0), 0)
  const deducoes = lista.filter((i) => i.categoria === 'impostos').reduce((s, i) => s + Number(i.valor || 0), 0)
  const custos = lista.filter((i) => i.categoria === 'custo').reduce((s, i) => s + Number(i.valor || 0), 0)
  const despesasOp = lista.filter((i) => i.categoria === 'despesa_operacional').reduce((s, i) => s + Number(i.valor || 0), 0)
  const depreciacao = lista.filter((i) => i.categoria === 'depreciacao').reduce((s, i) => s + Number(i.valor || 0), 0)

  const receitaLiquida = receitaBruta - deducoes
  const lucroBruto = receitaLiquida - custos
  const ebitda = lucroBruto - despesasOp
  const lucroLiquido = ebitda - depreciacao

  return { receitaBruta, deducoes, receitaLiquida, cmv: custos, lucroBruto, ebitda, lucroLiquido }
}

export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/** Ex.: 2.400.000 → "R$ 2,4M" · 349.000 → "R$ 349K" */
export function fmtBRLCompact(v: number): string {
  const n = Math.abs(v || 0)
  const sign = v < 0 ? '-' : ''
  if (n >= 1_000_000) {
    const m = (Math.abs(v) / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `${sign}R$ ${m}M`
  }
  if (n >= 1_000) {
    return `${sign}R$ ${Math.round(Math.abs(v) / 1_000)}K`
  }
  return fmtBRL(v)
}

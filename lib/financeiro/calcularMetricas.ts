import { createClient } from '@supabase/supabase-js'

export type MetricasFinanceiras = {
  empresa_id: string
  competencia: string
  receita_bruta: number
  deducoes: number
  receita_liquida: number
  cmv: number
  lucro_bruto: number
  despesas_operacionais: number
  ebitda: number
  depreciacao: number
  ebit: number
  resultado_financeiro: number
  lair: number
  impostos: number
  lucro_liquido: number
  margem_bruta: number
  margem_ebitda: number
  margem_liquida: number
  roi: number
  roic: number
  roce: number
  capital_investido: number
  capital_empregado: number
}

function pct(n: number, d: number): number {
  if (!d) return 0
  return (n / d) * 100
}

function toMonthBounds(competencia: Date): { ini: string; fim: string; key: string } {
  const y = competencia.getFullYear()
  const m = competencia.getMonth()
  const ini = new Date(y, m, 1).toISOString().slice(0, 10)
  const fim = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { ini, fim, key: ini }
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function calcularMetricasMes(
  empresaId: string,
  competencia: Date
): Promise<MetricasFinanceiras> {
  const supabase = getAdminSupabase()
  const { ini, fim, key } = toMonthBounds(competencia)

  const [txRes, despRes, notasRes, lancRes] = await Promise.all([
    supabase.from('transacoes').select('tipo,valor,categoria,data').eq('empresa_id', empresaId).gte('data', ini).lte('data', fim),
    supabase.from('despesas').select('valor,status,data,data_despesa').eq('empresa_id', empresaId).in('status', ['aprovado', 'pago']).gte('data', ini).lte('data', fim),
    supabase.from('notas_emitidas').select('valor_total,status,competencia,created_at').eq('empresa_id', empresaId).eq('status', 'autorizada').gte('created_at', `${ini}T00:00:00`).lte('created_at', `${fim}T23:59:59`).then((r) => ({ data: r.error ? [] : r.data, error: null })),
    supabase.from('lancamentos').select('valor,origem,descricao').eq('empresa_id', empresaId).gte('competencia', ini).lte('competencia', fim).then((r) => ({ data: r.error ? [] : r.data, error: null })),
  ])

  const txs = txRes.data ?? []
  const despesas = despRes.data ?? []
  const notas = notasRes.data ?? []
  const lancs = lancRes.data ?? []

  const receitaTransacoes = txs.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor || 0), 0)
  const receitaNotas = notas.reduce((s, n) => s + Number(n.valor_total || 0), 0)
  const receita_bruta = receitaTransacoes + receitaNotas
  const deducoes = txs.filter((t) => String(t.categoria || '').toLowerCase().includes('impost')).reduce((s, t) => s + Number(t.valor || 0), 0)
  const receita_liquida = receita_bruta - deducoes
  const cmv = txs.filter((t) => ['custo', 'cmv', 'csp'].includes(String(t.categoria || '').toLowerCase())).reduce((s, t) => s + Number(t.valor || 0), 0)
  const lucro_bruto = receita_liquida - cmv
  const despesas_operacionais = despesas.reduce((s, d) => s + Number(d.valor || 0), 0)
  const ebitda = lucro_bruto - despesas_operacionais
  const depreciacao = txs.filter((t) => String(t.categoria || '').toLowerCase().includes('depreci')).reduce((s, t) => s + Number(t.valor || 0), 0)
  const ebit = ebitda - depreciacao
  const receitasFin = txs.filter((t) => String(t.categoria || '').toLowerCase().includes('financeira') && t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor || 0), 0)
  const despesasFin = txs.filter((t) => String(t.categoria || '').toLowerCase().includes('financeira') && t.tipo === 'saida').reduce((s, t) => s + Number(t.valor || 0), 0)
  const resultado_financeiro = receitasFin - despesasFin
  const lair = ebit + resultado_financeiro
  const impostos = txs.filter((t) => String(t.categoria || '').toLowerCase().includes('imposto')).reduce((s, t) => s + Number(t.valor || 0), 0)
  const lucro_liquido = lair - impostos

  const capital_investido = lancs
    .filter((l) => String(l.descricao || '').toLowerCase().includes('aporte') || String(l.descricao || '').toLowerCase().includes('empréstimo'))
    .reduce((s, l) => s + Number(l.valor || 0), 0)
  const ativoTotal = lancs.filter((l) => String(l.descricao || '').toLowerCase().includes('ativo')).reduce((s, l) => s + Number(l.valor || 0), 0)
  const passivoCirc = lancs.filter((l) => String(l.descricao || '').toLowerCase().includes('passivo circulante')).reduce((s, l) => s + Number(l.valor || 0), 0)
  const capital_empregado = ativoTotal - passivoCirc
  const aliquotaIr = 0.34

  const m: MetricasFinanceiras = {
    empresa_id: empresaId,
    competencia: key,
    receita_bruta,
    deducoes,
    receita_liquida,
    cmv,
    lucro_bruto,
    despesas_operacionais,
    ebitda,
    depreciacao,
    ebit,
    resultado_financeiro,
    lair,
    impostos,
    lucro_liquido,
    margem_bruta: pct(lucro_bruto, receita_liquida),
    margem_ebitda: pct(ebitda, receita_liquida),
    margem_liquida: pct(lucro_liquido, receita_liquida),
    roi: pct(lucro_liquido, capital_investido),
    roic: pct(ebit * (1 - aliquotaIr), capital_investido),
    roce: pct(ebit, capital_empregado),
    capital_investido,
    capital_empregado,
  }

  await supabase.from('metricas_financeiras').upsert(m, { onConflict: 'empresa_id,competencia' })
  return m
}

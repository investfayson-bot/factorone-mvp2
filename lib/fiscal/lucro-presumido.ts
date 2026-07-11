/**
 * Lucro Presumido — estimativa simplificada pra comparação com Simples/Real.
 * Percentuais de presunção padrão (IN RFB 1.700/2017, art. 33):
 *   Comércio/Indústria: 8% (IRPJ) / 12% (CSLL)
 *   Serviços em geral:  32% (IRPJ) / 32% (CSLL)
 * IRPJ 15% sobre a base presumida + adicional de 10% sobre o que exceder
 * R$ 20.000/mês. CSLL 9% sobre a base presumida. PIS/COFINS cumulativos
 * (0,65% + 3%) sobre a receita bruta — sem direito a crédito, diferente do
 * Lucro Real. ISS (serviço) ou ICMS (comércio/indústria) entram "por fora",
 * na alíquota informada pelo usuário (é municipal/estadual, não tem tabela
 * nacional única).
 *
 * NÃO considera: substituição tributária, retenções na fonte, contribuições
 * previdenciárias (CPP/INSS patronal sobre a folha — ver
 * lib/fiscal/cpp-patronal.ts, precisa ser somada à parte pra comparar com
 * o Simples), incentivos fiscais setoriais. Também não valida o teto legal
 * de R$ 78 milhões/ano de receita bruta (Lei 9.718/98, art. 13) acima do
 * qual o Presumido deixa de ser opção legal — quem chama esta função
 * precisa checar isso antes de considerar o resultado válido. É uma
 * estimativa pra comparação de regime, não substitui apuração oficial do
 * contador.
 */

export type TipoAtividade = 'comercio' | 'industria' | 'servicos'

const PRESUNCAO: Record<TipoAtividade, { irpj: number; csll: number }> = {
  comercio: { irpj: 0.08, csll: 0.12 },
  industria: { irpj: 0.08, csll: 0.12 },
  servicos: { irpj: 0.32, csll: 0.32 },
}

const LIMITE_MENSAL_ADICIONAL_IRPJ = 20_000
const ALIQUOTA_IRPJ = 0.15
const ALIQUOTA_ADICIONAL_IRPJ = 0.10
const ALIQUOTA_CSLL = 0.09
const ALIQUOTA_PIS = 0.0065
const ALIQUOTA_COFINS = 0.03

export type ItemImposto = { operacao: string; aliquota: number; base: number; imposto: number }

export type ResultadoPresumido = {
  itens: ItemImposto[]
  total: number
  baseIrpj: number
  baseCsll: number
}

/**
 * @param receitaMes receita bruta média mensal
 * @param meses número de meses do período comparado (ex.: 6 = semestre)
 * @param tipoAtividade define os percentuais de presunção
 * @param aliquotaIssIcms alíquota municipal (ISS) ou estadual (ICMS) informada pelo usuário, em decimal (ex.: 0.05 = 5%)
 */
export function calcularPresumido(
  receitaMes: number,
  meses: number,
  tipoAtividade: TipoAtividade,
  aliquotaIssIcms: number
): ResultadoPresumido {
  const receitaPeriodo = receitaMes * meses
  const { irpj: pIrpj, csll: pCsll } = PRESUNCAO[tipoAtividade]

  const baseIrpj = receitaPeriodo * pIrpj
  const baseCsll = receitaPeriodo * pCsll
  const limiteAdicional = LIMITE_MENSAL_ADICIONAL_IRPJ * meses

  const irpjNormal = baseIrpj * ALIQUOTA_IRPJ
  const irpjAdicional = Math.max(0, baseIrpj - limiteAdicional) * ALIQUOTA_ADICIONAL_IRPJ
  const csll = baseCsll * ALIQUOTA_CSLL
  const pis = receitaPeriodo * ALIQUOTA_PIS
  const cofins = receitaPeriodo * ALIQUOTA_COFINS
  const issIcms = receitaPeriodo * aliquotaIssIcms

  const nomeIssIcms = tipoAtividade === 'servicos' ? 'ISS' : 'ICMS'

  const itens: ItemImposto[] = [
    { operacao: `IRPJ (presunção ${(pIrpj * 100).toFixed(0)}%)`, aliquota: ALIQUOTA_IRPJ, base: baseIrpj, imposto: irpjNormal },
    ...(irpjAdicional > 0 ? [{ operacao: 'IRPJ — adicional 10%', aliquota: ALIQUOTA_ADICIONAL_IRPJ, base: Math.max(0, baseIrpj - limiteAdicional), imposto: irpjAdicional }] : []),
    { operacao: `CSLL (presunção ${(pCsll * 100).toFixed(0)}%)`, aliquota: ALIQUOTA_CSLL, base: baseCsll, imposto: csll },
    { operacao: 'PIS (cumulativo)', aliquota: ALIQUOTA_PIS, base: receitaPeriodo, imposto: pis },
    { operacao: 'COFINS (cumulativo)', aliquota: ALIQUOTA_COFINS, base: receitaPeriodo, imposto: cofins },
    { operacao: `${nomeIssIcms} (alíquota informada)`, aliquota: aliquotaIssIcms, base: receitaPeriodo, imposto: issIcms },
  ]

  const total = itens.reduce((s, i) => s + i.imposto, 0)

  return { itens, total, baseIrpj, baseCsll }
}

/**
 * Lucro Real — estimativa simplificada pra comparação com Simples/Presumido.
 * IRPJ 15% sobre o lucro real (receita − despesas dedutíveis) + adicional
 * de 10% sobre o que exceder R$ 20.000/mês. CSLL 9% sobre o lucro real.
 * PIS/COFINS não-cumulativos (1,65% + 7,6%) sobre a receita bruta.
 *
 * LIMITAÇÃO IMPORTANTE: no regime não-cumulativo a empresa tem direito a
 * créditos de PIS/COFINS sobre insumos, energia, aluguel, depreciação etc.
 * Este cálculo NÃO desconta créditos (não temos essa granularidade de
 * despesa) — por isso o PIS/COFINS aqui é um teto, tende a SUPERESTIMAR o
 * imposto real do Lucro Real. Tratar como estimativa conservadora (o Real
 * tende a compensar melhor do que este número sugere), não como valor
 * final — apuração de créditos exige o contador.
 */

export type TipoAtividade = 'comercio' | 'industria' | 'servicos'

const LIMITE_MENSAL_ADICIONAL_IRPJ = 20_000
const ALIQUOTA_IRPJ = 0.15
const ALIQUOTA_ADICIONAL_IRPJ = 0.10
const ALIQUOTA_CSLL = 0.09
const ALIQUOTA_PIS = 0.0165
const ALIQUOTA_COFINS = 0.076

export type ItemImposto = { operacao: string; aliquota: number; base: number; imposto: number }

export type ResultadoReal = {
  itens: ItemImposto[]
  total: number
  lucroReal: number
}

/**
 * @param receitaMes receita bruta média mensal
 * @param despesasMes despesas dedutíveis médias mensais (custos, folha, aluguel etc.)
 * @param meses número de meses do período comparado
 * @param tipoAtividade só define o nome do imposto por fora (ISS/ICMS); a base de cálculo é a mesma
 * @param aliquotaIssIcms alíquota municipal (ISS) ou estadual (ICMS) informada pelo usuário, em decimal
 */
export function calcularReal(
  receitaMes: number,
  despesasMes: number,
  meses: number,
  tipoAtividade: TipoAtividade,
  aliquotaIssIcms: number
): ResultadoReal {
  const receitaPeriodo = receitaMes * meses
  const despesasPeriodo = despesasMes * meses
  const lucroReal = Math.max(0, receitaPeriodo - despesasPeriodo)
  const limiteAdicional = LIMITE_MENSAL_ADICIONAL_IRPJ * meses

  const irpjNormal = lucroReal * ALIQUOTA_IRPJ
  const irpjAdicional = Math.max(0, lucroReal - limiteAdicional) * ALIQUOTA_ADICIONAL_IRPJ
  const csll = lucroReal * ALIQUOTA_CSLL
  const pis = receitaPeriodo * ALIQUOTA_PIS
  const cofins = receitaPeriodo * ALIQUOTA_COFINS
  const issIcms = receitaPeriodo * aliquotaIssIcms

  const nomeIssIcms = tipoAtividade === 'servicos' ? 'ISS' : 'ICMS'

  const itens: ItemImposto[] = [
    { operacao: 'IRPJ (15% sobre lucro real)', aliquota: ALIQUOTA_IRPJ, base: lucroReal, imposto: irpjNormal },
    ...(irpjAdicional > 0 ? [{ operacao: 'IRPJ — adicional 10%', aliquota: ALIQUOTA_ADICIONAL_IRPJ, base: Math.max(0, lucroReal - limiteAdicional), imposto: irpjAdicional }] : []),
    { operacao: 'CSLL (9% sobre lucro real)', aliquota: ALIQUOTA_CSLL, base: lucroReal, imposto: csll },
    { operacao: 'PIS (não-cumulativo, sem créditos)', aliquota: ALIQUOTA_PIS, base: receitaPeriodo, imposto: pis },
    { operacao: 'COFINS (não-cumulativo, sem créditos)', aliquota: ALIQUOTA_COFINS, base: receitaPeriodo, imposto: cofins },
    { operacao: `${nomeIssIcms} (alíquota informada)`, aliquota: aliquotaIssIcms, base: receitaPeriodo, imposto: issIcms },
  ]

  const total = itens.reduce((s, i) => s + i.imposto, 0)

  return { itens, total, lucroReal }
}

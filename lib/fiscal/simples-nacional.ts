/**
 * Simples Nacional 2024 — tabelas e cálculo de DAS.
 * Fonte: LC 123/2006 + Resolução CGSN 140/2018.
 */

export type AnexoSimples = 'I' | 'II' | 'III' | 'IV' | 'V'

type Faixa = {
  limiteInferior: number
  limiteSuperior: number
  aliquotaNominal: number
  parcelaDeducao: number
}

const TABELAS: Record<AnexoSimples, Faixa[]> = {
  // Comércio
  I: [
    { limiteInferior: 0,          limiteSuperior: 180_000,    aliquotaNominal: 0.04,   parcelaDeducao: 0 },
    { limiteInferior: 180_000.01, limiteSuperior: 360_000,    aliquotaNominal: 0.073,  parcelaDeducao: 5_940 },
    { limiteInferior: 360_000.01, limiteSuperior: 720_000,    aliquotaNominal: 0.095,  parcelaDeducao: 13_860 },
    { limiteInferior: 720_000.01, limiteSuperior: 1_800_000,  aliquotaNominal: 0.107,  parcelaDeducao: 22_500 },
    { limiteInferior: 1_800_000.01, limiteSuperior: 3_600_000, aliquotaNominal: 0.143, parcelaDeducao: 87_300 },
    { limiteInferior: 3_600_000.01, limiteSuperior: 4_800_000, aliquotaNominal: 0.19,  parcelaDeducao: 378_000 },
  ],
  // Indústria
  II: [
    { limiteInferior: 0,          limiteSuperior: 180_000,    aliquotaNominal: 0.045,  parcelaDeducao: 0 },
    { limiteInferior: 180_000.01, limiteSuperior: 360_000,    aliquotaNominal: 0.078,  parcelaDeducao: 5_940 },
    { limiteInferior: 360_000.01, limiteSuperior: 720_000,    aliquotaNominal: 0.10,   parcelaDeducao: 13_860 },
    { limiteInferior: 720_000.01, limiteSuperior: 1_800_000,  aliquotaNominal: 0.112,  parcelaDeducao: 22_500 },
    { limiteInferior: 1_800_000.01, limiteSuperior: 3_600_000, aliquotaNominal: 0.147, parcelaDeducao: 85_500 },
    { limiteInferior: 3_600_000.01, limiteSuperior: 4_800_000, aliquotaNominal: 0.30,  parcelaDeducao: 720_000 },
  ],
  // Serviços (maioria)
  III: [
    { limiteInferior: 0,          limiteSuperior: 180_000,    aliquotaNominal: 0.06,   parcelaDeducao: 0 },
    { limiteInferior: 180_000.01, limiteSuperior: 360_000,    aliquotaNominal: 0.112,  parcelaDeducao: 9_360 },
    { limiteInferior: 360_000.01, limiteSuperior: 720_000,    aliquotaNominal: 0.135,  parcelaDeducao: 17_640 },
    { limiteInferior: 720_000.01, limiteSuperior: 1_800_000,  aliquotaNominal: 0.16,   parcelaDeducao: 35_640 },
    { limiteInferior: 1_800_000.01, limiteSuperior: 3_600_000, aliquotaNominal: 0.21,  parcelaDeducao: 125_640 },
    { limiteInferior: 3_600_000.01, limiteSuperior: 4_800_000, aliquotaNominal: 0.33,  parcelaDeducao: 648_000 },
  ],
  // Serviços (advocacia, medicina, etc.)
  IV: [
    { limiteInferior: 0,          limiteSuperior: 180_000,    aliquotaNominal: 0.045,  parcelaDeducao: 0 },
    { limiteInferior: 180_000.01, limiteSuperior: 360_000,    aliquotaNominal: 0.09,   parcelaDeducao: 8_100 },
    { limiteInferior: 360_000.01, limiteSuperior: 720_000,    aliquotaNominal: 0.102,  parcelaDeducao: 12_420 },
    { limiteInferior: 720_000.01, limiteSuperior: 1_800_000,  aliquotaNominal: 0.14,   parcelaDeducao: 39_780 },
    { limiteInferior: 1_800_000.01, limiteSuperior: 3_600_000, aliquotaNominal: 0.22,  parcelaDeducao: 183_780 },
    { limiteInferior: 3_600_000.01, limiteSuperior: 4_800_000, aliquotaNominal: 0.33,  parcelaDeducao: 828_000 },
  ],
  // Serviços (TI, publicidade, etc.)
  V: [
    { limiteInferior: 0,          limiteSuperior: 180_000,    aliquotaNominal: 0.155,  parcelaDeducao: 0 },
    { limiteInferior: 180_000.01, limiteSuperior: 360_000,    aliquotaNominal: 0.18,   parcelaDeducao: 4_500 },
    { limiteInferior: 360_000.01, limiteSuperior: 720_000,    aliquotaNominal: 0.195,  parcelaDeducao: 9_900 },
    { limiteInferior: 720_000.01, limiteSuperior: 1_800_000,  aliquotaNominal: 0.205,  parcelaDeducao: 17_100 },
    { limiteInferior: 1_800_000.01, limiteSuperior: 3_600_000, aliquotaNominal: 0.23,  parcelaDeducao: 62_100 },
    { limiteInferior: 3_600_000.01, limiteSuperior: 4_800_000, aliquotaNominal: 0.305, parcelaDeducao: 540_000 },
  ],
}

export type ResultadoDAS = {
  rbt12: number
  receitaMes: number
  faixa: number
  aliquotaNominal: number
  aliquotaEfetiva: number
  valorDAS: number
  vencimento: string
  competencia: string
  dentroDoLimite: boolean
  alertas: string[]
}

export function calcularDAS(
  receitaMes: number,
  rbt12: number,
  anexo: AnexoSimples = 'III',
  competencia?: string
): ResultadoDAS {
  const dentroDoLimite = rbt12 <= 4_800_000
  const hoje = new Date()
  const comp = competencia || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [ano, mes] = comp.split('-').map(Number)
  const vencimento = `${ano}-${String(mes + 1 > 12 ? 1 : mes + 1).padStart(2, '0')}-20`

  const alertas: string[] = []

  if (!dentroDoLimite) {
    alertas.push('Receita acima do limite do Simples Nacional (R$ 4,8M). Consulte seu contador sobre enquadramento.')
    return {
      rbt12, receitaMes, faixa: 0,
      aliquotaNominal: 0, aliquotaEfetiva: 0, valorDAS: 0,
      vencimento, competencia: comp, dentroDoLimite: false, alertas,
    }
  }

  if (rbt12 === 0) {
    alertas.push('Receita acumulada 12 meses zerada — registre suas transações para cálculo preciso.')
  }

  const tabela = TABELAS[anexo]
  const faixaIdx = tabela.findIndex(f => rbt12 >= f.limiteInferior && rbt12 <= f.limiteSuperior)
  const faixa = faixaIdx === -1 ? tabela.length - 1 : faixaIdx
  const { aliquotaNominal, parcelaDeducao } = tabela[faixa]

  const aliquotaEfetiva = rbt12 > 0 ? (rbt12 * aliquotaNominal - parcelaDeducao) / rbt12 : aliquotaNominal
  const valorDAS = receitaMes * aliquotaEfetiva

  const diasParaVencer = Math.ceil((new Date(vencimento + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
  if (diasParaVencer <= 5 && diasParaVencer >= 0) {
    alertas.push(`DAS vence em ${diasParaVencer === 0 ? 'hoje' : `${diasParaVencer} dia${diasParaVencer > 1 ? 's' : ''}`} (${vencimento.split('-').reverse().join('/')}).`)
  } else if (diasParaVencer < 0) {
    alertas.push(`DAS de ${comp} está em atraso desde ${vencimento.split('-').reverse().join('/')}. Verifique multa e juros.`)
  }

  if (faixa >= 4) {
    alertas.push(`Faixa 5+ do Simples — alíquota elevada (${(aliquotaEfetiva * 100).toFixed(2)}%). Avalie Lucro Presumido.`)
  }

  return {
    rbt12, receitaMes, faixa: faixa + 1,
    aliquotaNominal, aliquotaEfetiva, valorDAS,
    vencimento, competencia: comp, dentroDoLimite: true, alertas,
  }
}

export function projecaoAnual(receitaMesMedia: number, anexo: AnexoSimples = 'III'): number {
  const rbt12Proj = receitaMesMedia * 12
  const { valorDAS } = calcularDAS(receitaMesMedia, rbt12Proj, anexo)
  return valorDAS * 12
}

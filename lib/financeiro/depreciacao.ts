import { differenceInMonths } from 'date-fns'

export type AtivoDepreciacao = {
  valor_aquisicao: number
  valor_residual: number
  vida_util_anos: number
  metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos'
  data_inicio_depreciacao: Date | string
  depreciacao_acumulada: number
  status: 'ativo' | 'em_manutencao' | 'baixado' | 'alienado' | 'perdido'
}

export function calcularDepreciacaoLinear(valorAquisicao: number, valorResidual: number, vidaUtilAnos: number): number {
  const baseDepreciavel = Math.max(valorAquisicao - valorResidual, 0)
  return baseDepreciavel / Math.max(vidaUtilAnos * 12, 1)
}

export function calcularDepreciacaoAcelerada(
  valorAquisicao: number,
  valorResidual: number,
  vidaUtilAnos: number,
  mesAtual: number
): number {
  const taxaLinear = 1 / Math.max(vidaUtilAnos * 12, 1)
  const taxaAcelerada = taxaLinear * 2
  const valorContabilAtual = Math.max(valorAquisicao - valorResidual, 0) * Math.pow(1 - taxaAcelerada, Math.max(mesAtual - 1, 0))
  return Math.max(valorContabilAtual * taxaAcelerada, 0)
}

export function calcularDepreciacaoSomaDigitos(
  valorAquisicao: number,
  valorResidual: number,
  vidaUtilMeses: number,
  mesAtual: number
): number {
  const somaDigitos = (vidaUtilMeses * (vidaUtilMeses + 1)) / 2
  const fator = (vidaUtilMeses - mesAtual + 1) / Math.max(somaDigitos, 1)
  const baseDepreciavel = Math.max(valorAquisicao - valorResidual, 0)
  return Math.max(baseDepreciavel * fator, 0)
}

export function calcularDepreciacaoMes(ativo: AtivoDepreciacao, competencia: Date): number {
  const inicio = new Date(ativo.data_inicio_depreciacao)
  const mesesDesdeInicio = differenceInMonths(competencia, inicio) + 1
  const vidaUtilMeses = ativo.vida_util_anos * 12
  const limiteDepreciacao = Math.max(ativo.valor_aquisicao - ativo.valor_residual, 0)

  if (mesesDesdeInicio <= 0 || mesesDesdeInicio > vidaUtilMeses) return 0
  if (ativo.depreciacao_acumulada >= limiteDepreciacao) return 0
  if (ativo.status !== 'ativo') return 0

  let valor = 0
  switch (ativo.metodo_depreciacao) {
    case 'linear':
      valor = calcularDepreciacaoLinear(ativo.valor_aquisicao, ativo.valor_residual, ativo.vida_util_anos)
      break
    case 'acelerada':
      valor = calcularDepreciacaoAcelerada(ativo.valor_aquisicao, ativo.valor_residual, ativo.vida_util_anos, mesesDesdeInicio)
      break
    case 'soma_digitos':
      valor = calcularDepreciacaoSomaDigitos(ativo.valor_aquisicao, ativo.valor_residual, vidaUtilMeses, mesesDesdeInicio)
      break
  }
  const restante = limiteDepreciacao - ativo.depreciacao_acumulada
  return Math.max(Math.min(valor, restante), 0)
}

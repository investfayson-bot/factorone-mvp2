/**
 * Fator R — LC 123/2006, art. 18, §5º-J/§5º-M. Só se aplica a atividades de
 * serviço que a lei permite tributar pelo Anexo III OU Anexo V (ex.: TI,
 * consultoria, publicidade — não vale pra toda atividade de serviço, e não
 * vale pra comércio/indústria). Fator R = folha de pagamento (com encargos
 * e pró-labore) dos últimos 12 meses ÷ receita bruta dos últimos 12 meses.
 *   Fator R ≥ 28%  → Anexo III (alíquota menor)
 *   Fator R < 28%  → Anexo V (alíquota maior)
 * Enquadrar a atividade certa é responsabilidade do contador — este cálculo
 * só estima o percentual e a margem de segurança, não decide o anexo.
 */

const LIMITE_FATOR_R = 0.28

export type ResultadoFatorR = {
  percentual: number
  anexoSugerido: 'III' | 'V'
  acimaDoLimite: boolean
  margemPontosPercentuais: number
  folhaMensalMinimaParaAnexoIII: number
}

/**
 * @param folha12m folha de pagamento total (salários + encargos + pró-labore) dos últimos 12 meses
 * @param receita12m receita bruta (RBT12) dos últimos 12 meses
 */
export function calcularFatorR(folha12m: number, receita12m: number): ResultadoFatorR {
  const percentual = receita12m > 0 ? folha12m / receita12m : 0
  const acimaDoLimite = percentual >= LIMITE_FATOR_R
  const margemPontosPercentuais = (percentual - LIMITE_FATOR_R) * 100
  const folhaMensalMinimaParaAnexoIII = (receita12m * LIMITE_FATOR_R) / 12

  return {
    percentual,
    anexoSugerido: acimaDoLimite ? 'III' : 'V',
    acimaDoLimite,
    margemPontosPercentuais,
    folhaMensalMinimaParaAnexoIII,
  }
}

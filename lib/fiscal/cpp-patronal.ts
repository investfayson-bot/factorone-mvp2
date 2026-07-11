/**
 * CPP patronal (INSS patronal + RAT + terceiros/Sistema S) sobre a folha —
 * necessária pra comparar Simples × Presumido × Real de forma justa.
 *
 * Nos Anexos I, II, III e V do Simples Nacional a CPP já está embutida na
 * alíquota única do DAS. No Anexo IV do Simples e em Lucro Presumido/Real,
 * a CPP é paga À PARTE, sobre a folha de pagamento (achado do
 * revisor-financeiro, Fase 5 Bloco 4: sem isso, Presumido/Real aparecem
 * artificialmente mais baratos do que são).
 *
 * Alíquota agregada típica: ~20% INSS patronal + RAT (1-3%, aqui 2%) +
 * ~5,8% terceiros (Sistema S/salário-educação/INCRA) ≈ 26,8%. Varia por
 * CNAE/FAP real da empresa — é estimativa, não substitui a folha calculada
 * pelo contador/sistema de RH.
 */
export const ALIQUOTA_CPP_PATRONAL_ESTIMADA = 0.268

export function estimarCppPatronal(folhaMes: number, meses: number): number {
  return Math.max(0, folhaMes) * ALIQUOTA_CPP_PATRONAL_ESTIMADA * meses
}

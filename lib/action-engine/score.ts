import type { TipoEvento } from './types'

// Score determinístico (decisão explícita: não é a IA que prioriza a fila,
// é config auditável). base por tipo + urgência de prazo + impacto
// financeiro (log, não linear) + tempo parado sem ninguém olhar.
const PESO_BASE: Record<TipoEvento, number> = {
  tax_due: 70,
  transaction_received: 30,
  document_uploaded: 20,
}

function pesoPrazo(prazo: string | null): number {
  if (!prazo) return 0
  const dias = Math.floor((new Date(`${prazo}T00:00:00`).getTime() - Date.now()) / 86_400_000)
  if (dias <= 0) return 30
  if (dias <= 2) return 25
  if (dias <= 7) return 12
  return 0
}

function pesoValor(valor: number | null): number {
  if (!valor || valor <= 0) return 0
  return Math.min(20, Math.log10(valor + 1) * 4)
}

function pesoEspera(criadoEm: Date): number {
  const horas = (Date.now() - criadoEm.getTime()) / 3_600_000
  return Math.min(10, (horas / 24) * 2)
}

export function calcularScore(params: {
  tipo: TipoEvento
  prazo: string | null
  impactoValor: number | null
  criadoEm?: Date
}): number {
  const base = PESO_BASE[params.tipo]
  const total = base + pesoPrazo(params.prazo) + pesoValor(params.impactoValor) + pesoEspera(params.criadoEm ?? new Date())
  return Math.round(total)
}

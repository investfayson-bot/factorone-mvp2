import { onlyDigits } from '@/lib/masks'

export function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte string digitada (ex.: "1.234,56") para número. */
export function parseBRLInput(s: string): number {
  const t = s.trim()
  if (!t) return 0
  const normalized = t.replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

/** Formata número para máscara pt-BR ao digitar (sem símbolo R$). */
export function maskBRLInput(value: string): string {
  const d = onlyDigits(value)
  if (!d) return ''
  const n = Number.parseInt(d, 10) / 100
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

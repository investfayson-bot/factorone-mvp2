export type Canal = 'email' | 'site' | 'telegram'
export type Autonomia = 'rascunho' | 'automatico'
export type Regra = {
  id: string
  empresa_id: string
  nome: string | null
  canal: Canal
  criterio: string
  autonomia: Autonomia
  ativa: boolean
  created_at: string
}

/**
 * Casa a primeira regra ativa do canal cujo critério (palavras-chave separadas
 * por vírgula) aparece como substring do texto — case-insensitive. Sem match =
 * null, e quem chama deve tratar isso como autonomia "rascunho" (default seguro).
 */
export function encontrarRegra(regras: Regra[], canal: Canal, texto: string): Regra | null {
  const alvo = texto.toLowerCase()
  const candidatas = regras
    .filter(r => r.ativa && r.canal === canal)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const r of candidatas) {
    const chaves = r.criterio.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    if (chaves.some(k => alvo.includes(k))) return r
  }
  return null
}

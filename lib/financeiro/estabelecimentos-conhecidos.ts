// Reconhecimento determinístico de estabelecimentos muito comuns (streaming,
// telecom) — pedido do Fayson: "ao ver fatura netflix, vivo, disney, [devia
// ir] direto para assinaturas". Sem isso, a primeira ocorrência de cada um
// desses precisaria de uma chamada de IA pra adivinhar a categoria (e podia
// errar, já que nenhuma categoria "Assinaturas" existia antes). Estilo
// QuickBooks: nomes muito conhecidos não esperam a IA nem uma regra
// aprendida — já chegam com confiança alta, só falta o usuário confirmar.
const CONHECIDOS: { matcher: RegExp; categoria: string }[] = [
  { matcher: /(netflix|disney\+?|hbo ?max|amazon prime|globoplay|paramount\+?|youtube premium|deezer|spotify)/i, categoria: 'Assinaturas' },
  { matcher: /\b(vivo|claro|tim|oi|sky)\b/i, categoria: 'Assinaturas' },
]

/** Devolve a categoria conhecida pro estabelecimento, ou null se não reconhecer. */
export function categoriaConhecida(estabelecimento: string): string | null {
  const hit = CONHECIDOS.find(c => c.matcher.test(estabelecimento || ''))
  return hit ? hit.categoria : null
}

export const CATEGORIAS_PADRAO = [
  'Alimentação',
  'Transporte',
  'Hospedagem',
  'Tecnologia/Software',
  'Marketing',
  'Fornecedores',
  'Folha de Pagamento',
  'Impostos/Taxas',
  'Aluguel/Infraestrutura',
  'Consultoria',
  'Material de Escritório',
  'Outros',
]

const SUGESTOES_CATEGORIA: Array<{ matcher: RegExp; categoria: string }> = [
  { matcher: /(uber|99|cabify|taxi|combust|posto|ipiranga|shell)/i, categoria: 'Transporte' },
  { matcher: /(ifood|restaurante|lanch|caf[eé]|padaria|mercado|supermercado)/i, categoria: 'Alimentação' },
  { matcher: /(hotel|airbnb|pousada|booking)/i, categoria: 'Hospedagem' },
  { matcher: /(google|meta|facebook|instagram|ads|tiktok|linkedin ads)/i, categoria: 'Marketing' },
  { matcher: /(netflix|spotify|apple|google cloud|aws|azure|openai|notion|slack|figma|github|software|saas)/i, categoria: 'Tecnologia/Software' },
  { matcher: /(imposto|tributo|darf|simples|taxa|iof|icms|iss)/i, categoria: 'Impostos/Taxas' },
  { matcher: /(aluguel|condom[ií]nio|energia|internet|[áa]gua|luz)/i, categoria: 'Aluguel/Infraestrutura' },
  { matcher: /(consultoria|assessoria|contador|contabil)/i, categoria: 'Consultoria' },
  { matcher: /(fornecedor|compra|insumo|mat[eé]ria.prima)/i, categoria: 'Fornecedores' },
]

export function sugerirCategoriaDespesa(texto: string, categoriasDisponiveis?: string[]): string {
  const base = (categoriasDisponiveis && categoriasDisponiveis.length > 0)
    ? categoriasDisponiveis
    : CATEGORIAS_PADRAO

  const hit = SUGESTOES_CATEGORIA.find((s) => s.matcher.test(texto || ''))
  if (!hit) return base[0] ?? 'Outros'
  return base.find((c) => c.toLowerCase() === hit.categoria.toLowerCase()) ?? hit.categoria
}

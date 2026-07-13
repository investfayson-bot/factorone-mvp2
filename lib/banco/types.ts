// Tipos compartilhados do Banco module (fila, confirmação, categorias).

export const CATEGORIAS = [
  'Alimentação', 'Transporte / Combustível', 'Software / SaaS', 'Assinaturas', 'Marketing',
  'Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Serviços',
  'Receita de vendas', 'Tarifas bancárias', 'Outros',
] as const

export type FilaItem = {
  extrato_id: string
  data: string                       // ISO date
  descricao: string
  tipo: 'credito' | 'debito'
  valor: number
  contraparte_nome: string | null
  contraparte_documento: string | null
  sugestao_categoria: { categoria: string; fonte: 'aprendido' | 'ia' } | null
  // contraparte casou com cadastro existente (débito→fornecedor, crédito→cliente)
  sugestao_cadastro: { tipo: 'fornecedor' | 'cliente'; id: string; nome: string; match: 'cnpj' | 'nome' } | null
  // contraparte NÃO casou → UI oferece criar (só grava no confirmar)
  sugestao_criar: { tipo: 'fornecedor' | 'cliente'; nome: string } | null
  conta_prevista: {
    tipo: 'pagar' | 'receber'; id: string; descricao: string
    valor: number; data_vencimento: string; diffPct: number
  } | null
}

export type ConfirmarItem = {
  extrato_id: string
  categoria: string
  fornecedor_id?: string
  cliente_id?: string
  novo_fornecedor?: { razao_social: string }
  novo_cliente?: { nome: string }
  conta_pagar_id?: string
  conta_receber_id?: string
}

export type ConfirmarResposta = {
  confirmados: { extrato_id: string; transacao_id: string; ja_conciliado?: boolean }[]
  falhas: { extrato_id: string; erro: string }[]
}

// Tipos do Action Engine — ver docs/superpowers/specs/2026-07-15-action-engine-design.md

export type TipoEvento = 'transaction_received' | 'document_uploaded' | 'tax_due'
export type OrigemWorkItem = 'open_finance' | 'documento' | 'obrigacao_fiscal'
export type ResponsavelPapel = 'financeiro' | 'contador' | 'dono'
export type StatusWorkItem = 'aberto' | 'em_analise' | 'resolvido' | 'ignorado'

export type HistoricoEntrada = {
  em: string
  quem: string // 'sistema' | 'ia' | e-mail de quem resolveu manualmente
  acao: string
  detalhe?: Record<string, unknown>
}

export type RegistrarResultadoParams = {
  empresaId: string
  eventoId?: string | null
  tipo: TipoEvento
  origem: OrigemWorkItem
  origemRef: string
  responsavelPapel: ResponsavelPapel
  resolvidoAutomaticamente: boolean
  prazo?: string | null // formato 'YYYY-MM-DD' (sem horário) — usado por calcularScore
  impactoValor?: number | null
  sugestaoIa?: Record<string, unknown> | null
  arquivoPath?: string | null
  decisaoDetalhe?: Record<string, unknown>
}

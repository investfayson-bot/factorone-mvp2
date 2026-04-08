/** Forma usada nas listagens de `transacoes` no client */

export type TransacaoLista = {
  id: string
  data: string
  descricao: string | null
  categoria: string | null
  tipo: 'entrada' | 'saida'
  valor: number | string
  status?: string | null
  due_date?: string | null
}

export function erroDesconhecido(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Erro desconhecido'
}

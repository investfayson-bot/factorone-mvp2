/**
 * Camada de abstração BaaS (Banking as a Service) — provider-agnostic.
 * Um provider (Celcoin, Dock, Swap, Matera, QI Tech…) implementa esta interface.
 * O app fala com `BaaSProvider`, nunca direto com o fornecedor — trocar de BaaS
 * = trocar o adapter, sem mexer nas telas.
 */

export type BaaSEnv = 'sandbox' | 'production'

export type ContaPJInput = {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  email: string
  telefone?: string
  socio: { nome: string; cpf: string; email?: string }
}

export type ContaBancaria = {
  provider: string
  provider_account_id: string
  agencia: string
  numero_conta: string
  digito: string
  status: 'ativa' | 'pendente' | 'bloqueada'
}

export type CartaoInput = {
  provider_account_id: string
  formato: 'virtual' | 'fisico'
  titular_nome: string
  titular_cpf?: string
  limite?: number
}

export type CartaoEmitido = {
  provider: string
  provider_card_id: string
  ultimos4: string
  formato: 'virtual' | 'fisico'
  status: 'ativo' | 'bloqueado' | 'pendente'
}

export type PixInput = {
  provider_account_id: string
  chave: string
  valor: number
  descricao?: string
}

export type PixResultado = {
  provider: string
  provider_tx_id: string
  status: 'processando' | 'concluido' | 'erro'
}

export interface BaaSProvider {
  readonly nome: string
  readonly env: BaaSEnv
  /** true se as credenciais estão configuradas (senão o app usa fluxo simulado). */
  configurado(): boolean

  abrirContaPJ(input: ContaPJInput): Promise<ContaBancaria>
  emitirCartao(input: CartaoInput): Promise<CartaoEmitido>
  bloquearCartao(providerCardId: string, bloquear: boolean): Promise<void>
  consultarSaldo(providerAccountId: string): Promise<{ saldo: number; disponivel: number }>
  enviarPix(input: PixInput): Promise<PixResultado>
}

/** Erro padronizado quando a BaaS não está configurada (sem credenciais). */
export class BaaSNaoConfigurada extends Error {
  constructor(provider: string) {
    super(`BaaS "${provider}" não configurada — defina as credenciais no ambiente.`)
    this.name = 'BaaSNaoConfigurada'
  }
}

import type {
  BaaSProvider, BaaSEnv, ContaPJInput, ContaBancaria, CartaoInput, CartaoEmitido, PixInput, PixResultado,
} from './types'
import { BaaSNaoConfigurada } from './types'

/**
 * Adapter da Celcoin (BaaS). Autenticação = OAuth2 client_credentials.
 * Preencha CELCOIN_CLIENT_ID / CELCOIN_CLIENT_SECRET / CELCOIN_ENV no ambiente
 * quando o contrato fechar. Os endpoints exatos de conta/cartão/PIX são
 * finalizados com a documentação oficial da Celcoin (marcados com TODO).
 */
const BASES: Record<BaaSEnv, string> = {
  sandbox: 'https://sandbox.openfinance.celcoin.dev',
  production: 'https://openfinance.celcoin.dev',
}

export class CelcoinProvider implements BaaSProvider {
  readonly nome = 'celcoin'
  readonly env: BaaSEnv
  private clientId = process.env.CELCOIN_CLIENT_ID || ''
  private clientSecret = process.env.CELCOIN_CLIENT_SECRET || ''
  private token: { value: string; exp: number } | null = null

  constructor() {
    this.env = (process.env.CELCOIN_ENV as BaaSEnv) === 'production' ? 'production' : 'sandbox'
  }

  configurado(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  }

  private base(): string { return BASES[this.env] }

  /** OAuth2 client_credentials — retorna e cacheia o access_token. */
  private async getToken(): Promise<string> {
    if (!this.configurado()) throw new BaaSNaoConfigurada(this.nome)
    if (this.token && this.token.exp > Date.now() + 30_000) return this.token.value

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })
    const res = await fetch(`${this.base()}/v5/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`Celcoin auth falhou (${res.status})`)
    const d = (await res.json()) as { access_token: string; expires_in?: number }
    this.token = { value: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 }
    return this.token.value
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken()
    const res = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error((data && (data.message || data.error)) || `Celcoin error ${res.status}`)
    return data as T
  }

  // ── Métodos do produto ──────────────────────────────────────────────
  // Estrutura pronta; completar payload/endpoint exato com a doc da Celcoin.

  async abrirContaPJ(input: ContaPJInput): Promise<ContaBancaria> {
    // TODO(celcoin): POST /baas/v2/account/business — mapear input -> payload deles.
    void input
    throw new Error('Celcoin.abrirContaPJ: completar com a doc oficial da Celcoin')
  }

  async emitirCartao(input: CartaoInput): Promise<CartaoEmitido> {
    // TODO(celcoin): POST /card-issuing/v1/cards — físico/virtual.
    void input
    throw new Error('Celcoin.emitirCartao: completar com a doc oficial da Celcoin')
  }

  async bloquearCartao(providerCardId: string, bloquear: boolean): Promise<void> {
    // TODO(celcoin): PATCH /card-issuing/v1/cards/{id}/status
    void providerCardId; void bloquear
    throw new Error('Celcoin.bloquearCartao: completar com a doc oficial da Celcoin')
  }

  async consultarSaldo(providerAccountId: string): Promise<{ saldo: number; disponivel: number }> {
    // TODO(celcoin): GET /baas/v2/account/{id}/balance
    void providerAccountId
    throw new Error('Celcoin.consultarSaldo: completar com a doc oficial da Celcoin')
  }

  async enviarPix(input: PixInput): Promise<PixResultado> {
    // TODO(celcoin): POST /pix/v1/payment
    void input
    throw new Error('Celcoin.enviarPix: completar com a doc oficial da Celcoin')
  }
}

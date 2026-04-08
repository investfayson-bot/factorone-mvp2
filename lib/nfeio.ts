/**
 * NFe.io — URLs e erros. Endpoints reais podem variar (v1/v2); ajuste via env.
 */

export function isSandboxMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NFEIO_SANDBOX === 'true'
}

/** Base para NFS-e e operações comuns (docs NFe.io) */
export function getNfeioServiceBaseUrl(): string {
  if (process.env.NFEIO_SERVICE_BASE_URL) return process.env.NFEIO_SERVICE_BASE_URL
  return isSandboxMode() ? 'https://sandbox.api.nfe.io' : 'https://api.nfe.io'
}

/** Base para NF-e produto (documentação usa api.nfse.io para product invoices) */
export function getNfeioProductBaseUrl(): string {
  if (process.env.NFEIO_PRODUCT_BASE_URL) return process.env.NFEIO_PRODUCT_BASE_URL
  return isSandboxMode() ? 'https://sandbox.api.nfse.io' : 'https://api.nfse.io'
}

export function getNfeioApiKey(): string {
  return (
    process.env.NFEIO_API_KEY ||
    process.env.NEXT_PUBLIC_NFEIO_API_KEY ||
    ''
  ).trim()
}

export function getNfeioCompanyId(): string {
  return (process.env.NFEIO_COMPANY_ID || '').trim()
}

export function mapSefazMessage(code: number | string | undefined, fallback: string): string {
  const c = Number(code)
  const map: Record<number, string> = {
    202: 'Nota processando — aguarde autorização automática.',
    225: 'CNPJ do destinatário inválido — verifique e tente novamente.',
    539: 'Nota duplicada — já existe nota com esses dados.',
    999: 'Serviço SEFAZ indisponível — tente em alguns minutos.',
  }
  if (!Number.isNaN(c) && map[c]) return map[c]
  return fallback
}

export function authorizationHeader(): Record<string, string> {
  const key = getNfeioApiKey()
  return key ? { Authorization: key } : {}
}

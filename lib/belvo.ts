/**
 * Helper da Belvo (Open Finance).
 * Auth = HTTP Basic com BELVO_SECRET_ID:BELVO_SECRET_PASSWORD.
 * Base por ambiente via BELVO_ENV (sandbox | development | production).
 */

const BASES: Record<string, string> = {
  sandbox: 'https://sandbox.belvo.com',
  development: 'https://development.belvo.com',
  production: 'https://api.belvo.com',
}

export function belvoBase(): string {
  return BASES[process.env.BELVO_ENV || 'sandbox'] || BASES.sandbox
}

function authHeader(): string {
  const id = process.env.BELVO_SECRET_ID
  const pw = process.env.BELVO_SECRET_PASSWORD
  if (!id || !pw) throw new Error('BELVO_SECRET_ID/BELVO_SECRET_PASSWORD não configurados')
  return 'Basic ' + Buffer.from(`${id}:${pw}`).toString('base64')
}

export async function belvoFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${belvoBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    // Erros da Belvo vêm como array de { message, code } ou objeto { detail }
    const msg = Array.isArray(data)
      ? (data[0]?.message || JSON.stringify(data))
      : (data?.detail || data?.message || `Belvo error ${res.status}`)
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data as T
}

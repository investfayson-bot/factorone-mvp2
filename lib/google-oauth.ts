import crypto from 'crypto'

// Escopos do acessor completo (pedido do Fayson 2026-07-11): Gmail (ler/
// responder), Calendar (agendar de verdade), Drive.file (criar docs/
// apresentações — só arquivos criados pelo app, não o Drive inteiro).
// Ampliar escopo exige reconectar a conta Google — por isso já vai tudo
// junto antes da primeira conexão.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')
const ESTADO_TTL_MS = 10 * 60 * 1000

export function appUrl(reqOrigin?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || reqOrigin || 'https://factorone-mvp2.vercel.app'
}

export function redirectUri(reqOrigin?: string): string {
  return `${appUrl(reqOrigin)}/api/google/oauth/callback`
}

function segredo(): string {
  const s = process.env.COFRE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('COFRE_SECRET_KEY não configurada')
  return s
}

// state assinado (HMAC) — sem tabela extra pra guardar estado de OAuth em trânsito.
export function assinarEstado(empresaId: string): string {
  const payload = JSON.stringify({ empresaId, exp: Date.now() + ESTADO_TTL_MS })
  const b64 = Buffer.from(payload, 'utf8').toString('base64url')
  const assinatura = crypto.createHmac('sha256', segredo()).update(b64).digest('base64url')
  return `${b64}.${assinatura}`
}

export function validarEstado(state: string): { empresaId: string } | null {
  const [b64, assinatura] = (state || '').split('.')
  if (!b64 || !assinatura) return null
  const esperado = crypto.createHmac('sha256', segredo()).update(b64).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return null
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as { empresaId: string; exp: number }
    if (payload.exp < Date.now()) return null
    return { empresaId: payload.empresaId }
  } catch {
    return null
  }
}

export function criarUrlAutorizacao(empresaId: string, reqOrigin?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(reqOrigin),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: assinarEstado(empresaId),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function trocarCodigoPorToken(code: string, reqOrigin?: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri(reqOrigin),
      grant_type: 'authorization_code',
    }),
  })
  if (!r.ok) throw new Error(`Falha ao trocar código por token: ${await r.text()}`)
  return r.json()
}

export async function renovarAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  })
  if (!r.ok) throw new Error(`Falha ao renovar access token: ${await r.text()}`)
  return r.json()
}

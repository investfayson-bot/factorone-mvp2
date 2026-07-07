import crypto from 'crypto'

/**
 * Criptografia simétrica do Cofre (senhas + chaves de API).
 * AES-256-GCM: cada valor grava seu próprio IV + auth tag junto do ciphertext,
 * então nada de estado extra precisa ser guardado à parte no banco.
 * Chave: COFRE_SECRET_KEY (32 bytes) — se ausente, cai no fallback derivado do
 * service role key só pra não quebrar localmente sem .env completo.
 */

function chave(): Buffer {
  const secret = process.env.COFRE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!secret) throw new Error('COFRE_SECRET_KEY não configurada')
  return crypto.createHash('sha256').update(secret).digest()
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv)
  const ciphertext = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decifrar(valorCifrado: string): string {
  const buf = Buffer.from(valorCifrado, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function mascarar(texto: string): string {
  if (texto.length <= 4) return '••••'
  return `••••${texto.slice(-4)}`
}

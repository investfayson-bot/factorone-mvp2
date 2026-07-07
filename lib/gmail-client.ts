// Wrapper fino sobre a Gmail REST API via fetch puro — mesmo estilo dos
// helpers sendWhatsApp/sendTelegram do projeto (sem SDK googleapis).

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export type MensagemResumo = { id: string; threadId: string }
export type MensagemCompleta = {
  id: string
  threadId: string
  remetente: string
  assunto: string
  corpoTexto: string
  snippet: string
}

export async function listarNaoLidas(accessToken: string, maxResults = 20): Promise<MensagemResumo[]> {
  const url = `${BASE}/messages?${new URLSearchParams({ q: 'in:inbox is:unread', maxResults: String(maxResults) })}`
  const r = await fetch(url, { headers: auth(accessToken) })
  if (!r.ok) throw new Error(`Gmail list falhou: ${await r.text()}`)
  const j = await r.json() as { messages?: MensagemResumo[] }
  return j.messages ?? []
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extrairCorpo(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  type Parte = { mimeType?: string; body?: { data?: string }; parts?: Parte[] }
  const p = payload as Parte
  if (p.mimeType === 'text/plain' && p.body?.data) return decodeBase64Url(p.body.data)
  if (p.parts) {
    for (const parte of p.parts) {
      if (parte.mimeType === 'text/plain' && parte.body?.data) return decodeBase64Url(parte.body.data)
    }
    for (const parte of p.parts) {
      const achado = extrairCorpo(parte)
      if (achado) return achado
    }
  }
  if (p.mimeType === 'text/html' && p.body?.data) return decodeBase64Url(p.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return ''
}

export async function obterMensagem(accessToken: string, id: string): Promise<MensagemCompleta> {
  const r = await fetch(`${BASE}/messages/${id}?format=full`, { headers: auth(accessToken) })
  if (!r.ok) throw new Error(`Gmail get falhou: ${await r.text()}`)
  const j = await r.json() as { id: string; threadId: string; snippet?: string; payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown[] } }
  const headers = j.payload?.headers ?? []
  const h = (nome: string) => headers.find(x => x.name.toLowerCase() === nome.toLowerCase())?.value ?? ''
  return {
    id: j.id,
    threadId: j.threadId,
    remetente: h('From'),
    assunto: h('Subject'),
    corpoTexto: j.payload ? extrairCorpo(j.payload).slice(0, 4000) : '',
    snippet: j.snippet ?? '',
  }
}

function criarRawEmail(opts: { to: string; from: string; subject: string; bodyText: string; threadHeaders?: { inReplyTo?: string; references?: string } }): string {
  const linhas = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ]
  if (opts.threadHeaders?.inReplyTo) linhas.push(`In-Reply-To: ${opts.threadHeaders.inReplyTo}`)
  if (opts.threadHeaders?.references) linhas.push(`References: ${opts.threadHeaders.references}`)
  linhas.push('', opts.bodyText)
  const raw = linhas.join('\r\n')
  return Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function enviarResposta(accessToken: string, opts: { to: string; from: string; subject: string; bodyText: string; threadId?: string; messageIdHeader?: string }): Promise<string> {
  const raw = criarRawEmail({
    to: opts.to,
    from: opts.from,
    subject: opts.subject.startsWith('Re:') ? opts.subject : `Re: ${opts.subject}`,
    bodyText: opts.bodyText,
    threadHeaders: opts.messageIdHeader ? { inReplyTo: opts.messageIdHeader, references: opts.messageIdHeader } : undefined,
  })
  const r = await fetch(`${BASE}/messages/send`, {
    method: 'POST',
    headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, threadId: opts.threadId }),
  })
  if (!r.ok) throw new Error(`Gmail send falhou: ${await r.text()}`)
  const j = await r.json() as { id: string }
  return j.id
}

export async function arquivarEModificar(accessToken: string, id: string, opts: { removeLabelIds?: string[]; addLabelIds?: string[] }): Promise<void> {
  const r = await fetch(`${BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: opts.removeLabelIds ?? [], addLabelIds: opts.addLabelIds ?? [] }),
  })
  if (!r.ok) throw new Error(`Gmail modify falhou: ${await r.text()}`)
}

export async function marcarComoLida(accessToken: string, id: string): Promise<void> {
  return arquivarEModificar(accessToken, id, { removeLabelIds: ['UNREAD'] })
}

export async function arquivar(accessToken: string, id: string): Promise<void> {
  return arquivarEModificar(accessToken, id, { removeLabelIds: ['UNREAD', 'INBOX'] })
}

export async function obterPerfil(accessToken: string): Promise<{ emailAddress: string }> {
  const r = await fetch(`${BASE}/profile`, { headers: auth(accessToken) })
  if (!r.ok) throw new Error(`Gmail profile falhou: ${await r.text()}`)
  return r.json()
}

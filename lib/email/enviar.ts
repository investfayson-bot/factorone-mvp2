// Envio de e-mail com fallback: tenta Resend (provedor principal) e, se
// falhar — ex.: domínio ainda não verificado —, cai pro Mailtrap
// (MAILTRAP_TOKEN/MAILTRAP_FROM). Devolve qual provedor saiu e o erro real
// de cada tentativa, nunca sucesso de mentira.
//
// Atenção Mailtrap: o domínio demo (demomailtrap.co) só entrega pro e-mail
// do dono da conta — serve pra teste; produção de verdade exige domínio
// próprio verificado lá também.

export type ResultadoEnvio = { ok: boolean; provedor?: 'resend' | 'mailtrap'; erro?: string }

export type AnexoEmail = { filename: string; conteudoBase64: string; tipo: string }

export async function enviarEmail(opts: { para: string; assunto: string; html: string; anexos?: AnexoEmail[] }): Promise<ResultadoEnvio> {
  const erros: string[] = []

  // EMAIL_PROVIDER=mailtrap pula o Resend (pedido do Fayson enquanto o
  // domínio não verifica lá). Tirar a env volta pro fluxo Resend→Mailtrap.
  const soMailtrap = process.env.EMAIL_PROVIDER === 'mailtrap'

  if (!soMailtrap && process.env.RESEND_API_KEY) {
    try {
      const Resend = (await import('resend')).Resend
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'FactorOne <onboarding@resend.dev>',
        to: opts.para,
        subject: opts.assunto,
        html: opts.html,
        attachments: (opts.anexos ?? []).map(a => ({ filename: a.filename, content: a.conteudoBase64 })),
      })
      if (!error) return { ok: true, provedor: 'resend' }
      erros.push(`Resend: ${error.message ?? 'falha'}`)
    } catch (e) {
      erros.push(`Resend: ${e instanceof Error ? e.message : 'falha'}`)
    }
  }

  if (process.env.MAILTRAP_TOKEN) {
    try {
      // From "Nome <email>" pro formato da API do Mailtrap
      const fromRaw = process.env.MAILTRAP_FROM || 'FactorOne <hello@demomailtrap.co>'
      const m = fromRaw.match(/^(.*?)\s*<(.+)>$/)
      const from = m ? { name: m[1].trim() || 'FactorOne', email: m[2].trim() } : { name: 'FactorOne', email: fromRaw.trim() }

      const res = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MAILTRAP_TOKEN}` },
        body: JSON.stringify({
          from,
          to: [{ email: opts.para }],
          subject: opts.assunto,
          html: opts.html,
          attachments: (opts.anexos ?? []).map(a => ({ filename: a.filename, content: a.conteudoBase64, type: a.tipo, disposition: 'attachment' })),
        }),
      })
      if (res.ok) return { ok: true, provedor: 'mailtrap' }
      const body = await res.text().catch(() => '')
      erros.push(`Mailtrap: HTTP ${res.status}${body ? ` ${body.slice(0, 200)}` : ''}`)
    } catch (e) {
      erros.push(`Mailtrap: ${e instanceof Error ? e.message : 'falha'}`)
    }
  }

  if (erros.length === 0) return { ok: false, erro: 'Nenhum provedor de e-mail configurado (RESEND_API_KEY/MAILTRAP_TOKEN)' }
  return { ok: false, erro: erros.join(' | ') }
}

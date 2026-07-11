import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, getPapelAtivo } from '@/lib/supabase-route'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = ur?.empresa_id ?? user.id

  // Só papel 'admin' pode convidar/alterar equipe. Fonte AUTORITATIVA: usuario_empresas
  // (por user_id). Fecha o fail-open antigo (checava por e-mail em membros_equipe; quem
  // não tinha registro — ex.: contador — passava como admin) e barra escalada de papel.
  const papel = await getPapelAtivo(supabase, user.id)
  if (papel !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Admin pode convidar membros.' }, { status: 403 })
  }

  const { email: emailRaw, nome, role } = await req.json() as { email: string; nome?: string; role: string }
  const email = String(emailRaw ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

  const ROLES_VALIDAS = new Set(['admin', 'financeiro', 'comercial', 'operacional', 'logistica', 'viewer', 'contador'])
  if (!ROLES_VALIDAS.has(role)) return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const { error } = await supabase.from('membros_equipe').upsert({
    empresa_id: empresaId,
    email,
    nome: nome || null,
    role,
    status: 'pendente',
    token,
    expires_at: expiresAt,
    convidado_por: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_id,email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envia o convite via Resend. Bugs corrigidos aqui: (1) o from era um
  // domínio hardcoded não verificado no Resend — o envio falhava sempre;
  // (2) o erro do send era engolido e a UI dizia "convite enviado" mesmo
  // sem e-mail sair. Agora usa RESEND_FROM (domínio verificado, mesmo das
  // rotas de cobrança/notas) e reporta email_enviado de verdade.
  const resendKey = process.env.RESEND_API_KEY
  let emailEnviado = false
  let emailErro: string | null = null
  if (resendKey) {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('origin') ?? 'https://factorone-mvp2.vercel.app'
    const linkAceite = `${origin}/equipe/aceitar/${token}`

    const { data: emp } = await supabase.from('empresas').select('nome').eq('id', empresaId).maybeSingle()
    const nomeEmpresa = (emp?.nome as string) || 'FactorOne'

    const ROLE_LABELS: Record<string, string> = {
      admin: 'Administrador', financeiro: 'Financeiro', comercial: 'Comercial',
      operacional: 'Operacional', logistica: 'Logística', viewer: 'Visualização', contador: 'Contador (leitura)',
    }
    const roleLabel = ROLE_LABELS[role] ?? role

    const Resend = (await import('resend')).Resend
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'FactorOne <onboarding@resend.dev>',
      to: email,
      subject: `Você foi convidado para a equipe ${nomeEmpresa} no FactorOne`,
      html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4ef;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4ef;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e2d9;overflow:hidden">
        <tr>
          <td style="background:#0C1D16;padding:22px 32px">
            <div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.01em">Factor<span style="color:#4ADE80">One</span></div>
            <div style="color:#9FC3BB;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Finance OS</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0;line-height:0">
            <img src="${origin}/img/team-working.png" alt="" width="560" style="width:100%;max-width:560px;height:auto;display:block" />
          </td>
        </tr>
        <tr>
          <td style="padding:30px 32px 8px">
            <h1 style="margin:0 0 10px;font-size:21px;font-weight:800;color:#13201D;letter-spacing:-.01em">Você foi convidado!</h1>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#3C4A46">
              <strong>${user.email}</strong> convidou você para acessar a empresa
              <strong>${nomeEmpresa}</strong> no FactorOne com o papel de <strong>${roleLabel}</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr>
              <td style="background:#16A34A;border-radius:10px">
                <a href="${linkAceite}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px">Aceitar convite →</a>
              </td>
            </tr></table>
            <p style="margin:0 0 6px;font-size:12px;color:#7B8C88;line-height:1.6">
              O botão não funcionou? Copie e cole este link no navegador:<br/>
              <a href="${linkAceite}" style="color:#16A34A;word-break:break-all">${linkAceite}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 22px;border-top:1px solid #f0ede4">
            <p style="margin:0;font-size:11px;color:#9AA6A2;line-height:1.6">
              Este link expira em 7 dias. Se você não reconhece este convite, ignore este e-mail.<br/>
              Enviado para ${email} · FactorOne Finance OS
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    })
    emailEnviado = !sendError
    emailErro = sendError ? (sendError.message ?? 'Falha no envio') : null
  }

  return NextResponse.json({ ok: true, email_enviado: emailEnviado, email_erro: emailErro })
}

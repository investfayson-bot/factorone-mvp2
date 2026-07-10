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

  // Send email via Resend if configured
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const origin = req.headers.get('origin') ?? 'https://factorone-mvp2.vercel.app'
    const linkAceite = `${origin}/equipe/aceitar/${token}`

    const { data: emp } = await supabase.from('empresas').select('nome').eq('id', empresaId).maybeSingle()
    const nomeEmpresa = (emp?.nome as string) || 'FactorOne'

    const Resend = (await import('resend')).Resend
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: 'FactorOne <noreply@factoroneapp.com.br>',
      to: email,
      subject: `Você foi convidado para a equipe ${nomeEmpresa} no FactorOne`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="font-size: 22px; font-weight: 800; color: #0d1b2a; margin-bottom: 8px;">
            Factor<span style="color: var(--teal)">One</span>
          </div>
          <h2 style="color: #0d1b2a; margin: 24px 0 8px;">Você foi convidado!</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            <strong>${user.email}</strong> convidou você para acessar o workspace <strong>${nomeEmpresa}</strong> no FactorOne com o role de <strong>${role}</strong>.
          </p>
          <a href="${linkAceite}" style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: var(--teal); color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
            Aceitar convite →
          </a>
          <p style="color: #94a3b8; font-size: 12px;">Este link expira em 7 dias. Se não reconhece este convite, ignore este e-mail.</p>
        </div>`,
    })
  }

  return NextResponse.json({ ok: true })
}

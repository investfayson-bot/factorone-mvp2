import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Reenviar um documento do Cofre por e-mail (botão da spec/mockup). Manda
// um link assinado de 24h — não anexa o arquivo (limite de tamanho e o
// e-mail fica leve). Mesmo padrão honesto do convite: se o Resend falhar,
// devolve o erro real em vez de fingir sucesso.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Envio de e-mail não configurado (RESEND_API_KEY)' }, { status: 500 })

  const body = await req.json().catch(() => ({})) as { email?: string }
  const destino = String(body.email ?? '').trim().toLowerCase() || user.email
  if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) return NextResponse.json({ error: 'E-mail de destino inválido' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: doc } = await service
    .from('cofre_fiscal_documentos')
    .select('nome, descricao, competencia, arquivo_path')
    .eq('id', id).eq('empresa_id', empresaId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  if (!doc.arquivo_path) return NextResponse.json({ error: 'Documento sem arquivo anexado' }, { status: 400 })

  const { data: signed, error: signError } = await service.storage.from('recibos').createSignedUrl(doc.arquivo_path, 24 * 3600)
  if (signError || !signed?.signedUrl) return NextResponse.json({ error: signError?.message ?? 'Falha ao gerar link' }, { status: 500 })

  const { data: emp } = await service.from('empresas').select('nome').eq('id', empresaId).maybeSingle()
  const nomeEmpresa = (emp?.nome as string) || 'FactorOne'

  const Resend = (await import('resend')).Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'FactorOne <onboarding@resend.dev>',
    to: destino,
    subject: `Documento fiscal — ${doc.nome} (${nomeEmpresa})`,
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4ef;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4ef;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e2d9;overflow:hidden">
        <tr><td style="background:#0C1D16;padding:22px 32px">
          <div style="color:#ffffff;font-size:20px;font-weight:800">Factor<span style="color:#4ADE80">One</span></div>
          <div style="color:#9FC3BB;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Cofre Fiscal</div>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <h1 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#13201D">${doc.nome}</h1>
          <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#3C4A46">
            ${doc.descricao ? `${doc.descricao}<br/>` : ''}
            ${doc.competencia ? `Competência: ${doc.competencia} · ` : ''}Empresa: ${nomeEmpresa}
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#16A34A;border-radius:10px">
            <a href="${signed.signedUrl}" style="display:inline-block;padding:12px 26px;color:#ffffff;text-decoration:none;font-weight:700;font-size:13.5px">Abrir documento →</a>
          </td></tr></table>
          <p style="margin:14px 0 0;font-size:11.5px;color:#7B8C88">O link expira em 24 horas.</p>
        </td></tr>
        <tr><td style="padding:14px 32px 20px;border-top:1px solid #f0ede4">
          <p style="margin:0;font-size:11px;color:#9AA6A2">Enviado por ${user.email} via FactorOne Finance OS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  })

  if (sendError) return NextResponse.json({ error: sendError.message ?? 'Falha no envio' }, { status: 502 })
  return NextResponse.json({ ok: true, destino })
}

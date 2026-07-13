import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, getPapelAtivo } from '@/lib/supabase-route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate: só admin pode remover/revogar membros
  const papel = await getPapelAtivo(supabase, user.id)
  if (papel !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Admin pode remover membros.' }, { status: 403 })
  }

  const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = ur?.empresa_id ?? user.id

  const { membroId } = await req.json() as { membroId: string }
  if (!membroId) return NextResponse.json({ error: 'membroId obrigatório' }, { status: 400 })

  // Buscar o membro para pegar email e user_id
  const { data: membro } = await supabase.from('membros_equipe').select('email,user_id').eq('id', membroId).eq('empresa_id', empresaId).maybeSingle()
  if (!membro) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  // 1. Revogar em membros_equipe
  const { error: eRevoke } = await supabase.from('membros_equipe').update({ status: 'revogado' }).eq('id', membroId).eq('empresa_id', empresaId)
  if (eRevoke) return NextResponse.json({ error: eRevoke.message }, { status: 500 })

  // 2. Remover acesso em usuario_empresas se existir (contador pode ter sido aceito e criou acesso)
  if (membro.user_id) {
    await supabase.from('usuario_empresas').delete().eq('user_id', membro.user_id).eq('empresa_id', empresaId)
  }

  // 3. Enviar e-mail de aviso
  {
    const { data: emp } = await supabase.from('empresas').select('nome').eq('id', empresaId).maybeSingle()
    const nomeEmpresa = (emp?.nome as string) || 'FactorOne'

    const { enviarEmail } = await import('@/lib/email/enviar')
    await enviarEmail({
      para: membro.email,
      assunto: `Seu acesso foi desconectado — ${nomeEmpresa} no FactorOne`,
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
          <td style="padding:30px 32px">
            <h1 style="margin:0 0 10px;font-size:21px;font-weight:800;color:#13201D;letter-spacing:-.01em">Acesso desconectado</h1>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#3C4A46">
              Seu acesso ao FactorOne para a empresa <strong>${nomeEmpresa}</strong> foi desconectado.
            </p>
            <p style="margin:0 0 6px;font-size:12px;color:#7B8C88;line-height:1.6">
              Se você acredita que isso foi um erro, entre em contato com o administrador da empresa.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 22px;border-top:1px solid #f0ede4">
            <p style="margin:0;font-size:11px;color:#9AA6A2;line-height:1.6">
              Enviado para ${membro.email} · FactorOne Finance OS
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    })
  }

  return NextResponse.json({ ok: true })
}

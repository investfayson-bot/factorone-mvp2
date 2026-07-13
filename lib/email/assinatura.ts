const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://factorone-mvp2.vercel.app'

// Assinatura institucional (não uma pessoa) — todo e-mail de sistema sai do
// contato@factorone.com.br, então assina como o departamento, não como um
// nome fictício. Ver docs/factorone-cursor-package/design-reference pro
// tom visual (mesma marca verde do app).
export function rodapeAssinatura(para: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td style="width:52px;vertical-align:top;padding-right:12px">
          <img src="${APP_URL}/img/logo-email.png" width="40" height="40" style="border-radius:10px;display:block" alt="FactorOne" />
        </td>
        <td style="vertical-align:top">
          <div style="font-size:13px;font-weight:700;color:#111C16">Equipe FactorOne</div>
          <div style="font-size:11.5px;color:#16A34A;font-weight:700;margin:1px 0 6px">Central de Atendimento</div>
          <div style="font-size:11px;color:#64748b">
            <a href="mailto:contato@factorone.com.br" style="color:#64748b;text-decoration:none">contato@factorone.com.br</a>
            &nbsp;·&nbsp;
            <a href="https://factorone.com.br" style="color:#64748b;text-decoration:none">factorone.com.br</a>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:10.5px;color:#94a3b8">Este email foi enviado para ${para} · FactorOne Finance OS</p>`
}

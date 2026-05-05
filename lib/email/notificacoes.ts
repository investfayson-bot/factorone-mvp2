import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'FactorOne <notificacoes@factorone.com.br>'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export type TipoNotificacao =
  | 'reembolso_solicitado'
  | 'reembolso_aprovado'
  | 'reembolso_rejeitado'
  | 'reembolso_pago'
  | 'despesa_pendente'
  | 'despesa_aprovada'
  | 'despesa_rejeitada'

interface EnviarNotificacaoParams {
  tipo: TipoNotificacao
  para: string
  dados: {
    nome?: string
    descricao: string
    valor: number
    categoria?: string
    solicitante?: string
    motivo?: string
  }
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CONFIGS: Record<TipoNotificacao, { assunto: string; titulo: string; cor: string; mensagem: (d: EnviarNotificacaoParams['dados']) => string }> = {
  reembolso_solicitado: {
    assunto: 'Nova solicitação de reembolso aguarda aprovação',
    titulo: 'Reembolso solicitado',
    cor: '#b8922a',
    mensagem: d => `<strong>${d.solicitante || 'Um colaborador'}</strong> solicitou reembolso de <strong>${formatBRL(d.valor)}</strong> referente a <em>${d.descricao}</em>. Acesse o FactorOne para aprovar ou rejeitar.`,
  },
  reembolso_aprovado: {
    assunto: 'Seu reembolso foi aprovado',
    titulo: 'Reembolso aprovado',
    cor: '#2d9b6f',
    mensagem: d => `Seu reembolso de <strong>${formatBRL(d.valor)}</strong> referente a <em>${d.descricao}</em> foi <strong>aprovado</strong>. O pagamento será processado em breve.`,
  },
  reembolso_rejeitado: {
    assunto: 'Seu reembolso foi rejeitado',
    titulo: 'Reembolso rejeitado',
    cor: '#c0504a',
    mensagem: d => `Seu reembolso de <strong>${formatBRL(d.valor)}</strong> referente a <em>${d.descricao}</em> foi <strong>rejeitado</strong>.${d.motivo ? ` Motivo: ${d.motivo}` : ''}`,
  },
  reembolso_pago: {
    assunto: 'Reembolso pago — pagamento confirmado',
    titulo: 'Pagamento confirmado',
    cor: '#2d9b6f',
    mensagem: d => `O reembolso de <strong>${formatBRL(d.valor)}</strong> referente a <em>${d.descricao}</em> foi <strong>pago</strong> e lançado no sistema.`,
  },
  despesa_pendente: {
    assunto: 'Despesa aguardando sua aprovação',
    titulo: 'Despesa para aprovação',
    cor: '#b8922a',
    mensagem: d => `A despesa <em>${d.descricao}</em> no valor de <strong>${formatBRL(d.valor)}</strong>${d.categoria ? ` (${d.categoria})` : ''} aguarda sua aprovação. Acesse a Central de Aprovações no FactorOne.`,
  },
  despesa_aprovada: {
    assunto: 'Sua despesa foi aprovada',
    titulo: 'Despesa aprovada',
    cor: '#2d9b6f',
    mensagem: d => `A despesa <em>${d.descricao}</em> de <strong>${formatBRL(d.valor)}</strong> foi <strong>aprovada</strong>.`,
  },
  despesa_rejeitada: {
    assunto: 'Sua despesa foi rejeitada',
    titulo: 'Despesa rejeitada',
    cor: '#c0504a',
    mensagem: d => `A despesa <em>${d.descricao}</em> de <strong>${formatBRL(d.valor)}</strong> foi <strong>rejeitada</strong>.${d.motivo ? ` Motivo: ${d.motivo}` : ''}`,
  },
}

function buildHtml(cfg: typeof CONFIGS[TipoNotificacao], dados: EnviarNotificacaoParams['dados'], para: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <tr>
          <td style="background:${cfg.cor};padding:20px 28px">
            <div style="color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">FactorOne</div>
            <div style="color:#fff;font-size:20px;font-weight:700">${cfg.titulo}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155">${cfg.mensagem(dados)}</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://factorone.com.br'}/dashboard"
               style="display:inline-block;background:${cfg.cor};color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600">
              Acessar FactorOne →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #f1f5f9">
            <p style="margin:0;font-size:11px;color:#94a3b8">Este email foi enviado para ${para} · FactorOne Finance OS</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function enviarNotificacao({ tipo, para, dados }: EnviarNotificacaoParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const cfg = CONFIGS[tipo]
  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to: para,
      subject: cfg.assunto,
      html: buildHtml(cfg, dados, para),
    })
    return !error
  } catch {
    return false
  }
}

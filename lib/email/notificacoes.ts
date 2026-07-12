import { enviarEmail } from '@/lib/email/enviar'

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://factorone-mvp2.vercel.app'

function baseHtml(corHeader: string, titulo: string, corpo: string, para: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:${corHeader};padding:20px 28px">
          <div style="color:rgba(255,255,255,.7);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">FactorOne</div>
          <div style="color:#fff;font-size:20px;font-weight:700">${titulo}</div>
        </td></tr>
        <tr><td style="padding:28px">${corpo}</td></tr>
        <tr><td style="padding:14px 28px;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8">Este email foi enviado para ${para} · FactorOne Finance OS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function emailBoasVindas(para: string, nomeEmpresa: string): Promise<boolean> {
  const corpo = `
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1a2b4a">Bem-vindo ao FactorOne, ${nomeEmpresa}!</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#334155">Sua conta está configurada e pronta para uso. Veja por onde começar:</p>
    ${[
      ['fa-gauge-high', '#5E8C87', 'Dashboard', 'Visão geral do caixa, KPIs e saúde financeira'],
      ['fa-robot', '#1A2B4A', 'AI CFO', 'Análises automáticas e insights em tempo real'],
      ['fa-file-invoice-dollar', '#B8922A', 'DRE & Relatórios', 'Demonstrativo de resultados e exportação PDF'],
    ].map(([,cor, titulo, desc]) => `
      <div style="display:flex;gap:12px;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;background:${cor};border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"></div>
        <div><div style="font-size:12px;font-weight:700;color:#1a2b4a">${titulo}</div><div style="font-size:11px;color:#6b7280">${desc}</div></div>
      </div>`).join('')}
    <div style="margin-top:22px">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#5E8C87;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700">
        Acessar o dashboard →
      </a>
    </div>`
  const r = await enviarEmail({ para, assunto: `Bem-vindo ao FactorOne, ${nomeEmpresa}!`, html: baseHtml('#1A2B4A', `Bem-vindo, ${nomeEmpresa}!`, corpo, para) })
  return r.ok
}

export async function emailConviteContador(
  para: string,
  nomeContador: string,
  nomeEmpresa: string,
  accessUrl: string,
): Promise<boolean> {
  const corpo = `
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1a2b4a">Olá, ${nomeContador}!</p>
    <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#334155">
      <strong>${nomeEmpresa}</strong> convidou você para acompanhar a contabilidade da empresa no <strong>FactorOne</strong>.
      Pelo portal, com acesso <strong>somente leitura</strong> e em tempo real, você acompanha a
      <strong>DRE</strong>, os <strong>lançamentos</strong>, as <strong>notas fiscais</strong> e as <strong>despesas</strong>
      — e pode exportar tudo em CSV e baixar os XMLs das notas.
    </p>
    <div style="margin:22px 0">
      <a href="${accessUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:13px;font-weight:700">
        Acessar o portal do contador →
      </a>
    </div>
    <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8">
      Este link é pessoal e dá acesso aos dados financeiros de ${nomeEmpresa} — não compartilhe.
      Se você não esperava este convite, ignore este e-mail.
    </p>`
  const r = await enviarEmail({
    para,
    assunto: `${nomeEmpresa} convidou você para a contabilidade no FactorOne`,
    html: baseHtml('#0f766e', 'Convite — Portal do Contador', corpo, para),
  })
  return r.ok
}

export async function emailDasAlert(para: string, nomeEmpresa: string, valor: number, vencimento: string): Promise<boolean> {
  const corpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">
      O <strong>DAS (Simples Nacional)</strong> de <strong>${nomeEmpresa}</strong> vence em breve:
    </p>
    <div style="background:#FEF9EC;border:1px solid #F5C842;border-radius:8px;padding:16px 18px;margin-bottom:20px">
      <div style="font-size:11px;color:#92680A;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Valor estimado</div>
      <div style="font-size:24px;font-weight:800;color:#92680A;font-family:monospace">${formatBRL(valor)}</div>
      <div style="font-size:12px;color:#92680A;margin-top:4px">Vencimento: ${vencimento}</div>
    </div>
    <a href="${APP_URL}/dashboard/contabilidade" style="display:inline-block;background:#B8922A;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700">
      Ver detalhes no FactorOne →
    </a>`
  const r = await enviarEmail({ para, assunto: `⚠️ DAS vencendo — ${nomeEmpresa}`, html: baseHtml('#B8922A', 'DAS vencendo em breve', corpo, para) })
  return r.ok
}

export async function emailSaldoBaixo(para: string, nomeEmpresa: string, saldo: number, limite: number): Promise<boolean> {
  const corpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">
      O saldo da conta de <strong>${nomeEmpresa}</strong> está abaixo do limite configurado:
    </p>
    <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px 18px;margin-bottom:20px">
      <div style="display:flex;gap:24px">
        <div>
          <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Saldo atual</div>
          <div style="font-size:22px;font-weight:800;color:#991B1B;font-family:monospace">${formatBRL(saldo)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Limite mínimo</div>
          <div style="font-size:22px;font-weight:800;color:#991B1B;font-family:monospace">${formatBRL(limite)}</div>
        </div>
      </div>
    </div>
    <a href="${APP_URL}/dashboard/conta-pj" style="display:inline-block;background:#C0504A;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700">
      Ver conta bancária →
    </a>`
  const r = await enviarEmail({ para, assunto: `🔴 Saldo baixo — ${nomeEmpresa}`, html: baseHtml('#C0504A', 'Alerta de saldo baixo', corpo, para) })
  return r.ok
}

export async function emailRelatorioMensal(
  para: string,
  nomeEmpresa: string,
  competenciaLabel: string,
  metricas: { receita_bruta: number; despesas_operacionais: number; lucro_liquido: number },
  variacaoLucroPct: number | null
): Promise<boolean> {
  const variacaoTxt = variacaoLucroPct === null
    ? ''
    : `<div style="font-size:12px;color:${variacaoLucroPct >= 0 ? '#047857' : '#B91C1C'};margin-top:4px">${variacaoLucroPct >= 0 ? '▲' : '▼'} ${Math.abs(variacaoLucroPct).toFixed(1)}% vs. mês anterior</div>`
  const corpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">
      Resumo financeiro de <strong>${nomeEmpresa}</strong> — <strong>${competenciaLabel}</strong>:
    </p>
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;color:#047857;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Receita</div>
        <div style="font-size:18px;font-weight:800;color:#047857;font-family:monospace">${formatBRL(metricas.receita_bruta)}</div>
      </div>
      <div style="flex:1;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Despesas</div>
        <div style="font-size:18px;font-weight:800;color:#991B1B;font-family:monospace">${formatBRL(metricas.despesas_operacionais)}</div>
      </div>
    </div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:11px;color:#334155;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Resultado do mês</div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;font-family:monospace">${formatBRL(metricas.lucro_liquido)}</div>
      ${variacaoTxt}
    </div>
    <a href="${APP_URL}/dashboard/relatorios" style="display:inline-block;background:#3D7A6E;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700">
      Ver DRE completo →
    </a>`
  const r = await enviarEmail({
    para,
    assunto: `Resumo de ${competenciaLabel} — ${nomeEmpresa}`,
    html: baseHtml('#3D7A6E', `Resumo financeiro · ${competenciaLabel}`, corpo, para),
  })
  return r.ok
}

export async function enviarNotificacao({ tipo, para, dados }: EnviarNotificacaoParams): Promise<boolean> {
  const cfg = CONFIGS[tipo]
  const r = await enviarEmail({ para, assunto: cfg.assunto, html: buildHtml(cfg, dados, para) })
  return r.ok
}

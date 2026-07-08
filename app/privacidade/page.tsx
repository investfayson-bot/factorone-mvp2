import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidade — FactorOne',
  description: 'Como o FactorOne coleta, usa e protege seus dados.',
}

export default function PoliticaPrivacidadePage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)', color: '#1C2B2A', lineHeight: 1.7 }}>
      <Link href="/" style={{ fontSize: 15, fontWeight: 700, color: '#5E8C87', textDecoration: 'none' }}>← FactorOne</Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 20, marginBottom: 6 }}>Política de Privacidade</h1>
      <p style={{ fontSize: 15, color: '#5F6B69', marginBottom: 32 }}>Última atualização: julho de 2026</p>

      <p>
        Esta política descreve como o <strong>FactorOne</strong> ("nós") coleta, usa, armazena e protege as
        informações de quem utiliza a plataforma FactorOne Finance OS, incluindo o site, o painel web e os
        canais de mensagem (WhatsApp e Telegram) conectados à sua conta.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>1. Quais dados coletamos</h2>
      <p>
        Coletamos os dados que você cadastra diretamente no FactorOne — como nome, e-mail, dados financeiros
        da sua empresa (transações, contas a pagar/receber, saldos bancários) — e, quando você opta por
        conectar um canal de mensagem, o número de telefone do WhatsApp ou o identificador da conta do Telegram
        usado para vincular seu acesso.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>2. Como usamos seus dados</h2>
      <p>
        Usamos seus dados exclusivamente para operar o produto: exibir seus números financeiros, responder
        suas perguntas via assistente de IA (dentro do painel, WhatsApp ou Telegram), gerar relatórios e
        enviar notificações relacionadas à sua conta. Não vendemos nem compartilhamos seus dados financeiros
        com terceiros para fins de publicidade.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>3. WhatsApp e Telegram</h2>
      <p>
        Ao vincular seu número de WhatsApp ou sua conta do Telegram, você autoriza o FactorOne a receber as
        mensagens que você envia para o nosso número/bot e a responder com base nos dados da sua própria
        conta. Esse vínculo é feito por um código de confirmação gerado dentro do seu painel — nunca
        vinculamos um número ou conta sem essa confirmação explícita.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>4. Armazenamento e segurança</h2>
      <p>
        Os dados são armazenados em infraestrutura com controle de acesso por empresa (cada cliente só acessa
        os próprios dados) e conexões criptografadas. Você pode solicitar a exclusão da sua conta e dos dados
        associados a qualquer momento.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>5. Contato</h2>
      <p>
        Dúvidas sobre esta política ou sobre seus dados podem ser enviadas para{' '}
        <a href="mailto:contato@factorone.com.br" style={{ color: '#5E8C87' }}>contato@factorone.com.br</a>.
      </p>
    </div>
  )
}

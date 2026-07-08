import Link from 'next/link'

export const metadata = {
  title: 'Termos de Uso — FactorOne',
  description: 'Termos de uso da plataforma FactorOne Finance OS.',
}

export default function TermosDeUsoPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)', color: '#1C2B2A', lineHeight: 1.7 }}>
      <Link href="/" style={{ fontSize: 15, fontWeight: 700, color: '#5E8C87', textDecoration: 'none' }}>← FactorOne</Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 20, marginBottom: 6 }}>Termos de Uso</h1>
      <p style={{ fontSize: 15, color: '#5F6B69', marginBottom: 32 }}>Última atualização: julho de 2026</p>

      <p>
        Estes termos regem o uso da plataforma <strong>FactorOne Finance OS</strong>, incluindo o painel web e
        os canais de mensagem (WhatsApp e Telegram) conectados à sua conta.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>1. Uso da plataforma</h2>
      <p>
        Ao criar uma conta no FactorOne, você concorda em fornecer informações verdadeiras sobre sua empresa e
        em usar a plataforma de acordo com a legislação brasileira aplicável, incluindo normas fiscais e de
        proteção de dados (LGPD).
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>2. Canais de mensagem</h2>
      <p>
        Ao vincular um número de WhatsApp ou uma conta de Telegram à sua conta FactorOne, você autoriza a
        plataforma a processar as mensagens enviadas por você para gerar respostas com base nos seus próprios
        dados financeiros. Você pode desvincular esse canal a qualquer momento pelo painel.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>3. Exclusão de dados</h2>
      <p>
        Você pode solicitar a exclusão da sua conta e de todos os dados associados a qualquer momento,
        enviando um pedido para{' '}
        <a href="mailto:contato@factorone.com.br" style={{ color: '#5E8C87' }}>contato@factorone.com.br</a>.
        O pedido é processado em até 15 dias úteis.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>4. Limitação de responsabilidade</h2>
      <p>
        O FactorOne é uma ferramenta de apoio à gestão financeira. As decisões tomadas com base nos relatórios
        e respostas do assistente de IA são de responsabilidade exclusiva do usuário.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 10 }}>5. Contato</h2>
      <p>
        Dúvidas sobre estes termos podem ser enviadas para{' '}
        <a href="mailto:contato@factorone.com.br" style={{ color: '#5E8C87' }}>contato@factorone.com.br</a>. Veja
        também nossa <Link href="/privacidade" style={{ color: '#5E8C87' }}>Política de Privacidade</Link>.
      </p>
    </div>
  )
}

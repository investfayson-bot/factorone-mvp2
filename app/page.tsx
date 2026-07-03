import Link from 'next/link'
import EditorialBanner from '@/components/ui/EditorialBanner'
import ThemeToggle from '@/components/ui/ThemeToggle'

export const metadata = { title: 'FactorOne — o sistema operacional financeiro da sua empresa' }

const FEATURES = [
  {
    image: '/img/team-working.png', side: 'left' as const, eyebrow: 'Um sistema, o negócio inteiro',
    title: 'Do caixa ao contador, num lugar só.',
    subtitle: 'Contas a pagar e receber, DRE, conciliação bancária, notas fiscais e portal do contador. Pare de pular entre planilhas e sistemas soltos.',
    stats: [{ valor: 'DRE', label: 'em tempo real' }, { valor: 'NF-e', label: 'emissão nativa' }],
  },
  {
    image: '/img/founder-smiling.png', side: 'right' as const, eyebrow: 'FactorOne AI',
    title: 'Um CFO digital que conhece seus números.',
    subtitle: 'Pergunte em português: “qual meu runway?”, “onde cortar custo?”. A IA lê seus dados reais — receita, despesa, fluxo — e responde com contexto da sua empresa.',
    stats: [{ valor: '24/7', label: 'sempre disponível' }, { valor: 'PT-BR', label: 'linguagem natural' }],
  },
  {
    image: '/img/entrepreneur-cafe.png', side: 'left' as const, eyebrow: 'Conta PJ FactorOne',
    title: 'Seu banco PJ, sem tarifas.',
    subtitle: 'Abra a conta 100% digital em minutos, receba por PIX, peça cartões corporativos e veja tudo conciliado com a contabilidade — automático.',
    stats: [{ valor: 'R$ 0', label: 'mensalidade' }, { valor: '~2min', label: 'para abrir' }],
  },
]

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(247,244,238,.86)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--ink)' }}>
          Factor<span style={{ color: 'var(--sage)', fontStyle: 'italic' }}>One</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <ThemeToggle compact />
          <Link href="/precos" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>Preços</Link>
          <Link href="/auth" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>Entrar</Link>
          <Link href="/auth" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 600, background: 'var(--ink)', color: 'var(--paper)', padding: '9px 18px', borderRadius: 4 }}>Começar grátis →</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hero */}
        <EditorialBanner
          image="/img/founder-smiling.png"
          alt="Empreendedor usando o FactorOne"
          variant="split"
          imageSide="right"
          eyebrow="Finance OS · para empresas modernas"
          title={<>O sistema operacional financeiro<br /><span style={{ color: 'var(--sage)' }}>em tempo real.</span></>}
          subtitle="Gestão financeira, contabilidade afiada, conta PJ e um CFO com IA — no mesmo lugar, com a clareza que o seu negócio merece."
          stats={[
            { valor: '30 dias', label: 'grátis, sem cartão' },
            { valor: '1 sistema', label: 'o negócio inteiro' },
            { valor: 'IA', label: 'CFO 24/7' },
          ]}
          ctas={[
            { label: 'Começar grátis', href: '/auth', variant: 'solid' },
            { label: 'Ver planos', href: '/precos', variant: 'ghost' },
          ]}
          focal="center top"
          height={360}
        />

        {/* Features alternadas */}
        {FEATURES.map(f => (
          <EditorialBanner
            key={f.title}
            image={f.image}
            variant="split"
            imageSide={f.side}
            eyebrow={f.eyebrow}
            title={f.title}
            subtitle={f.subtitle}
            stats={f.stats}
            height={300}
          />
        ))}

        {/* CTA final — tom escuro */}
        <EditorialBanner
          image="/img/hands-phone-pix.png"
          alt="Comece com o FactorOne"
          variant="full"
          tone="ink"
          badge="Comece hoje"
          eyebrow="30 dias grátis · sem cartão"
          title={<>Seus números com clareza,<br />a partir de hoje.</>}
          subtitle="Abra sua conta em minutos e deixe o FactorOne cuidar do resto."
          ctas={[{ label: 'Criar minha conta', href: '/auth', variant: 'solid' }]}
          focal="center right"
          height={300}
        />
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
          Factor<span style={{ color: 'var(--sage)', fontStyle: 'italic' }}>One</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-mut)', fontFamily: 'var(--font-mono)' }}>© 2026 FactorOne · Finance OS · Feito no Brasil</div>
      </footer>
    </div>
  )
}

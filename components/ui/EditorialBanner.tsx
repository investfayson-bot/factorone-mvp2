import Link from 'next/link'

/**
 * EditorialBanner — primitivo de imagem/hero do FactorOne.
 * Um só componente para todas as superfícies image-forward do produto:
 * abrir conta PJ, billing, onboarding, marketing/site.
 *
 * Linguagem: Editorial Fintech (papel creme, tinta, sálvia, Fraunces).
 * Foto grande + eyebrow mono + título serifado + CTA. Auto-explicativo.
 *
 * Variantes:
 *  - split  → foto de um lado, conteúdo do outro (padrão p/ seções)
 *  - full   → foto full-bleed com overlay de texto (padrão p/ heros)
 *  - strip  → faixa larga e baixa (padrão p/ banners "abra sua conta")
 */

type CTA = { label: string; href?: string; onClick?: () => void; variant?: 'solid' | 'ghost' }

export type EditorialBannerProps = {
  image: string
  alt?: string
  eyebrow?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  ctas?: CTA[]
  variant?: 'split' | 'full' | 'strip'
  imageSide?: 'left' | 'right'
  tone?: 'paper' | 'ink'          // fundo do lado de conteúdo (split) ou do overlay
  focal?: string                   // object-position da foto, ex: 'center 30%'
  height?: number                  // altura mínima em px
  badge?: string                   // selo pequeno no topo (ex: "CONTA PJ")
  stats?: { valor: string; label: string }[]  // trio de números (prova social/produto)
  className?: string
  style?: React.CSSProperties
}

function CTAButton({ cta, onInk = false }: { cta: CTA; onInk?: boolean }) {
  const solid = (cta.variant ?? 'solid') === 'solid'
  // No tom escuro (ink) invertemos: sólido vira papel-sobre-tinta, ghost fica claro.
  const solidBg = onInk ? 'var(--paper)' : 'var(--ink)'
  const solidFg = onInk ? 'var(--ink)' : 'var(--paper)'
  const ghostBorder = onInk ? 'rgba(247,244,238,.35)' : 'var(--line)'
  const ghostFg = onInk ? 'var(--paper)' : 'var(--ink)'
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px',
    borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'var(--font-sans)', transition: 'all .15s', border: '1px solid',
    borderColor: solid ? solidBg : ghostBorder,
    background: solid ? solidBg : 'transparent',
    color: solid ? solidFg : ghostFg,
  }
  const inner = <>{cta.label}<span aria-hidden style={{ fontFamily: 'var(--font-mono)' }}>→</span></>
  if (cta.href) return <Link href={cta.href} style={base}>{inner}</Link>
  return <button onClick={cta.onClick} style={base}>{inner}</button>
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--sage)' }}>
      <span style={{ width: 16, height: 1, background: 'currentColor' }} />{children}
    </div>
  )
}

export default function EditorialBanner({
  image, alt = '', eyebrow, title, subtitle, ctas = [], variant = 'split',
  imageSide = 'right', tone = 'paper', focal = 'center', height, badge, stats, className = '', style,
}: EditorialBannerProps) {
  const onInk = tone === 'ink'
  const ink = onInk ? 'var(--paper)' : 'var(--ink)'
  const inkSoft = onInk ? 'rgba(247,244,238,.72)' : 'var(--ink-soft)'

  const Content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', padding: variant === 'strip' ? '28px 32px' : '44px 48px', maxWidth: variant === 'full' ? 620 : undefined }}>
      {badge && (
        <span style={{ alignSelf: 'flex-start', fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: onInk ? 'var(--paper)' : 'var(--sage-deep)', background: onInk ? 'rgba(247,244,238,.14)' : 'var(--sage-tint)', padding: '4px 11px', borderRadius: 100 }}>{badge}</span>
      )}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: variant === 'strip' ? 26 : 34, lineHeight: 1.06, letterSpacing: '-.03em', color: ink, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14.5, lineHeight: 1.6, color: inkSoft, margin: 0, maxWidth: 460 }}>{subtitle}</p>}
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: 32, marginTop: 4 }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, letterSpacing: '-.03em', color: ink, lineHeight: 1 }}>{s.valor}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: onInk ? 'rgba(247,244,238,.55)' : 'var(--ink-mut)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {ctas.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>{ctas.map((c, i) => <CTAButton key={i} cta={c} onInk={onInk} />)}</div>}
    </div>
  )

  // eslint-disable-next-line @next/next/no-img-element
  const Photo = <img src={image} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focal, display: 'block' }} />

  if (variant === 'full') {
    return (
      <div className={className} style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)', minHeight: height ?? 320, ...style }}>
        <div style={{ position: 'absolute', inset: 0 }}>{Photo}</div>
        <div style={{ position: 'absolute', inset: 0, background: onInk
          ? 'linear-gradient(90deg, rgba(19,32,29,.86) 0%, rgba(19,32,29,.62) 45%, rgba(19,32,29,.12) 100%)'
          : 'linear-gradient(90deg, rgba(247,244,238,.94) 0%, rgba(247,244,238,.78) 45%, rgba(247,244,238,.05) 100%)' }} />
        <div style={{ position: 'relative' }}>{Content}</div>
      </div>
    )
  }

  // split / strip
  const cols = variant === 'strip' ? '1.15fr .85fr' : '1fr 1fr'
  const photoFirst = imageSide === 'left'
  return (
    <div className={className} style={{ display: 'grid', gridTemplateColumns: cols, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)', background: onInk ? 'var(--ink)' : 'var(--surface)', minHeight: height ?? (variant === 'strip' ? 180 : 300), ...style }}>
      {photoFirst ? <div style={{ minHeight: '100%' }}>{Photo}</div> : Content}
      {photoFirst ? Content : <div style={{ minHeight: '100%' }}>{Photo}</div>}
    </div>
  )
}

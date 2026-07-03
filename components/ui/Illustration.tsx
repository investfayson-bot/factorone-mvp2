// Ilustrações flat (estilo unDraw) na paleta FactorOne — SVG inline, sem assets externos.
import Link from 'next/link'

const NAVY = '#13201D'
const TEAL = '#3D7A6E'
const TEAL_SOFT = '#8FB3AF'
const TEAL_BG = '#E3EEEC'
const CREAM = '#F7F4EE'
const GOLD = '#B08A3E'

/** Ilustração de boas-vindas/configuração para fundos claros (ex.: onboarding). */
export function OnboardingHero({ width = 280 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Configurar conta">
      <ellipse cx="140" cy="178" rx="96" ry="12" fill={TEAL_BG} />
      {/* prancheta */}
      <rect x="86" y="34" width="108" height="130" rx="12" fill="#fff" stroke="#E3EEEC" strokeWidth="2" />
      <rect x="116" y="26" width="48" height="18" rx="6" fill={TEAL} />
      {/* itens do checklist */}
      {[64, 92, 120].map((y, i) => (
        <g key={y}>
          <circle cx="106" cy={y} r="8" fill={i < 2 ? TEAL : TEAL_BG} />
          {i < 2 && <path d={`M102 ${y}l3 3 5-6`} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          <rect x="122" y={y - 4} width={i === 2 ? 40 : 56} height="7" rx="3.5" fill={i < 2 ? '#D7E3E1' : '#E9EFEE'} />
        </g>
      ))}
      {/* moeda/seta flutuante */}
      <circle cx="206" cy="70" r="26" fill={TEAL} />
      <path d="M206 58v24M198 66h12a5 5 0 010 10h-12M198 76h12a5 5 0 010 10h-14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="60" y="96" width="34" height="34" rx="9" fill={GOLD} transform="rotate(-8 60 96)" />
      <path d="M70 116l5 5 9-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(-8 60 96)" />
    </svg>
  )
}

/** Ilustração de conexão bancária / Open Finance (fundos claros). */
export function ConnectBank({ width = 240 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Conectar banco">
      <ellipse cx="120" cy="146" rx="80" ry="10" fill={TEAL_BG} />
      {/* banco */}
      <rect x="34" y="58" width="68" height="64" rx="8" fill="#fff" stroke="#E3EEEC" strokeWidth="2" />
      <path d="M34 58l34-22 34 22" fill={TEAL} />
      <rect x="46" y="74" width="8" height="34" fill={TEAL_SOFT} /><rect x="64" y="74" width="8" height="34" fill={TEAL_SOFT} /><rect x="82" y="74" width="8" height="34" fill={TEAL_SOFT} />
      {/* app/celular */}
      <rect x="150" y="46" width="56" height="86" rx="10" fill={NAVY} />
      <rect x="156" y="56" width="44" height="60" rx="4" fill="#fff" />
      <rect x="162" y="64" width="20" height="6" rx="3" fill={TEAL} /><rect x="162" y="78" width="32" height="5" rx="2.5" fill="#E3EEEC" /><rect x="162" y="90" width="26" height="5" rx="2.5" fill="#E3EEEC" />
      {/* conexao */}
      <path d="M102 90h48" stroke={GOLD} strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
      <circle cx="126" cy="90" r="11" fill={GOLD} />
      <path d="M122 90l3 3 5-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** Ilustração financeira para fundos escuros (ex.: painel do login). */
export function FinanceHero({ width = 320 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Análise financeira">
      {/* card principal */}
      <rect x="34" y="40" width="200" height="140" rx="14" fill={CREAM} />
      <rect x="34" y="40" width="200" height="36" rx="14" fill={TEAL} />
      <rect x="34" y="62" width="200" height="14" fill={TEAL} />
      <circle cx="52" cy="58" r="6" fill={CREAM} opacity=".9" />
      <rect x="66" y="54" width="70" height="8" rx="4" fill={CREAM} opacity=".85" />
      {/* barras */}
      <rect x="54" y="138" width="20" height="28" rx="4" fill={TEAL_SOFT} />
      <rect x="84" y="120" width="20" height="46" rx="4" fill={TEAL} />
      <rect x="114" y="104" width="20" height="62" rx="4" fill={TEAL_SOFT} />
      <rect x="144" y="118" width="20" height="48" rx="4" fill={TEAL} />
      {/* linha de tendência */}
      <path d="M58 128 L94 112 L124 96 L164 104 L208 76" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="208" cy="76" r="5" fill={GOLD} />
      {/* card flutuante (moeda) */}
      <circle cx="244" cy="150" r="34" fill={TEAL} />
      <circle cx="244" cy="150" r="34" stroke={CREAM} strokeOpacity=".25" strokeWidth="2" />
      <path d="M244 134v32M236 142h12a6 6 0 010 12h-12M236 154h12a6 6 0 010 12h-14" stroke={CREAM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* badge topo */}
      <rect x="190" y="36" width="56" height="22" rx="11" fill={GOLD} />
      <path d="M204 47l4 4 8-8" stroke="#13201D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/**
 * Estado vazio que ENSINA (não tela crua). Compatível com quem passa só `label`.
 * - label/title → vira o título (serifado, Fraunces)
 * - hint → linha explicativa do que fazer
 * - cta → botão primário (href OU onClick)
 */
export function EmptyState({ width = 132, label, title, hint, cta }: {
  width?: number
  label?: string
  title?: string
  hint?: string
  cta?: { label: string; href?: string; onClick?: () => void; icon?: string }
}) {
  const heading = title ?? label
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 4,
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'var(--font-sans)', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: '36px 24px' }}>
      <svg width={width} viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={heading || 'Vazio'}>
        <rect x="40" y="34" width="120" height="84" rx="8" fill={CREAM} stroke="#E4DCCC" strokeWidth="2" />
        <rect x="40" y="34" width="120" height="22" rx="8" fill="#EFE9DC" />
        <rect x="54" y="42" width="44" height="6" rx="3" fill={TEAL_SOFT} />
        <rect x="54" y="70" width="92" height="7" rx="3.5" fill="#E4DCCC" />
        <rect x="54" y="84" width="70" height="7" rx="3.5" fill="#E4DCCC" />
        <rect x="54" y="98" width="84" height="7" rx="3.5" fill="#E4DCCC" />
        <circle cx="150" cy="112" r="20" fill={TEAL} />
        <path d="M150 104v16M142 112h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {heading && <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-.02em' }}>{heading}</div>}
      {hint && <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', maxWidth: 360, lineHeight: 1.55 }}>{hint}</div>}
      {cta && (cta.href
        ? <Link href={cta.href} style={btnStyle}>{cta.icon && <i className={`fa-solid ${cta.icon}`} />}{cta.label}</Link>
        : <button onClick={cta.onClick} style={btnStyle}>{cta.icon && <i className={`fa-solid ${cta.icon}`} />}{cta.label}</button>
      )}
    </div>
  )
}

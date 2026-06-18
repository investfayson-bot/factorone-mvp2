// Ilustrações flat (estilo unDraw) na paleta FactorOne — SVG inline, sem assets externos.

const TEAL = '#5E8C87'
const TEAL_SOFT = '#8FB3AF'
const CREAM = '#F5F6F5'
const GOLD = '#B8922A'

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
      <path d="M204 47l4 4 8-8" stroke="#1C2B2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** Ilustração neutra para estados vazios (fundos claros). */
export function EmptyState({ width = 160, label }: { width?: number; label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={width} viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label || 'Vazio'}>
        <rect x="40" y="34" width="120" height="84" rx="10" fill="#fff" stroke="#EAEBEA" strokeWidth="2" />
        <rect x="40" y="34" width="120" height="22" rx="10" fill="#EFF3F2" />
        <rect x="54" y="42" width="44" height="6" rx="3" fill={TEAL_SOFT} />
        <rect x="54" y="70" width="92" height="7" rx="3.5" fill="#EAEBEA" />
        <rect x="54" y="84" width="70" height="7" rx="3.5" fill="#EAEBEA" />
        <rect x="54" y="98" width="84" height="7" rx="3.5" fill="#EAEBEA" />
        <circle cx="150" cy="112" r="20" fill={TEAL} />
        <path d="M150 104v16M142 112h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{label}</div>}
    </div>
  )
}

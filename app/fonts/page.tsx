import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FactorOne — Comparador de Fontes' }

// Fontes candidatas — todas profissionais, foco em clareza/legibilidade.
const FONTS = [
  { name: 'Inter', stack: "var(--font-sans)", rec: true, nota: 'Padrão de SaaS financeiro sério (Stripe, Linear, Notion). Clareza máxima, neutra.' },
  { name: 'Geist', stack: "'Geist', system-ui, sans-serif", nota: 'Fonte da Vercel. Moderna, técnica e sofisticada — cara de fintech premium.' },
  { name: 'IBM Plex Sans', stack: "'IBM Plex Sans', system-ui, sans-serif", nota: 'Corporativa e sólida, com leve personalidade. Transmite confiança de banco.' },
  { name: 'Figtree', stack: "'Figtree', system-ui, sans-serif", nota: 'Limpa e amigável, ótima leitura em texto denso.' },
  { name: 'Manrope', stack: "'Manrope', system-ui, sans-serif", nota: 'Geométrica suave, moderna.' },
  { name: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', system-ui, sans-serif", nota: 'A fonte ATUAL do FactorOne.' },
]

const GOOGLE = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=Figtree:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'

const KPIS = [
  { lbl: 'Saldo disponível', val: 'R$ 128.450,00', sub: '+4,2% no mês', up: true },
  { lbl: 'A receber (30d)', val: 'R$ 86.320,90', sub: '12 títulos', up: true },
  { lbl: 'A pagar (30d)', val: 'R$ 54.907,15', sub: '8 vencimentos', up: false },
]

const DRE = [
  ['Receita bruta', 'R$ 342.180,00'],
  ['(−) Deduções', 'R$ 41.061,60'],
  ['Receita líquida', 'R$ 301.118,40'],
  ['(−) CMV', 'R$ 128.940,00'],
  ['Lucro bruto', 'R$ 172.178,40'],
  ['EBITDA', 'R$ 98.540,10'],
]

function FontCard({ name, stack, rec, nota }: { name: string; stack: string; rec?: boolean; nota: string }) {
  return (
    <div style={{ fontFamily: stack, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,24,40,.04)' }}>
      {/* topo */}
      <div style={{ background: '#13201D', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Factor<span style={{ color: '#6FA595' }}>One</span>
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{name}</span>
        </div>
        {rec && <span style={{ fontSize: 10, fontWeight: 700, color: '#2B564D', background: '#E9F0ED', padding: '3px 10px', borderRadius: 20 }}>RECOMENDADA</span>}
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#7B8C88', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Visão geral · Julho 2026</div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {KPIS.map(k => (
            <div key={k.lbl} style={{ border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{k.lbl}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#13201D', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: k.up ? '#3D7A6E' : '#B0413E', marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabela DRE */}
        <div style={{ border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC', fontSize: 12, fontWeight: 700, color: '#13201D' }}>DRE — resumo</div>
          {DRE.map((row, i) => (
            <div key={row[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < DRE.length - 1 ? '0.5px solid #EFE9DC' : 'none', fontSize: 13 }}>
              <span style={{ color: '#374151' }}>{row[0]}</span>
              <span style={{ fontWeight: 700, color: '#13201D', fontVariantNumeric: 'tabular-nums' }}>{row[1]}</span>
            </div>
          ))}
        </div>

        {/* Texto corrido + pesos */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#374151', margin: '0 0 12px' }}>
          O FactorOne é o sistema operacional financeiro da sua empresa. Acompanhe fluxo de caixa, DRE, conciliação bancária e emissão de notas — tudo em tempo real, com clareza.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontSize: 15, fontWeight: 400, color: '#13201D' }}>Regular 400</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#13201D' }}>Medium 500</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#13201D' }}>Semibold 600</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#13201D' }}>Bold 700</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#13201D' }}>Extra 800</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#13201D', marginTop: 12, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          0123456789 · R$ 1.234.567,89 · +12,5% · -3,8%
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #EFE9DC', fontSize: 12, color: '#7B8C88', fontFamily: "var(--font-sans)" }}>
          {nota}
          <div style={{ marginTop: 6, color: '#13201D', fontWeight: 600 }}>→ Para escolher esta, me diga: <span style={{ color: '#3D7A6E' }}>&quot;quero {name}&quot;</span></div>
        </div>
      </div>
    </div>
  )
}

export default function FontsComparePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EE', padding: '32px 16px', fontFamily: "var(--font-sans)" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={GOOGLE} rel="stylesheet" />

      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#13201D', letterSpacing: '-0.03em', margin: '0 0 6px' }}>Comparador de fontes</h1>
          <p style={{ fontSize: 14, color: '#7B8C88', margin: 0, lineHeight: 1.6 }}>
            Mesma tela do FactorOne renderizada em cada fonte. Compare a clareza dos números e do texto e me diga qual quer — aplico em todo o sistema.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FONTS.map(f => <FontCard key={f.name} {...f} />)}
        </div>
      </div>
    </div>
  )
}

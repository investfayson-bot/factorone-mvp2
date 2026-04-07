'use client'
export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const PLANOS = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 89,
    priceId: 'price_1TGr7aJA6DAGsEckmrH0fAgN',
    desc: 'Para empresas em crescimento',
    features: ['Dashboard financeiro', 'Gestão de despesas', 'Invoices básico', 'AI CFO (50 msgs/mês)', 'Suporte por chat'],
    destaque: false,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 199,
    priceId: 'price_1TGr82JA6DAGsEcknu6iVcd9',
    desc: 'Para empresas que estão escalando',
    features: ['Tudo do Essencial', 'AI CFO ilimitado', 'Portal do contador', 'Upload de comprovantes', 'Cash flow preditivo', 'Relatórios avançados'],
    destaque: true,
  },
  {
    id: 'scale',
    nome: 'Scale',
    preco: 499,
    priceId: 'price_1TGr8OJA6DAGsEckLv5wxY07',
    desc: 'Para empresas de alto crescimento',
    features: ['Tudo do Profissional', 'Múltiplos CNPJs', 'API access', 'Automação contábil completa', 'Onboarding dedicado', 'SLA 99.9%'],
    destaque: false,
  },
]

export default function OnboardingPage() {
  const [planoSel, setPlanoSel] = useState('profissional')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCheckout() {
    setLoading(true)
    const plano = PLANOS.find(p => p.id === planoSel)
    if (!plano) return
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plano.priceId, plano: plano.id }),
      })
      const { url, error } = await res.json()
      if (url) window.location.href = url
      else { toast.error(error || 'Erro ao criar pagamento'); setLoading(false) }
    } catch {
      toast.error('Erro de conexão')
      setLoading(false)
    }
  }

  function handleDemo() {
    toast.success('Modo demo ativado — 14 dias grátis!')
    setTimeout(() => router.push('/dashboard'), 800)
  }

  return (
    <div className="auth-page min-h-screen py-12 px-4">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, background: '#C8F135', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#000' }}>F1</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2B2A' }}>FactorOne</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1C2B2A', marginBottom: 8, letterSpacing: '-0.03em' }}>Escolha seu plano</h1>
          <p style={{ color: '#6B7280', fontSize: 15 }}>14 dias grátis · Cancele quando quiser</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
          {PLANOS.map(p => (
            <div key={p.id} onClick={() => setPlanoSel(p.id)}
              style={{ position: 'relative', borderRadius: 16, padding: 24, cursor: 'pointer', background: '#fff', border: planoSel === p.id ? '2px solid #0055FF' : p.destaque ? '2px solid #1C2B2A' : '1px solid #E5E7EB', boxShadow: planoSel === p.id ? '0 0 0 4px rgba(0,85,255,0.08)' : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all .15s' }}>
              {p.destaque && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#1C2B2A', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20 }}>Mais popular</div>}
              {planoSel === p.id && <div style={{ position: 'absolute', top: 14, right: 14, width: 20, height: 20, background: '#0055FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0055FF', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{p.nome}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1C2B2A', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>R${p.preco}<span style={{ fontSize: 13, fontWeight: 400, color: '#9CA3AF' }}>/mês</span></div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>{p.desc}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#374151', marginBottom: 6 }}>
                    <span style={{ color: '#22C55E', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={handleCheckout} disabled={loading}
            style={{ width: '100%', maxWidth: 360, padding: '14px 0', background: '#1C2B2A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Redirecionando...' : `Assinar ${PLANOS.find(p=>p.id===planoSel)?.nome} →`}
          </button>
          <button onClick={handleDemo} style={{ background: 'none', border: 'none', fontSize: 13, color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline' }}>
            Testar grátis por 14 dias sem cartão
          </button>
        </div>
      </div>
    </div>
  )
}

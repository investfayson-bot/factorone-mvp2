'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'

const PLANOS = [
  {
    key: 'starter',
    nome: 'Starter',
    preco: 'Grátis',
    subPreco: 'para sempre',
    cor: '#5E8C87',
    priceId: null,
    destaque: false,
    features: [
      'Dashboard financeiro',
      'Cash Flow & Previsão 90d',
      'DRE & Relatórios',
      'Contas a Pagar/Receber',
      'Despesas & Reembolsos',
      'Fiscal & NF-e',
      'AI CFO (10 perguntas/mês)',
      'Módulo Pessoa Física',
      '1 usuário',
    ],
    nao: ['CRM & Pipeline', 'Logística & Frota', 'Marketing', 'Equipe ilimitada', 'Portal Contador', 'Automações'],
  },
  {
    key: 'pro',
    nome: 'Pro',
    preco: 'R$ 297',
    subPreco: '/mês · cobrado mensalmente',
    cor: '#7C3AED',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? 'price_pro',
    destaque: true,
    features: [
      'Tudo do Starter',
      'CRM & Pipeline de vendas',
      'Logística & Gestão de Frota',
      'Marketing & Campanhas',
      'Clientes & MRR',
      'AI CFO ilimitado',
      'Automações & alertas',
      'Até 10 usuários',
      'Suporte prioritário',
    ],
    nao: ['Portal Contador dedicado', 'API access', 'White-label'],
  },
  {
    key: 'enterprise',
    nome: 'Enterprise',
    preco: 'R$ 697',
    subPreco: '/mês · cobrado mensalmente',
    cor: '#1A2B4A',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise',
    destaque: false,
    features: [
      'Tudo do Pro',
      'Portal Contador dedicado',
      'Usuários ilimitados',
      'API access (webhooks)',
      'Relatório Gerencial PDF automático',
      'Open Finance (Pluggy)',
      'WhatsApp Business integrado',
      'SLA de suporte garantido',
    ],
    nao: [],
  },
]

export default function PlanosPage() {
  const router = useRouter()
  const { plano: planoAtual, planoAtivo } = usePlano()
  const [loading, setLoading] = useState<string | null>(null)

  async function assinar(planoKey: string, priceId: string | null) {
    if (!priceId || priceId.startsWith('price_pro') || priceId.startsWith('price_enterprise')) {
      alert('Configure NEXT_PUBLIC_STRIPE_PRICE_PRO e NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE no Vercel com os IDs reais do Stripe Dashboard.')
      return
    }
    setLoading(planoKey)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
        body: JSON.stringify({ priceId, plano: planoKey }),
      })
      const { url, error } = await res.json() as { url?: string; error?: string }
      if (error) { alert(error); return }
      if (url) window.location.href = url
    } finally {
      setLoading(null)
    }
  }

  const ehAtual = (key: string) => key === planoAtual && planoAtivo

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Planos & Billing</div>
          <div className="page-sub">Escolha o plano ideal para sua empresa</div>
        </div>
      </div>

      {/* Banner plano atual */}
      {planoAtual && (
        <div style={{ background: 'rgba(94,140,135,.08)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--teal)', fontSize: 14 }} />
          <span style={{ fontSize: 13, color: 'var(--navy)' }}>
            Plano atual: <strong style={{ textTransform: 'capitalize' }}>{planoAtual}</strong>
            {!planoAtivo && <span style={{ color: 'var(--red)', marginLeft: 8, fontSize: 11 }}>(inativo — renove para continuar)</span>}
          </span>
        </div>
      )}

      {/* Grid de planos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {PLANOS.map(p => (
          <div
            key={p.key}
            style={{
              background: '#fff',
              border: p.destaque ? `2px solid ${p.cor}` : '1px solid var(--gray-100)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: p.destaque ? `0 4px 20px rgba(124,58,237,.12)` : '0 1px 4px rgba(0,0,0,.04)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header do plano */}
            <div style={{ background: p.cor, padding: '20px 22px' }}>
              {p.destaque && (
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  Mais popular
                </div>
              )}
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{p.nome}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff' }}>{p.preco}</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>{p.subPreco}</div>
            </div>

            {/* Features */}
            <div style={{ padding: '18px 22px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-500)', alignItems: 'flex-start' }}>
                    <i className="fa-solid fa-check" style={{ color: p.cor, fontSize: 11, marginTop: 2, flexShrink: 0 }} /> {f}
                  </div>
                ))}
                {p.nao.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-300)', alignItems: 'flex-start' }}>
                    <i className="fa-solid fa-xmark" style={{ color: 'var(--gray-200)', fontSize: 11, marginTop: 2, flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '0 22px 22px' }}>
              {ehAtual(p.key) ? (
                <div style={{ textAlign: 'center', padding: '11px 0', fontSize: 13, fontWeight: 700, color: p.cor, border: `1px solid ${p.cor}`, borderRadius: 8 }}>
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />Seu plano atual
                </div>
              ) : p.key === 'starter' ? (
                <button
                  className="btn-action btn-ghost"
                  style={{ width: '100%', padding: '11px 0', fontSize: 13 }}
                  onClick={() => router.push('/dashboard')}
                >
                  Continuar grátis
                </button>
              ) : (
                <button
                  className="btn-action"
                  style={{ width: '100%', padding: '11px 0', fontSize: 13, background: p.cor, border: 'none', opacity: loading === p.key ? .6 : 1 }}
                  onClick={() => void assinar(p.key, p.priceId)}
                  disabled={loading === p.key}
                >
                  {loading === p.key ? 'Redirecionando…' : `Assinar ${p.nome}`}
                  {loading !== p.key && <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8, fontSize: 11 }} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Nota Stripe */}
      <div style={{ background: 'rgba(26,43,74,.04)', border: '1px solid rgba(26,43,74,.08)', borderRadius: 10, padding: '14px 18px', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.7 }}>
        <i className="fa-solid fa-lock" style={{ marginRight: 6, color: 'var(--teal)' }} />
        Pagamentos processados com segurança via <strong>Stripe</strong>. Cancele a qualquer momento. Sem multa de rescisão.
        {(!process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) && (
          <span style={{ display: 'block', marginTop: 6, color: 'var(--gold)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
            Configure <code>NEXT_PUBLIC_STRIPE_PRICE_PRO</code> e <code>NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE</code> no Vercel com os Price IDs do seu Stripe Dashboard.
          </span>
        )}
      </div>
    </>
  )
}

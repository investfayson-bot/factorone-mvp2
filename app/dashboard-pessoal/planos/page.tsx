'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const PLANOS_PF = [
  {
    key: 'starter_pf',
    nome: 'Starter PF',
    preco: 'Grátis',
    subPreco: '30 dias · sem cartão',
    badge: '30 dias grátis',
    badgeBg: '#F1EFE8', badgeColor: '#5F5E5A',
    priceId: null,
    destaque: false,
    features: [
      'Dashboard financeiro pessoal',
      'Controle de gastos e receitas',
      'Fluxo de caixa pessoal',
      'FactorOne AI (5x por dia)',
    ],
    nao: ['Metas financeiras', 'Relatórios exportáveis', 'Conexão bancária', 'Planejamento de IR'],
  },
  {
    key: 'pessoal',
    nome: 'Pessoal',
    preco: 'R$ 47',
    subPreco: 'por mês',
    badge: 'Mais popular PF',
    badgeBg: '#EAF3DE', badgeColor: '#3B6D11',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PESSOAL ?? 'price_pessoal',
    destaque: false,
    features: [
      'Tudo do Starter PF',
      'Metas financeiras',
      'Categorias personalizadas',
      'Relatórios PDF e Excel',
      'FactorOne AI ilimitado',
      'Alertas de gastos',
    ],
    nao: ['Open Finance (bancos)', 'Planejamento de IR'],
  },
  {
    key: 'premium_pf',
    nome: 'Premium PF',
    preco: 'R$ 97',
    subPreco: 'por mês',
    badge: 'Completo',
    badgeBg: '#E9F0ED', badgeColor: '#2B564D',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_PF ?? 'price_premium_pf',
    destaque: true,
    features: [
      'Tudo do Pessoal',
      'Open Finance (3 bancos)',
      'Planejamento de investimentos',
      'Organizador de IR',
      'Simulador de aposentadoria',
      'Upgrade para Conta PJ disponível',
    ],
    nao: [],
  },
]

export default function PlanosPFPage() {
  const router = useRouter()
  const [planoAtual] = useState('starter_pf')
  const [loading, setLoading] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  async function assinar(priceId: string | null, planKey: string) {
    if (!priceId) return
    setLoading(planKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId, email: userEmail }),
      })
      const json = await res.json()
      if (json?.url) window.location.href = json.url
      else toast.error('Erro ao iniciar checkout')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="page-title" style={{ marginBottom: 6 }}>Planos para você</div>
        <div className="page-sub">Organize sua vida financeira com o FactorOne</div>
      </div>

      {/* Grade 3 planos PF */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {PLANOS_PF.map(p => {
          const ativo = planoAtual === p.key
          const carregando = loading === p.key
          return (
            <div key={p.key} style={{
              background: '#fff',
              border: p.destaque ? '2px solid #3D7A6E' : '0.5px solid #E4DCCC',
              borderRadius: 14, padding: '18px 16px',
              display: 'flex', flexDirection: 'column', position: 'relative',
            }}>
              {p.destaque && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#3D7A6E', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: '0 0 8px 8px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  MAIS POPULAR
                </div>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 10, background: p.badgeBg, color: p.badgeColor, width: 'fit-content' }}>
                {p.badge}
              </span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', marginBottom: 4 }}>{p.nome}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#13201D', letterSpacing: '-0.03em', lineHeight: 1 }}>{p.preco}</div>
              <div style={{ fontSize: 13, color: '#7B8C88', marginBottom: 14, marginTop: 3 }}>{p.subPreco}</div>
              <div style={{ height: '0.5px', background: '#E4DCCC', marginBottom: 12 }} />
              <div style={{ flex: 1 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 13, color: '#3C4A46', lineHeight: 1.4 }}>
                    <i className="fa-solid fa-check" style={{ fontSize: 13, color: '#3D7A6E', flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
                {p.nao.length > 0 && (
                  <>
                    <div style={{ height: '0.5px', background: '#E4DCCC', margin: '10px 0 8px' }} />
                    {p.nao.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 13, color: '#A6B0AC', lineHeight: 1.4 }}>
                        <i className="fa-solid fa-lock" style={{ fontSize: 13, flexShrink: 0, marginTop: 2 }} />{f}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <button
                onClick={() => ativo ? null : p.priceId ? assinar(p.priceId, p.key) : router.push('/dashboard-pessoal')}
                disabled={ativo || carregando}
                style={{
                  marginTop: 16, width: '100%', padding: '10px', borderRadius: 9,
                  fontSize: 14, fontWeight: 700, cursor: ativo ? 'default' : 'pointer', border: 'none',
                  background: ativo ? '#E9F0ED' : p.destaque ? '#13201D' : '#F7F4EE',
                  color: ativo ? '#2B564D' : p.destaque ? '#fff' : '#13201D',
                  transition: 'all 0.15s',
                }}
              >
                {carregando ? 'Aguarde...' : ativo ? '✓ Plano atual' : p.priceId ? `Assinar ${p.nome}` : 'Começar grátis'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Banner upgrade para PJ */}
      <div style={{ background: '#13201D', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(61,122,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-building" style={{ fontSize: 22, color: '#6FA595' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 5 }}>
                Tem uma empresa? Abra sua Conta PJ
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 460 }}>
                Migre para o plano PJ e tenha DRE, NF-e, portal do contador e Conta PJ com cartão corporativo — tudo integrado ao FactorOne.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {['NF-e e fiscal', 'Portal do contador', 'Conta PJ + cartão', 'Open Finance'].map(tag => (
                  <span key={tag} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'rgba(61,122,110,0.2)', color: '#6FA595', fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => router.push('/dashboard/planos')}
              style={{ background: '#3D7A6E', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Ver planos PJ
            </button>
            <button
              onClick={() => router.push('/dashboard/planos?tab=familia')}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Plano Família & Empresa
            </button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D', marginBottom: 14 }}>Perguntas frequentes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { q: 'Posso cancelar a qualquer momento?', r: 'Sim. Sem fidelidade ou multa. Cancele quando quiser pelo painel.' },
            { q: 'Os 30 dias grátis precisam de cartão?', r: 'Não. Você testa sem informar cartão. O plano pago começa só se você decidir continuar.' },
            { q: 'Como migro para PJ depois?', r: 'Basta clicar em "Ver planos PJ" acima. Seus dados são preservados na migração.' },
          ].map(item => (
            <div key={item.q} style={{ borderBottom: '0.5px solid #EFE9DC', paddingBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D', marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: '#7B8C88', lineHeight: 1.5 }}>{item.r}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

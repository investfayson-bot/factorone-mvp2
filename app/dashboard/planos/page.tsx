'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'
import toast from 'react-hot-toast'

type TabTipo = 'pj' | 'familia'

const PLANOS_PJ = [
  {
    key: 'starter_pj',
    nome: 'Starter PJ',
    preco: 'Grátis',
    subPreco: '30 dias · sem cartão',
    badge: '30 dias grátis',
    badgeBg: '#F1EFE8', badgeColor: '#5F5E5A',
    priceId: null,
    destaque: false,
    features: [
      'Dashboard financeiro PJ',
      'Contas a pagar e receber',
      'Fluxo de caixa',
      'DRE básico',
      'FactorOne AI (5x por dia)',
    ],
    nao: [
      'Conciliação bancária',
      'NF-e e emissão fiscal',
      'Portal do contador',
      'Relatórios exportáveis',
    ],
  },
  {
    key: 'essencial_pj',
    nome: 'Essencial PJ',
    preco: 'R$ 147',
    subPreco: 'por mês',
    badge: 'Gestão completa',
    badgeBg: '#EAF3DE', badgeColor: '#3B6D11',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ESSENCIAL_PJ ?? 'price_essencial_pj',
    destaque: false,
    features: [
      'Tudo do Starter PJ',
      'Conciliação bancária',
      'DRE completo + relatórios',
      'Exportação Excel e PDF',
      'Orçamento e centros de custo',
      'FactorOne AI ilimitado',
    ],
    nao: [
      'NF-e e emissão fiscal',
      'Portal do contador',
      'Conta PJ marketplace',
    ],
  },
  {
    key: 'profissional_pj',
    nome: 'Profissional PJ',
    preco: 'R$ 297',
    subPreco: 'por mês',
    badge: 'Recomendado PME',
    badgeBg: '#E9F0ED', badgeColor: '#2B564D',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_PJ ?? 'price_pro_pj',
    destaque: true,
    features: [
      'Tudo do Essencial PJ',
      'NF-e e NFS-e (emissão)',
      'Portal do contador',
      'Open Finance (3 bancos)',
      'Clientes e invoices',
      'Portais fiscais (e-CAC, SEFAZ)',
      'Conta PJ via marketplace',
    ],
    nao: [
      'Multi-empresa',
      'API própria',
    ],
  },
]

const PLANOS_FAMILIA = [
  {
    key: 'familia',
    nome: 'Família & Empresa',
    preco: 'R$ 397',
    subPreco: 'por mês · tudo num só plano',
    badge: 'Bundle exclusivo',
    badgeBg: '#E9F0ED', badgeColor: '#2B564D',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILIA ?? 'price_familia',
    destaque: false,
    economia: 'Separado custaria R$ 685/mês — economia de R$ 288',
    features: [
      '1 CNPJ (módulo PJ completo)',
      'NF-e, contador, DRE, Conta PJ',
      '1 conta PF para o titular',
      'Até 3 contas PF para família',
      'Cada membro vê só o seu',
      'FactorOne AI para todos',
      'Open Finance (3 bancos)',
    ],
    nao: [
      'Multi-empresa (até 1 CNPJ)',
      'API própria',
    ],
  },
  {
    key: 'scale',
    nome: 'Scale Família & Empresa',
    preco: 'R$ 597',
    subPreco: 'por mês · para quem escala',
    badge: 'Carro-chefe',
    badgeBg: '#EEEDFE', badgeColor: '#3C3489',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE ?? 'price_scale',
    destaque: true,
    economia: 'Para holdings, múltiplos CNPJs e famílias maiores',
    features: [
      'Tudo do Família & Empresa',
      'Até 3 CNPJs (holding, filiais)',
      'Até 6 contas PF na família',
      'Visão consolidada de patrimônio',
      'FactorOne AI com modelo avançado',
      'Gestor de equipe + RBAC',
      'Open Finance ilimitado',
      'SLA e suporte prioritário',
    ],
    nao: [],
  },
]

export default function PlanosPage() {
  const router = useRouter()
  const { plano: planoAtual } = usePlano()
  const [tab, setTab] = useState<TabTipo>('pj')
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
      setLoading(null) }
  }

  const planos = tab === 'pj' ? PLANOS_PJ : PLANOS_FAMILIA

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="page-title" style={{ marginBottom: 6 }}>Planos FactorOne</div>
        <div className="page-sub">Escolha o plano ideal para sua situação</div>
      </div>

      {/* Toggle PJ / Família */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', background: '#F1ECE1', padding: 3, borderRadius: 12, border: '0.5px solid #D1D9D8' }}>
          {([
            { id: 'pj', label: 'Pessoa Jurídica', icon: 'fa-building' },
            { id: 'familia', label: 'Família & Empresa', icon: 'fa-people-roof' },
          ] as { id: TabTipo; label: string; icon: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? '#13201D' : '#7B8C88',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Banner informativo */}
      {tab === 'familia' && (
        <div style={{ background: '#13201D', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(61,122,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-people-roof" style={{ fontSize: 18, color: '#6FA595' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Um plano para empresa e família</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              O titular alterna entre o painel PJ (empresa) e PF (pessoal) no mesmo login. Os membros da família têm acesso separado — cada um vê só suas finanças, nunca os dados da empresa.
            </div>
          </div>
        </div>
      )}

      {/* Grade de planos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: tab === 'pj' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {planos.map(p => {
          const ativo = planoAtual === p.key
          const carregando = loading === p.key
          return (
            <div key={p.key} style={{
              background: '#fff',
              border: p.destaque ? '2px solid #3D7A6E' : '0.5px solid #E4DCCC',
              borderRadius: 14,
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}>
              {p.destaque && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#3D7A6E', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 12px', borderRadius: '0 0 8px 8px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  MAIS POPULAR
                </div>
              )}

              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 10, background: p.badgeBg, color: p.badgeColor, width: 'fit-content' }}>
                {p.badge}
              </span>

              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', marginBottom: 4 }}>{p.nome}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#13201D', letterSpacing: '-0.03em', lineHeight: 1 }}>{p.preco}</div>
              <div style={{ fontSize: 11, color: '#7B8C88', marginBottom: 14, marginTop: 3 }}>{p.subPreco}</div>

              {'economia' in p && (p as { economia?: string }).economia && (
                <div style={{ background: '#E9F0ED', borderRadius: 8, padding: '7px 10px', fontSize: 10, color: '#2B564D', fontWeight: 500, marginBottom: 12, lineHeight: 1.4 }}>
                  <i className="fa-solid fa-piggy-bank" style={{ marginRight: 5 }} />{(p as { economia?: string }).economia}
                </div>
              )}

              <div style={{ height: '0.5px', background: '#E4DCCC', marginBottom: 12 }} />

              <div style={{ flex: 1 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 11, color: '#3C4A46', lineHeight: 1.4 }}>
                    <i className="fa-solid fa-check" style={{ fontSize: 11, color: '#3D7A6E', flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
                {p.nao.length > 0 && (
                  <>
                    <div style={{ height: '0.5px', background: '#E4DCCC', margin: '10px 0 8px' }} />
                    {p.nao.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 11, color: '#A6B0AC', lineHeight: 1.4 }}>
                        <i className="fa-solid fa-lock" style={{ fontSize: 11, flexShrink: 0, marginTop: 2 }} />{f}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button
                onClick={() => ativo ? null : p.priceId ? assinar(p.priceId, p.key) : router.push('/dashboard')}
                disabled={ativo || carregando}
                style={{
                  marginTop: 16, width: '100%', padding: '10px', borderRadius: 9,
                  fontSize: 12, fontWeight: 700, cursor: ativo ? 'default' : 'pointer',
                  border: 'none',
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

      {/* Banner Conta PJ */}
      <div style={{ background: 'linear-gradient(135deg, #13201D 0%, #2A3F3E 100%)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(61,122,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-credit-card" style={{ fontSize: 22, color: '#6FA595' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Abra sua Conta PJ</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, maxWidth: 480 }}>
              Disponível no plano Profissional PJ ou superior. Conta com cartão corporativo, PIX, boleto e gestão de despesas — tudo integrado ao FactorOne.
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/marketplace')}
          style={{ background: '#3D7A6E', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Ver no Marketplace
        </button>
      </div>

      {/* FAQ */}
      <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', marginBottom: 14 }}>Perguntas frequentes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {[
            { q: 'Posso cancelar a qualquer momento?', r: 'Sim. Sem fidelidade ou multa. Cancele quando quiser pelo painel.' },
            { q: 'Os 30 dias grátis precisam de cartão?', r: 'Não. Você testa sem informar cartão. O plano pago começa só se você decidir continuar.' },
            { q: 'O que é o plano Família & Empresa?', r: 'Um bundle que cobre sua empresa (PJ) e até 3 membros da família (PF) num único plano com desconto.' },
            { q: 'A Conta PJ é cobrada à parte?', r: 'Sim. É um produto financeiro do marketplace, ativado no plano Profissional. Sem tarifas mensais — você paga só o que usar.' },
          ].map(item => (
            <div key={item.q}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#13201D', marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 11, color: '#7B8C88', lineHeight: 1.5 }}>{item.r}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

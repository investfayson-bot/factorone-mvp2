'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type AppItem = {
  id: string
  name: string
  icon: string
  color: string
  rating: number
  rev: number
  desc: string
  badge: 'popular' | 'new' | ''
  cat: 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'
  installed: boolean
}

const INITIAL_APPS: AppItem[] = [
  { id: 'crm', name: 'CRM Pro', icon: '👥', color: '#E6F1FB', rating: 4.8, rev: 120, desc: 'Gestão de leads, contatos e pipeline de vendas.', badge: 'popular', cat: 'vendas', installed: false },
  { id: 'mkt', name: 'Marketing Automation', icon: '📢', color: '#FFF3E0', rating: 4.7, rev: 105, desc: 'Automatize campanhas de email e anúncios.', badge: 'new', cat: 'vendas', installed: false },
  { id: 'sales', name: 'Sales Pipeline', icon: '📈', color: '#E8F5E9', rating: 4.9, rev: 85, desc: 'Acompanhe e preveja oportunidades de venda.', badge: 'new', cat: 'vendas', installed: false },
  { id: 'ar', name: 'Contas a Receber Plus', icon: '💵', color: '#E8F5E9', rating: 4.6, rev: 75, desc: 'Automatize cobranças e controle inadimplência.', badge: '', cat: 'financeiro', installed: true },
  { id: 'payroll', name: 'Folha de Pagamento', icon: '👨‍💼', color: '#F3E5F5', rating: 4.7, rev: 98, desc: 'Holerites, encargos, eSocial e FGTS.', badge: 'popular', cat: 'rh', installed: false },
  { id: 'tax', name: 'Tax Compliance', icon: '⚖️', color: '#E3F2FD', rating: 4.8, rev: 69, desc: 'Conformidade fiscal e obrigações acessórias.', badge: 'new', cat: 'fiscal', installed: false },
  { id: 'inv', name: 'Gestão de Estoque', icon: '📦', color: '#FFF8E1', rating: 4.6, rev: 75, desc: 'Controle de produtos, pedidos e movimentações.', badge: '', cat: 'operacional', installed: false },
  { id: 'sub', name: 'Subscription Billing', icon: '🔄', color: '#E8EAF6', rating: 4.7, rev: 102, desc: 'Assinaturas e cobranças recorrentes.', badge: 'new', cat: 'financeiro', installed: false },
  { id: 'budget', name: 'Budget & Forecast', icon: '🎯', color: '#E0F7FA', rating: 4.5, rev: 64, desc: 'Planejamento orçamentário e previsão.', badge: '', cat: 'financeiro', installed: false },
  { id: 'prop', name: 'Propostas Comerciais', icon: '📋', color: '#FCE4EC', rating: 4.8, rev: 88, desc: 'Crie e envie propostas e orçamentos.', badge: '', cat: 'vendas', installed: false },
  { id: 'contract', name: 'Contratos Digitais', icon: '🏗️', color: '#EFEBE9', rating: 4.4, rev: 55, desc: 'Gestão com assinatura digital integrada.', badge: '', cat: 'operacional', installed: false },
  { id: 'hr', name: 'RH & Benefícios', icon: '❤️', color: '#FCE4EC', rating: 4.6, rev: 90, desc: 'Férias, ponto, benefícios e colaboradores.', badge: '', cat: 'rh', installed: false },
]

type Filter = 'all' | 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'

export default function MarketplacePage() {
  const [apps, setApps] = useState<AppItem[]>(INITIAL_APPS)
  const [filter, setFilter] = useState<Filter>('all')

  function toggleInstall(id: string) {
    setApps(prev => prev.map(a => {
      if (a.id !== id) return a
      const next = { ...a, installed: !a.installed }
      toast.success(next.installed ? `${a.name} instalado!` : `${a.name} removido.`)
      return next
    }))
  }

  const visible = filter === 'all' ? apps : apps.filter(a => a.cat === filter)
  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'operacional', label: 'Operacional' },
    { key: 'vendas', label: 'Vendas' },
    { key: 'rh', label: 'RH' },
    { key: 'fiscal', label: 'Fiscal' },
  ]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>FactorOne App Marketplace</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Adicione funcionalidades poderosas à sua plataforma financeira.</div>
        </div>
        <button
          onClick={() => toast.success('Solicitação enviada à equipe FactorOne!')}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--gray-200)', background: '#fff', color: 'var(--navy)', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="fa-solid fa-plus" /> Solicitar App
        </button>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              background: filter === f.key ? 'var(--navy)' : 'transparent',
              color: filter === f.key ? '#fff' : 'var(--gray-700)',
              border: `1px solid ${filter === f.key ? 'var(--navy)' : 'var(--gray-200)'}`,
              fontWeight: filter === f.key ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* App grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        {visible.map(a => (
          <div
            key={a.id}
            style={{
              background: a.installed ? 'rgba(45,155,111,.02)' : '#fff',
              border: `1px solid ${a.installed ? 'rgba(45,155,111,.3)' : 'var(--gray-100)'}`,
              borderRadius: 12,
              padding: 18,
              cursor: 'pointer',
              transition: 'all .2s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = a.installed ? 'rgba(45,155,111,.3)' : 'var(--gray-100)'; (e.currentTarget as HTMLDivElement).style.transform = '' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 46, height: 46, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: a.color }}>
                {a.icon}
              </div>
              {a.badge ? (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  background: a.badge === 'popular' ? 'rgba(94,140,135,.15)' : 'rgba(124,58,237,.12)',
                  color: a.badge === 'popular' ? 'var(--teal)' : '#7C3AED',
                }}>
                  {a.badge === 'popular' ? 'Popular' : 'Novo'}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 5 }}>{a.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.55 }}>{a.desc}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--gold)' }}>
                {'★★★★'}{a.rating >= 4.8 ? '★' : '☆'}{' '}
                <span style={{ color: 'var(--gray-400)' }}>{a.rating} · {a.rev} av.</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleInstall(a.id) }}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  border: a.installed ? '1px solid rgba(45,155,111,.25)' : 'none',
                  background: a.installed ? 'rgba(45,155,111,.1)' : 'var(--navy)',
                  color: a.installed ? 'var(--green)' : '#fff',
                }}
              >
                {a.installed ? '✓ Instalado' : 'Instalar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CTA banner */}
      <div style={{ background: 'linear-gradient(135deg,var(--navy) 0%,#243736 100%)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Integre seus sistemas</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
            Conecte bancos, ERPs e outros sistemas externos{' '}
            <strong style={{ color: 'rgba(255,255,255,.8)' }}>via FactorOne API</strong>
          </div>
        </div>
        <Link
          href="/dashboard/integracoes"
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--teal)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}
        >
          Explorar Integrações →
        </Link>
      </div>
    </>
  )
}

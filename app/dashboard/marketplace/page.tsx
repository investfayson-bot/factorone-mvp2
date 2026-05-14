'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type AppItem = {
  id: string
  name: string
  icon: string
  iconColor: string
  iconBg: string
  rating: number
  rev: number
  desc: string
  badge: 'popular' | 'new' | ''
  cat: 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'
  installed: boolean
}

const INITIAL_APPS: AppItem[] = [
  { id: 'crm',      name: 'CRM Pro',                icon: 'fa-handshake',            iconColor: '#1E40AF', iconBg: '#DBEAFE', rating: 4.8, rev: 120, desc: 'Gestão de leads, contatos e pipeline de vendas.',     badge: 'popular', cat: 'vendas',      installed: false },
  { id: 'mkt',      name: 'Marketing Automation',   icon: 'fa-bullhorn',              iconColor: '#C2410C', iconBg: '#FFEDD5', rating: 4.7, rev: 105, desc: 'Automatize campanhas de email e anúncios.',           badge: 'new',     cat: 'vendas',      installed: false },
  { id: 'sales',    name: 'Sales Pipeline',          icon: 'fa-arrow-trend-up',        iconColor: '#166534', iconBg: '#DCFCE7', rating: 4.9, rev: 85,  desc: 'Acompanhe e preveja oportunidades de venda.',         badge: 'new',     cat: 'vendas',      installed: false },
  { id: 'ar',       name: 'Contas a Receber Plus',   icon: 'fa-file-invoice-dollar',   iconColor: '#065F46', iconBg: '#D1FAE5', rating: 4.6, rev: 75,  desc: 'Automatize cobranças e controle inadimplência.',       badge: '',        cat: 'financeiro',  installed: true  },
  { id: 'payroll',  name: 'Folha de Pagamento',      icon: 'fa-users-gear',            iconColor: '#6B21A8', iconBg: '#EDE9FE', rating: 4.7, rev: 98,  desc: 'Holerites, encargos, eSocial e FGTS.',                badge: 'popular', cat: 'rh',          installed: false },
  { id: 'tax',      name: 'Tax Compliance',          icon: 'fa-scale-balanced',        iconColor: '#1D4ED8', iconBg: '#DBEAFE', rating: 4.8, rev: 69,  desc: 'Conformidade fiscal e obrigações acessórias.',         badge: 'new',     cat: 'fiscal',      installed: false },
  { id: 'inv',      name: 'Gestão de Estoque',       icon: 'fa-boxes-stacked',         iconColor: '#92400E', iconBg: '#FEF3C7', rating: 4.6, rev: 75,  desc: 'Controle de produtos, pedidos e movimentações.',       badge: '',        cat: 'operacional', installed: false },
  { id: 'sub',      name: 'Subscription Billing',   icon: 'fa-rotate',                iconColor: '#1E3A5F', iconBg: '#E0E7FF', rating: 4.7, rev: 102, desc: 'Assinaturas e cobranças recorrentes.',                 badge: 'new',     cat: 'financeiro',  installed: false },
  { id: 'budget',   name: 'Budget & Forecast',       icon: 'fa-chart-pie',             iconColor: '#0E7490', iconBg: '#CFFAFE', rating: 4.5, rev: 64,  desc: 'Planejamento orçamentário e previsão.',               badge: '',        cat: 'financeiro',  installed: false },
  { id: 'prop',     name: 'Propostas Comerciais',    icon: 'fa-file-signature',        iconColor: '#BE185D', iconBg: '#FCE7F3', rating: 4.8, rev: 88,  desc: 'Crie e envie propostas e orçamentos.',                badge: '',        cat: 'vendas',      installed: false },
  { id: 'contract', name: 'Contratos Digitais',      icon: 'fa-file-contract',         iconColor: '#374151', iconBg: '#F3F4F6', rating: 4.4, rev: 55,  desc: 'Gestão com assinatura digital integrada.',             badge: '',        cat: 'operacional', installed: false },
  { id: 'hr',       name: 'RH & Benefícios',         icon: 'fa-heart-pulse',           iconColor: '#BE123C', iconBg: '#FFE4E6', rating: 4.6, rev: 90,  desc: 'Férias, ponto, benefícios e colaboradores.',           badge: '',        cat: 'rh',          installed: false },
]

type Filter = 'all' | 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',        label: 'Todos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'operacional', label: 'Operacional' },
  { key: 'vendas',     label: 'Vendas' },
  { key: 'rh',         label: 'RH' },
  { key: 'fiscal',     label: 'Fiscal' },
]

export default function MarketplacePage() {
  const [apps, setApps] = useState<AppItem[]>(INITIAL_APPS)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  function toggleInstall(id: string) {
    setApps(prev => prev.map(a => {
      if (a.id !== id) return a
      const next = { ...a, installed: !a.installed }
      toast.success(next.installed ? `${a.name} instalado!` : `${a.name} removido.`)
      return next
    }))
  }

  const visible = apps
    .filter(a => filter === 'all' || a.cat === filter)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))

  const instalados = apps.filter(a => a.installed)

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>FactorOne Marketplace</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Adicione funcionalidades poderosas à sua plataforma financeira.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 12 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar apps..."
              style={{ paddingLeft: 30, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12, width: 180, outline: 'none', color: 'var(--navy)' }}
            />
          </div>
          <button
            onClick={() => toast.success('Solicitação enviada à equipe FactorOne!')}
            className="btn-action btn-ghost"
            style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fa-solid fa-plus" /> Solicitar App
          </button>
        </div>
      </div>

      {/* Stats */}
      {instalados.length > 0 && (
        <div style={{ background: 'var(--green)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#fff', fontSize: 14 }} />
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
            {instalados.length} app{instalados.length > 1 ? 's' : ''} instalado{instalados.length > 1 ? 's' : ''}:{' '}
            <span style={{ fontWeight: 400 }}>{instalados.map(a => a.name).join(', ')}</span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
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
              transition: 'all .15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* App grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
        {visible.map(a => (
          <div
            key={a.id}
            style={{
              background: a.installed ? 'rgba(45,155,111,.03)' : '#fff',
              border: `1px solid ${a.installed ? 'rgba(45,155,111,.35)' : 'var(--gray-100)'}`,
              borderRadius: 12,
              padding: 18,
              transition: 'all .2s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = a.installed ? 'var(--green)' : 'var(--teal)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.06)' }}
            onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = a.installed ? 'rgba(45,155,111,.35)' : 'var(--gray-100)'; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.iconBg }}>
                <i className={`fa-solid ${a.icon}`} style={{ color: a.iconColor, fontSize: 18 }} />
              </div>
              {a.badge ? (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  background: a.badge === 'popular' ? 'rgba(94,140,135,.15)' : 'rgba(124,58,237,.12)',
                  color: a.badge === 'popular' ? 'var(--teal)' : '#7C3AED',
                }}>
                  {a.badge === 'popular' ? 'POPULAR' : 'NOVO'}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{a.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.55 }}>{a.desc}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fa-solid fa-star" style={{ fontSize: 10 }} />
                <span style={{ fontWeight: 700 }}>{a.rating}</span>
                <span style={{ color: 'var(--gray-400)' }}>· {a.rev} av.</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleInstall(a.id) }}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  border: a.installed ? '1px solid rgba(45,155,111,.3)' : 'none',
                  background: a.installed ? 'rgba(45,155,111,.1)' : 'var(--navy)',
                  color: a.installed ? 'var(--green)' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <i className={`fa-solid ${a.installed ? 'fa-check' : 'fa-download'}`} style={{ fontSize: 10 }} />
                {a.installed ? 'Instalado' : 'Instalar'}
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
            <i className="fa-solid fa-store" style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
            Nenhum app encontrado
          </div>
        )}
      </div>

      {/* CTA banner */}
      <div style={{ background: 'linear-gradient(135deg,var(--navy) 0%,#243736 100%)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Integre seus sistemas</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
            Conecte bancos, ERPs e sistemas externos via{' '}
            <strong style={{ color: 'rgba(255,255,255,.8)' }}>FactorOne API</strong>
          </div>
        </div>
        <Link
          href="/dashboard/integracoes"
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--teal)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}
        >
          Explorar Integrações
          <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6, fontSize: 10 }} />
        </Link>
      </div>
    </>
  )
}

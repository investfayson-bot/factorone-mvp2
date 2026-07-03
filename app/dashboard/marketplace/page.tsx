'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { MARKET_APPS, fetchInstalledIds, setInstalled, type MarketApp } from '@/lib/marketplace'

type Filter = 'all' | 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: 'all',         label: 'Todos',       icon: 'fa-grid-2' },
  { key: 'financeiro',  label: 'Financeiro',  icon: 'fa-chart-line' },
  { key: 'operacional', label: 'Operacional', icon: 'fa-gears' },
  { key: 'vendas',      label: 'Vendas',      icon: 'fa-handshake' },
  { key: 'rh',          label: 'RH',          icon: 'fa-users' },
  { key: 'fiscal',      label: 'Fiscal',      icon: 'fa-landmark' },
]

function Stars({ n }: { n: number }) {
  return (
    <span style={{ fontSize: 10, color: '#F59E0B', letterSpacing: 1 }}>
      {'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}
    </span>
  )
}

export default function MarketplacePage() {
  const router = useRouter()
  const [installed, setInstalledState] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchInstalledIds().then(setInstalledState) }, [])

  async function onToggle(a: MarketApp) {
    const willInstall = !installed.includes(a.id)
    if (!willInstall) {
      const ok = window.confirm(`Desinstalar ${a.name}?\n\nEle sai do menu lateral, mas seus dados NÃO são apagados — ficam salvos e voltam se você reinstalar.`)
      if (!ok) return
    }
    setBusy(a.id)
    setInstalledState(prev => willInstall ? [...prev, a.id] : prev.filter(x => x !== a.id))
    try {
      await setInstalled(a.id, willInstall)
      toast.success(willInstall ? `${a.name} adicionado ao menu!` : `${a.name} removido.`)
    } catch {
      setInstalledState(await fetchInstalledIds())
      toast.error('Falha ao atualizar. Tente de novo.')
    } finally { setBusy(null) }
  }

  const visible = MARKET_APPS
    .filter(a => filter === 'all' || a.cat === filter)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))

  const instalados = MARKET_APPS.filter(a => installed.includes(a.id))
  const contaPjInstalled = installed.includes('conta-pj') || installed.includes('banco-pj')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Marketplace</div>
          <div className="page-sub">Adicione módulos à sua plataforma — ao instalar, aparecem no menu lateral</div>
        </div>
        <div style={{ position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#A6B0AC', fontSize: 12 }} />
          <input
            className="form-input"
            placeholder="Buscar módulo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 220, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Banner Conta PJ */}
      {!contaPjInstalled && (
        <div style={{
          background: 'linear-gradient(135deg, #13201D 0%, #2A3F3E 100%)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(61,122,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-building-columns" style={{ fontSize: 24, color: '#6FA595' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif" }}>Conta PJ — powered by Celcoin</div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#3D7A6E', color: '#fff', letterSpacing: '0.06em' }}>DESTAQUE</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 10 }}>
              Conta bancária PJ com cartão corporativo, PIX, boleto e gestão de despesas — tudo integrado ao FactorOne. Aprovação em até 24h.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Cartão Visa Corporativo', 'PIX instantâneo', 'Boletos', 'Open Finance', 'Gestão de despesas'].map(tag => (
                <span key={tag} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(61,122,110,0.2)', color: '#6FA595', fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/conta-pj/abrir')}
            style={{ background: '#3D7A6E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Abrir Conta PJ
          </button>
        </div>
      )}

      {contaPjInstalled && (
        <div style={{ background: '#E9F0ED', border: '0.5px solid #3D7A6E', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 18, color: '#3D7A6E' }} />
          <div style={{ fontSize: 12, color: '#2B564D', fontWeight: 600 }}>Conta PJ ativa · aparece na sidebar como &quot;Conta PJ&quot;</div>
        </div>
      )}

      {/* Apps instalados */}
      {instalados.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Instalados ({instalados.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {instalados.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#E9F0ED', border: '0.5px solid #3D7A6E', borderRadius: 20 }}>
                <i className={`fa-solid ${a.icon}`} style={{ fontSize: 12, color: '#3D7A6E' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2B564D' }}>{a.name}</span>
                <button onClick={() => onToggle(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B8C88', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: filter === f.key ? 700 : 500,
            padding: '6px 14px', borderRadius: 20, border: '0.5px solid',
            borderColor: filter === f.key ? '#13201D' : '#E4DCCC',
            background: filter === f.key ? '#13201D' : '#fff',
            color: filter === f.key ? '#fff' : '#7B8C88',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <i className={`fa-solid ${f.icon}`} style={{ fontSize: 10 }} />
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid de apps */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#7B8C88' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 32, marginBottom: 12, display: 'block', color: '#D1D9D8' }} />
          <div style={{ fontWeight: 600, color: '#13201D', marginBottom: 4 }}>Nenhum módulo encontrado</div>
          <div style={{ fontSize: 12 }}>Tente outro termo ou filtro</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {visible.map(a => {
            const isOn = installed.includes(a.id)
            const isBusy = busy === a.id
            return (
              <div key={a.id} style={{
                background: '#fff', border: `0.5px solid ${isOn ? '#3D7A6E' : '#E4DCCC'}`,
                borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'all 0.15s',
              }}>
                {/* Top */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: a.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${a.icon}`} style={{ fontSize: 16, color: a.iconColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#13201D' }}>{a.name}</span>
                      {a.badge === 'popular' && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#EAF3DE', color: '#3B6D11' }}>POPULAR</span>
                      )}
                      {a.badge === 'new' && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#E9F0ED', color: '#2B564D' }}>NOVO</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Stars n={a.rating} />
                      <span style={{ fontSize: 10, color: '#7B8C88' }}>{a.rating} ({a.rev})</span>
                    </div>
                  </div>
                  {isOn && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#3D7A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#fff' }} />
                    </div>
                  )}
                </div>

                {/* Desc */}
                <div style={{ fontSize: 11, color: '#7B8C88', lineHeight: 1.5 }}>{a.desc}</div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  {!isOn ? (
                    <button
                      onClick={() => onToggle(a)}
                      disabled={isBusy}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer', background: '#13201D', color: '#fff', opacity: isBusy ? 0.7 : 1 }}
                    >
                      {isBusy ? '...' : 'Adicionar'}
                    </button>
                  ) : (
                    <>
                      {a.hasPage && (
                        <button
                          onClick={() => router.push(a.href)}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#13201D', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Abrir
                        </button>
                      )}
                      <button
                        onClick={() => onToggle(a)}
                        disabled={isBusy}
                        title="Remove do menu — seus dados ficam salvos"
                        style={{ flex: a.hasPage ? '0 0 auto' : 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid #F1D4D0', background: '#fff', color: '#B0413E', fontSize: 12, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
                      >
                        {isBusy ? '...' : 'Desinstalar'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

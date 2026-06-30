'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'

type Permissoes = Record<string, boolean>
type ContadorInfo = { nome: string; status: string; permissoes: Permissoes; empresa_nome?: string }
type Metrica = { competencia: string; receita_bruta: number; lucro_liquido: number; ebitda: number; margem_liquida: number }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; competencia: string; origem: string }
type NotaEmitida = { id: string; numero: string | null; destinatario_nome: string | null; valor_total: number; status: string; created_at: string }
type Despesa = { id: string; descricao: string; valor: number; categoria: string; status: string; data_despesa: string | null }

const TABS = ['dre', 'lancamentos', 'notas', 'despesas'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { dre: 'DRE', lancamentos: 'Lançamentos', notas: 'Notas Fiscais', despesas: 'Despesas' }
const TAB_ICONS: Record<Tab, string> = { dre: 'fa-chart-bar', lancamentos: 'fa-list', notas: 'fa-file-invoice', despesas: 'fa-receipt' }
const PERM_KEYS: Record<Tab, string> = { dre: 'ver_dre', lancamentos: 'ver_lancamentos', notas: 'ver_notas', despesas: 'ver_despesas' }

function PermBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: ok ? '#EAF5F3' : '#EEF2F1', color: ok ? '#0F6E56' : '#7A8F8E' }}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: '#7A8F8E' }}>
      <i className="fa-solid fa-folder-open" style={{ fontSize: 32, marginBottom: 12, display: 'block', color: '#D1D9D8' }} />
      <div style={{ fontSize: 12 }}>{msg}</div>
    </div>
  )
}

export default function PortalContadorPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cont, setCont] = useState<ContadorInfo | null>(null)
  const [tab, setTab] = useState<Tab>('dre')
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [notas, setNotas] = useState<NotaEmitida[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/contador/${token}?tab=info`)
      .then(async r => {
        if (r.status === 401) { setError('invalid'); return }
        if (r.status === 403) { setError('revoked'); return }
        const d = await r.json() as ContadorInfo
        setCont(d)
      })
      .catch(() => setError('network'))
      .finally(() => setLoading(false))
  }, [token])

  const carregarTab = useCallback(async (t: Tab) => {
    if (!token) return
    setDataLoading(true)
    try {
      const res = await fetch(`/api/contador/${token}?tab=${t}`)
      if (!res.ok) return
      const { data } = await res.json() as { data: unknown[] }
      if (t === 'dre') setMetricas(data as Metrica[])
      else if (t === 'lancamentos') setLancamentos(data as Lancamento[])
      else if (t === 'notas') setNotas(data as NotaEmitida[])
      else if (t === 'despesas') setDespesas(data as Despesa[])
    } finally { setDataLoading(false) }
  }, [token])

  useEffect(() => { if (cont) void carregarTab(tab) }, [cont, tab, carregarTab])

  // Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#7A8F8E', fontSize: 13 }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block', color: '#5E8C87' }} />
        Carregando portal...
      </div>
    </div>
  )

  // Erro
  if (error || !cont) {
    const isRevoked = error === 'revoked'
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: isRevoked ? '#FEE2E2' : '#EEF2F1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className={`fa-solid ${isRevoked ? 'fa-ban' : 'fa-lock'}`} style={{ fontSize: 24, color: isRevoked ? '#E74C3C' : '#7A8F8E' }} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#1C2B2A', marginBottom: 8 }}>
            {isRevoked ? 'Acesso revogado' : 'Acesso inválido'}
          </div>
          <div style={{ fontSize: 12, color: '#7A8F8E', lineHeight: 1.6 }}>
            {isRevoked
              ? 'O cliente revogou seu acesso a este portal. Entre em contato para solicitar reativação.'
              : 'Token expirado ou inválido. Solicite um novo link de acesso ao seu cliente.'}
          </div>
        </div>
      </div>
    )
  }

  const perm = cont.permissoes ?? {}
  const tabsVisiveis = TABS.filter(t => perm[PERM_KEYS[t]] !== false)

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F5' }}>
      {/* Topbar */}
      <div style={{ background: '#1C2B2A', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Factor<span style={{ color: '#7EBDB8' }}>One</span>
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Portal do Contador</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#EAF5F3', color: '#0F6E56', fontWeight: 700 }}>
            ✓ Somente leitura
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* Card de boas-vindas */}
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#1C2B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-calculator" style={{ fontSize: 18, color: '#7EBDB8' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Olá, {cont.nome}
                </div>
                <div style={{ fontSize: 11, color: '#7A8F8E', marginTop: 3 }}>
                  {cont.empresa_nome ? `Empresa: ${cont.empresa_nome} · ` : ''}Acesso em tempo real · Dados confidenciais
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <PermBadge ok={perm.ver_dre !== false} label="DRE" />
              <PermBadge ok={perm.ver_lancamentos !== false} label="Lançamentos" />
              <PermBadge ok={perm.ver_notas !== false} label="Notas" />
              <PermBadge ok={perm.ver_despesas !== false} label="Despesas" />
              <PermBadge ok={perm.exportar !== false} label="Exportar" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: '#E8EDEC', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
          {tabsVisiveis.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: tab === t ? 700 : 500,
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#1C2B2A' : '#7A8F8E',
              transition: 'all 0.15s',
            }}>
              <i className={`fa-solid ${TAB_ICONS[t]}`} style={{ fontSize: 10 }} />
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
          {dataLoading && (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 20, color: '#5E8C87' }} />
            </div>
          )}

          {/* DRE */}
          {!dataLoading && tab === 'dre' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-chart-bar" style={{ fontSize: 13, color: '#5E8C87' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>DRE — Últimos 12 meses</span>
              </div>
              {metricas.length === 0 ? <EmptyState msg="Sem dados de DRE. Execute o recálculo no módulo Relatórios." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Competência', 'Receita Bruta', 'EBITDA', 'Lucro Líquido', 'Margem'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Competência' ? 'left' : 'right', background: '#F8FAFA', borderBottom: '0.5px solid #E2E8E7', fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricas.map((m, i) => (
                        <tr key={m.competencia} style={{ borderBottom: i < metricas.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1C2B2A', fontFamily: 'monospace' }}>{m.competencia?.slice(0, 7)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>{formatBRL(m.receita_bruta)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", color: '#7A8F8E' }}>{formatBRL(m.ebitda)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: m.lucro_liquido >= 0 ? '#5E8C87' : '#E74C3C' }}>
                            {formatBRL(m.lucro_liquido)}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: Number(m.margem_liquida) >= 0.1 ? '#EAF5F3' : '#FEF3C7', color: Number(m.margem_liquida) >= 0.1 ? '#0F6E56' : '#92400E' }}>
                              {(Number(m.margem_liquida) * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Lançamentos */}
          {!dataLoading && tab === 'lancamentos' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-list" style={{ fontSize: 13, color: '#5E8C87' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>Lançamentos contábeis</span>
                <span style={{ fontSize: 10, color: '#7A8F8E', marginLeft: 'auto' }}>{lancamentos.length} registros</span>
              </div>
              {lancamentos.length === 0 ? <EmptyState msg="Sem lançamentos registrados." /> : (
                lancamentos.map((l, i) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < lancamentos.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: l.tipo === 'credito' ? '#EAF5F3' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${l.tipo === 'credito' ? 'fa-arrow-down' : 'fa-arrow-up'}`} style={{ fontSize: 12, color: l.tipo === 'credito' ? '#5E8C87' : '#E74C3C' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</div>
                      <div style={{ fontSize: 10, color: '#7A8F8E', marginTop: 2 }}>{l.competencia?.slice(0, 7)} · {l.origem}</div>
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: l.tipo === 'credito' ? '#5E8C87' : '#E74C3C', flexShrink: 0 }}>
                      {l.tipo === 'credito' ? '+' : '-'}{formatBRL(l.valor)}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Notas */}
          {!dataLoading && tab === 'notas' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-file-invoice" style={{ fontSize: 13, color: '#5E8C87' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>Notas fiscais emitidas</span>
                <span style={{ fontSize: 10, color: '#7A8F8E', marginLeft: 'auto' }}>{notas.length} emitidas</span>
              </div>
              {notas.length === 0 ? <EmptyState msg="Sem notas emitidas no período." /> : (
                notas.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < notas.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: n.status === 'autorizada' ? '#EAF5F3' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${n.status === 'autorizada' ? 'fa-file-check' : 'fa-file-clock'}`} style={{ fontSize: 12, color: n.status === 'autorizada' ? '#5E8C87' : '#D97706' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>{n.destinatario_nome ?? '—'}</div>
                      <div style={{ fontSize: 10, color: '#7A8F8E', marginTop: 2 }}>NF {n.numero ?? 'pendente'} · {n.created_at?.slice(0, 10)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: n.status === 'autorizada' ? '#EAF5F3' : '#FEF3C7', color: n.status === 'autorizada' ? '#0F6E56' : '#92400E' }}>
                        {n.status}
                      </span>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: '#1C2B2A' }}>{formatBRL(n.valor_total)}</div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Despesas */}
          {!dataLoading && tab === 'despesas' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: 13, color: '#5E8C87' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>Despesas</span>
                <span style={{ fontSize: 10, color: '#7A8F8E', marginLeft: 'auto' }}>{despesas.length} registros</span>
              </div>
              {despesas.length === 0 ? <EmptyState msg="Sem despesas registradas no período." /> : (
                despesas.map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < despesas.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EEF2F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-receipt" style={{ fontSize: 12, color: '#7A8F8E' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.descricao}</div>
                      <div style={{ fontSize: 10, color: '#7A8F8E', marginTop: 2 }}>{d.categoria} · {d.data_despesa ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: d.status === 'pago' ? '#EAF5F3' : '#FEF3C7', color: d.status === 'pago' ? '#0F6E56' : '#92400E' }}>
                        {d.status}
                      </span>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: '#E74C3C' }}>{formatBRL(Number(d.valor))}</div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#AAB8B7' }}>
          FactorOne Finance OS · Portal somente leitura · Dados confidenciais · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

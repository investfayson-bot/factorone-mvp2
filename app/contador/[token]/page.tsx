'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'

type Permissoes = Record<string, boolean>
type ContadorInfo = { nome: string; status: string; permissoes: Permissoes; empresa_nome?: string }
type Metrica = { competencia: string; receita_bruta: number; lucro_liquido: number; ebitda: number; margem_liquida: number }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; competencia: string; origem: string }
type NotaEmitida = { id: string; numero: string | null; destinatario_nome: string | null; valor_total: number; status: string; created_at: string; xml_url: string | null; pdf_url: string | null }
type Despesa = { id: string; descricao: string; valor: number; categoria: string; status: string; data_despesa: string | null }

const TABS = ['dre', 'lancamentos', 'notas', 'despesas'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { dre: 'DRE', lancamentos: 'Lançamentos', notas: 'Notas Fiscais', despesas: 'Despesas' }
const TAB_ICONS: Record<Tab, string> = { dre: 'fa-chart-bar', lancamentos: 'fa-list', notas: 'fa-file-invoice', despesas: 'fa-receipt' }
const PERM_KEYS: Record<Tab, string> = { dre: 'ver_dre', lancamentos: 'ver_lancamentos', notas: 'ver_notas', despesas: 'ver_despesas' }

function PermBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: ok ? '#E9F0ED' : '#F1ECE1', color: ok ? '#2B564D' : '#7B8C88' }}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: '#7B8C88' }}>
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
  const [competencia, setCompetencia] = useState('') // YYYY-MM (filtro de exportacao)

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
    <div style={{ minHeight: '100vh', background: '#F7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#7B8C88', fontSize: 13 }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block', color: '#3D7A6E' }} />
        Carregando portal...
      </div>
    </div>
  )

  // Erro
  if (error || !cont) {
    const isRevoked = error === 'revoked'
    return (
      <div style={{ minHeight: '100vh', background: '#F7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: isRevoked ? '#F4E4E1' : '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className={`fa-solid ${isRevoked ? 'fa-ban' : 'fa-lock'}`} style={{ fontSize: 24, color: isRevoked ? '#B0413E' : '#7B8C88' }} />
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, color: '#13201D', marginBottom: 8 }}>
            {isRevoked ? 'Acesso revogado' : 'Acesso inválido'}
          </div>
          <div style={{ fontSize: 12, color: '#7B8C88', lineHeight: 1.6 }}>
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
  const podeExportar = perm.exportar !== false
  const exportavel = tab === 'dre' || tab === 'lancamentos' || tab === 'despesas'
  const exportUrl = `/api/contador/${token}/export?tipo=${tab}${competencia ? `&competencia=${competencia}` : ''}`

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EE' }}>
      {/* Topbar */}
      <div style={{ background: '#13201D', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Factor<span style={{ color: '#6FA595' }}>One</span>
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Portal do Contador</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#E9F0ED', color: '#2B564D', fontWeight: 700 }}>
            ✓ Somente leitura
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* Card de boas-vindas */}
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: '#13201D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-calculator" style={{ fontSize: 18, color: '#6FA595' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>
                  Olá, {cont.nome}
                </div>
                <div style={{ fontSize: 11, color: '#7B8C88', marginTop: 3 }}>
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

        {/* KPI cards resumo */}
        {metricas.length > 0 && (() => {
          const ultimo = metricas[0]
          return (
            <div className="kpis" style={{ marginBottom: 16 }}>
              <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
                <div className="kpi-lbl">Receita Bruta <div style={{ width: 26, height: 26, borderRadius: 7, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-arrow-trend-up" style={{ fontSize: 11, color: '#3D7A6E' }} /></div></div>
                <div className="kpi-val">{formatBRL(ultimo.receita_bruta)}</div>
                <div className="kpi-delta">{ultimo.competencia?.slice(0, 7)}</div>
              </div>
              <div className="kpi" style={{ borderTop: `3px solid ${ultimo.lucro_liquido >= 0 ? '#3D7A6E' : '#B0413E'}` }}>
                <div className="kpi-lbl">Lucro Líquido <div style={{ width: 26, height: 26, borderRadius: 7, background: ultimo.lucro_liquido >= 0 ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-chart-line" style={{ fontSize: 11, color: ultimo.lucro_liquido >= 0 ? '#3D7A6E' : '#B0413E' }} /></div></div>
                <div className="kpi-val">{formatBRL(ultimo.lucro_liquido)}</div>
                <div className={`kpi-delta ${ultimo.lucro_liquido >= 0 ? 'up' : 'dn'}`}>Margem {(Number(ultimo.margem_liquida) * 100).toFixed(1)}%</div>
              </div>
              <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
                <div className="kpi-lbl">EBITDA <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-gauge-high" style={{ fontSize: 11, color: '#B08A3E' }} /></div></div>
                <div className="kpi-val">{formatBRL(ultimo.ebitda)}</div>
                <div className="kpi-delta">mês atual</div>
              </div>
              <div className="kpi" style={{ borderTop: '3px solid #7A6A9E' }}>
                <div className="kpi-lbl">Meses analisados <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-calendar" style={{ fontSize: 11, color: '#7A6A9E' }} /></div></div>
                <div className="kpi-val">{metricas.length}</div>
                <div className="kpi-delta">histórico disponível</div>
              </div>
            </div>
          )
        })()}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
          {tabsVisiveis.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: tab === t ? 700 : 500,
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#13201D' : '#7B8C88',
              transition: 'all 0.15s',
            }}>
              <i className={`fa-solid ${TAB_ICONS[t]}`} style={{ fontSize: 10 }} />
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
          {podeExportar && exportavel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1' }}>
              <span style={{ fontSize: 11, color: '#7B8C88', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-filter" style={{ fontSize: 10 }} />
                Filtrar competência (opcional)
              </span>
              <input
                type="month"
                value={competencia}
                onChange={e => setCompetencia(e.target.value)}
                style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '0.5px solid #E4DCCC', color: '#13201D', background: '#fff' }}
              />
              {competencia && (
                <button onClick={() => setCompetencia('')} title="Limpar filtro" style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: '#fff', color: '#7B8C88', cursor: 'pointer' }}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
              <a
                href={exportUrl}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, background: '#13201D', color: '#fff', textDecoration: 'none' }}
              >
                <i className="fa-solid fa-file-csv" />
                Baixar CSV
              </a>
            </div>
          )}

          {dataLoading && (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 20, color: '#3D7A6E' }} />
            </div>
          )}

          {/* DRE */}
          {!dataLoading && tab === 'dre' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-chart-bar" style={{ fontSize: 13, color: '#3D7A6E' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>DRE — Últimos 12 meses</span>
              </div>
              {metricas.length === 0 ? <EmptyState msg="Sem dados de DRE. Execute o recálculo no módulo Relatórios." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Competência', 'Receita Bruta', 'EBITDA', 'Lucro Líquido', 'Margem'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Competência' ? 'left' : 'right', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC', fontSize: 10, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricas.map((m, i) => (
                        <tr key={m.competencia} style={{ borderBottom: i < metricas.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#13201D', fontFamily: 'monospace' }}>{m.competencia?.slice(0, 7)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "var(--font-sans)", fontWeight: 500 }}>{formatBRL(m.receita_bruta)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "var(--font-sans)", color: '#7B8C88' }}>{formatBRL(m.ebitda)}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: "var(--font-sans)", fontWeight: 700, color: m.lucro_liquido >= 0 ? '#3D7A6E' : '#B0413E' }}>
                            {formatBRL(m.lucro_liquido)}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: Number(m.margem_liquida) >= 0.1 ? '#E9F0ED' : '#F3ECDA', color: Number(m.margem_liquida) >= 0.1 ? '#2B564D' : '#B08A3E' }}>
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
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-list" style={{ fontSize: 13, color: '#3D7A6E' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>Lançamentos contábeis</span>
                <span style={{ fontSize: 10, color: '#7B8C88', marginLeft: 'auto' }}>{lancamentos.length} registros</span>
              </div>
              {lancamentos.length === 0 ? <EmptyState msg="Sem lançamentos registrados." /> : (
                lancamentos.map((l, i) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < lancamentos.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: l.tipo === 'credito' ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${l.tipo === 'credito' ? 'fa-arrow-down' : 'fa-arrow-up'}`} style={{ fontSize: 12, color: l.tipo === 'credito' ? '#3D7A6E' : '#B0413E' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</div>
                      <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>{l.competencia?.slice(0, 7)} · {l.origem}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, color: l.tipo === 'credito' ? '#3D7A6E' : '#B0413E', flexShrink: 0 }}>
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
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-file-invoice" style={{ fontSize: 13, color: '#3D7A6E' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>Notas fiscais emitidas</span>
                <span style={{ fontSize: 10, color: '#7B8C88', marginLeft: 'auto' }}>{notas.length} emitidas</span>
              </div>
              {notas.length === 0 ? <EmptyState msg="Sem notas emitidas no período." /> : (
                notas.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < notas.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: n.status === 'autorizada' ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${n.status === 'autorizada' ? 'fa-file-check' : 'fa-file-clock'}`} style={{ fontSize: 12, color: n.status === 'autorizada' ? '#3D7A6E' : '#B08A3E' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>{n.destinatario_nome ?? '—'}</div>
                      <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>NF {n.numero ?? 'pendente'} · {n.created_at?.slice(0, 10)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {podeExportar && n.xml_url && (
                        <a href={n.xml_url} target="_blank" rel="noopener noreferrer" title="Baixar XML" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #E4DCCC', color: '#3D7A6E', textDecoration: 'none' }}>
                          <i className="fa-solid fa-code" style={{ marginRight: 4 }} />XML
                        </a>
                      )}
                      {podeExportar && n.pdf_url && (
                        <a href={n.pdf_url} target="_blank" rel="noopener noreferrer" title="Baixar DANFE (PDF)" style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #E4DCCC', color: '#B0413E', textDecoration: 'none' }}>
                          <i className="fa-solid fa-file-pdf" style={{ marginRight: 4 }} />PDF
                        </a>
                      )}
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: n.status === 'autorizada' ? '#E9F0ED' : '#F3ECDA', color: n.status === 'autorizada' ? '#2B564D' : '#B08A3E' }}>
                        {n.status}
                      </span>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, color: '#13201D' }}>{formatBRL(n.valor_total)}</div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Despesas */}
          {!dataLoading && tab === 'despesas' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: 13, color: '#3D7A6E' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>Despesas</span>
                <span style={{ fontSize: 10, color: '#7B8C88', marginLeft: 'auto' }}>{despesas.length} registros</span>
              </div>
              {despesas.length === 0 ? <EmptyState msg="Sem despesas registradas no período." /> : (
                despesas.map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < despesas.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-receipt" style={{ fontSize: 12, color: '#7B8C88' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.descricao}</div>
                      <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>{d.categoria} · {d.data_despesa ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: d.status === 'pago' ? '#E9F0ED' : '#F3ECDA', color: d.status === 'pago' ? '#2B564D' : '#B08A3E' }}>
                        {d.status}
                      </span>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, color: '#B0413E' }}>{formatBRL(Number(d.valor))}</div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#A6B0AC' }}>
          FactorOne Finance OS · Portal somente leitura · Dados confidenciais · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'

type Permissoes = Record<string, boolean>
type ContadorInfo = { nome: string; status: string; permissoes: Permissoes }
type Metrica = { competencia: string; receita_bruta: number; lucro_liquido: number; ebitda: number; margem_liquida: number }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; competencia: string; origem: string }
type NotaEmitida = { id: string; numero: string | null; destinatario_nome: string | null; valor_total: number; status: string; created_at: string }
type Despesa = { id: string; descricao: string; valor: number; categoria: string; status: string; data_despesa: string | null }

const TABS = ['dre', 'lancamentos', 'notas', 'despesas'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { dre: 'DRE', lancamentos: 'Lançamentos', notas: 'Notas Fiscais', despesas: 'Despesas' }
const PERM_KEYS: Record<Tab, string> = { dre: 'ver_dre', lancamentos: 'ver_lancamentos', notas: 'ver_notas', despesas: 'ver_despesas' }

function Tag({ v, label }: { v: boolean; label: string }) {
  return (
    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: v ? 'rgba(45,155,111,.1)' : 'rgba(192,80,74,.08)', color: v ? '#2d9b6f' : '#c0504a', fontWeight: 600 }}>
      {label}: {v ? 'sim' : 'não'}
    </span>
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
    } finally {
      setDataLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (cont) void carregarTab(tab)
  }, [cont, tab, carregarTab])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Carregando portal...</div>
      </div>
    )
  }

  if (error === 'invalid' || !cont) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 8 }}>Acesso inválido</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Token expirado ou inválido. Solicite um novo link de acesso ao seu cliente.</div>
        </div>
      </div>
    )
  }

  if (error === 'revoked') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⛔</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 8 }}>Acesso revogado</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>O cliente revogou seu acesso a este portal. Entre em contato para solicitar reativação.</div>
        </div>
      </div>
    )
  }

  const perm = cont.permissoes ?? {}
  const tabsVisiveis = TABS.filter(t => perm[PERM_KEYS[t]] !== false)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 18, color: '#1e293b' }}>
                Factor<span style={{ color: '#0f766e' }}>One</span> — Portal do Contador
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Olá, <strong>{cont.nome}</strong> · Acesso somente leitura · Dados em tempo real
              </div>
            </div>
            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'rgba(45,155,111,.1)', color: '#2d9b6f', fontWeight: 700 }}>
              ✓ {cont.status}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Tag v={perm.ver_dre !== false} label="DRE" />
            <Tag v={perm.ver_lancamentos !== false} label="Lançamentos" />
            <Tag v={perm.ver_notas !== false} label="Notas" />
            <Tag v={perm.ver_despesas !== false} label="Despesas" />
            <Tag v={perm.exportar !== false} label="Exportar" />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {tabsVisiveis.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? '#0f766e' : '#fff',
              color: tab === t ? '#fff' : '#475569',
              border: tab === t ? 'none' : '1px solid #e2e8f0',
              transition: 'all .15s',
            }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px' }}>
          {dataLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Carregando...</div>
          )}

          {!dataLoading && tab === 'dre' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>DRE — Últimos 12 meses</div>
              {metricas.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0' }}>Sem dados de DRE. Execute o recálculo no módulo Relatórios.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Competência', 'Receita Bruta', 'EBITDA', 'Lucro Líquido', 'Margem'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Competência' ? 'left' : 'right', color: '#64748b', fontWeight: 700, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metricas.map(m => (
                      <tr key={m.competencia} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '10px', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{m.competencia?.slice(0, 7)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{formatBRL(m.receita_bruta)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{formatBRL(m.ebitda)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.lucro_liquido >= 0 ? '#2d9b6f' : '#c0504a' }}>
                          {formatBRL(m.lucro_liquido)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#64748b', fontFamily: 'monospace' }}>
                          {(Number(m.margem_liquida) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {!dataLoading && tab === 'lancamentos' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Lançamentos Contábeis</div>
              {lancamentos.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0' }}>Sem lançamentos registrados.</div>
              ) : lancamentos.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{l.descricao}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{l.competencia?.slice(0, 7)} · {l.origem}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13, color: l.tipo === 'credito' ? '#2d9b6f' : '#c0504a' }}>
                    {l.tipo === 'credito' ? '+' : '-'}{formatBRL(l.valor)}
                  </div>
                </div>
              ))}
            </>
          )}

          {!dataLoading && tab === 'notas' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Notas Fiscais Emitidas</div>
              {notas.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0' }}>Sem notas emitidas.</div>
              ) : notas.map(n => (
                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{n.destinatario_nome ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>NF {n.numero ?? 'pendente'} · {n.created_at?.slice(0, 10)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: n.status === 'autorizada' ? 'rgba(45,155,111,.1)' : '#f1f5f9', color: n.status === 'autorizada' ? '#2d9b6f' : '#64748b' }}>
                      {n.status}
                    </span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{formatBRL(n.valor_total)}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!dataLoading && tab === 'despesas' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Despesas</div>
              {despesas.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0' }}>Sem despesas registradas.</div>
              ) : despesas.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{d.descricao}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d.categoria} · {d.data_despesa ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>{d.status}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{formatBRL(Number(d.valor))}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' }}>
          FactorOne Finance OS · Portal somente leitura · Dados confidenciais
        </div>
      </div>
    </div>
  )
}

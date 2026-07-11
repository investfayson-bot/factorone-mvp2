'use client'

import { Fragment, useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import NovaContaPagarModal from '@/components/financeiro/NovaContaPagarModal'

type ContaPagar = {
  id: string; fornecedor_nome: string; descricao: string; categoria: string
  data_vencimento: string; valor: number; valor_pago: number; status: string
  observacoes?: string | null; comprovante_url?: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function diasAte(d: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(d + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

function StatusChip({ status, dias }: { status: string; dias: number }) {
  if (status === 'paga') return <span className="chip-v2 g">Paga</span>
  if (status === 'vencida' || dias < 0) return <span className="chip-v2 r">Vencida</span>
  if (dias <= 5) return <span className="chip-v2 y">A vencer</span>
  return <span className="chip-v2 g">Programada</span>
}

const STATUS_FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'a_vencer', label: 'A vencer' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'paga', label: 'Pagas' },
] as const

function ContasAPagarInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<typeof STATUS_FILTROS[number]['key']>('todas')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const h = await authHeaders()
      const r = await fetch('/api/financeiro/pagar?status=todas', { headers: h }).then(x => x.json()).catch(() => ({ data: [] }))
      setContas((r.data || []) as ContaPagar[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setModalAberto(true)
      router.replace('/dashboard/financeiro/contas-a-pagar')
    }
  }, [searchParams, router])

  const filtradas = useMemo(() => {
    return contas.filter(c => {
      const dias = diasAte(c.data_vencimento)
      if (filtroStatus === 'todas') return true
      if (filtroStatus === 'paga') return c.status === 'paga'
      if (filtroStatus === 'vencida') return c.status === 'vencida' || (c.status !== 'paga' && dias < 0)
      if (filtroStatus === 'a_vencer') return c.status !== 'paga' && dias >= 0
      return true
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [contas, filtroStatus])

  const kpis = useMemo(() => {
    const aberto = contas.filter(c => c.status !== 'paga')
    const totalAberto = aberto.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_pago || 0), 0)
    const vencendo7 = aberto.filter(c => diasAte(c.data_vencimento) >= 0 && diasAte(c.data_vencimento) <= 7)
    const totalVencendo7 = vencendo7.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_pago || 0), 0)
    const vencidas = aberto.filter(c => diasAte(c.data_vencimento) < 0)
    const totalVencido = vencidas.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_pago || 0), 0)
    return { totalAberto, totalVencendo7, totalVencido }
  }, [contas])

  async function pagar(id: string, valor: number) {
    setActionLoading(id)
    try {
      const h = await authHeaders()
      await fetch(`/api/financeiro/pagar/${id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ data_pagamento: new Date().toISOString().slice(0, 10), valor_pago: valor, tipo_pagamento: 'pix' }),
      })
      await carregar()
    } finally { setActionLoading(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div className="kpi-v2"><div className="l">Total em aberto (mês)</div><div className="v">{formatBRL(kpis.totalAberto)}</div></div>
        <div className="kpi-v2 warn"><div className="l">Vencendo em 7 dias</div><div className="v">{formatBRL(kpis.totalVencendo7)}</div></div>
        <div className="kpi-v2 neg"><div className="l">Vencido</div><div className="v" style={{ color: kpis.totalVencido > 0 ? 'var(--neg)' : undefined }}>{formatBRL(kpis.totalVencido)}</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="pill-sel-v2">
          {STATUS_FILTROS.map(f => (
            <span key={f.key} className={filtroStatus === f.key ? 'on' : ''} onClick={() => setFiltroStatus(f.key)}>{f.label}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>{filtradas.length} título{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-v2">
          <thead>
            <tr>
              <th style={{ padding: '10px 16px' }}>Fornecedor</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', padding: '10px 16px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Nenhuma conta a pagar neste filtro.</td></tr>
            ) : filtradas.map(c => {
              const aberto = expandido === c.id
              const historico = contas.filter(x => x.status === 'paga' && x.fornecedor_nome === c.fornecedor_nome && x.id !== c.id)
              return (
                <Fragment key={c.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandido(aberto ? null : c.id)}>
                    <td style={{ padding: '9px 16px', fontWeight: 700, color: 'var(--ink)' }}>{c.fornecedor_nome || c.descricao}</td>
                    <td>{c.categoria || '—'}</td>
                    <td>{fmtDate(c.data_vencimento)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td><StatusChip status={c.status} dias={diasAte(c.data_vencimento)} /></td>
                    <td style={{ textAlign: 'right', padding: '9px 16px' }}>
                      {c.status !== 'paga' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void pagar(c.id, Number(c.valor || 0) - Number(c.valor_pago || 0)) }}
                          disabled={actionLoading === c.id}
                          className="btn-v2 primary"
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
                        >
                          {actionLoading === c.id ? '...' : 'Pagar'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {aberto && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--bg)', padding: '12px 16px', fontSize: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>Histórico com {c.fornecedor_nome}</div>
                            {historico.length === 0 ? (
                              <div style={{ color: 'var(--mut)' }}>Sem pagamentos anteriores registrados.</div>
                            ) : historico.slice(0, 5).map(h => (
                              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--mut)' }}>
                                <span>{fmtDate(h.data_vencimento)}</span><span>{formatBRL(Number(h.valor))}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>Comprovante & observação</div>
                            {c.comprovante_url ? (
                              <a href={c.comprovante_url} target="_blank" rel="noreferrer" className="link-v2">Ver comprovante anexado</a>
                            ) : (
                              <div style={{ color: 'var(--mut)' }}>Nenhum comprovante anexado.</div>
                            )}
                            <div style={{ marginTop: 6, color: 'var(--mut)' }}>{c.observacoes || 'Sem observações.'}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <NovaContaPagarModal open={modalAberto} onClose={() => setModalAberto(false)} onSaved={carregar} />
    </div>
  )
}

export default function ContasAPagarPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px 0', color: 'var(--mut)' }}>Carregando…</div>}>
      <ContasAPagarInner />
    </Suspense>
  )
}

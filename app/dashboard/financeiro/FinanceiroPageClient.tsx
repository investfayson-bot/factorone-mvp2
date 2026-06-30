'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import NovaContaPagarModal from '@/components/financeiro/NovaContaPagarModal'
import NovaContaReceberModal from '@/components/financeiro/NovaContaReceberModal'
import Conciliacao from '@/components/financeiro/Conciliacao'
import AgingReport from '@/components/financeiro/AgingReport'

type ContaPagar = {
  id: string; fornecedor_nome: string; descricao: string
  categoria: string; data_vencimento: string
  valor: number; valor_pago: number; status: string
}
type ContaReceber = {
  id: string; cliente_nome: string; descricao: string
  data_vencimento: string; valor: number; valor_recebido: number
  status: string; dias_atraso: number; cliente_email?: string | null
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

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pendente: { bg: '#FEF3C7', color: '#92400E', label: 'Pendente' },
    vencida:  { bg: '#FEE2E2', color: '#991B1B', label: 'Vencida' },
    paga:     { bg: '#EAF5F3', color: '#0F6E56', label: 'Paga' },
    recebida: { bg: '#EAF5F3', color: '#0F6E56', label: 'Recebida' },
    cancelada:{ bg: '#EEF2F1', color: '#7A8F8E', label: 'Cancelada' },
  }
  const s = map[status] ?? { bg: '#EEF2F1', color: '#7A8F8E', label: status }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function FinanceiroInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<'resumo' | 'pagar' | 'receber' | 'conciliacao' | 'aging'>('resumo')
  const [pagar, setPagar] = useState<ContaPagar[]>([])
  const [receber, setReceber] = useState<ContaReceber[]>([])
  const [fStatusPagar, setFStatusPagar] = useState('todas')
  const [fStatusReceber, setFStatusReceber] = useState('todas')
  const [openPagar, setOpenPagar] = useState(false)
  const [openReceber, setOpenReceber] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const t = tabParam
    if (t === 'pagar' || t === 'receber' || t === 'conciliacao' || t === 'aging') setTab(t)
    else setTab('resumo')
  }, [tabParam])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const h = await authHeaders()
      const [p, r] = await Promise.all([
        fetch(`/api/financeiro/pagar?status=${fStatusPagar}`, { headers: h }).then(x => x.json()).catch(() => ({ data: [] })),
        fetch(`/api/financeiro/receber?status=${fStatusReceber}`, { headers: h }).then(x => x.json()).catch(() => ({ data: [] })),
      ])
      setPagar((p.data || []) as ContaPagar[])
      setReceber((r.data || []) as ContaReceber[])
    } finally {
      setLoading(false)
    }
  }, [fStatusPagar, fStatusReceber])

  useEffect(() => { void carregar() }, [carregar])

  const kpis = useMemo(() => {
    const pagarPend = pagar.filter(x => x.status === 'pendente' || x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_pago || 0), 0)
    const receberPend = receber.filter(x => x.status === 'pendente' || x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_recebido || 0), 0)
    const vencidasPagar = pagar.filter(x => x.status === 'vencida').length
    const vencidasReceber = receber.filter(x => x.status === 'vencida').length
    const saldo = receberPend - pagarPend
    return { pagarPend, receberPend, vencidasPagar, vencidasReceber, saldo }
  }, [pagar, receber])

  async function registrarPagamento(id: string, valor: number) {
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

  async function registrarRecebimento(id: string, valor: number, vencida: boolean) {
    setActionLoading(id)
    try {
      const h = await authHeaders()
      await fetch(`/api/financeiro/receber/${id}/receber`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ data_recebimento: new Date().toISOString().slice(0, 10), valor_recebido: valor, cobrar_juros: vencida }),
      })
      await carregar()
    } finally { setActionLoading(null) }
  }

  async function enviarCobranca(id: string) {
    setActionLoading(id)
    try {
      const h = await authHeaders()
      await fetch('/api/financeiro/cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ action: 'enviar', conta_receber_id: id }),
      })
    } finally { setActionLoading(null) }
  }

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Financeiro</div>
          <div className="page-sub">Contas a pagar e receber · Conciliação · Aging report</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 12 }}
            onClick={async () => {
              const { baixarArquivo } = await import('@/lib/download-arquivo')
              const r = await baixarArquivo('/api/financeiro/exportar-pdf', 'financeiro.pdf')
              if ('erro' in r) { const { default: toast } = await import('react-hot-toast'); toast.error(r.erro) }
            }}
          >
            <i className="fa-solid fa-file-pdf" style={{ marginRight: 6, color: '#E74C3C' }} />PDF
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpenReceber(true)}>
            <i className="fa-solid fa-arrow-down-circle" style={{ marginRight: 6, color: '#5E8C87' }} />A receber
          </button>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setOpenPagar(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />A pagar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #E74C3C' }}>
          <div className="kpi-lbl">
            A Pagar
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-up-circle" style={{ fontSize: 12, color: '#E74C3C' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.pagarPend)}</div>
          <div className={`kpi-delta ${kpis.vencidasPagar > 0 ? 'dn' : ''}`}>
            {kpis.vencidasPagar > 0 ? `⚠ ${kpis.vencidasPagar} vencida${kpis.vencidasPagar > 1 ? 's' : ''}` : `${pagar.filter(x => x.status === 'pendente').length} pendentes`}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #5E8C87' }}>
          <div className="kpi-lbl">
            A Receber
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EAF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-down-circle" style={{ fontSize: 12, color: '#5E8C87' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.receberPend)}</div>
          <div className={`kpi-delta ${kpis.vencidasReceber > 0 ? 'warn' : 'up'}`}>
            {kpis.vencidasReceber > 0 ? `⚠ ${kpis.vencidasReceber} vencida${kpis.vencidasReceber > 1 ? 's' : ''}` : `${receber.filter(x => x.status === 'pendente').length} pendentes`}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${kpis.saldo >= 0 ? '#5E8C87' : '#E74C3C'}` }}>
          <div className="kpi-lbl">
            Saldo projetado
            <div style={{ width: 28, height: 28, borderRadius: 8, background: kpis.saldo >= 0 ? '#EAF5F3' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-scale-balanced" style={{ fontSize: 12, color: kpis.saldo >= 0 ? '#5E8C87' : '#E74C3C' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.saldo)}</div>
          <div className={`kpi-delta ${kpis.saldo >= 0 ? 'up' : 'dn'}`}>
            {kpis.saldo >= 0 ? '↑ A receber supera a pagar' : '↓ A pagar supera a receber'}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7C3AED' }}>
          <div className="kpi-lbl">
            Total de lançamentos
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 12, color: '#7C3AED' }} />
            </div>
          </div>
          <div className="kpi-val">{pagar.length + receber.length}</div>
          <div className="kpi-delta">{pagar.length} pagar · {receber.length} receber</div>
        </div>
      </div>

      {/* A PAGAR */}
      {tab === 'resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFA' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>Próximas a pagar</div>
              <button onClick={() => setTab('pagar')} style={{ fontSize: 10, color: '#5E8C87', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {pagar.filter(c => c.status !== 'paga').slice(0, 5).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#7A8F8E' }}>Nada pendente</div>
            ) : pagar.filter(c => c.status !== 'paga').slice(0, 5).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fornecedor_nome || c.descricao}</div>
                  <div style={{ fontSize: 10, color: '#7A8F8E' }}>{fmtDate(c.data_vencimento)}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E74C3C', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</div>
                <StatusTag status={c.status} />
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFA' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>Próximas a receber</div>
              <button onClick={() => setTab('receber')} style={{ fontSize: 10, color: '#5E8C87', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {receber.filter(c => c.status !== 'recebida').slice(0, 5).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#7A8F8E' }}>Nada pendente</div>
            ) : receber.filter(c => c.status !== 'recebida').slice(0, 5).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_nome || c.descricao}</div>
                  <div style={{ fontSize: 10, color: '#7A8F8E' }}>{fmtDate(c.data_vencimento)}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5E8C87', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</div>
                <StatusTag status={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pagar' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }} value={fStatusPagar} onChange={e => setFStatusPagar(e.target.value)}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#7A8F8E' }}>{pagar.length} lançamento{pagar.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header tabela */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 100px 110px 90px 100px', padding: '10px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA' }}>
              {['Fornecedor', 'Descrição', 'Categoria', 'Vencimento', 'Valor', 'Status', 'Ação'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#7A8F8E', fontSize: 12 }}>Carregando...</div>
            ) : pagar.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <i className="fa-solid fa-check-circle" style={{ fontSize: 32, color: '#5E8C87', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B2A', marginBottom: 4 }}>Nenhuma conta a pagar</div>
                <div style={{ fontSize: 11, color: '#7A8F8E' }}>Tudo em dia ou sem lançamentos no período</div>
              </div>
            ) : pagar.map((c, i) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 100px 110px 90px 100px',
                padding: '11px 16px', borderBottom: i < pagar.length - 1 ? '0.5px solid #F0F4F3' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fornecedor_nome || '—'}</div>
                <div style={{ fontSize: 11, color: '#3A5150', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</div>
                <div style={{ fontSize: 11, color: '#7A8F8E' }}>{c.categoria || '—'}</div>
                <div style={{ fontSize: 11, color: c.status === 'vencida' ? '#E74C3C' : '#3A5150', fontWeight: c.status === 'vencida' ? 700 : 400 }}>{fmtDate(c.data_vencimento)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E74C3C', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</div>
                <div><StatusTag status={c.status} /></div>
                <div>
                  {c.status !== 'paga' && (
                    <button
                      onClick={() => void registrarPagamento(c.id, Number(c.valor || 0) - Number(c.valor_pago || 0))}
                      disabled={actionLoading === c.id}
                      style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#1C2B2A', color: '#fff', cursor: 'pointer', opacity: actionLoading === c.id ? 0.6 : 1 }}
                    >
                      {actionLoading === c.id ? '...' : 'Pagar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* A RECEBER */}
      {tab === 'receber' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }} value={fStatusReceber} onChange={e => setFStatusReceber(e.target.value)}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="recebida">Recebida</option>
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#7A8F8E' }}>{receber.length} lançamento{receber.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 100px 80px 110px 90px 130px', padding: '10px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA' }}>
              {['Cliente', 'Descrição', 'Vencimento', 'Atraso', 'Valor', 'Status', 'Ações'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#7A8F8E', fontSize: 12 }}>Carregando...</div>
            ) : receber.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: 32, color: '#5E8C87', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B2A', marginBottom: 4 }}>Nenhuma conta a receber</div>
                <div style={{ fontSize: 11, color: '#7A8F8E' }}>Sem lançamentos no período selecionado</div>
              </div>
            ) : receber.map((c, i) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 100px 80px 110px 90px 130px',
                padding: '11px 16px', borderBottom: i < receber.length - 1 ? '0.5px solid #F0F4F3' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_nome || '—'}</div>
                <div style={{ fontSize: 11, color: '#3A5150', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</div>
                <div style={{ fontSize: 11, color: '#3A5150' }}>{fmtDate(c.data_vencimento)}</div>
                <div style={{ fontSize: 11, fontWeight: c.dias_atraso > 0 ? 700 : 400, color: c.dias_atraso > 0 ? '#E74C3C' : '#7A8F8E' }}>
                  {c.dias_atraso > 0 ? `${c.dias_atraso}d` : '—'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5E8C87', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</div>
                <div><StatusTag status={c.status} /></div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {c.status !== 'recebida' && (
                    <button
                      onClick={() => void registrarRecebimento(c.id, Number(c.valor || 0) - Number(c.valor_recebido || 0), c.status === 'vencida')}
                      disabled={actionLoading === c.id}
                      style={{ fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 6, border: 'none', background: '#5E8C87', color: '#fff', cursor: 'pointer', opacity: actionLoading === c.id ? 0.6 : 1 }}
                    >
                      {actionLoading === c.id ? '...' : 'Receber'}
                    </button>
                  )}
                  <button
                    onClick={() => void enviarCobranca(c.id)}
                    disabled={actionLoading === c.id}
                    style={{ fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 6, border: '0.5px solid #E2E8E7', background: '#fff', color: '#3A5150', cursor: 'pointer' }}
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'conciliacao' && <Conciliacao />}
      {tab === 'aging' && <AgingReport />}

      <NovaContaPagarModal open={openPagar} onClose={() => setOpenPagar(false)} onSaved={carregar} />
      <NovaContaReceberModal open={openReceber} onClose={() => setOpenReceber(false)} onSaved={carregar} />
    </>
  )
}

export default function FinanceiroPageClient() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#7A8F8E', fontSize: 13 }}>Carregando…</div>}>
      <FinanceiroInner />
    </Suspense>
  )
}

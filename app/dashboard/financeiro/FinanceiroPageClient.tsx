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
    pendente: { bg: '#F3ECDA', color: '#B08A3E', label: 'Pendente' },
    vencida:  { bg: '#F4E4E1', color: '#B0413E', label: 'Vencida' },
    paga:     { bg: '#E9F0ED', color: '#2B564D', label: 'Paga' },
    recebida: { bg: '#E9F0ED', color: '#2B564D', label: 'Recebida' },
    cancelada:{ bg: '#F1ECE1', color: '#7B8C88', label: 'Cancelada' },
  }
  const s = map[status] ?? { bg: '#F1ECE1', color: '#7B8C88', label: status }
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
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
          <div className="page-title">Contas a Pagar & Receber</div>
          <div className="page-sub">Quem você deve pagar e quem te deve — compromissos assumidos, não o efeito no caixa</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 14 }}
            onClick={async () => {
              const { baixarArquivo } = await import('@/lib/download-arquivo')
              const r = await baixarArquivo('/api/financeiro/exportar-pdf', 'financeiro.pdf')
              if ('erro' in r) { const { default: toast } = await import('react-hot-toast'); toast.error(r.erro) }
            }}
          >
            <i className="fa-solid fa-file-pdf" style={{ marginRight: 6, color: '#B0413E' }} />PDF
          </button>
          <button className="btn-ghost" style={{ fontSize: 14 }} onClick={() => setOpenReceber(true)}>
            <i className="fa-solid fa-arrow-down-circle" style={{ marginRight: 6, color: '#3D7A6E' }} />A receber
          </button>
          <button className="btn-action" style={{ fontSize: 14 }} onClick={() => setOpenPagar(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />A pagar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #B0413E' }}>
          <div className="kpi-lbl">
            A Pagar
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-up-circle" style={{ fontSize: 14, color: '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.pagarPend)}</div>
          <div className={`kpi-delta ${kpis.vencidasPagar > 0 ? 'dn' : ''}`}>
            {kpis.vencidasPagar > 0 ? `⚠ ${kpis.vencidasPagar} vencida${kpis.vencidasPagar > 1 ? 's' : ''}` : `${pagar.filter(x => x.status === 'pendente').length} pendentes`}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">
            A Receber
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-down-circle" style={{ fontSize: 14, color: '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.receberPend)}</div>
          <div className={`kpi-delta ${kpis.vencidasReceber > 0 ? 'warn' : 'up'}`}>
            {kpis.vencidasReceber > 0 ? `⚠ ${kpis.vencidasReceber} vencida${kpis.vencidasReceber > 1 ? 's' : ''}` : `${receber.filter(x => x.status === 'pendente').length} pendentes`}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${kpis.saldo >= 0 ? '#3D7A6E' : '#B0413E'}` }}>
          <div className="kpi-lbl">
            Saldo projetado
            <div style={{ width: 28, height: 28, borderRadius: 8, background: kpis.saldo >= 0 ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-scale-balanced" style={{ fontSize: 14, color: kpis.saldo >= 0 ? '#3D7A6E' : '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.saldo)}</div>
          <div className={`kpi-delta ${kpis.saldo >= 0 ? 'up' : 'dn'}`}>
            {kpis.saldo >= 0 ? '↑ A receber supera a pagar' : '↓ A pagar supera a receber'}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7A6A9E' }}>
          <div className="kpi-lbl">
            Total de lançamentos
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 14, color: '#7A6A9E' }} />
            </div>
          </div>
          <div className="kpi-val">{pagar.length + receber.length}</div>
          <div className="kpi-delta">{pagar.length} pagar · {receber.length} receber</div>
        </div>
      </div>

      {/* Abas de navegação (interativo) */}
      <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { key: 'resumo', label: 'Resumo', icon: 'fa-gauge-high' },
          { key: 'pagar', label: 'A pagar', icon: 'fa-arrow-up', count: pagar.filter(x => x.status !== 'paga').length },
          { key: 'receber', label: 'A receber', icon: 'fa-arrow-down', count: receber.filter(x => x.status !== 'recebida').length },
          { key: 'conciliacao', label: 'Conciliação', icon: 'fa-scale-balanced' },
          { key: 'aging', label: 'Aging', icon: 'fa-hourglass-half' },
        ] as { key: typeof tab; label: string; icon: string; count?: number }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#13201D' : '#7B8C88', transition: 'all .15s',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />{t.label}
            {t.count ? <span style={{ fontSize: 11, fontWeight: 700, background: tab === t.key ? '#E9F0ED' : '#fff', color: '#3D7A6E', padding: '1px 6px', borderRadius: 20 }}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* A PAGAR */}
      {tab === 'resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FBF8F1' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Próximas a pagar</div>
              <button onClick={() => setTab('pagar')} style={{ fontSize: 12, color: '#3D7A6E', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {pagar.filter(c => c.status !== 'paga').slice(0, 5).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 14, color: '#7B8C88' }}>Nada pendente</div>
            ) : pagar.filter(c => c.status !== 'paga').slice(0, 5).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fornecedor_nome || c.descricao}</div>
                  <div style={{ fontSize: 12, color: '#7B8C88' }}>{fmtDate(c.data_vencimento)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.valor || 0))}</div>
                <StatusTag status={c.status} />
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FBF8F1' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Próximas a receber</div>
              <button onClick={() => setTab('receber')} style={{ fontSize: 12, color: '#3D7A6E', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {receber.filter(c => c.status !== 'recebida').slice(0, 5).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 14, color: '#7B8C88' }}>Nada pendente</div>
            ) : receber.filter(c => c.status !== 'recebida').slice(0, 5).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_nome || c.descricao}</div>
                  <div style={{ fontSize: 12, color: '#7B8C88' }}>{fmtDate(c.data_vencimento)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#3D7A6E', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.valor || 0))}</div>
                <StatusTag status={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pagar' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={fStatusPagar} onChange={e => setFStatusPagar(e.target.value)}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: '#7B8C88' }}>{pagar.length} lançamento{pagar.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header tabela */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 100px 110px 90px 100px', padding: '10px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1' }}>
              {['Fornecedor', 'Descrição', 'Categoria', 'Vencimento', 'Valor', 'Status', 'Ação'].map(h => (
                <div key={h} style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Carregando...</div>
            ) : pagar.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <i className="fa-solid fa-check-circle" style={{ fontSize: 32, color: '#3D7A6E', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#13201D', marginBottom: 4 }}>Nenhuma conta a pagar</div>
                <div style={{ fontSize: 13, color: '#7B8C88' }}>Tudo em dia ou sem lançamentos no período</div>
              </div>
            ) : pagar.map((c, i) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 100px 110px 90px 100px',
                padding: '11px 16px', borderBottom: i < pagar.length - 1 ? '0.5px solid #EFE9DC' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fornecedor_nome || '—'}</div>
                <div style={{ fontSize: 13, color: '#3C4A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</div>
                <div style={{ fontSize: 13, color: '#7B8C88' }}>{c.categoria || '—'}</div>
                <div style={{ fontSize: 13, color: c.status === 'vencida' ? '#B0413E' : '#3C4A46', fontWeight: c.status === 'vencida' ? 700 : 400 }}>{fmtDate(c.data_vencimento)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.valor || 0))}</div>
                <div><StatusTag status={c.status} /></div>
                <div>
                  {c.status !== 'paga' && (
                    <button
                      onClick={() => void registrarPagamento(c.id, Number(c.valor || 0) - Number(c.valor_pago || 0))}
                      disabled={actionLoading === c.id}
                      style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#13201D', color: '#fff', cursor: 'pointer', opacity: actionLoading === c.id ? 0.6 : 1 }}
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
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={fStatusReceber} onChange={e => setFStatusReceber(e.target.value)}>
              <option value="todas">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="recebida">Recebida</option>
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: '#7B8C88' }}>{receber.length} lançamento{receber.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 100px 80px 110px 90px 130px', padding: '10px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1' }}>
              {['Cliente', 'Descrição', 'Vencimento', 'Atraso', 'Valor', 'Status', 'Ações'].map(h => (
                <div key={h} style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Carregando...</div>
            ) : receber.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: 32, color: '#3D7A6E', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#13201D', marginBottom: 4 }}>Nenhuma conta a receber</div>
                <div style={{ fontSize: 13, color: '#7B8C88' }}>Sem lançamentos no período selecionado</div>
              </div>
            ) : receber.map((c, i) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 100px 80px 110px 90px 130px',
                padding: '11px 16px', borderBottom: i < receber.length - 1 ? '0.5px solid #EFE9DC' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_nome || '—'}</div>
                <div style={{ fontSize: 13, color: '#3C4A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</div>
                <div style={{ fontSize: 13, color: '#3C4A46' }}>{fmtDate(c.data_vencimento)}</div>
                <div style={{ fontSize: 13, fontWeight: c.dias_atraso > 0 ? 700 : 400, color: c.dias_atraso > 0 ? '#B0413E' : '#7B8C88' }}>
                  {c.dias_atraso > 0 ? `${c.dias_atraso}d` : '—'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#3D7A6E', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.valor || 0))}</div>
                <div><StatusTag status={c.status} /></div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {c.status !== 'recebida' && (
                    <button
                      onClick={() => void registrarRecebimento(c.id, Number(c.valor || 0) - Number(c.valor_recebido || 0), c.status === 'vencida')}
                      disabled={actionLoading === c.id}
                      style={{ fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 6, border: 'none', background: '#3D7A6E', color: '#fff', cursor: 'pointer', opacity: actionLoading === c.id ? 0.6 : 1 }}
                    >
                      {actionLoading === c.id ? '...' : 'Receber'}
                    </button>
                  )}
                  <button
                    onClick={() => void enviarCobranca(c.id)}
                    disabled={actionLoading === c.id}
                    style={{ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 6, border: '0.5px solid #E4DCCC', background: '#fff', color: '#3C4A46', cursor: 'pointer' }}
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
    <Suspense fallback={<div style={{ padding: 32, color: '#7B8C88', fontSize: 15 }}>Carregando…</div>}>
      <FinanceiroInner />
    </Suspense>
  )
}

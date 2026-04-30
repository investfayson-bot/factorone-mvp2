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
  id: string
  fornecedor_nome: string
  descricao: string
  categoria: string
  data_vencimento: string
  valor: number
  valor_pago: number
  status: string
}
type ContaReceber = {
  id: string
  cliente_nome: string
  descricao: string
  data_vencimento: string
  valor: number
  valor_recebido: number
  status: string
  dias_atraso: number
  cliente_email?: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function statusTagFin(status: string) {
  const map: Record<string, string> = { pendente: 'amber', vencida: 'red', paga: 'green', recebida: 'green', cancelada: 'gray' }
  return <span className={`tag ${map[status] || 'gray'}`}>{status}</span>
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

  useEffect(() => {
    const t = tabParam
    if (t === 'pagar' || t === 'receber' || t === 'conciliacao' || t === 'aging') setTab(t)
    else setTab('resumo')
  }, [tabParam])

  const carregar = useCallback(async () => {
    const h = await authHeaders()
    const [p, r] = await Promise.all([
      fetch(`/api/financeiro/pagar?status=${fStatusPagar}`, { headers: { ...h } }).then((x) => x.json()).catch(() => ({ data: [] })),
      fetch(`/api/financeiro/receber?status=${fStatusReceber}`, { headers: { ...h } }).then((x) => x.json()).catch(() => ({ data: [] })),
    ])
    setPagar((p.data || []) as ContaPagar[])
    setReceber((r.data || []) as ContaReceber[])
  }, [fStatusPagar, fStatusReceber])

  useEffect(() => { void carregar() }, [carregar])

  const kpis = useMemo(() => {
    const pagarPend = pagar.filter((x) => x.status === 'pendente' || x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_pago || 0), 0)
    const receberPend = receber.filter((x) => x.status === 'pendente' || x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_recebido || 0), 0)
    const vencidasPagar = pagar.filter((x) => x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0), 0)
    const vencidasReceber = receber.filter((x) => x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0), 0)
    const recebidoMes = receber.filter((x) => x.status === 'recebida').reduce((s, x) => s + Number(x.valor_recebido || 0), 0)
    const pagoMes = pagar.filter((x) => x.status === 'paga').reduce((s, x) => s + Number(x.valor_pago || 0), 0)
    return { pagarPend, receberPend, vencidasPagar, vencidasReceber, recebidoMes, pagoMes }
  }, [pagar, receber])

  async function registrarPagamento(id: string, valor: number) {
    const data = new Date().toISOString().slice(0, 10)
    const h = await authHeaders()
    await fetch(`/api/financeiro/pagar/${id}/pagar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ data_pagamento: data, valor_pago: valor, tipo_pagamento: 'pix' }) })
    await carregar()
  }
  async function registrarRecebimento(id: string, valor: number, vencida: boolean) {
    const data = new Date().toISOString().slice(0, 10)
    const h = await authHeaders()
    await fetch(`/api/financeiro/receber/${id}/receber`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ data_recebimento: data, valor_recebido: valor, cobrar_juros: vencida }) })
    await carregar()
  }
  async function enviarCobranca(id: string) {
    const h = await authHeaders()
    await fetch('/api/financeiro/cobranca', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ action: 'enviar', conta_receber_id: id }) })
    alert('Cobrança processada')
  }

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Contas Pagar / Receber</div>
          <div className="page-sub">Conciliação bancária · Aging report · Tempo real</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" onClick={() => setOpenPagar(true)}>+ A pagar</button>
          <button className="btn-action" onClick={() => setOpenReceber(true)}>+ A receber</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {[
          { k: 'A pagar', v: kpis.pagarPend, warn: false },
          { k: 'A receber', v: kpis.receberPend, warn: false },
          { k: 'Vencidas pagar', v: kpis.vencidasPagar, warn: true },
          { k: 'Vencidas receber', v: kpis.vencidasReceber, warn: true },
          { k: 'Recebido mês', v: kpis.recebidoMes, warn: false },
          { k: 'Pago mês', v: kpis.pagoMes, warn: false },
        ].map((row) => (
          <div key={row.k} className="kpi">
            <div className="kpi-lbl">{row.k}</div>
            <div className="kpi-val" style={{ color: row.warn && row.v > 0 ? 'var(--red)' : 'var(--navy)', fontSize: 18 }}>{formatBRL(row.v)}</div>
            <div className={`kpi-delta ${row.warn && row.v > 0 ? 'dn' : 'up'}`}>{row.warn && row.v > 0 ? '⚠ atenção' : '✓ ok'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['resumo', 'pagar', 'receber', 'conciliacao', 'aging'] as const).map((t) => (
          <button key={t} className={`btn-action${tab !== t ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px', textTransform: 'capitalize' }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'resumo' && (
        <div className="chart-card" style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          Resumo consolidado: use as abas acima para A Pagar, A Receber, Conciliação bancária e Aging Report.
        </div>
      )}

      {tab === 'pagar' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={fStatusPagar} onChange={(e) => setFStatusPagar(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {pagar.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Nenhuma conta a pagar.</td></tr>
                ) : pagar.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.fornecedor_nome}</td>
                    <td>{c.descricao}</td>
                    <td>{c.categoria}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace" }}>{c.data_vencimento}</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)', fontFamily: "'Sora', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td>{statusTagFin(c.status)}</td>
                    <td>
                      {c.status !== 'paga' && (
                        <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void registrarPagamento(c.id, Number(c.valor || 0) - Number(c.valor_pago || 0))}>Pagar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'receber' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={fStatusReceber} onChange={(e) => setFStatusReceber(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="recebida">Recebida</option>
            </select>
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Dias atraso</th><th>Valor</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {receber.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Nenhuma conta a receber.</td></tr>
                ) : receber.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.cliente_nome}</td>
                    <td>{c.descricao}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace" }}>{c.data_vencimento}</td>
                    <td style={{ color: c.dias_atraso > 0 ? 'var(--red)' : 'var(--navy)', fontFamily: "'DM Mono', monospace" }}>{c.dias_atraso || 0}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)', fontFamily: "'Sora', sans-serif" }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td>{statusTagFin(c.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status !== 'recebida' && (
                          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void registrarRecebimento(c.id, Number(c.valor || 0) - Number(c.valor_recebido || 0), c.status === 'vencida')}>Receber</button>
                        )}
                        <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void enviarCobranca(c.id)}>Cobrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    <Suspense fallback={<div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>}>
      <FinanceiroInner />
    </Suspense>
  )
}

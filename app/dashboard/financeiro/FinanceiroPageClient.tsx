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
  const [tab, setTab] = useState<'pagar' | 'receber' | 'conciliacao' | 'aging'>('pagar')
  const [pagar, setPagar] = useState<ContaPagar[]>([])
  const [receber, setReceber] = useState<ContaReceber[]>([])
  const [fStatusPagar, setFStatusPagar] = useState('todas')
  const [fStatusReceber, setFStatusReceber] = useState('todas')
  const [openPagar, setOpenPagar] = useState(false)
  const [openReceber, setOpenReceber] = useState(false)

  useEffect(() => {
    const t = tabParam
    if (t === 'pagar' || t === 'receber' || t === 'conciliacao' || t === 'aging') setTab(t)
    else setTab('pagar')
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
    const vencidasPagar = pagar.filter((x) => x.status === 'vencida').length
    return { pagarPend, receberPend, vencidasPagar }
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
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        {([['pagar', `A Pagar${kpis.pagarPend > 0 ? ` · ${formatBRL(kpis.pagarPend)}` : ''}`], ['receber', `A Receber${kpis.receberPend > 0 ? ` · ${formatBRL(kpis.receberPend)}` : ''}`], ['conciliacao', 'Conciliação'], ['aging', 'Aging']] as [typeof tab, string][]).map(([t, l]) => (
          <button key={t} className={`btn-action${tab !== t ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(t)}>
            {t === 'pagar' && kpis.vencidasPagar > 0 ? <><i className="fa-solid fa-circle-exclamation" style={{ color: tab === t ? '#fff' : 'var(--red)', marginRight: 4, fontSize: 9 }} />{l}</> : l}
          </button>
        ))}
      </div>

      {tab === 'pagar' && (
        <>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={fStatusPagar} onChange={(e) => setFStatusPagar(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <button className="btn-action" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }} onClick={() => setOpenPagar(true)}>+ A pagar</button>
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
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={fStatusReceber} onChange={(e) => setFStatusReceber(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="recebida">Recebida</option>
            </select>
            <button className="btn-action" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }} onClick={() => setOpenReceber(true)}>+ A receber</button>
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

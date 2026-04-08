'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import NovaContaPagarModal from '@/components/financeiro/NovaContaPagarModal'
import NovaContaReceberModal from '@/components/financeiro/NovaContaReceberModal'
import Conciliacao from '@/components/financeiro/Conciliacao'
import AgingReport from '@/components/financeiro/AgingReport'
import DashboardPageHeader from '@/components/dashboard/DashboardPageHeader'

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

  useEffect(() => {
    void carregar()
  }, [carregar])

  const kpis = useMemo(() => {
    const pagarPend = pagar
      .filter((x) => x.status === 'pendente' || x.status === 'vencida')
      .reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_pago || 0), 0)
    const receberPend = receber
      .filter((x) => x.status === 'pendente' || x.status === 'vencida')
      .reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_recebido || 0), 0)
    const vencidasPagar = pagar.filter((x) => x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0), 0)
    const vencidasReceber = receber.filter((x) => x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0), 0)
    const recebidoMes = receber.filter((x) => x.status === 'recebida').reduce((s, x) => s + Number(x.valor_recebido || 0), 0)
    const pagoMes = pagar.filter((x) => x.status === 'paga').reduce((s, x) => s + Number(x.valor_pago || 0), 0)
    return { pagarPend, receberPend, vencidasPagar, vencidasReceber, recebidoMes, pagoMes }
  }, [pagar, receber])

  async function registrarPagamento(id: string, valor: number) {
    const data = new Date().toISOString().slice(0, 10)
    const h = await authHeaders()
    await fetch(`/api/financeiro/pagar/${id}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ data_pagamento: data, valor_pago: valor, tipo_pagamento: 'pix' }),
    })
    await carregar()
  }
  async function registrarRecebimento(id: string, valor: number, vencida: boolean) {
    const data = new Date().toISOString().slice(0, 10)
    const h = await authHeaders()
    await fetch(`/api/financeiro/receber/${id}/receber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ data_recebimento: data, valor_recebido: valor, cobrar_juros: vencida }),
    })
    await carregar()
  }
  async function enviarCobranca(id: string) {
    const h = await authHeaders()
    await fetch('/api/financeiro/cobranca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ action: 'enviar', conta_receber_id: id }),
    })
    alert('Cobrança processada')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <DashboardPageHeader
        title="Financeiro"
        subtitle="Contas a pagar e receber · conciliação e aging"
        badge="tempo-real"
      >
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => setOpenPagar(true)}
        >
          + A pagar
        </button>
        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          onClick={() => setOpenReceber(true)}
        >
          + A receber
        </button>
      </DashboardPageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { k: 'A pagar (pendente)', v: kpis.pagarPend, warn: false },
          { k: 'A receber (pendente)', v: kpis.receberPend, warn: false },
          { k: 'Vencidas a pagar', v: kpis.vencidasPagar, warn: true },
          { k: 'Vencidas a receber', v: kpis.vencidasReceber, warn: true },
          { k: 'Recebido no mês', v: kpis.recebidoMes, warn: false },
          { k: 'Pago no mês', v: kpis.pagoMes, warn: false },
        ].map((row) => (
          <div
            key={row.k}
            className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm transition-all hover:border-emerald-200/80 hover:shadow-md"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{row.k}</p>
            <p className={`mt-2 text-xl font-bold tracking-tight ${row.warn ? 'text-red-600' : 'text-gray-900'}`}>
              {formatBRL(row.v)}
            </p>
          </div>
        ))}
      </div>

      {tab === 'resumo' && (
        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 text-sm text-gray-600 shadow-sm">
          Resumo consolidado: use as abas acima para A Pagar, A Receber, Conciliação bancária e Aging Report.
        </div>
      )}

      {tab === 'pagar' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select className="rounded border px-3 py-2" value={fStatusPagar} onChange={(e) => setFStatusPagar(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2 text-left">Fornecedor</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Categoria</th>
                  <th className="p-2 text-left">Vencimento</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagar.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2">{c.fornecedor_nome}</td>
                    <td className="p-2">{c.descricao}</td>
                    <td className="p-2">{c.categoria}</td>
                    <td className="p-2">{c.data_vencimento}</td>
                    <td className="p-2 text-right">{formatBRL(Number(c.valor || 0))}</td>
                    <td className="p-2 text-center">{c.status}</td>
                    <td className="p-2 text-center">
                      {c.status !== 'paga' && (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => void registrarPagamento(c.id, Number(c.valor || 0) - Number(c.valor_pago || 0))}
                        >
                          Registrar pagamento
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'receber' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select className="rounded border px-3 py-2" value={fStatusReceber} onChange={(e) => setFStatusReceber(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="recebida">Recebida</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Vencimento</th>
                  <th className="p-2 text-center">Dias atraso</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {receber.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2">{c.cliente_nome}</td>
                    <td className="p-2">{c.descricao}</td>
                    <td className="p-2">{c.data_vencimento}</td>
                    <td className="p-2 text-center">{c.dias_atraso || 0}</td>
                    <td className="p-2 text-right">{formatBRL(Number(c.valor || 0))}</td>
                    <td className="p-2 text-center">{c.status}</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-1">
                        {c.status !== 'recebida' && (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            onClick={() =>
                              void registrarRecebimento(c.id, Number(c.valor || 0) - Number(c.valor_recebido || 0), c.status === 'vencida')
                            }
                          >
                            Registrar recebimento
                          </button>
                        )}
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void enviarCobranca(c.id)}>
                          Enviar cobrança
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'conciliacao' && <Conciliacao />}
      {tab === 'aging' && <AgingReport />}

      <NovaContaPagarModal open={openPagar} onClose={() => setOpenPagar(false)} onSaved={carregar} />
      <NovaContaReceberModal open={openReceber} onClose={() => setOpenReceber(false)} onSaved={carregar} />
    </div>
  )
}

export default function FinanceiroPageClient() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Carregando…</div>}>
      <FinanceiroInner />
    </Suspense>
  )
}

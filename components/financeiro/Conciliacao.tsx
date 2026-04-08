'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

type Extrato = { id: string; data_transacao: string; descricao: string; valor: number; tipo: 'credito' | 'debito'; conta_id: string }
type Match = { extrato_id: string; referencia_id: string; tipo: string; confidence: number; metodo: string }

export default function Conciliacao() {
  const [extratos, setExtratos] = useState<Extrato[]>([])
  const [pendentes, setPendentes] = useState<Array<{ id: string; tipo: 'pagar' | 'receber'; nome: string; valor: number; data: string }>>([])
  const [sugestoes, setSugestoes] = useState<Match[]>([])
  const [selectedExtrato, setSelectedExtrato] = useState<Extrato | null>(null)
  const [stats, setStats] = useState<{ percentual: number; conciliados: number; nao_conciliados: number } | null>(null)

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    const h = await authHeaders()
    const [ex, pg, rc, st] = await Promise.all([
      supabase.from('extrato_bancario').select('id,data_transacao,descricao,valor,tipo,conta_id').eq('empresa_id', eid).eq('conciliado', false).order('data_transacao', { ascending: false }).limit(100),
      supabase.from('contas_pagar').select('id,fornecedor_nome,valor,data_vencimento,status,extrato_id').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_paga']).is('extrato_id', null),
      supabase.from('contas_receber').select('id,cliente_nome,valor,data_vencimento,status,extrato_id').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_recebida']).is('extrato_id', null),
      fetch('/api/financeiro/conciliacao', { headers: { ...h } }).then((r) => r.json()).catch(() => null),
    ])
    setExtratos((ex.data || []) as Extrato[])
    setPendentes([
      ...(pg.data || []).map((x) => ({ id: x.id, tipo: 'pagar' as const, nome: x.fornecedor_nome, valor: Number(x.valor || 0), data: x.data_vencimento })),
      ...(rc.data || []).map((x) => ({ id: x.id, tipo: 'receber' as const, nome: x.cliente_nome, valor: Number(x.valor || 0), data: x.data_vencimento })),
    ])
    setStats(st)
  }
  useEffect(() => { void carregar() }, [])

  async function conciliarAutomatico(contaId: string) {
    const h = await authHeaders()
    const res = await fetch('/api/financeiro/conciliacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ conta_id: contaId }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha na conciliação')
    setSugestoes(payload.matches || [])
    alert(`${payload.conciliados} conciliados automaticamente; ${payload.matches?.length || 0} sugestões para revisão.`)
    await carregar()
  }

  const destaque = selectedExtrato
    ? pendentes.filter((p) => {
        const diffVal = Math.abs(Number(selectedExtrato.valor || 0) - Number(p.valor || 0)) / Math.max(Number(selectedExtrato.valor || 1), 1)
        return diffVal <= 0.01
      })
    : []

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Extrato (não conciliados)</h3>
          {extratos[0]?.conta_id && <button className="rounded border px-2 py-1 text-xs" onClick={() => void conciliarAutomatico(extratos[0].conta_id)}>Conciliar automaticamente</button>}
        </div>
        <div className="space-y-2">{extratos.map((e) => <button key={e.id} className={`w-full rounded border p-2 text-left text-sm ${selectedExtrato?.id === e.id ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => setSelectedExtrato(e)}><p>{new Date(e.data_transacao).toLocaleDateString('pt-BR')} • {e.descricao}</p><p className={e.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}>{formatBRL(Number(e.valor || 0))}</p></button>)}</div>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold">Lançamentos internos pendentes</h3>
        <div className="mt-2 space-y-2">{(selectedExtrato ? destaque : pendentes).map((p) => <div key={p.id} className={`rounded border p-2 text-sm ${selectedExtrato ? 'border-amber-300 bg-amber-50' : ''}`}><p>{p.nome} • {p.data}</p><p>{formatBRL(p.valor)} • {p.tipo}</p></div>)}</div>
      </div>
      <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold">Estatísticas</h3>
        <p className="text-sm text-slate-600">% conciliado: {stats?.percentual?.toFixed(1) || '0'}%</p>
        <p className="text-sm text-slate-600">Conciliados: {stats?.conciliados || 0} • Não conciliados: {stats?.nao_conciliados || 0}</p>
        {sugestoes.length > 0 && <p className="text-sm text-slate-600">Sugestões fuzzy pendentes: {sugestoes.length}</p>}
      </div>
    </div>
  )
}

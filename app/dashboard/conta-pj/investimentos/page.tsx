'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

export default function InvestimentosPage() {
  type InvestimentoRow = { id: string; status: 'ativo' | 'vencido' | 'resgatado'; valor_aplicado: number | string; rendimento_total: number | string; nome: string; tipo: string; data_vencimento?: string | null; valor_atual: number | string }
  const [rows, setRows] = useState<InvestimentoRow[]>([])
  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u.data?.empresa_id as string) || user.id
    const { data } = await supabase.from('investimentos').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { void carregar() }, [carregar])
  const ativos = rows.filter((r) => r.status === 'ativo')
  const resgatados = rows.filter((r) => r.status === 'resgatado')
  const totalAplicado = useMemo(() => ativos.reduce((s, r) => s + Number(r.valor_aplicado || 0), 0), [ativos])
  const rendimento = useMemo(() => ativos.reduce((s, r) => s + Number(r.rendimento_total || 0), 0), [ativos])
  async function resgatar(id: string) {
    await supabase.from('investimentos').update({ status: 'resgatado' }).eq('id', id)
    await carregar()
  }
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Investimentos</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Total aplicado</p><p className="text-xl font-bold">{formatBRL(totalAplicado)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Rendimento total</p><p className="text-xl font-bold text-emerald-600">{formatBRL(rendimento)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Melhor investimento</p><p className="text-xl font-bold">{ativos.sort((a, b) => Number(b.rendimento_total || 0) - Number(a.rendimento_total || 0))[0]?.nome || '—'}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Vencimento próximo</p><p className="text-xl font-bold">{ativos.sort((a, b) => new Date(a.data_vencimento || 0).getTime() - new Date(b.data_vencimento || 0).getTime())[0]?.data_vencimento || '—'}</p></div>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-semibold">Lista de investimentos</h2>
        <div className="space-y-2">{ativos.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">{r.nome}</p><p className="text-xs text-slate-500">{r.tipo} • venc. {r.data_vencimento || '—'}</p></div><div className="text-right"><p>{formatBRL(Number(r.valor_atual || 0))}</p><p className="text-xs text-emerald-600">{formatBRL(Number(r.rendimento_total || 0))}</p></div><button className="rounded border px-2 py-1 text-xs" onClick={() => void resgatar(r.id)}>Resgatar</button></div>)}</div>
      </div>
      <div className="rounded-2xl border bg-white p-4"><h2 className="mb-2 font-semibold">Histórico de resgates</h2><div className="space-y-2">{resgatados.map((r) => <div key={r.id} className="rounded-xl bg-slate-50 p-2 text-sm">{r.nome} • {formatBRL(Number(r.valor_atual || 0))}</div>)}</div></div>
    </div>
  )
}

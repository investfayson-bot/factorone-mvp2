'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

export default function ExtratoCompletoPage() {
  type ExtratoRow = { id: string; descricao: string; contraparte_nome?: string | null; tipo: 'credito' | 'debito'; valor: number | string; saldo_apos?: number | string | null; data_transacao: string; conciliado?: boolean }
  const [rows, setRows] = useState<ExtratoRow[]>([])
  const [tipo, setTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('30')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u.data?.empresa_id as string) || user.id
    const start = new Date()
    start.setDate(start.getDate() - Number(periodo))
    let q = supabase.from('extrato_bancario').select('*').eq('empresa_id', empresaId).gte('data_transacao', start.toISOString()).order('data_transacao', { ascending: false })
    if (tipo !== 'todos') q = q.eq('tipo', tipo)
    const { data } = await q
    setRows(data || [])
  }, [periodo, tipo])
  useEffect(() => { void carregar() }, [carregar])
  const filtered = rows.filter((r) => `${r.descricao || ''} ${r.contraparte_nome || ''}`.toLowerCase().includes(busca.toLowerCase()))
  const totais = useMemo(() => ({
    c: filtered.filter((r) => r.tipo === 'credito').reduce((s, r) => s + Number(r.valor || 0), 0),
    d: filtered.filter((r) => r.tipo === 'debito').reduce((s, r) => s + Number(r.valor || 0), 0),
  }), [filtered])

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Extrato completo</h1>
      <div className="grid gap-2 md:grid-cols-4">
        <select className="rounded border px-3 py-2" value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="1">Hoje</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select>
        <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="todos">Todos</option><option value="credito">Crédito</option><option value="debito">Débito</option></select>
        <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Buscar descrição/contraparte" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Data/hora</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Contraparte</th><th className="p-2 text-right">Valor</th><th className="p-2 text-right">Saldo após</th><th className="p-2 text-center">Conciliado</th></tr></thead>
          <tbody>{filtered.map((r) => <tr key={r.id} className="border-b"><td className="p-2">{new Date(r.data_transacao).toLocaleString('pt-BR')}</td><td className="p-2">{r.descricao}</td><td className="p-2">{r.contraparte_nome || '—'}</td><td className={`p-2 text-right font-semibold ${r.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>{r.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(r.valor || 0))}</td><td className="p-2 text-right">{formatBRL(Number(r.saldo_apos || 0))}</td><td className="p-2 text-center">{r.conciliado ? 'Sim' : 'Não'}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 rounded-2xl border bg-white p-3 text-sm"><p>Total créditos: <b className="text-emerald-600">{formatBRL(totais.c)}</b></p><p>Total débitos: <b className="text-red-600">{formatBRL(totais.d)}</b></p><p>Saldo período: <b>{formatBRL(totais.c - totais.d)}</b></p></div>
    </div>
  )
}

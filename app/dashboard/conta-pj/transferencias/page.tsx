'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

export default function TransferenciasPage() {
  type TransferenciaRow = { id: string; destinatario_nome: string; tipo: string; data_agendada: string; valor: number | string; status: string }
  const [rows, setRows] = useState<TransferenciaRow[]>([])
  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u.data?.empresa_id as string) || user.id
    const { data } = await supabase.from('transferencias_agendadas').select('*').eq('empresa_id', empresaId).order('data_agendada', { ascending: true })
    setRows(data || [])
  }, [])
  useEffect(() => { void carregar() }, [carregar])
  async function cancelar(id: string) {
    await supabase.from('transferencias_agendadas').update({ status: 'cancelado' }).eq('id', id)
    await carregar()
  }
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Transferências</h1>
      <div className="rounded-2xl border bg-white p-4">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-slate-600">Nenhuma transferência encontrada para sua empresa.</p>
            <p className="mt-1 text-xs text-slate-500">Use a ação PIX/TED no dashboard da Conta PJ para criar a primeira.</p>
          </div>
        ) : (
          <div className="space-y-2">{rows.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">{r.destinatario_nome}</p><p className="text-xs text-slate-500">{r.tipo.toUpperCase()} • {r.data_agendada}</p></div><div className="flex items-center gap-2"><p className="font-semibold">{formatBRL(Number(r.valor || 0))}</p>{r.status === 'agendado' && <button className="rounded border px-2 py-1 text-xs" onClick={() => void cancelar(r.id)}>Cancelar</button>}</div></div>)}</div>
        )}
      </div>
    </div>
  )
}

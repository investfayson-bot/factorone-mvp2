'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CATS = ['Marketing', 'Tecnologia', 'RH', 'Software', 'Jurídico', 'Viagens', 'Infraestrutura', 'Alimentação', 'Outros']

type DespesaRow = {
  id: string
  descricao: string
  valor: number
  categoria: string
  data: string
  status: string
}

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [form, setForm] = useState({ descricao: '', valor: '', categoria: 'Marketing', data: new Date().toISOString().split('T')[0], status: 'pago' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single()
    if (!u) return
    setEmpresaId(u.empresa_id)
    const { data } = await supabase.from('despesas').select('*').eq('empresa_id', u.empresa_id).order('created_at', { ascending: false })
    setDespesas((data ?? []) as DespesaRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function salvar() {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return }
    setLoading(true)
    await supabase.from('despesas').insert({ ...form, empresa_id: empresaId, valor: parseFloat(form.valor) })
    setModal(false)
    setForm({ descricao: '', valor: '', categoria: 'Marketing', data: new Date().toISOString().split('T')[0], status: 'pago' })
    setLoading(false)
    load()
  }

  const fmt = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const total = despesas.reduce((a, d) => a + (d.valor || 0), 0)

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Despesas</h1>
          <p className="text-sm text-slate-500">{despesas.length} lançamentos · Total {fmt(total)}</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all">+ Nova Despesa</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="text-left p-3">Descrição</th><th className="text-left p-3">Categoria</th><th className="text-left p-3">Data</th><th className="text-left p-3">Valor</th></tr>
          </thead>
          <tbody>
            {despesas.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="p-3 text-slate-800">{d.descricao}</td>
                <td className="p-3 text-slate-500">{d.categoria}</td>
                <td className="p-3 text-slate-500">{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                <td className="p-3 text-red-600 font-semibold">-{fmt(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-800">Nova Despesa</h2>
            <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição" className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all" />
            <input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor" className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all" />
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 outline-none transition-all">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 outline-none transition-all" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-medium px-5 py-2.5 rounded-xl transition-all">Cancelar</button>
              <button onClick={salvar} disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all">{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

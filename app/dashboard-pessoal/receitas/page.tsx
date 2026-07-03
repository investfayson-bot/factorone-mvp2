'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Receita = { id: string; descricao: string; valor: number; categoria: string; data_recebimento: string; recorrente: boolean }
const CATS = ['Salário','Freelance','Aluguel','Dividendos','Bônus','Vendas','Outros']
const EMPTY = { descricao: '', valor: '', categoria: 'Salário', data_recebimento: new Date().toISOString().slice(0,10), recorrente: false }

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [renda, setRenda] = useState('')
  const [savingRenda, setSavingRenda] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      carregar(user.id, mes)
      const { data } = await supabase.from('perfil_usuario').select('renda_mensal').eq('user_id', user.id).maybeSingle()
      if (data?.renda_mensal) setRenda(String(data.renda_mensal))
    })
  }, [])

  async function carregar(uid: string, m: string) {
    const { data } = await supabase.from('receitas_pessoais').select('*').eq('user_id', uid).gte('data_recebimento', `${m}-01`).lte('data_recebimento', `${m}-31`).order('data_recebimento', { ascending: false })
    setReceitas((data ?? []) as Receita[])
  }

  async function salvar() {
    if (!form.descricao || !form.valor) return toast.error('Preencha descrição e valor')
    setSaving(true)
    const { error } = await supabase.from('receitas_pessoais').insert({ user_id: userId, ...form, valor: Number(form.valor) })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Receita registrada')
    setForm(EMPTY)
    setModal(false)
    carregar(userId, mes)
  }

  async function salvarRenda() {
    if (!renda) return
    setSavingRenda(true)
    await supabase.from('perfil_usuario').upsert({ user_id: userId, renda_mensal: Number(renda) }, { onConflict: 'user_id' })
    setSavingRenda(false)
    toast.success('Renda atualizada')
  }

  async function excluir(id: string) {
    await supabase.from('receitas_pessoais').delete().eq('id', id)
    setReceitas(prev => prev.filter(r => r.id !== id))
  }

  const total = receitas.reduce((s, r) => s + Number(r.valor), 0)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Receitas</div>
          <div className="page-sub">Salário, freelances e outras entradas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="month" value={mes} onChange={e => { setMes(e.target.value); carregar(userId, e.target.value) }} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
          <button onClick={() => setModal(true)} className="btn-action">+ Nova receita</button>
        </div>
      </div>

      {/* Renda fixa */}
      <div style={{ background: 'rgba(61,122,110,.06)', border: '1px solid rgba(61,122,110,.2)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>Renda mensal fixa</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Usada como base do orçamento e pelo AI CFO</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" type="number" placeholder="R$ 0,00" value={renda} onChange={e => setRenda(e.target.value)} style={{ width: 140, padding: '6px 10px', fontSize: 13 }} />
          <button onClick={salvarRenda} className="btn-action" disabled={savingRenda} style={{ padding: '7px 14px', fontSize: 12 }}>{savingRenda ? '...' : 'Salvar'}</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Receitas do mês</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(total)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Lançamentos</div><div className="kpi-val">{receitas.length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Recorrentes</div><div className="kpi-val">{receitas.filter(r => r.recorrente).length}</div></div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <table className="expenses-table">
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Recorrente</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {receitas.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>Nenhuma receita no período</td></tr>}
            {receitas.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.descricao}</td>
                <td><span className="tag green">{r.categoria}</span></td>
                <td style={{ color: 'var(--gray-400)' }}>{r.data_recebimento?.split('-').reverse().join('/')}</td>
                <td>{r.recorrente ? <span className="tag green">sim</span> : <span className="tag gray">não</span>}</td>
                <td style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: 'var(--teal)' }}>{formatBRL(Number(r.valor))}</td>
                <td><button onClick={() => excluir(r.id)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)' }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Nova receita</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <input className="form-input" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input className="form-input" type="date" value={form.data_recebimento} onChange={e => setForm(f => ({ ...f, data_recebimento: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.recorrente} onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} />
                Receita recorrente (todo mês)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

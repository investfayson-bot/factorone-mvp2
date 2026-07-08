'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Gasto = { id: string; descricao: string; valor: number; categoria: string; data_despesa: string; status: string; parcela_atual: number | null; total_parcelas: number | null }

const CATEGORIAS = ['Alimentação','Transporte','Moradia','Saúde','Lazer','Educação','Vestuário','Assinaturas','Outros']

const EMPTY = { descricao: '', valor: '', categoria: 'Alimentação', data_despesa: new Date().toISOString().slice(0,10), parcelas: '1' }

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id, mes) }
    })
  }, [])

  async function carregar(uid: string, m: string) {
    const ini = `${m}-01`
    const fim = `${m}-31`
    const { data } = await supabase.from('despesas_pessoais').select('id,descricao,valor,categoria,data_despesa,status,parcela_atual,total_parcelas').eq('user_id', uid).gte('data_despesa', ini).lte('data_despesa', fim).order('data_despesa', { ascending: false })
    setGastos((data ?? []) as Gasto[])
  }

  async function salvar() {
    if (!form.descricao || !form.valor) return toast.error('Preencha descrição e valor')
    setSaving(true)
    const parcelas = Math.max(1, parseInt(form.parcelas) || 1)
    const valorParc = Number(form.valor) / parcelas
    const rows = Array.from({ length: parcelas }, (_, i) => {
      const d = new Date(form.data_despesa)
      d.setMonth(d.getMonth() + i)
      return { user_id: userId, descricao: form.descricao, valor: valorParc, categoria: form.categoria, data_despesa: d.toISOString().slice(0,10), status: 'pendente', parcela_atual: parcelas > 1 ? i + 1 : null, total_parcelas: parcelas > 1 ? parcelas : null }
    })
    const { error } = await supabase.from('despesas_pessoais').insert(rows)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(parcelas > 1 ? `${parcelas}x de ${formatBRL(valorParc)} criadas` : 'Gasto registrado')
    setForm(EMPTY)
    setModal(false)
    carregar(userId, mes)
  }

  async function marcarPago(id: string) {
    await supabase.from('despesas_pessoais').update({ status: 'pago' }).eq('id', id)
    setGastos(prev => prev.map(g => g.id === id ? { ...g, status: 'pago' } : g))
  }

  async function excluir(id: string) {
    await supabase.from('despesas_pessoais').delete().eq('id', id)
    setGastos(prev => prev.filter(g => g.id !== id))
    toast.success('Removido')
  }

  async function uploadOCR(file: File) {
    setUploadando(true)
    try {
      const form2 = new FormData()
      form2.append('file', file)
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/contabilidade/processar-recibo', {
        method: 'POST',
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
        body: form2,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      if (data.dados_extraidos) {
        setForm(f => ({ ...f, descricao: data.dados_extraidos.fornecedor || f.descricao, valor: String(data.dados_extraidos.valor || f.valor), categoria: data.dados_extraidos.categoria || f.categoria, data_despesa: data.dados_extraidos.data || f.data_despesa }))
        setModal(true)
        toast.success('Recibo extraído — confira e salve')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro no OCR')
    } finally {
      setUploadando(false)
    }
  }

  const total = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const pendente = gastos.filter(g => g.status === 'pendente').reduce((s, g) => s + Number(g.valor), 0)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Gastos & Recibos</div>
          <div className="page-sub">Todos os seus gastos do mês</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={mes} onChange={e => { setMes(e.target.value); carregar(userId, e.target.value) }} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 14 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(61,122,110,.1)', border: '1px solid rgba(61,122,110,.3)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, color: 'var(--teal)', cursor: 'pointer' }}>
            {uploadando ? 'Lendo...' : 'OCR'}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadOCR(f); e.currentTarget.value = '' }} />
          </label>
          <button onClick={() => setModal(true)} className="btn-action">+ Novo gasto</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Total do mês</div><div className="kpi-val">{formatBRL(total)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Pendente</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{formatBRL(pendente)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Lançamentos</div><div className="kpi-val">{gastos.length}</div></div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <table className="expenses-table">
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Parcela</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {gastos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>Nenhum gasto no período</td></tr>}
            {gastos.map(g => (
              <tr key={g.id}>
                <td style={{ fontWeight: 600 }}>{g.descricao}</td>
                <td><span className="tag gray">{g.categoria}</span></td>
                <td style={{ color: 'var(--gray-400)' }}>{g.data_despesa?.split('-').reverse().join('/')}</td>
                <td style={{ color: 'var(--gray-400)', fontSize: 13 }}>{g.parcela_atual ? `${g.parcela_atual}/${g.total_parcelas}x` : '—'}</td>
                <td style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{formatBRL(Number(g.valor))}</td>
                <td><span className={`tag ${g.status === 'pago' ? 'green' : g.status === 'vencido' ? 'red' : 'gray'}`}>{g.status}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {g.status !== 'pago' && <button onClick={() => marcarPago(g.id)} className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}>Pago</button>}
                  <button onClick={() => excluir(g.id)} className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12, color: 'var(--red)' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 420, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Novo gasto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                <input className="form-input" placeholder="Parcelas" type="number" min="1" max="48" value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} />
              </div>
              <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input className="form-input" type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))} />
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

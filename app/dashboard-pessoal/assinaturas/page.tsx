'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Assinatura = { id: string; nome: string; valor: number; dia_vencimento: number; categoria: string; ativa: boolean; ciclo: string; ultimo_uso: string | null }

const CATS = ['Streaming','Música','Jogos','Produtividade','Saúde','Educação','Moradia','Outros']
const POPULARES = [
  { nome: 'Netflix', valor: 39.90, categoria: 'Streaming' },
  { nome: 'Spotify', valor: 21.90, categoria: 'Música' },
  { nome: 'Disney+', valor: 27.90, categoria: 'Streaming' },
  { nome: 'Amazon Prime', valor: 19.90, categoria: 'Streaming' },
  { nome: 'YouTube Premium', valor: 27.90, categoria: 'Streaming' },
  { nome: 'HBO Max', valor: 34.90, categoria: 'Streaming' },
  { nome: 'iCloud', valor: 7.90, categoria: 'Produtividade' },
  { nome: 'Microsoft 365', valor: 39.00, categoria: 'Produtividade' },
]
const EMPTY = { nome: '', valor: '', dia_vencimento: '10', categoria: 'Streaming', ciclo: 'mensal' }

export default function AssinaturasPage() {
  const [items, setItems] = useState<Assinatura[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id) }
    })
  }, [])

  async function carregar(uid: string) {
    const { data } = await supabase.from('assinaturas_pessoais').select('*').eq('user_id', uid).order('ativa', { ascending: false }).order('valor', { ascending: false })
    setItems((data ?? []) as Assinatura[])
  }

  async function salvar() {
    if (!form.nome || !form.valor) return toast.error('Preencha nome e valor')
    setSaving(true)
    const { error } = await supabase.from('assinaturas_pessoais').insert({ user_id: userId, nome: form.nome, valor: Number(form.valor), dia_vencimento: parseInt(form.dia_vencimento), categoria: form.categoria, ciclo: form.ciclo, ativa: true })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Assinatura adicionada')
    setForm(EMPTY)
    setModal(false)
    carregar(userId)
  }

  async function toggleAtiva(id: string, ativa: boolean) {
    await supabase.from('assinaturas_pessoais').update({ ativa: !ativa }).eq('id', id)
    setItems(prev => prev.map(a => a.id === id ? { ...a, ativa: !ativa } : a))
  }

  async function excluir(id: string) {
    await supabase.from('assinaturas_pessoais').delete().eq('id', id)
    setItems(prev => prev.filter(a => a.id !== id))
    toast.success('Removida')
  }

  function adicionarPopular(p: typeof POPULARES[0]) {
    setForm(f => ({ ...f, nome: p.nome, valor: String(p.valor), categoria: p.categoria }))
    setModal(true)
  }

  const totalAtivas = items.filter(a => a.ativa).reduce((s, a) => s + Number(a.valor), 0)
  const totalInativas = items.filter(a => !a.ativa).reduce((s, a) => s + Number(a.valor), 0)
  const ativas = items.filter(a => a.ativa)
  const inativas = items.filter(a => !a.ativa)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Assinaturas & Fixos</div>
          <div className="page-sub">Controle todos os seus serviços recorrentes</div>
        </div>
        <button onClick={() => setModal(true)} className="btn-action">+ Nova assinatura</button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Total mensal ativo</div><div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(totalAtivas)}</div><div className="kpi-delta">{ativas.length} serviços</div></div>
        <div className="kpi"><div className="kpi-lbl">Total anual</div><div className="kpi-val">{formatBRL(totalAtivas * 12)}</div><div className="kpi-delta">se mantiver todos</div></div>
        <div className="kpi"><div className="kpi-lbl">Pausadas</div><div className="kpi-val" style={{ color: 'var(--gray-400)' }}>{formatBRL(totalInativas)}</div><div className="kpi-delta">{inativas.length} serviços</div></div>
        <div className="kpi"><div className="kpi-lbl">Economia possível</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(totalInativas)}</div><div className="kpi-delta">pausando inativos</div></div>
      </div>

      {/* Populares */}
      <div style={{ background: 'rgba(94,140,135,.04)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 12, padding: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', marginBottom: 10 }}>Adicionar rapidamente</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {POPULARES.map(p => (
            <button key={p.nome} onClick={() => adicionarPopular(p)} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>
              {p.nome} · {formatBRL(p.valor)}
            </button>
          ))}
        </div>
      </div>

      {ativas.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Ativas</div>
          <table className="expenses-table">
            <thead><tr><th>Serviço</th><th>Categoria</th><th>Ciclo</th><th>Vence dia</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {ativas.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.nome}</td>
                  <td><span className="tag gray">{a.categoria}</span></td>
                  <td style={{ color: 'var(--gray-400)', fontSize: 11 }}>{a.ciclo}</td>
                  <td style={{ color: 'var(--gray-400)' }}>dia {a.dia_vencimento}</td>
                  <td style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: 'var(--red)' }}>{formatBRL(Number(a.valor))}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleAtiva(a.id, a.ativa)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}>Pausar</button>
                    <button onClick={() => excluir(a.id)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inativas.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--gray-400)' }}>Pausadas</div>
          <table className="expenses-table">
            <thead><tr><th>Serviço</th><th>Categoria</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {inativas.map(a => (
                <tr key={a.id} style={{ opacity: 0.6 }}>
                  <td style={{ fontWeight: 600 }}>{a.nome}</td>
                  <td><span className="tag gray">{a.categoria}</span></td>
                  <td style={{ fontFamily: "'Inter', sans-serif" }}>{formatBRL(Number(a.valor))}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleAtiva(a.id, a.ativa)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}>Reativar</button>
                    <button onClick={() => excluir(a.id)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Nova assinatura</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Nome do serviço" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                <input className="form-input" placeholder="Dia vencimento" type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
              </div>
              <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
              <select className="form-input" value={form.ciclo} onChange={e => setForm(f => ({ ...f, ciclo: e.target.value }))}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

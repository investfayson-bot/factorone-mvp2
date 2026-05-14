'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Meta = { id: string; nome: string; descricao: string | null; valor_meta: number; valor_atual: number; prazo: string | null; categoria: string; icone: string }

const CATEGORIAS = ['Reserva','Viagem','Bem','Educação','Investimento','Outros']
const ICONES = ['🎯','✈️','🏠','🚗','📚','💰','🏖️','💍','📱','🎓']
const EMPTY = { nome: '', descricao: '', valor_meta: '', valor_atual: '', prazo: '', categoria: 'Reserva', icone: '🎯' }

export default function MetasPage() {
  const [metas, setMetas] = useState<Meta[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [aportando, setAportando] = useState<string | null>(null)
  const [aporte, setAporte] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id) }
    })
  }, [])

  async function carregar(uid: string) {
    const { data } = await supabase.from('metas_financeiras_pf').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    setMetas((data ?? []) as Meta[])
  }

  async function salvar() {
    if (!form.nome || !form.valor_meta) return toast.error('Preencha nome e valor da meta')
    setSaving(true)
    const { error } = await supabase.from('metas_financeiras_pf').insert({ user_id: userId, nome: form.nome, descricao: form.descricao || null, valor_meta: Number(form.valor_meta), valor_atual: Number(form.valor_atual) || 0, prazo: form.prazo || null, categoria: form.categoria, icone: form.icone })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Meta criada')
    setForm(EMPTY)
    setModal(false)
    carregar(userId)
  }

  async function salvarAporte(id: string) {
    const val = Number(aporte)
    if (!val || val <= 0) return toast.error('Valor inválido')
    const meta = metas.find(m => m.id === id)
    if (!meta) return
    const novo = Math.min(meta.valor_meta, meta.valor_atual + val)
    await supabase.from('metas_financeiras_pf').update({ valor_atual: novo }).eq('id', id)
    toast.success(formatBRL(val) + ' aportado')
    setAportando(null)
    setAporte('')
    carregar(userId)
  }

  async function excluir(id: string) {
    await supabase.from('metas_financeiras_pf').delete().eq('id', id)
    setMetas(prev => prev.filter(m => m.id !== id))
    toast.success('Meta removida')
  }

  function diasRestantes(prazo: string | null) {
    if (!prazo) return null
    const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
    return diff
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Metas Financeiras</div>
          <div className="page-sub">Defina objetivos e acompanhe seu progresso</div>
        </div>
        <button onClick={() => setModal(true)} className="btn-action">+ Nova meta</button>
      </div>

      {metas.length === 0 ? (
        <div style={{ background: '#fff', border: '2px dashed var(--gray-100)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <i className="fa-solid fa-bullseye" style={{ fontSize: 32, color: "var(--gray-300)", marginBottom: 12, display: "block" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Nenhuma meta ainda</div>
          <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 }}>Crie sua primeira meta — reserva de emergência, viagem, carro...</div>
          <button onClick={() => setModal(true)} className="btn-action">Criar primeira meta</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {metas.map(m => {
            const pct = m.valor_meta > 0 ? Math.min(100, (m.valor_atual / m.valor_meta) * 100) : 0
            const dias = diasRestantes(m.prazo)
            const concluida = pct >= 100
            return (
              <div key={m.id} style={{ background: '#fff', border: `1px solid ${concluida ? 'var(--teal)' : 'var(--gray-100)'}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{m.icone}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{m.nome}</div>
                    {m.descricao && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{m.descricao}</div>}
                  </div>
                  <span className={`tag ${concluida ? 'green' : 'gray'}`}>{concluida ? '✓ Concluída' : m.categoria}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--gray-400)' }}>Progresso</span>
                  <span style={{ fontWeight: 700, color: concluida ? 'var(--teal)' : 'var(--navy)' }}>{formatBRL(m.valor_atual)} / {formatBRL(m.valor_meta)}</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: 'var(--gray-100)', marginBottom: 10 }}>
                  <div style={{ height: '100%', borderRadius: 5, background: concluida ? 'var(--teal)' : 'var(--green)', width: `${pct}%`, transition: 'width .4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
                  <span>{pct.toFixed(0)}% atingido</span>
                  {dias !== null && <span style={{ color: dias < 30 ? 'var(--red)' : 'var(--gray-400)' }}>{dias > 0 ? `${dias} dias` : 'Prazo vencido'}</span>}
                </div>

                {!concluida && (
                  aportando === m.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input autoFocus className="form-input" type="number" placeholder="Valor aporte" value={aporte} onChange={e => setAporte(e.target.value)} style={{ flex: 1, padding: '5px 8px', fontSize: 12 }} />
                      <button onClick={() => salvarAporte(m.id)} className="btn-action" style={{ padding: '5px 10px', fontSize: 11 }}>✓</button>
                      <button onClick={() => setAportando(null)} className="btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setAportando(m.id)} className="btn-action" style={{ flex: 1, fontSize: 11 }}>+ Aportar</button>
                      <button onClick={() => excluir(m.id)} className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }}>Excluir</button>
                    </div>
                  )
                )}
                {concluida && <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 700, textAlign: 'center', padding: '6px 0' }}>Meta alcançada!</div>}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 440, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Nova meta</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ICONES.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icone: ic }))} style={{ fontSize: 20, padding: 6, borderRadius: 8, border: `2px solid ${form.icone === ic ? 'var(--teal)' : 'transparent'}`, background: form.icone === ic ? 'rgba(94,140,135,.1)' : 'transparent', cursor: 'pointer' }}>{ic}</button>
                ))}
              </div>
              <input className="form-input" placeholder="Nome da meta" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <input className="form-input" placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Valor da meta (R$)" type="number" value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: e.target.value }))} />
                <input className="form-input" placeholder="Já tenho (R$)" type="number" value={form.valor_atual} onChange={e => setForm(f => ({ ...f, valor_atual: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="form-input" type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Criar meta'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

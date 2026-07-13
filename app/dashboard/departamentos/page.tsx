'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Dept = { id: string; nome: string; descricao: string | null; chefe_id: string | null; ativo: boolean }

export default function DepartamentosPage() {
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', descricao: '' })
  const [selecionado, setSelecionado] = useState<Dept | null>(null)

  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = ur?.empresa_id || user.id
      const { data } = await supabase.from('departamentos').select('*').eq('empresa_id', eid)
      setDepts(data || [])
      setLoading(false)
    }
    void carregar()
  }, [])

  const criar = async () => {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user?.id).maybeSingle()
    const eid = ur?.empresa_id || user?.id

    const { error } = await supabase.from('departamentos').insert({
      empresa_id: eid,
      nome: form.nome,
      descricao: form.descricao || null,
    })

    if (error) { toast.error(error.message); return }
    toast.success('Departamento criado!')
    setModal(false)
    setForm({ nome: '', descricao: '' })
    window.location.reload()
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Departamentos</h1>
        <button onClick={() => setModal(true)} className="btn-action primary" style={{ fontSize: 14 }}>+ Novo</button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : depts.length === 0 ? (
        <div className="card-v2" style={{ padding: 24, textAlign: 'center', color: 'var(--mut)' }}>
          Nenhum departamento criado. Crie um pra organizar sua equipe.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {depts.map(d => (
            <div key={d.id} className="card-v2" onClick={() => setSelecionado(d)} style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background .2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{d.nome}</div>
                {d.descricao && <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4 }}>{d.descricao}</div>}
              </div>
              <span style={{ fontSize: 12, background: d.ativo ? 'var(--acc-soft)' : '#f1f5f9', padding: '4px 8px', borderRadius: 4, color: d.ativo ? 'var(--acc-ink)' : 'var(--mut)' }}>
                {d.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Novo Departamento</h2>
            <input
              type="text"
              placeholder="Nome (ex: Financeiro)"
              className="form-input"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              style={{ marginBottom: 12 }}
            />
            <textarea
              placeholder="Descrição (opcional)"
              className="form-input"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              style={{ marginBottom: 16, minHeight: 80 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-v2">Cancelar</button>
              <button onClick={() => void criar()} className="btn-v2 primary">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: detalhe de departamento */}
      {selecionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelecionado(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{selecionado.nome}</h2>
              <button onClick={() => setSelecionado(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {selecionado.descricao && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Descrição</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{selecionado.descricao}</div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 8px', background: selecionado.ativo ? 'var(--acc-soft)' : '#f1f5f9', borderRadius: 4, display: 'inline-block', color: selecionado.ativo ? 'var(--acc-ink)' : 'var(--mut)' }}>
                  {selecionado.ativo ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <button onClick={() => { setSelecionado(null); alert('Chat do departamento — feature em desenvolvimento') }} className="btn-v2 primary" style={{ width: '100%' }}>
                  <i className="fa-solid fa-comments" style={{ marginRight: 8 }} />Chat da Equipe
                </button>
                <button onClick={() => { setSelecionado(null); alert('AI por Setor — recomendações específicas desta área') }} className="btn-v2" style={{ width: '100%' }}>
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }} />Assessora IA Setorial
                </button>
                <button onClick={() => { setSelecionado(null); alert('Gerenciar membros do departamento') }} className="btn-v2" style={{ width: '100%' }}>
                  <i className="fa-solid fa-people-group" style={{ marginRight: 8 }} />Membros
                </button>
                <button onClick={() => setSelecionado(null)} className="btn-v2" style={{ width: '100%' }}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

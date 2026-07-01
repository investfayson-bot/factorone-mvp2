'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { EmptyState } from '@/components/ui/Illustration'
import toast from 'react-hot-toast'

type Funcionario = {
  id: string
  nome: string
  cargo: string | null
  departamento: string | null
  salario: number
  status: string
  admissao: string | null
}

const VAZIO = { nome: '', cargo: '', departamento: '', salario: '', admissao: '' }

export default function FolhaPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [funcs, setFuncs] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...VAZIO })
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) ?? user.id
    setEmpresaId(empresa)
    const { data } = await supabase.from('folha_funcionarios').select('*').eq('empresa_id', empresa).order('created_at', { ascending: false })
    setFuncs((data ?? []) as Funcionario[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Informe o nome'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('folha_funcionarios').insert({
        empresa_id: empresaId,
        nome: form.nome.trim(),
        cargo: form.cargo.trim() || null,
        departamento: form.departamento.trim() || null,
        salario: Number(form.salario) || 0,
        admissao: form.admissao || null,
        status: 'ativo',
      })
      if (error) throw error
      toast.success('Funcionário adicionado')
      setForm({ ...VAZIO }); setShowForm(false)
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(f: Funcionario) {
    const novo = f.status === 'ativo' ? 'inativo' : 'ativo'
    const { error } = await supabase.from('folha_funcionarios').update({ status: novo }).eq('id', f.id)
    if (error) { toast.error('Falha ao atualizar'); return }
    setFuncs(prev => prev.map(x => x.id === f.id ? { ...x, status: novo } : x))
  }

  async function remover(id: string) {
    const { error } = await supabase.from('folha_funcionarios').delete().eq('id', id)
    if (error) { toast.error('Falha ao remover'); return }
    setFuncs(prev => prev.filter(f => f.id !== id))
  }

  const ativos = funcs.filter(f => f.status === 'ativo')
  const totalFolha = ativos.reduce((s, f) => s + Number(f.salario), 0)
  const mediaSalario = ativos.length ? totalFolha / ativos.length : 0
  const encargos = totalFolha * 0.68 // estimativa simples de encargos sobre a folha

  const kpis = [
    { label: 'Funcionários ativos', valor: String(ativos.length), cor: 'var(--navy)' },
    { label: 'Folha mensal', valor: formatBRL(totalFolha), cor: 'var(--teal)' },
    { label: 'Custo c/ encargos (est.)', valor: formatBRL(totalFolha + encargos), cor: 'var(--navy)' },
    { label: 'Salário médio', valor: formatBRL(mediaSalario), cor: 'var(--navy)' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Folha de Pagamento</h1>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Funcionários, salários e custo da folha.</div>
        </div>
        <button className="btn-action" style={{ borderRadius: 8, padding: '9px 16px' }} onClick={() => setShowForm(v => !v)}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo funcionário
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: .4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.cor, marginTop: 4 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <Campo label="Nome *"><input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></Campo>
            <Campo label="Cargo"><input className="form-input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></Campo>
            <Campo label="Departamento"><input className="form-input" value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} /></Campo>
            <Campo label="Salário (R$)"><input className="form-input" type="number" step="0.01" value={form.salario} onChange={e => setForm(f => ({ ...f, salario: e.target.value }))} /></Campo>
            <Campo label="Admissão"><input className="form-input" type="date" value={form.admissao} onChange={e => setForm(f => ({ ...f, admissao: e.target.value }))} /></Campo>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-action" style={{ borderRadius: 8, opacity: saving ? .6 : 1 }} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn-action btn-ghost" style={{ borderRadius: 8 }} onClick={() => { setShowForm(false); setForm({ ...VAZIO }) }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>
        ) : funcs.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <EmptyState label="Nenhum funcionário cadastrado." />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50,#f9fafb)', color: 'var(--gray-500)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={th}>Nome</th><th style={th}>Cargo</th><th style={th}>Departamento</th>
                <th style={{ ...th, textAlign: 'right' }}>Salário</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {funcs.map(f => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--gray-50,#f3f4f6)', opacity: f.status === 'ativo' ? 1 : .5 }}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--navy)' }}>{f.nome}</td>
                  <td style={{ ...td, color: 'var(--gray-500)' }}>{f.cargo || '—'}</td>
                  <td style={{ ...td, color: 'var(--gray-500)' }}>{f.departamento || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatBRL(Number(f.salario))}</td>
                  <td style={td}>
                    <button onClick={() => toggleStatus(f)} style={{ cursor: 'pointer', border: 'none', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: f.status === 'ativo' ? 'rgba(45,155,111,.12)' : 'var(--gray-100)', color: f.status === 'ativo' ? '#2D9B6F' : 'var(--gray-500)' }}>
                      {f.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => remover(f.id)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                      <i className="fa-solid fa-trash" style={{ fontSize: 12 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '10px 14px' }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

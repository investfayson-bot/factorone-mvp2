'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { EmptyState } from '@/components/ui/Illustration'
import toast from 'react-hot-toast'

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'number' | 'money' | 'date' | 'select'
  options?: string[]
  required?: boolean
}
export type ColDef = {
  key: string
  label: string
  align?: 'right'
  money?: boolean
  tag?: boolean
}
export type KpiDef = {
  label: string
  value: (rows: Row[]) => string
  color?: (rows: Row[]) => string
}
type Row = Record<string, unknown>

export type RowActionCtx = { empresaId: string; reload: () => void }

export type CrudConfig = {
  table: string
  titulo: string
  subtitulo: string
  icon: string
  addLabel: string
  emptyLabel: string
  /** Dica opcional exibida no estado vazio (o que fazer / por quê). */
  emptyHint?: string
  fields: FieldDef[]
  columns: ColDef[]
  kpis: KpiDef[]
  /** Ações extras por linha (ex.: marcar como paga). Renderizadas antes do excluir. */
  actions?: (row: Row, ctx: RowActionCtx) => React.ReactNode
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '10px 14px' }

export default function GenericCrud(cfg: CrudConfig) {
  const [empresaId, setEmpresaId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) ?? user.id
    setEmpresaId(empresa)
    const { data } = await supabase.from(cfg.table).select('*').eq('empresa_id', empresa).order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
    setLoading(false)
  }, [cfg.table])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    for (const f of cfg.fields) {
      if (f.required && !(form[f.key] ?? '').trim()) { toast.error(`Informe: ${f.label}`); return }
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { empresa_id: empresaId }
      for (const f of cfg.fields) {
        const raw = form[f.key] ?? ''
        if (f.type === 'number' || f.type === 'money') payload[f.key] = Number(raw) || 0
        else if (f.type === 'date') payload[f.key] = raw || null
        else payload[f.key] = raw.trim() || null
      }
      const { error } = await supabase.from(cfg.table).insert(payload)
      if (error) throw error
      toast.success('Registro adicionado')
      setForm({}); setShowForm(false)
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: string) {
    const { error } = await supabase.from(cfg.table).delete().eq('id', id)
    if (error) { toast.error('Falha ao remover'); return }
    setRows(prev => prev.filter(r => (r.id as string) !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>{cfg.titulo}</h1>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>{cfg.subtitulo}</div>
        </div>
        <button className="btn-action" style={{ borderRadius: 8, padding: '9px 16px' }} onClick={() => setShowForm(v => !v)}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />{cfg.addLabel}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {cfg.kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: .4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color?.(rows) ?? 'var(--navy)', marginTop: 4 }}>{k.value(rows)}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {cfg.fields.map(f => (
              <div className="form-group" style={{ margin: 0 }} key={f.key}>
                <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select className="form-input" value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}>
                    <option value="">Selecione</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={f.type === 'money' || f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    step={f.type === 'money' ? '0.01' : undefined}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-action" style={{ borderRadius: 8, opacity: saving ? .6 : 1 }} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn-action btn-ghost" style={{ borderRadius: 8 }} onClick={() => { setShowForm(false); setForm({}) }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <EmptyState
              title={cfg.emptyLabel}
              hint={cfg.emptyHint ?? `Adicione o primeiro registro para começar a acompanhar ${cfg.titulo.toLowerCase()}.`}
              cta={{ label: cfg.addLabel, icon: 'fa-plus', onClick: () => setShowForm(true) }}
            />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50,#f9fafb)', color: 'var(--gray-500)', fontSize: 11, textTransform: 'uppercase' }}>
                {cfg.columns.map(c => <th key={c.key} style={{ ...th, textAlign: c.align ?? 'left' }}>{c.label}</th>)}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id as string} style={{ borderTop: '1px solid var(--gray-50,#f3f4f6)' }}>
                  {cfg.columns.map((c, i) => {
                    const v = r[c.key]
                    let content: React.ReactNode
                    if (c.money) content = formatBRL(Number(v ?? 0))
                    else if (c.tag) content = <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--gray-100)', color: 'var(--gray-600,#4b5563)' }}>{String(v ?? '—')}</span>
                    else content = (v === null || v === undefined || v === '') ? '—' : String(v)
                    return <td key={c.key} style={{ ...td, textAlign: c.align ?? 'left', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--navy)' : c.align === 'right' ? 'var(--navy)' : 'var(--gray-600,#4b5563)' }}>{content}</td>
                  })}
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {cfg.actions?.(r, { empresaId, reload: carregar })}
                    <button onClick={() => remover(r.id as string)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', marginLeft: 8 }}>
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

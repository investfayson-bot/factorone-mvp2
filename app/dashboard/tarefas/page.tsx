'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Status = 'a_fazer' | 'fazendo' | 'rascunho' | 'feito'
type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
type Tarefa = { id: string; projeto_id: string | null; parent_id: string | null; titulo: string; responsavel: string | null; prioridade: Prioridade; prazo: string | null; status: Status; ordem: number; created_at: string }
type Projeto = { id: string; nome: string; cor: string }
type View = 'lista' | 'board' | 'gantt' | 'calendario'

const STATUS_COLS: { id: Status; label: string }[] = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'fazendo', label: 'Fazendo' },
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'feito', label: 'Feito' },
]

const PRIORIDADE_COR: Record<Prioridade, { bg: string; fg: string; label: string }> = {
  baixa: { bg: 'var(--line-soft)', fg: 'var(--ink-mut)', label: 'Baixa' },
  media: { bg: 'var(--sage-tint)', fg: 'var(--sage-deep)', label: 'Média' },
  alta: { bg: 'var(--gold-tint)', fg: 'var(--gold)', label: 'Alta' },
  urgente: { bg: 'var(--brick-tint)', fg: 'var(--brick)', label: 'Urgente' },
}

const STATUS_COR: Record<Status, { bg: string; fg: string }> = {
  a_fazer: { bg: 'var(--line-soft)', fg: 'var(--ink-mut)' },
  fazendo: { bg: 'var(--gold-tint)', fg: 'var(--gold)' },
  rascunho: { bg: 'var(--line-soft)', fg: 'var(--ink-mut)' },
  feito: { bg: 'var(--sage-tint)', fg: 'var(--sage-deep)' },
}

const VAZIO = { titulo: '', responsavel: '', prioridade: 'media' as Prioridade, prazo: '', status: 'a_fazer' as Status, projeto_id: '' }

export default function TarefasPage() {
  const [token, setToken] = useState('')
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [view, setView] = useState<View>('lista')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...VAZIO })
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      const auth = tk ? { Authorization: `Bearer ${tk}` } : {}
      const [rt, rp] = await Promise.all([
        fetch('/api/tarefas', { headers: auth }),
        fetch('/api/projetos', { headers: auth }),
      ])
      const [jt, jp] = await Promise.all([rt.json(), rp.json()])
      if (rt.ok) setTarefas(jt.tarefas ?? [])
      if (rp.ok) setProjetos(jp.projetos ?? [])
      setLoading(false)
    })()
  }, [])

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  async function criar() {
    if (!form.titulo.trim()) { toast.error('Dê um título pra tarefa'); return }
    try {
      const r = await fetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ ...form, prazo: form.prazo || null, projeto_id: form.projeto_id || null }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao criar')
      setTarefas(prev => [j.tarefa, ...prev])
      setShowModal(false); setForm({ ...VAZIO })
      toast.success('Tarefa criada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function atualizar(id: string, patch: Partial<Tarefa>) {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    try {
      const r = await fetch(`/api/tarefas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(patch) })
      if (!r.ok) throw new Error()
    } catch { toast.error('Falha ao salvar alteração') }
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir esta tarefa?')) return
    setTarefas(prev => prev.filter(t => t.id !== id))
    try { await fetch(`/api/tarefas/${id}`, { method: 'DELETE', headers: auth }) } catch { /* ignore */ }
  }

  function toggleFeito(t: Tarefa) { void atualizar(t.id, { status: t.status === 'feito' ? 'a_fazer' : 'feito' }) }

  const nomeProjeto = (id: string | null) => projetos.find(p => p.id === id)?.nome ?? ''
  const corProjeto = (id: string | null) => projetos.find(p => p.id === id)?.cor ?? 'var(--ink-mut)'

  const feitas = tarefas.filter(t => t.status === 'feito').length
  const pct = tarefas.length ? Math.round((feitas / tarefas.length) * 100) : 0

  const dataFmt = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Scale · Tarefas</div>
          <div className="page-sub">Multi-view (Lista/Board/Gantt/Calendário) · quem faz o quê · prioridades.</div>
        </div>
        <button className="btn-action" style={{ fontSize: 12 }} onClick={() => { setForm({ ...VAZIO }); setShowModal(true) }}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Tarefa
        </button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Total</div><div className="kpi-val">{loading ? '—' : tarefas.length}</div></div>
        <div className="kpi"><div className="kpi-lbl">A fazer</div><div className="kpi-val">{loading ? '—' : tarefas.filter(t => t.status === 'a_fazer').length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Fazendo</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{loading ? '—' : tarefas.filter(t => t.status === 'fazendo').length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Concluídas</div><div className="kpi-val" style={{ color: 'var(--sage-deep)' }}>{loading ? '—' : `${pct}%`}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['lista', 'Lista'], ['board', 'Board'], ['gantt', 'Gantt'], ['calendario', 'Calendário']] as [View, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${view !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {!loading && tarefas.length === 0 && (
        <div className="txs-card" style={{ padding: 44, textAlign: 'center' }}>
          <i className="fa-solid fa-list-check" style={{ fontSize: 28, color: 'var(--sage)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Nenhuma tarefa ainda</div>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setShowModal(true)}>Criar a primeira</button>
        </div>
      )}

      {/* ── Lista ── */}
      {view === 'lista' && tarefas.length > 0 && (
        <div className="txs-card">
          {tarefas.map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 130px 100px 90px 90px auto', gap: 12, alignItems: 'center', padding: '11px 18px', borderBottom: i < tarefas.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <input type="checkbox" checked={t.status === 'feito'} onChange={() => toggleFeito(t)} style={{ accentColor: 'var(--sage)', width: 15, height: 15, cursor: 'pointer' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.status === 'feito' ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: t.status === 'feito' ? 'line-through' : 'none' }}>{t.titulo}</div>
                {t.projeto_id && <div style={{ fontSize: 10, color: corProjeto(t.projeto_id), fontWeight: 600 }}>{nomeProjeto(t.projeto_id)}</div>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mut)' }}>{t.responsavel || '—'}</div>
              <span style={{ justifySelf: 'start', fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: PRIORIDADE_COR[t.prioridade].bg, color: PRIORIDADE_COR[t.prioridade].fg }}>{PRIORIDADE_COR[t.prioridade].label}</span>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mut)' }}>{dataFmt(t.prazo)}</div>
              <select value={t.status} onChange={e => void atualizar(t.id, { status: e.target.value as Status })} style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 6px', borderRadius: 100, background: STATUS_COR[t.status].bg, color: STATUS_COR[t.status].fg, border: 'none', cursor: 'pointer' }}>
                {STATUS_COLS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button className="btn-ghost" style={{ fontSize: 10, padding: '4px 8px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void excluir(t.id)}><i className="fa-solid fa-trash-can" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Board ── */}
      {view === 'board' && tarefas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {STATUS_COLS.map(col => {
            const itens = tarefas.filter(t => t.status === col.id)
            return (
              <div key={col.id}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) void atualizar(dragId, { status: col.id }); setDragId(null) }}
                style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 10, minHeight: 120 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{col.label}</span><span>{itens.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map(t => (
                    <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', cursor: 'grab' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{t.titulo}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: PRIORIDADE_COR[t.prioridade].bg, color: PRIORIDADE_COR[t.prioridade].fg }}>{PRIORIDADE_COR[t.prioridade].label}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-mut)' }}>{t.responsavel || ''}</span>
                      </div>
                      {t.prazo && <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>{dataFmt(t.prazo)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Gantt ── */}
      {view === 'gantt' && tarefas.length > 0 && (
        <GanttView tarefas={tarefas} nomeProjeto={nomeProjeto} corProjeto={corProjeto} />
      )}

      {/* ── Calendário ── */}
      {view === 'calendario' && tarefas.length > 0 && (
        <CalendarioView tarefas={tarefas} />
      )}

      {/* Modal nova tarefa */}
      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Nova tarefa</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-group"><label className="form-label">Título</label><input className="form-input" placeholder="Ex: Renegociar frete transportadora X" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Responsável</label><input className="form-input" placeholder="Nome" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Prazo</label><input className="form-input" type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prioridade</label>
                <select className="form-input" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as Prioridade }))}>
                  {(['baixa', 'media', 'alta', 'urgente'] as Prioridade[]).map(p => <option key={p} value={p}>{PRIORIDADE_COR[p].label}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Projeto (opcional)</label>
                <select className="form-input" value={form.projeto_id} onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value }))}>
                  <option value="">Sem projeto</option>
                  {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void criar()}>Criar tarefa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function GanttView({ tarefas, nomeProjeto, corProjeto }: { tarefas: Tarefa[]; nomeProjeto: (id: string | null) => string; corProjeto: (id: string | null) => string }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const comPrazo = tarefas.filter(t => t.prazo).sort((a, b) => (a.prazo! < b.prazo! ? -1 : 1))
  if (comPrazo.length === 0) return <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>Nenhuma tarefa com prazo definido ainda.</div>
  const datas = comPrazo.map(t => new Date(t.prazo! + 'T12:00:00').getTime())
  const criadas = comPrazo.map(t => new Date(t.created_at).getTime())
  const min = Math.min(hoje.getTime(), ...criadas)
  const max = Math.max(...datas, hoje.getTime() + 86400000 * 7)
  const span = Math.max(max - min, 86400000)
  const pos = (t: number) => `${((t - min) / span) * 100}%`

  return (
    <div className="txs-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginBottom: 10 }}>
        <span>{new Date(min).toLocaleDateString('pt-BR')}</span>
        <span style={{ color: 'var(--sage-deep)', fontWeight: 700 }}>hoje</span>
        <span>{new Date(max).toLocaleDateString('pt-BR')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comPrazo.map(t => {
          const inicio = new Date(t.created_at).getTime()
          const fim = new Date(t.prazo! + 'T12:00:00').getTime()
          const atrasada = fim < hoje.getTime() && t.status !== 'feito'
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.projeto_id && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: corProjeto(t.projeto_id), marginRight: 6 }} />}
                {t.titulo}
              </div>
              <div style={{ position: 'relative', height: 18, background: 'var(--line-soft)', borderRadius: 6 }}>
                <div style={{ position: 'absolute', left: pos(inicio), width: `calc(${pos(fim)} - ${pos(inicio)})`, top: 0, bottom: 0, borderRadius: 6, background: atrasada ? 'var(--brick)' : t.status === 'feito' ? 'var(--sage)' : 'var(--gold)', minWidth: 6 }} title={`${nomeProjeto(t.projeto_id)} · prazo ${new Date(t.prazo! + 'T12:00:00').toLocaleDateString('pt-BR')}`} />
                <div style={{ position: 'absolute', left: pos(hoje.getTime()), top: -2, bottom: -2, width: 2, background: 'var(--sage-deep)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarioView({ tarefas }: { tarefas: Tarefa[] }) {
  const [ref, setRef] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const ano = ref.getFullYear(), mes = ref.getMonth()
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const porDia = new Map<number, Tarefa[]>()
  for (const t of tarefas) {
    if (!t.prazo) continue
    const d = new Date(t.prazo + 'T12:00:00')
    if (d.getFullYear() === ano && d.getMonth() === mes) {
      const dia = d.getDate()
      if (!porDia.has(dia)) porDia.set(dia, [])
      porDia.get(dia)!.push(t)
    }
  }
  const hoje = new Date()
  const celulas: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)]

  return (
    <div className="txs-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setRef(new Date(ano, mes - 1, 1))}><i className="fa-solid fa-chevron-left" /></button>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setRef(new Date(ano, mes + 1, 1))}><i className="fa-solid fa-chevron-right" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 10, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 4 }}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {celulas.map((dia, i) => {
          const isHoje = dia !== null && hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia
          const itens = dia !== null ? (porDia.get(dia) ?? []) : []
          return (
            <div key={i} style={{ minHeight: 68, borderRadius: 8, padding: 6, background: isHoje ? 'var(--sage-tint)' : 'var(--surface-2)', border: isHoje ? '1px solid var(--sage)' : '1px solid transparent' }}>
              {dia !== null && <div style={{ fontSize: 10.5, fontWeight: isHoje ? 700 : 500, color: isHoje ? 'var(--sage-deep)' : 'var(--ink-mut)', marginBottom: 3 }}>{dia}</div>}
              {itens.slice(0, 2).map(t => (
                <div key={t.id} style={{ fontSize: 9, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
              ))}
              {itens.length > 2 && <div style={{ fontSize: 9, color: 'var(--ink-faint)' }}>+{itens.length - 2}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

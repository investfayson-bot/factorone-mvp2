'use client'

// Calendário Editorial (Fase 7) — cal-grid do mockup em tela cheia, mês
// navegável; post clicável abre edição; "+ Novo conteúdo" usa o mesmo
// gerador IA da Visão Geral (aqui via título/copy manual + IA opcional).

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Conteudo = { id: string; titulo: string; tipo: string; status: string; data_pub: string | null; hora_pub: string | null; canal: string | null; copy: string | null }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const TIPOS = ['post_instagram', 'reel', 'story', 'email', 'post_linkedin', 'blog', 'video', 'outro']
const STATUS = ['ideia', 'producao', 'revisao', 'agendado', 'publicado', 'cancelado']

export default function CalendarioEditorialPage() {
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [editando, setEditando] = useState<Partial<Conteudo> | null>(null)
  const [salvando, setSalvando] = useState(false)

  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)
    const ini = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    const fim = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('marketing_conteudo')
      .select('id, titulo, tipo, status, data_pub, hora_pub, canal, copy')
      .eq('empresa_id', eid)
      .gte('data_pub', ini).lte('data_pub', fim)
      .order('data_pub')
    setConteudos((data as Conteudo[]) ?? [])
  }, [ano, mes])
  useEffect(() => { void carregar() }, [carregar])

  const porDia = useMemo(() => {
    const m = new Map<string, Conteudo[]>()
    for (const c of conteudos) { if (c.data_pub) m.set(c.data_pub, [...(m.get(c.data_pub) ?? []), c]) }
    return m
  }, [conteudos])

  async function salvar() {
    if (!editando?.titulo?.trim()) { toast.error('Dê um título'); return }
    setSalvando(true)
    try {
      const payload = {
        titulo: editando.titulo.trim(),
        tipo: editando.tipo ?? 'post_instagram',
        status: editando.status ?? 'ideia',
        data_pub: editando.data_pub || null,
        hora_pub: editando.hora_pub || null,
        canal: editando.canal || null,
        copy: editando.copy || null,
      }
      const { error } = editando.id
        ? await supabase.from('marketing_conteudo').update(payload).eq('id', editando.id)
        : await supabase.from('marketing_conteudo').insert({ ...payload, empresa_id: empresaId })
      if (error) throw error
      toast.success('Salvo')
      setEditando(null)
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const hojeIso = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ paddingBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{MESES[mes]} de {ano}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}><i className="fa-solid fa-chevron-left" style={{ fontSize: 11 }} /></button>
          <button className="btn-v2" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { const d = new Date(); setMesAtual(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Hoje</button>
          <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}><i className="fa-solid fa-chevron-right" style={{ fontSize: 11 }} /></button>
          <button className="btn-v2 primary" onClick={() => setEditando({ data_pub: hojeIso })}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo conteúdo</button>
        </div>
      </div>

      <div className="card-v2" style={{ padding: 16 }}>
        <div className="cal-grid">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="cal-h">{d}</div>)}
          {celulas.map((dia, i) => {
            if (!dia) return <div key={i} />
            const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const posts = porDia.get(iso) ?? []
            return (
              <div key={i} className={`cal-d${iso === hojeIso ? ' hoje' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setEditando({ data_pub: iso })}>
                {dia}
                {posts.map(p => (
                  <span key={p.id} className={`cal-post${p.tipo === 'email' ? ' ads' : ''}`} onClick={e => { e.stopPropagation(); setEditando(p) }}>
                    {p.status === 'publicado' ? '✓ ' : ''}{p.titulo}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8 }}>Clique num dia pra criar conteúdo, ou num post pra editar. Sugestões da Assessora IA (Visão Geral) caem aqui quando agendadas.</div>
      </div>

      {editando && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditando(null) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 16 }}>{editando.id ? 'Editar conteúdo' : 'Novo conteúdo'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Título *" value={editando.titulo ?? ''} onChange={e => setEditando(v => ({ ...v, titulo: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select className="form-input" value={editando.tipo ?? 'post_instagram'} onChange={e => setEditando(v => ({ ...v, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <select className="form-input" value={editando.status ?? 'ideia'} onChange={e => setEditando(v => ({ ...v, status: e.target.value }))}>
                  {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="form-input" type="date" value={editando.data_pub ?? ''} onChange={e => setEditando(v => ({ ...v, data_pub: e.target.value }))} />
                <input className="form-input" type="time" value={editando.hora_pub ?? ''} onChange={e => setEditando(v => ({ ...v, hora_pub: e.target.value }))} />
              </div>
              <textarea className="form-input" rows={4} placeholder="Texto/copy do post" value={editando.copy ?? ''} onChange={e => setEditando(v => ({ ...v, copy: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-v2" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-v2 primary" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

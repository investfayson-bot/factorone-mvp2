'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Op = {
  id: string; empresa_id: string; cliente_id: string | null; titulo: string
  valor: number | null; etapa: string; probabilidade: number
  data_fechamento: string | null; responsavel_nome: string | null; descricao: string | null
  created_at: string; clientes?: { nome: string } | null
}
type Atividade = {
  id: string; empresa_id: string; cliente_id: string | null; oportunidade_id: string | null
  tipo: string; titulo: string; descricao: string | null; data: string
  hora_inicio: string | null; hora_fim: string | null; local: string | null
  status: string; responsavel_nome: string | null; created_at: string
  clientes?: { nome: string } | null
}
type Cliente = { id: string; nome: string }

const ETAPAS = [
  { id: 'prospeccao', label: 'Prospecção', color: '#7A8F8E', bg: '#EEF2F1', prob: 10 },
  { id: 'qualificado', label: 'Qualificado', color: '#7C3AED', bg: '#F3F0FF', prob: 30 },
  { id: 'proposta', label: 'Proposta', color: '#D97706', bg: '#FEF3C7', prob: 60 },
  { id: 'negociacao', label: 'Negociação', color: '#5E8C87', bg: '#EAF5F3', prob: 80 },
  { id: 'fechado_ganho', label: 'Ganho', color: '#16A085', bg: '#DCFCE7', prob: 100 },
  { id: 'fechado_perdido', label: 'Perdido', color: '#E74C3C', bg: '#FEE2E2', prob: 0 },
]

const TIPO_ATI = [
  { v: 'reuniao', l: 'Reunião', i: 'fa-users' },
  { v: 'ligacao', l: 'Ligação', i: 'fa-phone' },
  { v: 'email', l: 'E-mail', i: 'fa-envelope' },
  { v: 'tarefa', l: 'Tarefa', i: 'fa-check-square' },
  { v: 'visita', l: 'Visita', i: 'fa-map-marker-alt' },
  { v: 'whatsapp', l: 'WhatsApp', i: 'fa-whatsapp' },
]

const TIPO_ICON: Record<string, string> = { reuniao: 'fa-users', ligacao: 'fa-phone', email: 'fa-envelope', tarefa: 'fa-square-check', visita: 'fa-map-marker-alt', whatsapp: 'fa-comment', outro: 'fa-ellipsis' }

export default function CRMPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [oportunidades, setOportunidades] = useState<Op[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pipeline' | 'agenda' | 'atividades'>('pipeline')
  const [showOp, setShowOp] = useState(false)
  const [showAtv, setShowAtv] = useState(false)
  const [savingOp, setSavingOp] = useState(false)
  const [savingAtv, setSavingAtv] = useState(false)
  const [formOp, setFormOp] = useState({ titulo: '', cliente_id: '', valor: '', etapa: 'prospeccao', probabilidade: 10, data_fechamento: '', responsavel_nome: '', descricao: '' })
  const [formAtv, setFormAtv] = useState({ tipo: 'reuniao', titulo: '', cliente_id: '', oportunidade_id: '', data: new Date().toISOString().slice(0, 10), hora_inicio: '', hora_fim: '', local: '', descricao: '', responsavel_nome: '', status: 'pendente' })
  const [agendaMes, setAgendaMes] = useState(new Date().toISOString().slice(0, 7))
  const [showInsight, setShowInsight] = useState(false)
  const [insightText, setInsightText] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [ops, ativs, clts] = await Promise.all([
      supabase.from('crm_oportunidades').select('*, clientes(nome)').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('crm_atividades').select('*, clientes(nome)').eq('empresa_id', eid).order('data', { ascending: true }),
      supabase.from('clientes').select('id,nome').eq('empresa_id', eid).eq('status', 'ativo').order('nome'),
    ])
    setOportunidades((ops.data || []) as Op[])
    setAtividades((ativs.data || []) as Atividade[])
    setClientes((clts.data || []) as Cliente[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvarOp() {
    if (!formOp.titulo.trim()) return
    setSavingOp(true)
    await supabase.from('crm_oportunidades').insert({
      empresa_id: empresaId, titulo: formOp.titulo,
      cliente_id: formOp.cliente_id || null,
      valor: formOp.valor ? Number(formOp.valor.replace(',', '.')) : null,
      etapa: formOp.etapa, probabilidade: formOp.probabilidade,
      data_fechamento: formOp.data_fechamento || null,
      responsavel_nome: formOp.responsavel_nome || null,
      descricao: formOp.descricao || null,
    })
    setSavingOp(false); setShowOp(false); void carregar()
  }

  async function salvarAtv() {
    if (!formAtv.titulo.trim()) return
    setSavingAtv(true)
    await supabase.from('crm_atividades').insert({
      empresa_id: empresaId, tipo: formAtv.tipo, titulo: formAtv.titulo,
      cliente_id: formAtv.cliente_id || null,
      oportunidade_id: formAtv.oportunidade_id || null,
      data: formAtv.data, hora_inicio: formAtv.hora_inicio || null,
      hora_fim: formAtv.hora_fim || null, local: formAtv.local || null,
      descricao: formAtv.descricao || null,
      responsavel_nome: formAtv.responsavel_nome || null,
      status: formAtv.status,
    })
    setSavingAtv(false); setShowAtv(false); void carregar()
  }

  async function moverEtapa(opId: string, etapa: string) {
    const e = ETAPAS.find(e => e.id === etapa)
    await supabase.from('crm_oportunidades').update({ etapa, probabilidade: e?.prob ?? 50 }).eq('id', opId)
    void carregar()
  }

  async function marcarAtividade(id: string, status: string) {
    await supabase.from('crm_atividades').update({ status }).eq('id', id)
    void carregar()
  }

  const pipeline = useMemo(() => {
    return ETAPAS.map(e => ({
      ...e,
      ops: oportunidades.filter(o => o.etapa === e.id),
      total: oportunidades.filter(o => o.etapa === e.id).reduce((s, o) => s + Number(o.valor || 0), 0),
    }))
  }, [oportunidades])

  const kpis = useMemo(() => {
    const abertas = oportunidades.filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa))
    const ganhas = oportunidades.filter(o => o.etapa === 'fechado_ganho')
    return {
      abertas: abertas.length,
      valorTotal: abertas.reduce((s, o) => s + Number(o.valor || 0), 0),
      ganhas: ganhas.length,
      ticket: ganhas.length > 0 ? ganhas.reduce((s, o) => s + Number(o.valor || 0), 0) / ganhas.length : 0,
      pendentes: atividades.filter(a => a.status === 'pendente').length,
    }
  }, [oportunidades, atividades])

  const agendaDias = useMemo(() => {
    const ini = `${agendaMes}-01`
    const fim = new Date(Number(agendaMes.slice(0, 4)), Number(agendaMes.slice(5, 7)), 0).toISOString().slice(0, 10)
    return atividades.filter(a => a.data >= ini && a.data <= fim).sort((a, b) => a.data.localeCompare(b.data))
  }, [atividades, agendaMes])

  const inp: React.CSSProperties = { width: '100%', border: '0.5px solid #E2E8E7', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1C2B2A', background: '#fff', boxSizing: 'border-box', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#7A8F8E', marginBottom: 4, display: 'block' }

  if (loading) return <div style={{ padding: 32, color: '#7A8F8E' }}>Carregando CRM…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">CRM</div>
          <div className="page-sub">{kpis.abertas} oportunidades abertas · {kpis.pendentes} atividades pendentes</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" onClick={() => setShowAtv(true)} style={{ fontSize: 12 }}>
            <i className="fa-solid fa-calendar-plus" style={{ marginRight: 5, fontSize: 11 }} />Agendar
          </button>
          <button className="btn-action btn-ghost" style={{ fontSize: 12 }} onClick={async () => {
            setShowInsight(true)
            setInsightText('')
            setInsightLoading(true)
            try {
              const { data: sess } = await supabase.auth.getSession()
              const res = await fetch('/api/crm/insight', {
                method: 'POST',
                headers: { Authorization: `Bearer ${sess.session?.access_token ?? ''}` },
              })
              const d = await res.json() as { insight?: string }
              setInsightText(d.insight ?? 'Sem dados suficientes.')
            } catch { setInsightText('Erro ao gerar análise.') }
            finally { setInsightLoading(false) }
          }}>
            <i className="fa-solid fa-robot" style={{ marginRight: 5, fontSize: 11 }} />IA Pipeline
          </button>
          <button className="btn-action" onClick={() => setShowOp(true)}>+ Nova oportunidade</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        {[
          { l: 'Em aberto', v: String(kpis.abertas),         icon: 'fa-briefcase',    bg: '#EEF2F1', c: '#1C2B2A', sub: 'oportunidades' },
          { l: 'Pipeline total', v: formatBRL(kpis.valorTotal), icon: 'fa-funnel-dollar', bg: '#EAF5F3', c: '#5E8C87', sub: 'valor estimado' },
          { l: 'Ganhas',       v: String(kpis.ganhas),         icon: 'fa-trophy',       bg: '#DCFCE7', c: '#16A085', sub: 'fechamentos' },
          { l: 'Ticket médio', v: formatBRL(kpis.ticket),      icon: 'fa-tag',          bg: '#FEF3C7', c: '#D97706', sub: 'por negócio' },
        ].map(k => (
          <div key={k.l} className="kpi" style={{ borderTop: `3px solid ${k.c}` }}>
            <div className="kpi-lbl">{k.l}
              <div style={{ width: 26, height: 26, borderRadius: 7, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa-solid ${k.icon}`} style={{ fontSize: 11, color: k.c }} />
              </div>
            </div>
            <div className="kpi-val" style={{ color: k.c }}>{k.v}</div>
            <div className="kpi-delta">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs pill */}
      <div style={{ display: 'flex', gap: 2, background: '#E8EDEC', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
        {([['pipeline','Pipeline','fa-columns'], ['agenda','Agenda','fa-calendar'], ['atividades','Atividades','fa-list-check'], ['automacoes','Automações','fa-robot']] as [string,string,string][]).map(([k,l,ico]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8, fontSize: 11,
            fontWeight: tab === k ? 700 : 500, border: 'none', cursor: 'pointer',
            background: tab === k ? '#fff' : 'transparent',
            color: tab === k ? '#1C2B2A' : '#7A8F8E', transition: 'all .15s',
          }}>
            <i className={`fa-solid ${ico}`} style={{ fontSize: 10 }} />{l}
          </button>
        ))}
      </div>

      {/* Pipeline Kanban */}
      {tab === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, overflowX: 'auto' }}>
          {pipeline.map(col => (
            <div key={col.id} style={{ minWidth: 180 }}>
              <div style={{ padding: '8px 10px', background: col.bg, borderRadius: '10px 10px 0 0', border: `1px solid ${col.color}20`, borderBottom: `2px solid ${col.color}` }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 2px' }}>{col.label}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#1C2B2A', margin: 0, fontFamily: "'Manrope', 'Inter', sans-serif" }}>{formatBRL(col.total)}</p>
              </div>
              <div style={{ background: '#fafafa', border: `1px solid ${col.color}20`, borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 200, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.ops.map(op => (
                  <div key={op.id} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 8, padding: '10px 10px 8px' }}>
                    <p style={{ fontWeight: 700, fontSize: 11, color: '#1C2B2A', margin: '0 0 3px', lineHeight: 1.3 }}>{op.titulo}</p>
                    {op.clientes && <p style={{ fontSize: 10, color: '#5E8C87', margin: '0 0 3px' }}>{op.clientes.nome}</p>}
                    {op.valor && <p style={{ fontSize: 11, fontWeight: 700, color: '#16A085', fontFamily: "'Manrope', 'Inter', sans-serif", margin: '0 0 6px' }}>{formatBRL(Number(op.valor))}</p>}
                    <select value={op.etapa} onChange={e => void moverEtapa(op.id, e.target.value)} style={{ fontSize: 9, padding: '2px 4px', borderRadius: 5, border: '0.5px solid #E2E8E7', color: '#7A8F8E', width: '100%' }}>
                      {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agenda */}
      {tab === 'agenda' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button onClick={() => { const d = new Date(agendaMes + '-01'); d.setMonth(d.getMonth() - 1); setAgendaMes(d.toISOString().slice(0, 7)) }} className="btn-action btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A', minWidth: 140, textAlign: 'center' }}>
              {new Date(agendaMes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(agendaMes + '-01'); d.setMonth(d.getMonth() + 1); setAgendaMes(d.toISOString().slice(0, 7)) }} className="btn-action btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>›</button>
          </div>
          {agendaDias.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#7A8F8E', fontSize: 13 }}>
              Nenhum compromisso. <button onClick={() => setShowAtv(true)} style={{ color: '#5E8C87', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Agendar →</button>
            </div>
          )}
          {agendaDias.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '0.5px solid #E2E8E7', alignItems: 'flex-start' }}>
              <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#7A8F8E', margin: 0 }}>
                  {new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
                </p>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#1C2B2A', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {new Date(a.data + 'T12:00:00').getDate()}
                </p>
              </div>
              <div style={{ width: 4, borderRadius: 2, alignSelf: 'stretch', background: a.status === 'realizada' ? '#16A085' : a.status === 'cancelada' ? '#E74C3C' : '#5E8C87', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <i className={`fa-solid ${TIPO_ICON[a.tipo] || 'fa-circle'}`} style={{ fontSize: 12, color: '#5E8C87' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A', margin: 0 }}>{a.titulo}</p>
                </div>
                {a.hora_inicio && <p style={{ fontSize: 11, color: '#7A8F8E', margin: '1px 0' }}>{a.hora_inicio}{a.hora_fim ? ` – ${a.hora_fim}` : ''}{a.local ? ` · ${a.local}` : ''}</p>}
                {a.clientes && <p style={{ fontSize: 11, color: '#5E8C87', margin: '2px 0 0' }}>{a.clientes.nome}</p>}
              </div>
              <select value={a.status} onChange={e => void marcarAtividade(a.id, e.target.value)} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '0.5px solid #E2E8E7', color: a.status === 'realizada' ? '#16A085' : '#7A8F8E', flexShrink: 0 }}>
                <option value="pendente">Pendente</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          ))}
        </>
      )}

      {/* Atividades */}
      {tab === 'atividades' && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Responsável</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {atividades.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: '#7A8F8E' }}>Nenhuma atividade.</td></tr>}
                {atividades.slice(0, 50).map(a => (
                  <tr key={a.id} style={{ opacity: a.status === 'cancelada' ? 0.5 : 1 }}>
                    <td style={{ fontFamily: "'Manrope', 'Inter', sans-serif", fontSize: 11 }}>{new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <i className={`fa-solid ${TIPO_ICON[a.tipo] || 'fa-circle'}`} style={{ color: '#5E8C87', fontSize: 10 }} />
                        {TIPO_ATI.find(t => t.v === a.tipo)?.l || a.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{a.titulo}</td>
                    <td style={{ fontSize: 11, color: '#5E8C87' }}>{a.clientes?.nome || '—'}</td>
                    <td style={{ fontSize: 11, color: '#7A8F8E' }}>{a.responsavel_nome || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <select value={a.status} onChange={e => void marcarAtividade(a.id, e.target.value)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, border: '1px solid', background: a.status === 'realizada' ? 'rgba(45,155,111,.1)' : a.status === 'cancelada' ? 'rgba(192,80,74,.1)' : '#E2E8E7', color: a.status === 'realizada' ? '#16A085' : a.status === 'cancelada' ? '#E74C3C' : '#7A8F8E', borderColor: 'transparent', cursor: 'pointer' }}>
                        <option value="pendente">Pendente</option>
                        <option value="realizada">Realizada</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal oportunidade */}
      {showOp && (
        <div className="modal-bg" onClick={() => setShowOp(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Nova oportunidade</h3>
              <button className="modal-close" onClick={() => setShowOp(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Título *</label><input style={inp} placeholder="Ex.: Proposta sistema de gestão" value={formOp.titulo} onChange={e => setFormOp(f => ({ ...f, titulo: e.target.value }))} /></div>
              <div><label style={lbl}>Cliente</label><select style={inp} value={formOp.cliente_id} onChange={e => setFormOp(f => ({ ...f, cliente_id: e.target.value }))}><option value="">— Selecionar —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><label style={lbl}>Valor estimado (R$)</label><input style={inp} placeholder="0,00" value={formOp.valor} onChange={e => setFormOp(f => ({ ...f, valor: e.target.value }))} /></div>
              <div><label style={lbl}>Etapa</label><select style={inp} value={formOp.etapa} onChange={e => { const et = ETAPAS.find(x => x.id === e.target.value); setFormOp(f => ({ ...f, etapa: e.target.value, probabilidade: et?.prob ?? 50 })) }}>{ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
              <div><label style={lbl}>Probabilidade (%)</label><input style={inp} type="number" min={0} max={100} value={formOp.probabilidade} onChange={e => setFormOp(f => ({ ...f, probabilidade: Number(e.target.value) }))} /></div>
              <div><label style={lbl}>Prev. fechamento</label><input style={inp} type="date" value={formOp.data_fechamento} onChange={e => setFormOp(f => ({ ...f, data_fechamento: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Responsável</label><input style={inp} placeholder="Nome do responsável" value={formOp.responsavel_nome} onChange={e => setFormOp(f => ({ ...f, responsavel_nome: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Descrição</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Contexto da oportunidade" value={formOp.descricao} onChange={e => setFormOp(f => ({ ...f, descricao: e.target.value }))} /></div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-action btn-ghost" onClick={() => setShowOp(false)}>Cancelar</button>
              <button className="btn-action" disabled={savingOp} onClick={() => void salvarOp()}>{savingOp ? 'Salvando…' : 'Criar oportunidade'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal atividade */}
      {showAtv && (
        <div className="modal-bg" onClick={() => setShowAtv(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Agendar atividade</h3>
              <button className="modal-close" onClick={() => setShowAtv(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {/* Tipo seletor */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 16 }}>
              {TIPO_ATI.map(t => (
                <button key={t.v} type="button" onClick={() => setFormAtv(f => ({ ...f, tipo: t.v }))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 8, border: formAtv.tipo === t.v ? '2px solid #5E8C87' : '0.5px solid #E2E8E7', background: formAtv.tipo === t.v ? 'rgba(94,140,135,.06)' : '#fafafa', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: formAtv.tipo === t.v ? '#5E8C87' : '#7A8F8E' }}>
                  <i className={`fa-solid ${t.i}`} style={{ fontSize: 15 }} />{t.l}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Título *</label><input style={inp} placeholder="Ex.: Reunião de kick-off" value={formAtv.titulo} onChange={e => setFormAtv(f => ({ ...f, titulo: e.target.value }))} /></div>
              <div><label style={lbl}>Cliente</label><select style={inp} value={formAtv.cliente_id} onChange={e => setFormAtv(f => ({ ...f, cliente_id: e.target.value }))}><option value="">— Selecionar —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><label style={lbl}>Data *</label><input style={inp} type="date" value={formAtv.data} onChange={e => setFormAtv(f => ({ ...f, data: e.target.value }))} /></div>
              <div><label style={lbl}>Início</label><input style={inp} type="time" value={formAtv.hora_inicio} onChange={e => setFormAtv(f => ({ ...f, hora_inicio: e.target.value }))} /></div>
              <div><label style={lbl}>Término</label><input style={inp} type="time" value={formAtv.hora_fim} onChange={e => setFormAtv(f => ({ ...f, hora_fim: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Local / Link</label><input style={inp} placeholder="Endereço ou URL do Meet/Zoom" value={formAtv.local} onChange={e => setFormAtv(f => ({ ...f, local: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Responsável</label><input style={inp} placeholder="Quem conduz" value={formAtv.responsavel_nome} onChange={e => setFormAtv(f => ({ ...f, responsavel_nome: e.target.value }))} /></div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-action btn-ghost" onClick={() => setShowAtv(false)}>Cancelar</button>
              <button className="btn-action" disabled={savingAtv} onClick={() => void salvarAtv()}>{savingAtv ? 'Salvando…' : 'Agendar'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Automações */}
      {tab === ('automacoes' as typeof tab) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#EAF5F3', border: '0.5px solid #5E8C87', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 16, color: '#5E8C87', marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', marginBottom: 3 }}>Automações de follow-up com FactorOne AI</div>
              <div style={{ fontSize: 11, color: '#7A8F8E', lineHeight: 1.6 }}>Configure gatilhos automáticos para follow-up de oportunidades, lembretes de atividades e alertas de pipeline estagnado.</div>
            </div>
          </div>

          {[
            { titulo: 'Follow-up automático após proposta', desc: 'Cria atividade de ligação 3 dias depois de mover oportunidade para "Proposta" sem resposta do cliente', ativo: true, icon: 'fa-phone', cor: '#5E8C87', gatilho: 'Etapa: Proposta → sem atividade por 3 dias', acao: 'Criar atividade: Ligar para cliente' },
            { titulo: 'Alerta de pipeline estagnado', desc: 'Notifica o responsável quando uma oportunidade não tem atividades há mais de 7 dias', ativo: true, icon: 'fa-bell', cor: '#D97706', gatilho: 'Oportunidade sem atividade → 7 dias', acao: 'Notificação + e-mail ao responsável' },
            { titulo: 'E-mail de boas-vindas ao cliente', desc: 'Envia e-mail automático quando cliente é cadastrado no sistema', ativo: false, icon: 'fa-envelope', cor: '#2563eb', gatilho: 'Novo cliente cadastrado', acao: 'Enviar e-mail de boas-vindas' },
            { titulo: 'Lembrete de reunião', desc: 'Envia WhatsApp 1 hora antes de reuniões agendadas no pipeline', ativo: false, icon: 'fa-comment', cor: '#25D366', gatilho: 'Atividade: Reunião → 1 hora antes', acao: 'WhatsApp automático ao cliente' },
            { titulo: 'Recálculo de probabilidade', desc: 'FactorOne AI recalcula a probabilidade de fechamento semanalmente com base no histórico', ativo: true, icon: 'fa-robot', cor: '#7C3AED', gatilho: 'Toda segunda-feira, 09:00', acao: 'IA atualiza campo de probabilidade' },
            { titulo: 'Relatório semanal de pipeline', desc: 'Relatório em PDF do funil enviado por e-mail toda sexta para o gestor', ativo: false, icon: 'fa-file-pdf', cor: '#E74C3C', gatilho: 'Toda sexta-feira, 17:00', acao: 'PDF + e-mail para gerência' },
          ].map(auto => (
            <div key={auto.titulo} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `${auto.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${auto.icon}`} style={{ fontSize: 16, color: auto.cor }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A' }}>{auto.titulo}</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: auto.ativo ? '#EAF5F3' : '#EEF2F1', color: auto.ativo ? '#0F6E56' : '#7A8F8E' }}>
                    {auto.ativo ? '● ATIVO' : '○ INATIVO'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#7A8F8E', marginBottom: 8, lineHeight: 1.5 }}>{auto.desc}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                    <i className="fa-solid fa-bolt" style={{ marginRight: 4, fontSize: 9 }} />{auto.gatilho}
                  </span>
                  <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: '#EAF5F3', color: '#0F6E56', fontWeight: 600 }}>
                    <i className="fa-solid fa-arrow-right" style={{ marginRight: 4, fontSize: 9 }} />{auto.acao}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '0.5px solid #E2E8E7', background: '#fff', color: '#7A8F8E', cursor: 'pointer', fontWeight: 600 }}>Editar</button>
                <button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: 'none', background: auto.ativo ? '#FEE2E2' : '#EAF5F3', color: auto.ativo ? '#E74C3C' : '#0F6E56', cursor: 'pointer', fontWeight: 700 }}>
                  {auto.ativo ? 'Pausar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}

          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: '1.5px dashed #D1D9D8', background: '#F8FAFA', color: '#7A8F8E', cursor: 'pointer', fontSize: 12, fontWeight: 600, width: '100%', justifyContent: 'center' }}>
            <i className="fa-solid fa-plus" />Nova automação
          </button>
        </div>
      )}

      {/* Modal AI Pipeline Insight */}
      {showInsight && (
        <div className="modal-bg" onClick={() => setShowInsight(false)}>
          <div className="modal-box" style={{ maxWidth: 560, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <i className="fa-solid fa-robot" style={{ color: '#5E8C87', marginRight: 8 }} />
              Análise IA do Pipeline
              <button className="modal-close" onClick={() => setShowInsight(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {insightLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#7A8F8E' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block', color: '#5E8C87' }} />
                Analisando pipeline com FactorOne IA...
              </div>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1C2B2A', whiteSpace: 'pre-wrap' }}>
                {insightText}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-action btn-ghost" onClick={() => setShowInsight(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

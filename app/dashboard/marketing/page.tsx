'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Campanha = {
  id: string; empresa_id: string; nome: string
  tipo: 'google_ads' | 'meta_ads' | 'email' | 'seo' | 'social' | 'outro'
  status: 'rascunho' | 'ativa' | 'pausada' | 'concluida' | 'cancelada'
  orcamento: number | null; gasto: number; impressoes: number; cliques: number
  conversoes: number; receita_gerada: number; data_inicio: string | null; data_fim: string | null
  url_destino: string | null; notas: string | null; created_at: string
}
type Conteudo = {
  id: string; empresa_id: string; titulo: string
  tipo: string; status: string; data_pub: string | null
  hora_pub: string | null; canal: string | null; copy: string | null; responsavel: string | null; campanha_id: string | null
}
type Lead = {
  id: string; nome: string | null; email: string | null; telefone: string | null
  origem: string | null; status: string; created_at: string
}

const TIPO_CAMP: Record<string, { label: string; icon: string; color: string }> = {
  google_ads:  { label: 'Google Ads',  icon: 'fa-google',    color: '#4285F4' },
  meta_ads:    { label: 'Meta Ads',    icon: 'fa-meta',      color: '#0866FF' },
  email:       { label: 'E-mail',      icon: 'fa-envelope',  color: '#00A896' },
  seo:         { label: 'SEO',         icon: 'fa-magnifying-glass-chart', color: '#FF6B35' },
  social:      { label: 'Social',      icon: 'fa-share-nodes', color: '#7C3AED' },
  outro:       { label: 'Outro',       icon: 'fa-bullhorn',  color: '#64748b' },
}

const STATUS_CONT: Record<string, { label: string; color: string; bg: string }> = {
  ideia:      { label: 'Ideia',     color: '#94a3b8', bg: '#f1f5f9' },
  producao:   { label: 'Produção',  color: '#F59E0B', bg: '#fffbeb' },
  revisao:    { label: 'Revisão',   color: '#7C3AED', bg: 'rgba(124,58,237,.08)' },
  agendado:   { label: 'Agendado',  color: 'var(--teal)', bg: 'rgba(0,168,150,.08)' },
  publicado:  { label: 'Publicado', color: 'var(--green)', bg: 'rgba(45,155,111,.08)' },
  cancelado:  { label: 'Cancelado', color: 'var(--red)', bg: 'rgba(192,80,74,.08)' },
}

const TIPOS_CONT = ['post_instagram','post_linkedin','blog','video','email','story','reel','outro']

const BLANK_CAMP = { nome: '', tipo: 'meta_ads', status: 'rascunho', orcamento: '', gasto: '0', data_inicio: '', data_fim: '', url_destino: '', notas: '' }
const BLANK_CONT = { titulo: '', tipo: 'post_instagram', status: 'ideia', data_pub: '', hora_pub: '', canal: '', copy: '', responsavel: '', campanha_id: '' }

export default function MarketingPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'campanhas' | 'funil' | 'conteudo' | 'leads'>('dashboard')
  const [showCamp, setShowCamp] = useState(false)
  const [showCont, setShowCont] = useState(false)
  const [formCamp, setFormCamp] = useState({ ...BLANK_CAMP })
  const [formCont, setFormCont] = useState({ ...BLANK_CONT })
  const [saving, setSaving] = useState(false)
  const [calMes, setCalMes] = useState(new Date().toISOString().slice(0, 7))

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [camps, conts, lds] = await Promise.all([
      supabase.from('marketing_campanhas').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('marketing_conteudo').select('*').eq('empresa_id', eid).order('data_pub', { ascending: true }),
      supabase.from('marketing_leads').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(100),
    ])
    setCampanhas((camps.data || []) as Campanha[])
    setConteudos((conts.data || []) as Conteudo[])
    setLeads((lds.data || []) as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvarCampanha() {
    if (!formCamp.nome.trim()) return
    setSaving(true)
    await supabase.from('marketing_campanhas').insert({
      empresa_id: empresaId, nome: formCamp.nome, tipo: formCamp.tipo, status: formCamp.status,
      orcamento: formCamp.orcamento ? Number(String(formCamp.orcamento).replace(',', '.')) : null,
      gasto: 0, impressoes: 0, cliques: 0, conversoes: 0, receita_gerada: 0,
      data_inicio: formCamp.data_inicio || null, data_fim: formCamp.data_fim || null,
      url_destino: formCamp.url_destino || null, notas: formCamp.notas || null,
    })
    setSaving(false); setShowCamp(false); void carregar()
  }

  async function salvarConteudo() {
    if (!formCont.titulo.trim()) return
    setSaving(true)
    await supabase.from('marketing_conteudo').insert({
      empresa_id: empresaId, titulo: formCont.titulo, tipo: formCont.tipo, status: formCont.status,
      data_pub: formCont.data_pub || null, hora_pub: formCont.hora_pub || null,
      canal: formCont.canal || null, copy: formCont.copy || null,
      responsavel: formCont.responsavel || null,
      campanha_id: formCont.campanha_id || null,
    })
    setSaving(false); setShowCont(false); void carregar()
  }

  const kpis = useMemo(() => {
    const ativas = campanhas.filter(c => c.status === 'ativa')
    return {
      totalGasto: campanhas.reduce((s, c) => s + Number(c.gasto || 0), 0),
      receitaGerada: campanhas.reduce((s, c) => s + Number(c.receita_gerada || 0), 0),
      roas: campanhas.reduce((s, c) => s + Number(c.gasto || 0), 0) > 0
        ? campanhas.reduce((s, c) => s + Number(c.receita_gerada || 0), 0) / campanhas.reduce((s, c) => s + Number(c.gasto || 0), 0)
        : 0,
      impressoes: campanhas.reduce((s, c) => s + Number(c.impressoes || 0), 0),
      cliques: campanhas.reduce((s, c) => s + Number(c.cliques || 0), 0),
      conversoes: campanhas.reduce((s, c) => s + Number(c.conversoes || 0), 0),
      leads: leads.length,
      leadsNovos: leads.filter(l => l.status === 'novo').length,
      campanhasAtivas: ativas.length,
      conteudosProg: conteudos.filter(c => ['producao','revisao','agendado'].includes(c.status)).length,
    }
  }, [campanhas, leads, conteudos])

  const ctr = kpis.impressoes > 0 ? ((kpis.cliques / kpis.impressoes) * 100).toFixed(2) : '0.00'
  const cvr = kpis.cliques > 0 ? ((kpis.conversoes / kpis.cliques) * 100).toFixed(2) : '0.00'

  // Funil de leads
  const funilLeads = useMemo(() => {
    const total = leads.length || 1
    return ['novo','contato','qualificado','convertido','perdido'].map(s => ({
      s, n: leads.filter(l => l.status === s).length,
      pct: (leads.filter(l => l.status === s).length / total) * 100,
    }))
  }, [leads])

  // Calendário editorial
  const contCalMes = useMemo(() => {
    const ini = `${calMes}-01`
    const fim = new Date(Number(calMes.slice(0, 4)), Number(calMes.slice(5, 7)), 0).toISOString().slice(0, 10)
    return conteudos.filter(c => c.data_pub && c.data_pub >= ini && c.data_pub <= fim).sort((a, b) => (a.data_pub || '').localeCompare(b.data_pub || ''))
  }, [conteudos, calMes])

  const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--navy)', background: '#fff', boxSizing: 'border-box', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)' }}>Carregando Marketing…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Marketing</div>
          <div className="page-sub">{kpis.campanhasAtivas} campanhas ativas · {kpis.leads} leads · ROAS {kpis.roas.toFixed(2)}x</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowCont(true)}>
            <i className="fa-solid fa-pen-to-square" style={{ marginRight: 5, fontSize: 11 }} />Conteúdo
          </button>
          <button className="btn-action" onClick={() => setShowCamp(true)}>+ Nova campanha</button>
        </div>
      </div>

      {/* KPIs financeiros — conectados ao dashboard */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 16 }}>
        {[
          { l: 'Investido', v: formatBRL(kpis.totalGasto), s: 'total campanhas', c: 'var(--navy)' },
          { l: 'Receita gerada', v: formatBRL(kpis.receitaGerada), s: 'via marketing', c: 'var(--green)' },
          { l: 'ROAS', v: `${kpis.roas.toFixed(2)}x`, s: 'retorno/investimento', c: kpis.roas >= 3 ? 'var(--green)' : kpis.roas >= 1 ? 'var(--gold)' : 'var(--red)' },
          { l: 'Leads totais', v: kpis.leads, s: `${kpis.leadsNovos} novos`, c: '#7C3AED' },
          { l: 'Conteúdo', v: kpis.conteudosProg, s: 'em produção', c: 'var(--teal)' },
        ].map(k => (
          <div key={k.l} className="kpi">
            <div className="kpi-lbl">{k.l}</div>
            <div className="kpi-val" style={{ color: k.c }}>{k.v}</div>
            <div className="kpi-delta">{k.s}</div>
          </div>
        ))}
      </div>

      {/* Métricas de performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { l: 'Impressões', v: kpis.impressoes.toLocaleString('pt-BR') },
          { l: 'Cliques', v: kpis.cliques.toLocaleString('pt-BR') },
          { l: 'CTR', v: `${ctr}%` },
          { l: 'Conv. Rate', v: `${cvr}%` },
        ].map(m => (
          <div key={m.l} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 4px' }}>{m.l}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: 'DM Mono,monospace', margin: 0 }}>{m.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['dashboard','Visão Geral'],['campanhas','Campanhas'],['funil','Funil de Leads'],['conteudo','Calendário'],['leads','Leads']] as [string,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: tab === k ? 'var(--navy)' : '#fff', color: tab === k ? '#fff' : 'var(--gray-500)', borderColor: tab === k ? 'var(--navy)' : 'var(--gray-100)' }}>{l}</button>
        ))}
      </div>

      {/* Dashboard geral */}
      {tab === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          {/* Campanhas ativas */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Campanhas ativas</p>
            {campanhas.filter(c => c.status === 'ativa').length === 0 && <p style={{ color: 'var(--gray-400)', fontSize: 12 }}>Nenhuma campanha ativa.</p>}
            {campanhas.filter(c => c.status === 'ativa').map(c => {
              const pct = c.orcamento ? Math.min(100, (Number(c.gasto) / Number(c.orcamento)) * 100) : 0
              const t = TIPO_CAMP[c.tipo]
              return (
                <div key={c.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className={`fa-brands ${t.icon}`} style={{ color: t.color, fontSize: 14 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{c.nome}</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'var(--gray-500)' }}>{formatBRL(Number(c.gasto))} / {c.orcamento ? formatBRL(Number(c.orcamento)) : '∞'}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 3 }}>
                    <div style={{ height: 5, borderRadius: 3, width: `${pct}%`, background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--gold)' : 'var(--teal)', transition: 'width .3s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    {[['Impressões', c.impressoes.toLocaleString('pt-BR')], ['Cliques', c.cliques.toLocaleString('pt-BR')], ['Conv.', c.conversoes], ['Receita', formatBRL(Number(c.receita_gerada))]].map(([k, v]) => (
                      <span key={String(k)} style={{ fontSize: 10, color: 'var(--gray-400)' }}>{k}: <strong style={{ color: 'var(--navy)' }}>{String(v)}</strong></span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Funil resumido */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Funil de leads</p>
            {funilLeads.map((f, i) => (
              <div key={f.s} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--gray-500)', textTransform: 'capitalize' }}>{f.s}</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{f.n}</span>
                </div>
                <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 3 }}>
                  <div style={{ height: 5, borderRadius: 3, width: `${f.pct}%`, background: ['#7C3AED','var(--teal)','var(--gold)','var(--green)','var(--red)'][i], transition: 'width .3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campanhas */}
      {tab === 'campanhas' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead><tr><th>Campanha</th><th>Tipo</th><th>Status</th><th style={{ textAlign: 'right' }}>Orçamento</th><th style={{ textAlign: 'right' }}>Gasto</th><th style={{ textAlign: 'right' }}>Receita</th><th style={{ textAlign: 'center' }}>ROAS</th><th style={{ textAlign: 'center' }}>Conv.</th></tr></thead>
              <tbody>
                {campanhas.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)' }}>Nenhuma campanha.</td></tr>}
                {campanhas.map(c => {
                  const roas = Number(c.gasto) > 0 ? (Number(c.receita_gerada) / Number(c.gasto)).toFixed(2) : '—'
                  const t = TIPO_CAMP[c.tipo]
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>{c.nome}</td>
                      <td><span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}><i className={`fa-brands ${t.icon}`} style={{ color: t.color }} />{t.label}</span></td>
                      <td><span className="tag gray" style={{ fontSize: 9, textTransform: 'uppercase' }}>{c.status}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{c.orcamento ? formatBRL(Number(c.orcamento)) : '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--red)' }}>{formatBRL(Number(c.gasto))}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--green)' }}>{formatBRL(Number(c.receita_gerada))}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: Number(roas) >= 3 ? 'var(--green)' : Number(roas) >= 1 ? 'var(--gold)' : 'var(--red)' }}>{roas}x</td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>{c.conversoes}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Funil completo */}
      {tab === 'funil' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <div>
            {funilLeads.map((f, i) => (
              <div key={f.s} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, borderLeft: `4px solid ${['#7C3AED','var(--teal)','var(--gold)','var(--green)','var(--red)'][i]}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gray-400)', margin: '0 0 2px' }}>{f.s}</p>
                <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'DM Mono,monospace', color: 'var(--navy)', margin: 0 }}>{f.n}</p>
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, marginTop: 8 }}>
                  <div style={{ height: 4, width: `${f.pct}%`, background: ['#7C3AED','var(--teal)','var(--gold)','var(--green)','var(--red)'][i], borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
            <div className="expenses-table">
              <table>
                <thead><tr><th>Lead</th><th>E-mail</th><th>Origem</th><th>Status</th><th>Data</th></tr></thead>
                <tbody>
                  {leads.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)' }}>Nenhum lead.</td></tr>}
                  {leads.slice(0, 30).map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{l.nome || 'Anônimo'}</td>
                      <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{l.email || '—'}</td>
                      <td><span className="tag gray" style={{ fontSize: 9 }}>{l.origem || '—'}</span></td>
                      <td><span className="tag gray" style={{ fontSize: 9, textTransform: 'capitalize' }}>{l.status}</span></td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Calendário editorial */}
      {tab === 'conteudo' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button onClick={() => { const d = new Date(calMes + '-01'); d.setMonth(d.getMonth() - 1); setCalMes(d.toISOString().slice(0, 7)) }} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', minWidth: 140, textAlign: 'center' }}>{new Date(calMes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => { const d = new Date(calMes + '-01'); d.setMonth(d.getMonth() + 1); setCalMes(d.toISOString().slice(0, 7)) }} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>›</button>
          </div>
          {contCalMes.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)', fontSize: 13 }}>Nenhum conteúdo agendado. <button onClick={() => setShowCont(true)} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Planejar →</button></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {contCalMes.map(c => {
              const st = STATUS_CONT[c.status] || STATUS_CONT.ideia
              return (
                <div key={c.id} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${st.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>{c.data_pub ? new Date(c.data_pub + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', margin: '0 0 3px' }}>{c.titulo}</p>
                  <p style={{ fontSize: 10, color: 'var(--gray-400)', margin: 0 }}>{c.tipo.replace(/_/g, ' ')} {c.canal ? `· ${c.canal}` : ''}</p>
                  {c.responsavel && <p style={{ fontSize: 10, color: 'var(--teal)', margin: '4px 0 0' }}>{c.responsavel}</p>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Leads lista */}
      {tab === 'leads' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Origem</th><th>Status</th><th>Data</th></tr></thead>
              <tbody>
                {leads.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)' }}>Nenhum lead cadastrado.</td></tr>}
                {leads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{l.nome || 'Anônimo'}</td>
                    <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{l.email || '—'}</td>
                    <td style={{ fontSize: 11 }}>{l.telefone || '—'}</td>
                    <td><span className="tag gray" style={{ fontSize: 9 }}>{l.origem || '—'}</span></td>
                    <td><span className="tag gray" style={{ fontSize: 9, textTransform: 'capitalize' }}>{l.status}</span></td>
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal campanha */}
      {showCamp && (
        <div className="modal-bg" onClick={() => setShowCamp(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Nova campanha</h3>
              <button className="modal-close" onClick={() => setShowCamp(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Nome da campanha *</label>
                <input style={inp} placeholder="Ex.: Google Ads — Produto X" value={formCamp.nome} onChange={e => setFormCamp(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Canal</label>
                <select style={inp} value={formCamp.tipo} onChange={e => setFormCamp(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_CAMP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Orçamento (R$)</label>
                <input style={inp} placeholder="5.000,00" value={formCamp.orcamento} onChange={e => setFormCamp(f => ({ ...f, orcamento: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Início</label>
                <input style={inp} type="date" value={formCamp.data_inicio} onChange={e => setFormCamp(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Fim</label>
                <input style={inp} type="date" value={formCamp.data_fim} onChange={e => setFormCamp(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>URL de destino</label>
                <input style={inp} placeholder="https://site.com/landing" value={formCamp.url_destino} onChange={e => setFormCamp(f => ({ ...f, url_destino: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={() => setShowCamp(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} onClick={() => void salvarCampanha()}>{saving ? 'Salvando…' : 'Criar campanha'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conteúdo */}
      {showCont && (
        <div className="modal-bg" onClick={() => setShowCont(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Planejar conteúdo</h3>
              <button className="modal-close" onClick={() => setShowCont(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Título *</label>
                <input style={inp} placeholder="Ex.: 5 dicas de gestão financeira" value={formCont.titulo} onChange={e => setFormCont(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={formCont.tipo} onChange={e => setFormCont(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_CONT.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={formCont.status} onChange={e => setFormCont(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_CONT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data de publicação</label>
                <input style={inp} type="date" value={formCont.data_pub} onChange={e => setFormCont(f => ({ ...f, data_pub: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Hora</label>
                <input style={inp} type="time" value={formCont.hora_pub} onChange={e => setFormCont(f => ({ ...f, hora_pub: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Canal</label>
                <input style={inp} placeholder="Instagram, LinkedIn…" value={formCont.canal} onChange={e => setFormCont(f => ({ ...f, canal: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Responsável</label>
                <input style={inp} placeholder="Quem cria" value={formCont.responsavel} onChange={e => setFormCont(f => ({ ...f, responsavel: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Copy / Legenda</label>
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Texto do post ou briefing" value={formCont.copy} onChange={e => setFormCont(f => ({ ...f, copy: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={() => setShowCont(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} onClick={() => void salvarConteudo()}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

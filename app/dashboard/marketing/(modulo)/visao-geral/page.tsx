'use client'

// Visão Geral do Marketing (Fase 7, mockup 06-marketing.html): KPIs reais
// de marketing_campanhas/leads, Assessora de Marketing (gerador IA, card
// .gen escuro), calendário resumido, campanhas ativas com ROAS, e coluna
// direita (tráfego por canal, o que está funcionando, integração com chat).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Campanha = { id: string; nome: string; tipo: string; status: string; orcamento: number | null; gasto: number | null; impressoes: number; cliques: number; conversoes: number; receita_gerada: number | null }
type Conteudo = { id: string; titulo: string; tipo: string; data_pub: string | null; status: string }
const EM_PRODUCAO = new Set(['producao', 'revisao', 'agendado'])
type Sugestao = { tipo: string; titulo: string; copy: string }

const TIPO_ICONE: Record<string, string> = { post_instagram: 'fa-image', reel: 'fa-film', story: 'fa-bolt', email: 'fa-envelope', post_linkedin: 'fa-briefcase' }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

export default function MarketingVisaoGeral() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [leadsMes, setLeadsMes] = useState(0)
  const [loading, setLoading] = useState(true)

  const [prompt, setPrompt] = useState('')
  const [gerando, setGerando] = useState(false)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [agendandoIdx, setAgendandoIdx] = useState<number | null>(null)

  const [campanhaSelecionada, setCampanhaSelecionada] = useState<Campanha | null>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    try {
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const inicioMes = new Date(); inicioMes.setDate(1)
      const iniIso = inicioMes.toISOString().slice(0, 10)
      const [campRes, contRes, leadsRes] = await Promise.all([
        supabase.from('marketing_campanhas').select('id, nome, tipo, status, orcamento, gasto, impressoes, cliques, conversoes, receita_gerada').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(50),
        supabase.from('marketing_conteudo').select('id, titulo, tipo, data_pub, status').eq('empresa_id', eid).not('data_pub', 'is', null).gte('data_pub', iniIso).order('data_pub').limit(40),
        supabase.from('marketing_leads').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('created_at', inicioMes.toISOString()),
      ])
      setCampanhas((campRes.data as Campanha[]) ?? [])
      setConteudos((contRes.data as Conteudo[]) ?? [])
      setLeadsMes(leadsRes.count ?? 0)
    } catch { /* rede */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const m = useMemo(() => {
    const ativas = campanhas.filter(c => c.status === 'ativa')
    const investimento = ativas.reduce((s, c) => s + Number(c.gasto ?? 0), 0)
    const receita = ativas.reduce((s, c) => s + Number(c.receita_gerada ?? 0), 0)
    const roas = investimento > 0 ? receita / investimento : null
    const cpl = leadsMes > 0 && investimento > 0 ? investimento / leadsMes : null
    const porCanal = ['meta_ads', 'google_ads'].map(tipo => {
      const doCanal = campanhas.filter(c => c.tipo === tipo)
      const inv = doCanal.reduce((s, c) => s + Number(c.gasto ?? 0), 0)
      const rec = doCanal.reduce((s, c) => s + Number(c.receita_gerada ?? 0), 0)
      return { tipo, label: tipo === 'meta_ads' ? 'Meta Ads' : 'Google Ads', investimento: inv, roas: inv > 0 ? rec / inv : null }
    })
    const melhor = [...ativas].filter(c => Number(c.gasto ?? 0) > 0).sort((a, b) => (Number(b.receita_gerada ?? 0) / Number(b.gasto ?? 1)) - (Number(a.receita_gerada ?? 0) / Number(a.gasto ?? 1)))[0] ?? null
    return { ativas, investimento, receita, roas, cpl, porCanal, melhor }
  }, [campanhas, leadsMes])

  async function gerar() {
    if (!prompt.trim()) { toast.error('Descreve o que você quer divulgar'); return }
    setGerando(true)
    try {
      const r = await fetch('/api/marketing/gerar-conteudo', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ prompt: prompt.trim() }) })
      const d = await r.json() as { sugestoes?: Sugestao[]; error?: string }
      if (!r.ok || !d.sugestoes) throw new Error(d.error || 'Falha ao gerar')
      setSugestoes(d.sugestoes)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setGerando(false) }
  }

  async function agendar(s: Sugestao, idx: number) {
    const data = prompt && '' // noop pra lint
    void data
    const dataPub = window.prompt('Publicar em que data? (AAAA-MM-DD, vazio = fica como ideia)', new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10))
    if (dataPub === null) return
    setAgendandoIdx(idx)
    try {
      const r = await fetch('/api/marketing/gerar-conteudo', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ agendar: { ...s, data_pub: dataPub.trim() || undefined } }) })
      const d = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || !d.ok) throw new Error(d.error || 'Falha ao agendar')
      toast.success(dataPub.trim() ? 'Agendado no calendário editorial' : 'Salvo como ideia')
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setAgendandoIdx(null) }
  }

  // calendário resumido: semana atual
  const semana = useMemo(() => {
    const hoje = new Date()
    const dom = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dom); d.setDate(dom.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      return { iso, dia: d.getDate(), posts: conteudos.filter(c => c.data_pub === iso) }
    })
  }, [conteudos])

  return (
    <div style={{ paddingBottom: 30 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        <div className="kpi-v2"><div className="l">Investimento em ads (mês)</div><div className="v">{loading ? '…' : formatBRL(m.investimento)}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>campanhas ativas</div></div>
        <div className="kpi-v2"><div className="l">ROAS médio</div><div className="v">{loading || m.roas == null ? '—' : `${m.roas.toFixed(1)}x`}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>receita / investimento</div></div>
        <div className="kpi-v2"><div className="l">Leads gerados (mês)</div><div className="v">{loading ? '…' : leadsMes}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>{m.cpl != null ? `CPL ${formatBRL(m.cpl)}` : 'sem custo atribuído'}</div></div>
        <div className="kpi-v2"><div className="l">Conteúdos no mês</div><div className="v">{loading ? '…' : conteudos.length}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>{loading ? '' : `${conteudos.filter(c => EM_PRODUCAO.has(c.status)).length} em produção`}</div></div>
      </div>

      {/* Motor de Receita — esteira Investido → Leads → Receita → ROAS */}
      <div className="card-v2" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Motor de Receita</div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {[
            { label: 'Investido', val: formatBRL(m.investimento), sub: 'em ads (mês)', href: '/dashboard/marketing/trafego' },
            { label: 'Leads', val: String(leadsMes), sub: m.cpl != null ? `CPL ${formatBRL(m.cpl)}` : 'gerados no mês', href: '/dashboard/captacao' },
            { label: 'Receita gerada', val: formatBRL(m.receita), sub: 'atribuída às campanhas', href: '/dashboard/financeiro/dre' },
            { label: 'ROAS', val: m.roas != null ? `${m.roas.toFixed(1)}x` : '—', sub: 'receita / investimento', href: '/dashboard/marketing/campanhas' },
          ].map((e, i, arr) => (
            <div key={e.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Link href={e.href} style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', transition: 'background .15s' }}
                  onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--acc-soft)' }}
                  onMouseLeave={ev => { ev.currentTarget.style.background = 'var(--bg)' }}
                >
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>{e.label}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '4px 0 2px', letterSpacing: '-.02em' }}>{loading ? '…' : e.val}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--mut2)', fontWeight: 600 }}>{e.sub}</div>
                </div>
              </Link>
              {i < arr.length - 1 && <i className="fa-solid fa-arrow-right" style={{ color: 'var(--mut2)', fontSize: 12, padding: '0 10px', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Assessora de Marketing */}
          <div className="gen">
            <span className="tag">FACTORONE AI</span>
            <h3>Assessora de Marketing — gerar conteúdo</h3>
            <input className="gen-input" placeholder="Ex: divulgar o novo plano de consultoria mensal com desconto de lançamento" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void gerar() }} />
            {sugestoes.length > 0 && (
              <div className="gen-cards">
                {sugestoes.map((s, i) => (
                  <div key={i} className="gen-c">
                    <div className="ph"><i className={`fa-solid ${TIPO_ICONE[s.tipo] ?? 'fa-image'}`} /></div>
                    <p><b style={{ color: '#fff', display: 'block', marginBottom: 2 }}>{s.titulo}</b>{s.copy.slice(0, 110)}…</p>
                    <div style={{ padding: '0 8px 8px' }}>
                      <button className="solid" style={{ fontSize: 10, padding: '4px 8px', width: '100%' }} disabled={agendandoIdx === i} onClick={() => void agendar(s, i)}>
                        {agendandoIdx === i ? '…' : 'Agendar no calendário'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="actions">
              <button className="solid" disabled={gerando} onClick={() => void gerar()}>{gerando ? 'Gerando…' : sugestoes.length ? 'Gerar mais variações' : 'Gerar conteúdo'}</button>
              {sugestoes.length > 0 && <button className="ghost" onClick={() => setSugestoes([])}>Limpar</button>}
            </div>
          </div>

          {/* Calendário resumido (semana) */}
          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Calendário editorial — esta semana</div>
              <Link href="/dashboard/marketing/calendario" style={{ fontSize: 11.5, color: 'var(--acc)', fontWeight: 700, textDecoration: 'none' }}>Mês completo →</Link>
            </div>
            <div className="cal-grid">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="cal-h">{d}</div>)}
              {semana.map(d => (
                <div key={d.iso} className={`cal-d${d.iso === new Date().toISOString().slice(0, 10) ? ' hoje' : ''}`}>
                  {d.dia}
                  {d.posts.slice(0, 2).map(p => <span key={p.id} className={`cal-post${p.tipo === 'email' ? ' ads' : ''}`}>{p.titulo}</span>)}
                </div>
              ))}
            </div>
          </div>

          {/* Campanhas ativas */}
          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Campanhas ativas</div>
              <Link href="/dashboard/marketing/campanhas" style={{ fontSize: 11.5, color: 'var(--acc)', fontWeight: 700, textDecoration: 'none' }}>Todas →</Link>
            </div>
            {m.ativas.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhuma campanha ativa — cadastre em Campanhas.</div>
            ) : m.ativas.slice(0, 5).map(c => {
              const pct = Number(c.orcamento ?? 0) > 0 ? Math.min(100, (Number(c.gasto ?? 0) / Number(c.orcamento)) * 100) : 0
              const roas = Number(c.gasto ?? 0) > 0 ? Number(c.receita_gerada ?? 0) / Number(c.gasto ?? 1) : null
              return (
                <div key={c.id} className="camp-row" onClick={() => setCampanhaSelecionada(c)} style={{ cursor: 'pointer', transition: 'background .2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ minWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)', fontWeight: 700 }}>{c.nome}</span>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--mut)' }}>{formatBRL(Number(c.gasto ?? 0))}</span>
                  <span style={{ fontWeight: 800, color: roas != null && roas >= 1 ? 'var(--acc-ink)' : 'var(--mut)', minWidth: 44, textAlign: 'right' }}>{roas != null ? `${roas.toFixed(1)}x` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Tráfego pago por canal</div>
            {m.porCanal.map(c => (
              <div key={c.tipo} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{c.label}</span>
                <span style={{ color: 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(c.investimento)} · {c.roas != null ? `${c.roas.toFixed(1)}x` : '—'}</span>
              </div>
            ))}
            <Link href="/dashboard/marketing/trafego" style={{ fontSize: 11.5, color: 'var(--acc)', fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>Detalhar →</Link>
          </div>

          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              <i className="fa-solid fa-lightbulb" style={{ color: '#B08A3E', marginRight: 6, fontSize: 12 }} />O que está funcionando
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.6 }}>
              {m.melhor
                ? <>Sua melhor campanha é <b style={{ color: 'var(--ink)' }}>{m.melhor.nome}</b>, com ROAS de <b style={{ color: 'var(--acc-ink)' }}>{(Number(m.melhor.receita_gerada ?? 0) / Number(m.melhor.gasto ?? 1)).toFixed(1)}x</b>. Considere realocar orçamento das campanhas com ROAS abaixo de 1x pra ela.</>
                : 'Cadastre campanhas com gasto e receita pra IA apontar onde investir mais.'}
            </div>
          </div>

          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              <i className="fa-solid fa-comments" style={{ color: 'var(--acc)', marginRight: 6, fontSize: 12 }} />Integrado ao chat de vendas
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.6 }}>
              Leads que chegam pelo chat do site entram em Conversas com origem rastreada — e quando demonstram intenção de compra, a Donna cria o card no <Link href="/dashboard/clientes-vendas/pipeline" style={{ color: 'var(--acc)', fontWeight: 700 }}>Pipeline</Link> automaticamente.
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: detalhe de campanha */}
      {campanhaSelecionada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setCampanhaSelecionada(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{campanhaSelecionada.nome}</h2>
              <button onClick={() => setCampanhaSelecionada(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Tipo</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{campanhaSelecionada.tipo === 'meta_ads' ? 'Meta Ads' : campanhaSelecionada.tipo === 'google_ads' ? 'Google Ads' : campanhaSelecionada.tipo}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 8px', background: campanhaSelecionada.status === 'ativa' ? 'var(--acc-soft)' : 'var(--warn-soft)', borderRadius: 4, display: 'inline-block', color: campanhaSelecionada.status === 'ativa' ? 'var(--acc-ink)' : 'var(--warn)', textTransform: 'capitalize' }}>
                  {campanhaSelecionada.status}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Orçamento</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{formatBRL(Number(campanhaSelecionada.orcamento ?? 0))}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px', background: 'var(--cream)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 2 }}>Gasto</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{formatBRL(Number(campanhaSelecionada.gasto ?? 0))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 2 }}>ROAS</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: Number(campanhaSelecionada.gasto ?? 0) > 0 && Number(campanhaSelecionada.receita_gerada ?? 0) / Number(campanhaSelecionada.gasto ?? 1) >= 1 ? 'var(--acc-ink)' : 'var(--mut)' }}>
                    {Number(campanhaSelecionada.gasto ?? 0) > 0 ? `${(Number(campanhaSelecionada.receita_gerada ?? 0) / Number(campanhaSelecionada.gasto ?? 1)).toFixed(1)}x` : '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>
                  <div style={{ color: 'var(--mut)', marginBottom: 2 }}>Impressões</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{campanhaSelecionada.impressoes?.toLocaleString('pt-BR') ?? '0'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--mut)', marginBottom: 2 }}>Cliques</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{campanhaSelecionada.cliques?.toLocaleString('pt-BR') ?? '0'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--mut)', marginBottom: 2 }}>Conversões</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{campanhaSelecionada.conversoes?.toLocaleString('pt-BR') ?? '0'}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Receita Gerada</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--acc-ink)' }}>{formatBRL(Number(campanhaSelecionada.receita_gerada ?? 0))}</div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/dashboard/marketing/campanhas" className="btn-v2 primary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>Ir para Campanhas</Link>
                <button onClick={() => setCampanhaSelecionada(null)} className="btn-v2" style={{ flex: 1 }}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

// Pipeline (Fase 6) — Kanban com temperatura, pixel-fiel ao 08-crm.html:
// 4 colunas com contador+soma, badge frio/morno/quente, aviso de card
// parado, borda verde quando a IA está negociando. Selecionar um card abre
// o painel de Alçada de negociação (mesmo motor de autonomia da Fase 4,
// aplicado a desconto) + o Registro de auditoria daquele negócio.
// Drag-and-drop nativo move de etapa — manual sempre vence o automático.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Negocio = {
  id: string; titulo: string; valor: number | null; etapa: string
  temperatura: 'frio' | 'morno' | 'quente' | null
  ia_negociando: boolean; desconto_max_pct: number | null; canal_negociacao: string | null
  contato: string | null; dias_parado: number
}
type Evento = { id: string; origem: 'ia' | 'humano'; titulo: string; detalhe: string | null; created_at: string }
type Oferta = { desconto_pct: number; status: string }

const COLUNAS: { etapa: string; label: string }[] = [
  { etapa: 'prospeccao', label: 'Prospect' },
  { etapa: 'qualificado', label: 'Qualificação' },
  { etapa: 'proposta', label: 'Proposta' },
  { etapa: 'negociacao', label: 'Negociação' },
]

const TEMP_UI: Record<string, { classe: string; label: string; icone: string }> = {
  frio: { classe: 'cold', label: 'Frio', icone: 'fa-temperature-low' },
  morno: { classe: 'warm', label: 'Morno', icone: 'fa-temperature-half' },
  quente: { classe: 'hot', label: 'Quente', icone: 'fa-fire' },
}

const DIAS_PARADO_ALERTA = 7

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

export default function PipelinePage() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<Negocio | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [salvandoAlcada, setSalvandoAlcada] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/crm/pipeline', { headers: await authHeaders() })
      const d = await r.json() as { negocios?: Negocio[] }
      if (r.ok) setNegocios(d.negocios ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  // eventos + ofertas do negócio selecionado (leitura client-side, RLS)
  useEffect(() => {
    if (!selecionado) { setEventos([]); setOfertas([]); return }
    void (async () => {
      const [ev, of] = await Promise.all([
        supabase.from('crm_negociacao_eventos').select('id, origem, titulo, detalhe, created_at').eq('oportunidade_id', selecionado.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('crm_ofertas').select('desconto_pct, status').eq('oportunidade_id', selecionado.id).order('created_at', { ascending: false }).limit(5),
      ])
      setEventos((ev.data as Evento[]) ?? [])
      setOfertas((of.data as Oferta[]) ?? [])
    })()
  }, [selecionado])

  async function patch(id: string, corpo: Record<string, unknown>, otimista?: (n: Negocio) => Negocio) {
    if (otimista) {
      setNegocios(prev => prev.map(n => n.id === id ? otimista(n) : n))
      setSelecionado(prev => prev && prev.id === id ? otimista(prev) : prev)
    }
    const r = await fetch('/api/crm/pipeline', { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ id, ...corpo }) })
    const d = await r.json() as { ok?: boolean; error?: string }
    if (!r.ok || !d.ok) { toast.error(d.error || 'Falha ao salvar'); void carregar() }
  }

  function soltar(etapa: string) {
    if (!dragId) return
    const n = negocios.find(x => x.id === dragId)
    setDragId(null); setDragOver(null)
    if (!n || n.etapa === etapa) return
    void patch(dragId, { acao: 'mover', etapa }, x => ({ ...x, etapa }))
  }

  const porColuna = useMemo(() => {
    const m = new Map<string, Negocio[]>()
    for (const c of COLUNAS) m.set(c.etapa, [])
    for (const n of negocios) m.get(n.etapa)?.push(n)
    return m
  }, [negocios])

  const ultimaOferta = ofertas[0]
  const sel = selecionado

  return (
    <div style={{ paddingBottom: 30 }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando pipeline…</div>
      ) : (
        <>
          <div className="kanban" style={{ marginBottom: 16 }}>
            {COLUNAS.map(c => {
              const itens = porColuna.get(c.etapa) ?? []
              const soma = itens.reduce((s, n) => s + Number(n.valor ?? 0), 0)
              return (
                <div
                  key={c.etapa}
                  className={`kb-col${dragOver === c.etapa ? ' drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(c.etapa) }}
                  onDragLeave={() => setDragOver(v => (v === c.etapa ? null : v))}
                  onDrop={() => soltar(c.etapa)}
                >
                  <div className="kb-h">{c.label} <span>{itens.length} · {formatBRL(soma)}</span></div>
                  {itens.map(n => {
                    const t = n.temperatura ? TEMP_UI[n.temperatura] : null
                    return (
                      <div
                        key={n.id}
                        className={`kb-card${n.ia_negociando ? ' ia' : ''}${sel?.id === n.id ? ' selected' : ''}`}
                        draggable
                        onDragStart={() => setDragId(n.id)}
                        onClick={() => setSelecionado(sel?.id === n.id ? null : n)}
                      >
                        <b>{n.titulo}</b>
                        {n.contato && <div className="co">{n.contato}</div>}
                        {t && <div className={`temp ${t.classe}`}><i className={`fa-solid ${t.icone}`} style={{ fontSize: 9 }} />{t.label}</div>}
                        <div className="val">{formatBRL(Number(n.valor ?? 0))}</div>
                        {n.ia_negociando
                          ? <span className="ia-negociando"><i className="fa-solid fa-robot" style={{ marginRight: 4, fontSize: 9 }} />IA negociando dentro da alçada</span>
                          : n.dias_parado >= DIAS_PARADO_ALERTA && <span className="stale"><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4, fontSize: 9 }} />{n.dias_parado} dias parado, sem contato</span>}
                      </div>
                    )
                  })}
                  {itens.length === 0 && <div style={{ fontSize: 11, color: 'var(--mut2)', textAlign: 'center', padding: '14px 0' }}>Arraste um card pra cá</div>}
                </div>
              )
            })}
          </div>

          {/* Alçada + auditoria do card selecionado */}
          {sel ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              <div className="alc">
                <span className="tag">FACTORONE AI</span>
                <h3>Alçada de negociação — {sel.titulo}{sel.contato ? ` / ${sel.contato}` : ''}</h3>
                <div className="alc-row">
                  <div><b>Desconto autorizado</b><small>A IA pode oferecer até este limite sem te chamar</small></div>
                  <div className="range">
                    <div className="track"><i style={{ width: `${Math.min(100, Number(sel.desconto_max_pct ?? 0) * 4)}%` }} /></div>
                    <input
                      type="number" min={0} max={100}
                      defaultValue={sel.desconto_max_pct ?? 0}
                      key={sel.id}
                      disabled={salvandoAlcada}
                      onBlur={e => {
                        const pct = Number(e.target.value)
                        if (pct === Number(sel.desconto_max_pct ?? 0)) return
                        setSalvandoAlcada(true)
                        void patch(sel.id, { acao: 'alcada', desconto_max_pct: pct }, n => ({ ...n, desconto_max_pct: pct })).finally(() => setSalvandoAlcada(false))
                      }}
                      style={{ width: 52, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 6px', textAlign: 'right' }}
                    />
                    <b>%</b>
                  </div>
                </div>
                <div className="alc-row">
                  <div><b>Canal permitido</b><small>Onde a IA pode negociar sozinha</small></div>
                  <select
                    value={sel.canal_negociacao ?? ''}
                    onChange={e => void patch(sel.id, { acao: 'alcada', canal_negociacao: e.target.value }, n => ({ ...n, canal_negociacao: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 8px' }}
                  >
                    <option value="" style={{ color: '#111' }}>Nenhum</option>
                    {['WhatsApp', 'Site', 'E-mail', 'Telegram'].map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
                  </select>
                </div>
                <div className="alc-row">
                  <div><b>Cliente classificado</b><small>Temperatura definida por você / IA</small></div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['frio', 'morno', 'quente'] as const).map(t => (
                      <span
                        key={t}
                        className={`temp ${TEMP_UI[t].classe}`}
                        style={{ margin: 0, cursor: 'pointer', opacity: sel.temperatura === t ? 1 : 0.4 }}
                        onClick={() => void patch(sel.id, { acao: 'temperatura', temperatura: t }, n => ({ ...n, temperatura: t }))}
                      >
                        <i className={`fa-solid ${TEMP_UI[t].icone}`} style={{ fontSize: 9 }} />{TEMP_UI[t].label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="alc-row">
                  <div><b>Negociação automática</b><small>IA fecha sozinha dentro da alçada</small></div>
                  <i
                    className={`fa-solid ${sel.ia_negociando ? 'fa-toggle-on' : 'fa-toggle-off'}`}
                    onClick={() => void patch(sel.id, { acao: 'alcada', ia_negociando: !sel.ia_negociando }, n => ({ ...n, ia_negociando: !sel.ia_negociando }))}
                    style={{ cursor: 'pointer', fontSize: 22, color: sel.ia_negociando ? '#22C55E' : 'rgba(255,255,255,.3)' }}
                  />
                </div>
                <p className="foot">
                  {ultimaOferta
                    ? <>A IA já ofereceu <b>{Number(ultimaOferta.desconto_pct)}%</b> e o cliente ainda não fechou. {sel.ia_negociando
                        ? <>Como está com ON, ela pode chegar até os <b>{Number(sel.desconto_max_pct ?? 0)}%</b> autorizados sem te avisar de novo — só cai em &quot;Precisamos de você&quot; se pedir mais que isso.</>
                        : <>Com o automático OFF, qualquer proposta nova passa por você antes.</>}</>
                    : <>Nenhuma oferta feita ainda neste negócio. {sel.ia_negociando
                        ? <>Com o automático ON, a IA pode oferecer até <b>{Number(sel.desconto_max_pct ?? 0)}%</b> no canal permitido sem te chamar.</>
                        : <>Ligue a negociação automática pra IA trabalhar dentro da alçada.</>}</>}
                </p>
              </div>

              <div className="card-v2" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Registro da negociação{sel.contato ? ` — ${sel.contato}` : ''}</div>
                  <button className="btn-v2" style={{ fontSize: 11.5 }} onClick={() => void patch(sel.id, { acao: 'contato' }, n => ({ ...n, dias_parado: 0 }))}>Registrar contato</button>
                </div>
                {eventos.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--mut)', padding: '10px 0' }}>Nenhum evento registrado ainda — mova o card, classifique a temperatura ou ajuste a alçada e tudo fica auditado aqui.</div>
                ) : eventos.map(ev => (
                  <div key={ev.id} className="audit">
                    <div className={`dot${ev.titulo.toLowerCase().includes('acima da alçada') ? ' warn' : ''}`} />
                    <div>
                      <b>{ev.titulo}</b>
                      <small>{ev.detalhe ? `${ev.detalhe} · ` : ''}{ev.origem === 'ia' ? 'IA' : 'Você'} · {new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--mut)', textAlign: 'center', padding: '8px 0' }}>
              Clique num card pra ver a alçada de negociação e o registro de auditoria.
            </div>
          )}
        </>
      )}
    </div>
  )
}

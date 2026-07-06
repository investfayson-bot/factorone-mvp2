'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Canal = 'whatsapp' | 'email'
type Toque = { id: string; cliente: string; contato: string; canal: Canal; tipo: string; mensagem: string; status: 'pendente' | 'enviado' | 'pulado'; valor: number; agendado_para: string }

const TIPO: Record<string, { label: string; cor: string; ic: string }> = {
  satisfacao: { label: 'Satisfação', cor: 'var(--sage)', ic: 'fa-face-smile' },
  garantia: { label: 'Garantia', cor: 'var(--gold)', ic: 'fa-shield-halved' },
  recompra: { label: 'Recompra', cor: 'var(--sage-deep)', ic: 'fa-rotate' },
  retorno: { label: 'Retorno', cor: 'var(--gold)', ic: 'fa-calendar-check' },
  reativacao: { label: 'Reativação', cor: '#B0413E', ic: 'fa-heart' },
}

type Passo = { dia: number; tipo: string; canal: Canal; msg: string }
type Regua = { key: string; nome: string; desc: string; ic: string; passos: Passo[] }
const REGUAS: Regua[] = [
  { key: 'produto', nome: 'Produto físico', desc: 'Satisfação → garantia → recompra', ic: 'fa-bag-shopping', passos: [
    { dia: 2, tipo: 'satisfacao', canal: 'whatsapp', msg: 'Oi {nome}! Chegou tudo certinho com seu pedido? Qualquer coisa, é só me chamar 💛' },
    { dia: 20, tipo: 'garantia', canal: 'whatsapp', msg: 'Oi {nome}! Tudo certo com sua peça? Se aparecer qualquer detalhe, a gente resolve — sua garantia cobre. 😉' },
    { dia: 45, tipo: 'recompra', canal: 'whatsapp', msg: 'Oi {nome}! Chegaram novidades com a sua cara ✨ Quer dar uma espiada antes de todo mundo?' },
  ] },
  { key: 'servico', nome: 'Serviço', desc: 'Pós-atendimento → retorno → reativação', ic: 'fa-user-doctor', passos: [
    { dia: 1, tipo: 'satisfacao', canal: 'whatsapp', msg: 'Oi {nome}! Como foi seu atendimento? Sua opinião ajuda muito a gente a melhorar 🙏' },
    { dia: 30, tipo: 'retorno', canal: 'whatsapp', msg: 'Oi {nome}! Já faz um tempinho — que tal agendar seu retorno? Tenho horários essa semana.' },
    { dia: 90, tipo: 'reativacao', canal: 'whatsapp', msg: 'Oi {nome}! Senti sua falta por aqui. Preparei uma condição especial pra você voltar 💛' },
  ] },
  { key: 'simples', nome: 'Simples', desc: 'Só satisfação + recompra', ic: 'fa-bolt', passos: [
    { dia: 2, tipo: 'satisfacao', canal: 'whatsapp', msg: 'Oi {nome}! Deu tudo certo com a gente? Fico feliz em saber 💛' },
    { dia: 30, tipo: 'recompra', canal: 'whatsapp', msg: 'Oi {nome}! Bora de novo? Tenho novidade que você vai gostar ✨' },
  ] },
]

const hojeStr = () => new Date().toISOString().slice(0, 10)
function addDias(base: string, n: number) { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function dataBR(s: string) { try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) } catch { return s } }

export default function PosVendaPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [usaDB, setUsaDB] = useState(false)
  const [toques, setToques] = useState<Toque[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [novo, setNovo] = useState({ cliente: '', contato: '', canal: 'whatsapp' as Canal, valor: '', regua: 'produto', base: hojeStr() })

  useEffect(() => { void load() }, [])
  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = ur?.empresa_id ?? user.id; setEmpresaId(eid)
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/posvenda', { headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {} })
      const j = await r.json()
      if (j.ok) { setUsaDB(true); setToques((j.toques ?? []) as Toque[]) }
      else { const raw = localStorage.getItem(`fo_posvenda_${eid}`); setToques(raw ? JSON.parse(raw) : []) }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function persistir(next: Toque[]) {
    setToques(next)
    if (usaDB) {
      const { data: sess } = await supabase.auth.getSession()
      try { await fetch('/api/posvenda', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ toques: next }) }) }
      catch { toast.error('Falha ao salvar') }
    } else { localStorage.setItem(`fo_posvenda_${empresaId}`, JSON.stringify(next)) }
  }

  function criarRegua() {
    if (!novo.cliente.trim()) { toast.error('Informe o nome do cliente'); return }
    const r = REGUAS.find(x => x.key === novo.regua)!
    const gerados: Toque[] = r.passos.map(p => ({
      id: crypto.randomUUID(), cliente: novo.cliente.trim(), contato: novo.contato.trim(), canal: novo.canal,
      tipo: p.tipo, mensagem: p.msg.replace(/\{nome\}/g, novo.cliente.trim().split(' ')[0]),
      status: 'pendente', valor: Number(novo.valor.replace(',', '.')) || 0, agendado_para: addDias(novo.base, p.dia),
    }))
    void persistir([...toques, ...gerados])
    setModal(false); setNovo({ cliente: '', contato: '', canal: 'whatsapp', valor: '', regua: 'produto', base: hojeStr() })
    toast.success(`Régua criada — ${gerados.length} toques agendados`)
  }

  function mudar(id: string, patch: Partial<Toque>) { void persistir(toques.map(t => t.id === id ? { ...t, ...patch } : t)) }
  function excluir(id: string) { void persistir(toques.filter(t => t.id !== id)) }
  function enviar(t: Toque) {
    const enc = encodeURIComponent(t.mensagem)
    if (t.canal === 'email') window.open(`mailto:${t.contato}?subject=${encodeURIComponent('Um oi da nossa parte')}&body=${enc}`)
    else { const dig = t.contato.replace(/\D/g, ''); window.open(dig ? `https://wa.me/${dig}?text=${enc}` : `https://wa.me/?text=${enc}`, '_blank') }
    mudar(t.id, { status: 'enviado' })
  }

  const hoje = hojeStr()
  const pend = toques.filter(t => t.status === 'pendente')
  const atrasados = pend.filter(t => t.agendado_para < hoje).sort((a, b) => a.agendado_para.localeCompare(b.agendado_para))
  const doDia = pend.filter(t => t.agendado_para === hoje)
  const proximos = pend.filter(t => t.agendado_para > hoje).sort((a, b) => a.agendado_para.localeCompare(b.agendado_para))
  const feitos = toques.filter(t => t.status !== 'pendente')

  function Card({ t }: { t: Toque }) {
    const ti = TIPO[t.tipo] ?? { label: t.tipo, cor: 'var(--ink-mut)', ic: 'fa-bell' }
    const done = t.status !== 'pendente'
    return (
      <div className="txs-card" style={{ padding: '13px 15px', opacity: done ? .7 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sage-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={`fa-solid ${ti.ic}`} style={{ color: ti.cor, fontSize: 13 }} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.cliente}{t.valor > 0 && <span style={{ fontWeight: 500, color: 'var(--ink-mut)', fontSize: 11.5 }}> · {formatBRL(t.valor)}</span>}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mut)' }}>{t.contato || 'sem contato'} · <i className={`fa-${t.canal === 'email' ? 'solid fa-envelope' : 'brands fa-whatsapp'}`} /> {t.canal === 'email' ? 'e-mail' : 'WhatsApp'}</div>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: ti.cor, background: 'color-mix(in srgb, currentColor 12%, #fff)', padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>{ti.label} · {dataBR(t.agendado_para)}</span>
        </div>
        <textarea defaultValue={t.mensagem} onBlur={e => { if (e.target.value !== t.mensagem) mudar(t.id, { mensagem: e.target.value }) }} disabled={done}
          style={{ width: '100%', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', resize: 'vertical', minHeight: 46, background: done ? 'var(--surface-2)' : '#fff', fontFamily: 'inherit' }} />
        {!done && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn-action" style={{ fontSize: 11.5, padding: '6px 12px' }} onClick={() => enviar(t)}>
              <i className={`fa-${t.canal === 'email' ? 'solid fa-envelope' : 'brands fa-whatsapp'}`} style={{ marginRight: 5 }} />Enviar
            </button>
            <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={() => mudar(t.id, { status: 'enviado' })}>Marcar feito</button>
            <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={() => mudar(t.id, { status: 'pulado' })}>Pular</button>
            <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 9px', marginLeft: 'auto', color: '#B0413E' }} onClick={() => excluir(t.id)} title="Excluir"><i className="fa-solid fa-trash" /></button>
          </div>
        )}
        {done && <div style={{ fontSize: 11, color: 'var(--ink-mut)', marginTop: 6 }}><i className={`fa-solid ${t.status === 'enviado' ? 'fa-circle-check' : 'fa-circle-minus'}`} style={{ marginRight: 5, color: t.status === 'enviado' ? 'var(--sage)' : 'var(--ink-faint)' }} />{t.status === 'enviado' ? 'Enviado' : 'Pulado'} · <button onClick={() => mudar(t.id, { status: 'pendente' })} style={{ background: 'none', border: 'none', color: 'var(--sage-deep)', cursor: 'pointer', fontSize: 11, padding: 0 }}>reabrir</button></div>}
      </div>
    )
  }

  function Secao({ titulo, cor, itens }: { titulo: string; cor: string; itens: Toque[] }) {
    if (itens.length === 0) return null
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo} · {itens.length}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>{itens.map(t => <Card key={t.id} t={t} />)}</div>
      </div>
    )
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Pós-venda & Follow-up</div>
          <div className="page-sub">O sistema lembra de cada cliente por você — mensagem pronta, é só enviar.</div>
        </div>
        <button className="btn-action" onClick={() => setModal(true)}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova régua</button>
      </div>

      <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Atrasados', v: atrasados.length, c: '#B0413E' },
          { l: 'Para hoje', v: doDia.length, c: 'var(--gold)' },
          { l: 'Próximos', v: proximos.length, c: 'var(--sage-deep)' },
          { l: 'Concluídos', v: feitos.filter(f => f.status === 'enviado').length, c: 'var(--sage)' },
        ].map(k => (
          <div key={k.l} className="kpi txs-card" style={{ padding: '13px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>
        : toques.length === 0 ? (
          <div className="txs-card" style={{ padding: '44px 30px', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--sage-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-heart-pulse" style={{ fontSize: 22, color: 'var(--sage-deep)' }} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Nunca mais esqueça um cliente</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.6 }}>Crie uma régua de pós-venda: o sistema agenda os toques (satisfação, garantia, recompra) e deixa a mensagem pronta pra você enviar no WhatsApp.</div>
            <button className="btn-action" onClick={() => setModal(true)}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Criar primeira régua</button>
          </div>
        ) : (
          <>
            <Secao titulo="Atrasados" cor="#B0413E" itens={atrasados} />
            <Secao titulo="Para hoje" cor="var(--gold)" itens={doDia} />
            <Secao titulo="Próximos" cor="var(--sage-deep)" itens={proximos} />
            {feitos.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Concluídos · {feitos.length}</summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10, marginTop: 10 }}>{feitos.map(t => <Card key={t.id} t={t} />)}</div>
              </details>
            )}
          </>
        )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(19,32,29,.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} className="txs-card" style={{ width: '100%', maxWidth: 460, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Nova régua de pós-venda</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 18 }}>Depois de uma venda ou atendimento, agende os toques do cliente.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Cliente *</label>
                <input className="form-input" placeholder="Ex: Ana Souza" value={novo.cliente} onChange={e => setNovo(p => ({ ...p, cliente: e.target.value }))} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Contato</label>
                  <input className="form-input" placeholder={novo.canal === 'email' ? 'email@cliente.com' : 'WhatsApp c/ DDI (5531…)'} value={novo.contato} onChange={e => setNovo(p => ({ ...p, contato: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Canal</label>
                  <select className="form-input" value={novo.canal} onChange={e => setNovo(p => ({ ...p, canal: e.target.value as Canal }))}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Valor da venda</label>
                  <input className="form-input" placeholder="0,00" value={novo.valor} onChange={e => setNovo(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Data da venda</label>
                  <input className="form-input" type="date" value={novo.base} onChange={e => setNovo(p => ({ ...p, base: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Régua</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {REGUAS.map(r => (
                    <button key={r.key} onClick={() => setNovo(p => ({ ...p, regua: r.key }))} style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${novo.regua === r.key ? 'var(--sage)' : 'var(--line)'}`, background: novo.regua === r.key ? 'var(--sage-tint)' : '#fff' }}>
                      <i className={`fa-solid ${r.ic}`} style={{ color: 'var(--sage-deep)', fontSize: 14, width: 16 }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{r.nome} <span style={{ fontWeight: 500, color: 'var(--ink-mut)' }}>· {r.passos.length} toques</span></div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-action" style={{ flex: 2 }} onClick={criarRegua}>Agendar toques</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

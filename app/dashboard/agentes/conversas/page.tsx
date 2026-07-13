'use client'

// Inbox unificado de atendimento (Fase 4). Site (widget) e Telegram (bot de
// cliente via deep link) escrevem em atendimento_conversas/mensagens; e-mail
// usa a pipeline própria já existente (donna_emails_processados) e entra
// aqui normalizado pro mesmo formato de bolhas de mensagem. WhatsApp/
// Instagram seguem como filtros prontos pra quando forem plugados — exigem
// conta Meta Business, projeto à parte.
// Bloco "Precisamos de você" é alimentado por /api/donna/atendimento/pendentes.

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type CanalReal = 'site' | 'telegram' | 'email'
type Conversa = { id: string; visitante_nome: string | null; visitante_email: string | null; status: string; motivo: string | null; canal: 'site' | 'telegram'; created_at: string; updated_at: string }
type EmailItem = { id: string; remetente: string; assunto: string; snippet: string; corpo_resposta: string | null; status: string; created_at: string }
type Mensagem = { id: string; autor: 'visitante' | 'donna' | 'humano'; texto: string; pendente_aprovacao: boolean; created_at: string }
type Pendente = { id: string; canal: CanalReal; contato: string; trecho: string; motivo: string; created_at: string; link: string }
type Regra = { id: string; nome: string | null; canal: 'email' | 'site' | 'telegram'; criterio: string; autonomia: 'rascunho' | 'automatico'; ativa: boolean }
type Selecionado = { tipo: 'conversa'; conversa: Conversa } | { tipo: 'email'; email: EmailItem } | { tipo: 'exemplo'; canal: ExemploCanal; nome: string; thread: { autor: 'visitante' | 'donna'; texto: string; modo?: string }[] }

const CANAL_META: Record<CanalReal | 'whatsapp' | 'instagram', { label: string; icone: string; cor: string }> = {
  site: { label: 'Site', icone: 'fa-solid fa-globe', cor: 'var(--sage-deep)' },
  telegram: { label: 'Telegram', icone: 'fa-brands fa-telegram', cor: '#229ED9' },
  email: { label: 'E-mail', icone: 'fa-solid fa-envelope', cor: '#5CA9DB' },
  whatsapp: { label: 'WhatsApp', icone: 'fa-brands fa-whatsapp', cor: '#25D366' },
  instagram: { label: 'Instagram', icone: 'fa-brands fa-instagram', cor: '#D96FA8' },
}

const CANAIS_FILTRO = ['todos', 'site', 'telegram', 'email', 'whatsapp', 'instagram'] as const

// WhatsApp e Instagram exigem conta Meta Business aprovada (em andamento) —
// até lá, mostramos uma prévia claramente marcada como exemplo, pra dar uma
// ideia de como vai funcionar sem fingir que já tem cliente de verdade ali.
type ExemploCanal = 'whatsapp' | 'instagram'
const EXEMPLOS: Record<ExemploCanal, { nome: string; ultima: string; thread: { autor: 'visitante' | 'donna'; texto: string; modo?: string }[] }[]> = {
  whatsapp: [
    { nome: 'Juliana Oliveira', ultima: 'Vocês conseguem um desconto maior? Meu orçamento é apertado', thread: [
      { autor: 'visitante', texto: 'Oi! Vi que vocês têm um plano de consultoria, quanto fica pra mim?' },
      { autor: 'donna', texto: 'Oi Juliana! Nosso plano essencial fica R$ 890/mês, com diagnóstico gratuito inicial. Quer que eu agende uma call?', modo: 'IA · automático' },
      { autor: 'visitante', texto: 'Consigo um desconto maior? Meu orçamento tá apertado esse mês' },
    ] },
    { nome: 'Roberto Almeida', ultima: 'Isso aqui é urgente, precisamos conversar hoje', thread: [
      { autor: 'visitante', texto: 'Isso aqui é urgente, precisamos conversar hoje' },
    ] },
  ],
  instagram: [
    { nome: 'Ana Beatriz', ultima: 'Pedido de reembolso de R$ 2.450', thread: [
      { autor: 'visitante', texto: 'Oi, preciso pedir reembolso de uma compra — R$ 2.450' },
    ] },
  ],
}

function iniciais(nome: string | null): string {
  const s = (nome || 'Visitante').trim()
  const partes = s.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function mensagensDoEmail(e: EmailItem): Mensagem[] {
  const lista: Mensagem[] = [{ id: `${e.id}-in`, autor: 'visitante', texto: `${e.assunto || '(sem assunto)'}${e.snippet ? `\n\n${e.snippet}` : ''}`, pendente_aprovacao: false, created_at: e.created_at }]
  if (e.corpo_resposta) lista.push({ id: e.id, autor: 'donna', texto: e.corpo_resposta, pendente_aprovacao: e.status === 'pendente_aprovacao', created_at: e.created_at })
  return lista
}

function ConversasContent() {
  const params = useSearchParams()
  const conversaParam = params.get('conversa')

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [selecionado, setSelecionado] = useState<Selecionado | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [respostaManual, setRespostaManual] = useState('')
  const [canalFiltro, setCanalFiltro] = useState<typeof CANAIS_FILTRO[number]>('todos')
  const [busca, setBusca] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [regras, setRegras] = useState<Regra[]>([])

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      const a = tk ? { Authorization: `Bearer ${tk}` } : {}
      try {
        const [cRes, eRes, pRes, rRes] = await Promise.all([
          fetch('/api/donna/atendimento/conversas', { headers: a }),
          fetch('/api/donna/emails', { headers: a }),
          fetch('/api/donna/atendimento/pendentes', { headers: a }),
          fetch('/api/donna/regras', { headers: a }),
        ])
        const cj = await cRes.json(); if (cRes.ok) setConversas(cj.conversas ?? [])
        const ej = await eRes.json(); if (eRes.ok) setEmails(ej.emails ?? [])
        const pj = await pRes.json(); if (pRes.ok) setPendentes(pj.pendentes ?? [])
        const rj = await rRes.json(); if (rRes.ok) setRegras(rj.regras ?? [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!conversaParam || conversas.length === 0 || selecionado) return
    const c = conversas.find(x => x.id === conversaParam)
    if (c) void abrirConversa(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaParam, conversas])

  async function abrirConversa(c: Conversa) {
    setSelecionado({ tipo: 'conversa', conversa: c })
    setMensagens([])
    try {
      const r = await fetch(`/api/donna/atendimento/conversas/${c.id}/mensagens`, { headers: auth })
      const j = await r.json()
      if (r.ok) setMensagens(j.mensagens ?? [])
    } catch { /* ignore */ }
  }

  function abrirEmail(e: EmailItem) {
    setSelecionado({ tipo: 'email', email: e })
    setMensagens(mensagensDoEmail(e))
  }

  async function aprovarMensagem(id: string) {
    if (!selecionado) return
    if (selecionado.tipo === 'email') {
      try {
        const r = await fetch(`/api/donna/emails/${id}/aprovar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({}) })
        if (!r.ok) throw new Error()
        setMensagens(prev => prev.map(m => m.id === id ? { ...m, pendente_aprovacao: false } : m))
        setEmails(prev => prev.filter(e => e.id !== id))
        toast.success('Resposta enviada')
      } catch { toast.error('Falha ao aprovar') }
      return
    }
    try {
      await fetch(`/api/donna/atendimento/mensagens/${id}/aprovar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({}) })
      setMensagens(prev => prev.map(m => m.id === id ? { ...m, pendente_aprovacao: false } : m))
    } catch { toast.error('Falha ao aprovar') }
  }

  async function descartarMensagem(id: string) {
    if (!selecionado) return
    if (selecionado.tipo === 'email') {
      try {
        await fetch(`/api/donna/emails/${id}/descartar`, { method: 'POST', headers: auth })
        setMensagens(prev => prev.filter(m => m.id !== id))
        setEmails(prev => prev.filter(e => e.id !== id))
      } catch { toast.error('Falha ao descartar') }
      return
    }
    try {
      await fetch(`/api/donna/atendimento/mensagens/${id}/descartar`, { method: 'POST', headers: auth })
      setMensagens(prev => prev.filter(m => m.id !== id))
    } catch { toast.error('Falha ao descartar') }
  }

  async function responderManual() {
    if (!selecionado || selecionado.tipo !== 'conversa' || !respostaManual.trim()) return
    const conversaAtiva = selecionado.conversa
    const texto = respostaManual
    setRespostaManual('')
    try {
      const r = await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ texto }) })
      if (!r.ok) throw new Error()
      setMensagens(prev => [...prev, { id: `tmp-${Date.now()}`, autor: 'humano', texto, pendente_aprovacao: false, created_at: new Date().toISOString() }])
    } catch { toast.error('Falha ao responder') }
  }

  async function encerrarConversa() {
    if (!selecionado || selecionado.tipo !== 'conversa') return
    const conversaAtiva = selecionado.conversa
    try {
      await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ status: 'encerrada' }) })
      setConversas(prev => prev.map(c => c.id === conversaAtiva.id ? { ...c, status: 'encerrada' } : c))
      setSelecionado({ tipo: 'conversa', conversa: { ...conversaAtiva, status: 'encerrada' } })
      toast.success('Conversa encerrada')
    } catch { toast.error('Falha ao encerrar') }
  }

  async function alternarAutonomia(r: Regra) {
    const nova = r.autonomia === 'automatico' ? 'rascunho' : 'automatico'
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, autonomia: nova } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ autonomia: nova }) }) } catch { /* ignore */ }
  }

  async function alternarRegraAtiva(r: Regra) {
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, ativa: !x.ativa } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ ativa: !r.ativa }) }) } catch { /* ignore */ }
  }

  async function verEResponder(p: Pendente) {
    if (p.canal === 'email') {
      const e = emails.find(x => x.id === p.id)
      if (e) { abrirEmail(e); return }
    } else {
      const c = conversas.find(x => x.id === p.id)
      if (c) { await abrirConversa(c); return }
    }
    window.location.href = p.link
  }

  const itens = useMemo(() => {
    type Item = { tipo: 'conversa'; canal: 'site' | 'telegram'; id: string; nome: string; status: string; ts: string; sel: boolean }
      | { tipo: 'email'; canal: 'email'; id: string; nome: string; status: string; ts: string; sel: boolean }
    const deConversas: Item[] = conversas.map(c => ({ tipo: 'conversa', canal: c.canal, id: c.id, nome: c.visitante_nome || 'Visitante', status: c.status, ts: c.updated_at, sel: selecionado?.tipo === 'conversa' && selecionado.conversa.id === c.id }))
    const deEmails: Item[] = emails.map(e => ({ tipo: 'email', canal: 'email', id: e.id, nome: e.remetente, status: e.status === 'pendente_aprovacao' ? 'aguardando_humano' : e.status, ts: e.created_at, sel: selecionado?.tipo === 'email' && selecionado.email.id === e.id }))
    let lista = [...deConversas, ...deEmails].sort((a, b) => (a.status === 'aguardando_humano' ? -1 : 1) - (b.status === 'aguardando_humano' ? -1 : 1) || b.ts.localeCompare(a.ts))
    if (canalFiltro !== 'todos') lista = lista.filter(x => x.canal === canalFiltro)
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter(x => x.nome.toLowerCase().includes(q))
    }
    return lista
  }, [conversas, emails, selecionado, canalFiltro, busca])

  function abrirItem(id: string, tipo: 'conversa' | 'email') {
    if (tipo === 'email') {
      const e = emails.find(x => x.id === id)
      if (e) abrirEmail(e)
    } else {
      const c = conversas.find(x => x.id === id)
      if (c) void abrirConversa(c)
    }
  }

  function abrirExemplo(canal: ExemploCanal, nome: string) {
    const ex = EXEMPLOS[canal].find(e => e.nome === nome)
    if (ex) setSelecionado({ tipo: 'exemplo', canal, nome: ex.nome, thread: ex.thread })
  }

  const exemplosDoCanal = canalFiltro === 'whatsapp' || canalFiltro === 'instagram' ? EXEMPLOS[canalFiltro] : []

  const canalAtivo: CanalReal | ExemploCanal | null = selecionado
    ? selecionado.tipo === 'email' ? 'email' : selecionado.tipo === 'exemplo' ? selecionado.canal : selecionado.conversa.canal
    : null
  const regrasCanal = useMemo(() => (canalAtivo && canalAtivo !== 'whatsapp' && canalAtivo !== 'instagram' ? regras.filter(r => r.canal === canalAtivo) : []), [regras, canalAtivo])

  const mensagensExibidas: Mensagem[] = selecionado?.tipo === 'exemplo'
    ? selecionado.thread.map((m, i) => ({ id: `ex-${i}`, autor: m.autor, texto: m.texto, pendente_aprovacao: false, created_at: '' }))
    : mensagens

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 128px)' }}>
      {pendentes.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--warn-soft), var(--card))',
          border: '1.5px solid rgba(217,119,6,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: 'var(--warn)' }}>
              <i className="fa-solid fa-bell" />Precisamos de você — a IA não decide sozinha aqui
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn)' }}>{pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}</span>
          </div>
          {pendentes.map((p, i) => (
            <div key={`${p.canal}-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(217,119,6,.22)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: CANAL_META[p.canal].cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                {p.contato.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 12.5, display: 'block', color: 'var(--ink)' }}>{p.contato}</b>
                {p.trecho && <small style={{ fontSize: 11.5, color: 'var(--ink-mut)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&quot;{p.trecho}&quot;</small>}
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 20, marginTop: 3, display: 'inline-block' }}>{p.motivo}</span>
              </div>
              <button className="btn-action" style={{ fontSize: 11.5, padding: '5px 11px', flexShrink: 0 }} onClick={() => void verEResponder(p)}>Ver e responder</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '22fr 56fr 22fr', gap: 0, flex: 1, minHeight: 0, margin: '-4px -2px', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
        {/* Coluna 1 — lista de conversas (~22%) */}
        <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Caixa de entrada <span style={{ color: 'var(--ink-mut)', fontWeight: 600 }}>{conversas.length + emails.length}</span></div>
            <input
              className="form-input"
              placeholder="Buscar conversas…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ fontSize: 13.5, height: 34 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
              {CANAIS_FILTRO.map(id => (
                <button
                  key={id}
                  onClick={() => setCanalFiltro(id)}
                  style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--line)', cursor: 'pointer',
                    background: canalFiltro === id ? 'var(--sage-deep)' : 'var(--surface-2)',
                    color: canalFiltro === id ? '#fff' : 'var(--ink-mut)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {id !== 'todos' && <i className={CANAL_META[id].icone} style={{ fontSize: 11 }} />}
                  {id === 'todos' ? 'Todos' : CANAL_META[id].label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(canalFiltro === 'whatsapp' || canalFiltro === 'instagram') && (
              <div style={{ padding: '10px 16px', background: 'var(--warn-soft)', borderBottom: '1px solid rgba(217,119,6,.2)', fontSize: 11.5, color: 'var(--warn)', fontWeight: 700 }}>
                <i className="fa-solid fa-clock" style={{ marginRight: 6 }} />Em breve — aguardando aprovação da Meta Business. Veja um exemplo de como vai funcionar:
              </div>
            )}
            {exemplosDoCanal.map(ex => (
              <div
                key={ex.nome}
                onClick={() => abrirExemplo(canalFiltro as ExemploCanal, ex.nome)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)',
                  background: selecionado?.tipo === 'exemplo' && selecionado.nome === ex.nome ? 'var(--sage-tint)' : 'transparent', opacity: 0.85,
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--sage-tint)', color: 'var(--sage-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    {iniciais(ex.nome)}
                  </div>
                  <div style={{ position: 'absolute', right: -2, bottom: -2, width: 15, height: 15, borderRadius: 5, background: CANAL_META[canalFiltro as ExemploCanal].cor, border: '1.5px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={CANAL_META[canalFiltro as ExemploCanal].icone} style={{ fontSize: 7, color: '#fff' }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{ex.nome}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '1px 7px', borderRadius: 100 }}>Exemplo</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-mut)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.ultima}</span>
                </div>
              </div>
            ))}
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 14 }}>Carregando…</div>
            ) : itens.length === 0 && exemplosDoCanal.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 14 }}>
                Nenhuma conversa ainda.
              </div>
            ) : itens.map(it => (
              <div
                key={`${it.tipo}-${it.id}`}
                onClick={() => abrirItem(it.id, it.tipo)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)',
                  background: it.sel ? 'var(--sage-tint)' : 'transparent',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--sage-tint)', color: 'var(--sage-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    {iniciais(it.nome)}
                  </div>
                  <div style={{ position: 'absolute', right: -2, bottom: -2, width: 15, height: 15, borderRadius: 5, background: CANAL_META[it.canal].cor, border: '1.5px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={CANAL_META[it.canal].icone} style={{ fontSize: 7, color: '#fff' }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>{new Date(it.ts).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 100, display: 'inline-block', marginTop: 4,
                    background: it.status === 'aguardando_humano' ? 'var(--warn-soft)' : it.status === 'encerrada' ? 'var(--line-soft)' : 'var(--sage-tint)',
                    color: it.status === 'aguardando_humano' ? 'var(--warn)' : it.status === 'encerrada' ? 'var(--ink-mut)' : 'var(--sage-deep)',
                  }}>
                    {it.status === 'aguardando_humano' ? 'aguardando você' : it.status === 'encerrada' ? 'encerrada' : CANAL_META[it.canal].label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2 — thread (~56%, aumentada) */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--line)' }}>
          {!selecionado ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mut)', fontSize: 14.5 }}>Selecione uma conversa.</div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                      {selecionado.tipo === 'email' ? selecionado.email.remetente : selecionado.tipo === 'exemplo' ? selecionado.nome : (selecionado.conversa.visitante_nome || 'Visitante')}
                    </span>
                    {selecionado.tipo === 'conversa' && selecionado.conversa.status === 'aguardando_humano' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 20 }}>Aguardando você</span>
                    )}
                    {selecionado.tipo === 'exemplo' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 20 }}>Exemplo — canal ainda não conectado</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}>
                    <i className={CANAL_META[canalAtivo!].icone} style={{ marginRight: 5 }} />{CANAL_META[canalAtivo!].label}
                  </div>
                </div>
                {selecionado.tipo === 'conversa' && (
                  <button className="btn-action btn-ghost" style={{ fontSize: 12.5 }} onClick={() => void encerrarConversa()}>Encerrar conversa</button>
                )}
              </div>
              {selecionado.tipo === 'conversa' && selecionado.conversa.status === 'aguardando_humano' && selecionado.conversa.motivo && (
                <div style={{ padding: '8px 18px', fontSize: 12.5, color: 'var(--warn)', background: 'var(--warn-soft)', borderBottom: '1px solid rgba(217,119,6,.2)' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />{selecionado.conversa.motivo}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mensagensExibidas.map(m => (
                  <div key={m.id} style={{
                    alignSelf: m.autor === 'visitante' ? 'flex-start' : 'flex-end',
                    background: m.pendente_aprovacao ? 'var(--warn-soft)' : m.autor === 'visitante' ? 'var(--surface-2)' : 'var(--sage-tint)',
                    border: m.pendente_aprovacao ? '1px dashed var(--warn)' : '1px solid var(--line-soft)',
                    borderRadius: 12, padding: '10px 14px', fontSize: 14, maxWidth: '72%', whiteSpace: 'pre-wrap',
                  }}>
                    <div style={{ fontSize: 11, color: m.pendente_aprovacao ? 'var(--warn)' : 'var(--ink-mut)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                      {m.autor === 'visitante' ? 'Cliente' : m.autor === 'humano' ? 'Você' : m.pendente_aprovacao ? 'IA · pausada, aguardando você' : 'IA · automático'}
                    </div>
                    <div>{m.texto}</div>
                    {m.pendente_aprovacao && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn-action" style={{ fontSize: 12, padding: '3px 9px' }} onClick={() => void aprovarMensagem(m.id)}>Aprovar</button>
                        <button className="btn-action btn-ghost" style={{ fontSize: 12, padding: '3px 9px' }} onClick={() => void descartarMensagem(m.id)}>Descartar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selecionado.tipo === 'conversa' && (
                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Digite uma mensagem…"
                    value={respostaManual}
                    onChange={e => setRespostaManual(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void responderManual() }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-action" onClick={() => void responderManual()}><i className="fa-solid fa-paper-plane" /></button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Coluna 3 — painel de automação da conversa (~22%) */}
        <div style={{ overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
            Automação{canalAtivo ? ` · ${CANAL_META[canalAtivo].label}` : ''}
          </div>
          {/* Fase 6 — classificar temperatura aqui cria/atualiza o card no
              Pipeline automaticamente (spec: de qualquer tela do sistema) */}
          {selecionado?.tipo === 'conversa' && selecionado.conversa.visitante_nome && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Temperatura do lead</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['frio', 'cold', 'Frio'], ['morno', 'warm', 'Morno'], ['quente', 'hot', 'Quente']] as const).map(([t, classe, label]) => (
                  <span
                    key={t}
                    className={`temp ${classe}`}
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={async () => {
                      const conv = selecionado.conversa
                      const r = await fetch('/api/crm/classificar-temperatura', {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
                        body: JSON.stringify({ titulo: conv.visitante_nome, contato: conv.visitante_nome, temperatura: t, origem_detalhe: `Classificado na conversa (${conv.canal})` }),
                      })
                      const d = await r.json() as { ok?: boolean; criado?: boolean; error?: string }
                      if (r.ok && d.ok) toast.success(d.criado ? 'Card criado no Pipeline (Prospect)' : 'Temperatura atualizada no Pipeline')
                      else toast.error(d.error || 'Falha ao classificar')
                    }}
                  >{label}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-mut)', marginTop: 5 }}>Classificar cria o card no Pipeline se ainda não existir.</div>
            </div>
          )}
          {!canalAtivo ? (
            <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--ink-mut)' }}>Selecione uma conversa pra ver as regras do canal.</div>
          ) : canalAtivo === 'whatsapp' || canalAtivo === 'instagram' ? (
            [
              { nome: 'Responder dúvidas de preço', desc: 'IA responde perguntas de catálogo e planos sem aprovação', modo: 'Automático' as const },
              { nome: 'Conceder desconto', desc: 'Alçada até 15% · acima disso, sempre pede aprovação', modo: 'Rascunho / aprovação' as const },
            ].map(ex => (
              <div key={ex.nome} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <b style={{ fontSize: 12.5, color: 'var(--ink)' }}>{ex.nome}</b>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '1px 7px', borderRadius: 100 }}>Exemplo</span>
                </div>
                <small style={{ fontSize: 10.5, color: 'var(--ink-mut)', lineHeight: 1.4, display: 'block' }}>{ex.desc}</small>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 5, display: 'inline-block',
                  background: ex.modo === 'Automático' ? 'var(--sage-tint)' : 'var(--warn-soft)', color: ex.modo === 'Automático' ? 'var(--sage-deep)' : 'var(--warn)',
                }}>
                  {ex.modo}
                </span>
              </div>
            ))
          ) : regrasCanal.length === 0 ? (
            <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--ink-mut)' }}>Sem regras cadastradas pro canal {CANAL_META[canalAtivo].label} ainda.</div>
          ) : regrasCanal.map(r => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <b style={{ fontSize: 12.5, color: 'var(--ink)' }}>{r.nome || r.criterio}</b>
                <button
                  onClick={() => void alternarRegraAtiva(r)}
                  title={r.ativa ? 'Desligar regra' : 'Ligar regra'}
                  style={{ width: 30, height: 17, borderRadius: 10, border: 'none', cursor: 'pointer', background: r.ativa ? 'var(--sage-deep)' : 'var(--line)', position: 'relative', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 2, left: r.ativa ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
              </div>
              <small style={{ fontSize: 10.5, color: 'var(--ink-mut)', lineHeight: 1.4, display: 'block' }}>Palavras-chave: {r.criterio}</small>
              <button
                onClick={() => void alternarAutonomia(r)}
                title="Clique pra alternar entre automático e rascunho"
                style={{
                  fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 5, border: 'none', cursor: 'pointer', display: 'inline-block',
                  background: r.autonomia === 'automatico' ? 'var(--sage-tint)' : 'var(--warn-soft)',
                  color: r.autonomia === 'automatico' ? 'var(--sage-deep)' : 'var(--warn)',
                }}
              >
                {r.autonomia === 'automatico' ? 'Automático' : 'Rascunho / aprovação'}
              </button>
            </div>
          ))}
          <div style={{ padding: '10px 16px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3, color: 'var(--ink)' }}>Pedidos sensíveis</div>
            <small style={{ fontSize: 10.5, color: 'var(--ink-mut)', lineHeight: 1.4, display: 'block' }}>Cancelamento, reclamação e negociação — a IA sempre transfere pra você, nunca decide sozinha</small>
            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 5, display: 'inline-block', background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              Sempre manual
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConversasPage() {
  return (
    <Suspense fallback={null}>
      <ConversasContent />
    </Suspense>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Resumo = {
  resultado: number; entrou: number; saiu: number; aClassificar: number
  aReceberQtd: number; aReceberValor: number; vencimentos: string[]; obrasEstouro: string[]
  aluguelMes: number; imoveis: number; topCats: [string, number][]
}
type Msg = { autor: 'ai' | 'user'; texto: string }

const SUGESTOES = ['Como estão meus números?', 'O que vence agora?', 'Quanto tenho a receber de aluguel?', 'Onde estou gastando mais?', 'Alguma obra estourando?']

export default function AssistentePage() {
  const [token, setToken] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([{ autor: 'ai', texto: 'Oi! Sou seu assistente do FactorOne. Cuido das suas finanças e do seu patrimônio. Me pergunte qualquer coisa — ou veja o resumo do dia ao lado.' }])
  const [input, setInput] = useState('')
  const [pensando, setPensando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''; setToken(tk)
      try { const r = await fetch('/api/assistente', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.resumo) setResumo(j.resumo as Resumo) } catch { /* ignore */ }
    })()
  }, [])
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim()
    if (!pergunta || pensando) return
    setMsgs(m => [...m, { autor: 'user', texto: pergunta }]); setInput(''); setPensando(true)
    try {
      const r = await fetch('/api/assistente', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ pergunta }) })
      const j = await r.json()
      setMsgs(m => [...m, { autor: 'ai', texto: j.resposta ?? 'Não consegui responder agora.' }])
    } catch { setMsgs(m => [...m, { autor: 'ai', texto: 'Tive um problema pra responder. Tenta de novo.' }]) }
    finally { setPensando(false) }
  }

  const alertas: { txt: string; cor: string; ic: string; href: string }[] = resumo ? [
    ...(resumo.aClassificar > 0 ? [{ txt: `${resumo.aClassificar} transações a classificar`, cor: '#B0413E', ic: 'fa-layer-group', href: '/dashboard/classificar' }] : []),
    ...(resumo.aReceberQtd > 0 ? [{ txt: `${resumo.aReceberQtd} aluguéis a receber · ${formatBRL(resumo.aReceberValor)}`, cor: 'var(--gold)', ic: 'fa-hand-holding-dollar', href: '/dashboard/patrimonio/recibos' }] : []),
    ...resumo.vencimentos.map(v => ({ txt: v, cor: 'var(--gold)', ic: 'fa-car', href: '/dashboard/patrimonio/veiculos' })),
    ...resumo.obrasEstouro.map(o => ({ txt: `Obra estourando: ${o}`, cor: '#B0413E', ic: 'fa-helmet-safety', href: '/dashboard/patrimonio/obras' })),
  ] : []

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Assistente</div>
          <div className="page-sub">Seu copiloto 24/7 — conhece suas finanças e seu patrimônio.</div>
        </div>
        <span className="live-badge"><span className="live-dot" /> ativo</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
        {/* Chat */}
        <div className="txs-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 460 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.autor === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.autor === 'ai' ? 'var(--sage)' : 'var(--ink)', color: '#fff', fontSize: 12 }}>
                  <i className={`fa-solid ${m.autor === 'ai' ? 'fa-robot' : 'fa-user'}`} />
                </div>
                <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.autor === 'ai' ? 'var(--surface-2)' : 'var(--ink)', color: m.autor === 'ai' ? 'var(--ink)' : 'var(--paper)', border: m.autor === 'ai' ? '1px solid var(--line)' : 'none' }}>{m.texto}</div>
              </div>
            ))}
            {pensando && <div style={{ fontSize: 12, color: 'var(--ink-mut)', paddingLeft: 40 }}><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 6 }} />pensando…</div>}
            <div ref={fim} />
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {SUGESTOES.map(s => <button key={s} onClick={() => void enviar(s)} disabled={pensando} style={{ fontSize: 11, padding: '5px 11px', borderRadius: 100, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-soft)', cursor: 'pointer' }}>{s}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Pergunte sobre suas finanças ou patrimônio…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void enviar() }} style={{ flex: 1 }} />
              <button className="btn-action" disabled={pensando || !input.trim()} onClick={() => void enviar()}><i className="fa-solid fa-paper-plane" /></button>
            </div>
          </div>
        </div>

        {/* Resumo do dia */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="txs-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Resumo do dia</div>
            {!resumo ? <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}>Carregando…</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>Resultado do período</div><div style={{ fontSize: 20, fontWeight: 700, color: resumo.resultado >= 0 ? 'var(--sage)' : '#B0413E', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(resumo.resultado)}</div></div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>Aluguel/mês</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{formatBRL(resumo.aluguelMes)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>Imóveis</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{resumo.imoveis}</div></div>
                </div>
              </div>
            )}
          </div>

          <div className="txs-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Precisa da sua atenção</div>
            {alertas.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--sage-deep)' }}><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />Tudo em dia por aqui ✓</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alertas.map((a, i) => (
                  <Link key={i} href={a.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <i className={`fa-solid ${a.ic}`} style={{ fontSize: 12, color: a.cor, marginTop: 2, width: 14 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>{a.txt}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', lineHeight: 1.6, padding: '0 4px' }}>
            <i className="fa-solid fa-envelope" style={{ marginRight: 5 }} />Ler e-mail e agendar automático chegam com o FactorHub. Por enquanto, pergunte e eu te trago tudo dos seus dados.
          </div>
        </div>
      </div>
    </>
  )
}

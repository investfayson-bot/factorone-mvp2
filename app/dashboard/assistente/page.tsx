'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Resumo = {
  resultado: number; entrou: number; saiu: number; aClassificar: number
  aReceberQtd: number; aReceberValor: number; vencimentos: string[]; obrasEstouro: string[]
  aluguelMes: number; imoveis: number; topCats: [string, number][]
  pipelineAberto: number; ganhoValor: number; atividadesPendentes: number; oportunidadesAbertas: number
}
type Relatorio = { gerado: string; narrativa: string; r: Resumo }
type Msg = { autor: 'ai' | 'user'; texto: string; relatorio?: Relatorio }

const SUGESTOES = ['Como estão meus números?', 'O que vence agora?', 'Quanto tenho a receber de aluguel?', 'Onde estou gastando mais?', 'Alguma obra estourando?']

// Monta o texto puro do relatório (WhatsApp / e-mail).
function montarTexto(rel: Relatorio): string {
  const { r } = rel
  const L: string[] = ['📊 FactorOne — Relatório do dia', rel.gerado, '']
  if (rel.narrativa) { L.push(rel.narrativa, '') }
  L.push(`Entrou: ${formatBRL(r.entrou)}`)
  L.push(`Saiu: ${formatBRL(r.saiu)}`)
  L.push(`Resultado: ${formatBRL(r.resultado)}`)
  if (r.aluguelMes) L.push(`Aluguel/mês: ${formatBRL(r.aluguelMes)} · ${r.imoveis} imóveis`)
  if (r.pipelineAberto) L.push(`Pipeline aberto: ${formatBRL(r.pipelineAberto)}`)
  if (r.topCats?.length) { L.push('', 'Onde você gastou:'); for (const [c, v] of r.topCats.slice(0, 6)) L.push(`• ${c}: ${formatBRL(v)}`) }
  const alertas = [
    ...(r.aClassificar > 0 ? [`${r.aClassificar} transações a classificar`] : []),
    ...(r.aReceberQtd > 0 ? [`${r.aReceberQtd} aluguéis a receber (${formatBRL(r.aReceberValor)})`] : []),
    ...r.vencimentos,
    ...r.obrasEstouro.map(o => `Obra estourando: ${o}`),
    ...(r.atividadesPendentes > 0 ? [`${r.atividadesPendentes} atividades pendentes no CRM`] : []),
  ]
  if (alertas.length) { L.push('', 'Precisa de atenção:'); for (const a of alertas) L.push(`• ${a}`) }
  L.push('', '— gerado pelo FactorOne')
  return L.join('\n')
}

export default function AssistentePage() {
  const [token, setToken] = useState('')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([{ autor: 'ai', texto: 'Oi! Sou seu assistente do FactorOne. Cuido das suas finanças e do seu patrimônio. Me pergunte qualquer coisa, ou peça um relatório do dia — eu monto, você abre numa tela e envia se precisar.' }])
  const [input, setInput] = useState('')
  const [pensando, setPensando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [relAberto, setRelAberto] = useState<Relatorio | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''; setToken(tk)
      try { const r = await fetch('/api/assistente', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.resumo) setResumo(j.resumo as Resumo) } catch { /* ignore */ }
    })()
  }, [])
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando, gerando])

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim()
    if (!pergunta || pensando) return
    // "quero um relatório" também dispara a geração
    if (/relat[óo]rio/i.test(pergunta)) { setInput(''); void gerarRelatorio(); return }
    setMsgs(m => [...m, { autor: 'user', texto: pergunta }]); setInput(''); setPensando(true)
    try {
      const r = await fetch('/api/assistente', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ pergunta }) })
      const j = await r.json()
      setMsgs(m => [...m, { autor: 'ai', texto: j.resposta ?? 'Não consegui responder agora.' }])
    } catch { setMsgs(m => [...m, { autor: 'ai', texto: 'Tive um problema pra responder. Tenta de novo.' }]) }
    finally { setPensando(false) }
  }

  // Gera o relatório: pega os números, pede um resumo executivo à IA e posta um card no chat.
  async function gerarRelatorio() {
    if (gerando) return
    setGerando(true)
    setMsgs(m => [...m, { autor: 'user', texto: '📄 Gerar relatório do dia' }])
    try {
      let r = resumo
      if (!r) {
        const rr = await fetch('/api/assistente', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const jj = await rr.json(); r = (jj.resumo as Resumo) ?? null; if (r) setResumo(r)
      }
      if (!r) { setMsgs(m => [...m, { autor: 'ai', texto: 'Não consegui carregar seus números agora.' }]); return }
      let narrativa = ''
      try {
        const rn = await fetch('/api/assistente', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ pergunta: 'Escreva um resumo executivo curto (no máximo 4 frases, tom de CFO, sem bullet points) da situação do meu negócio hoje com base nos meus números.' }) })
        const jn = await rn.json(); narrativa = (jn.resposta as string) ?? ''
      } catch { /* segue sem narrativa */ }
      const rel: Relatorio = { gerado: new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }), narrativa, r }
      setMsgs(m => [...m, { autor: 'ai', texto: 'Prontinho — montei seu relatório do dia. Abra pra ver completo ou envie direto.', relatorio: rel }])
    } catch { setMsgs(m => [...m, { autor: 'ai', texto: 'Tive um problema pra montar o relatório. Tenta de novo.' }]) }
    finally { setGerando(false) }
  }

  const alertas: { txt: string; cor: string; ic: string; href: string }[] = resumo ? [
    ...(resumo.aClassificar > 0 ? [{ txt: `${resumo.aClassificar} transações a classificar`, cor: '#B0413E', ic: 'fa-layer-group', href: '/dashboard/classificar' }] : []),
    ...(resumo.aReceberQtd > 0 ? [{ txt: `${resumo.aReceberQtd} aluguéis a receber · ${formatBRL(resumo.aReceberValor)}`, cor: 'var(--gold)', ic: 'fa-hand-holding-dollar', href: '/dashboard/patrimonio/recibos' }] : []),
    ...resumo.vencimentos.map(v => ({ txt: v, cor: 'var(--gold)', ic: 'fa-car', href: '/dashboard/patrimonio/veiculos' })),
    ...resumo.obrasEstouro.map(o => ({ txt: `Obra estourando: ${o}`, cor: '#B0413E', ic: 'fa-helmet-safety', href: '/dashboard/patrimonio/obras' })),
    ...(resumo.atividadesPendentes > 0 ? [{ txt: `${resumo.atividadesPendentes} atividades pendentes no CRM`, cor: 'var(--gold)', ic: 'fa-list-check', href: '/dashboard/crm' }] : []),
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
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 8, alignItems: m.autor === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.autor === 'ai' ? 'var(--surface-2)' : 'var(--ink)', color: m.autor === 'ai' ? 'var(--ink)' : 'var(--paper)', border: m.autor === 'ai' ? '1px solid var(--line)' : 'none' }}>{m.texto}</div>
                  {m.relatorio && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--sage)', borderRadius: 12, padding: '12px 14px', width: 260, boxShadow: 'var(--shadow-card)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sage-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-file-lines" style={{ color: 'var(--sage-deep)' }} /></div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Relatório do dia</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-mut)' }}>Resultado {formatBRL(m.relatorio.r.resultado)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-action" style={{ fontSize: 11.5, padding: '6px 10px', flex: 1 }} onClick={() => setRelAberto(m.relatorio!)}><i className="fa-solid fa-up-right-and-down-left-from-center" style={{ marginRight: 5 }} />Abrir</button>
                        <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} title="WhatsApp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(montarTexto(m.relatorio!))}`, '_blank')}><i className="fa-brands fa-whatsapp" style={{ color: '#25D366' }} /></button>
                        <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} title="E-mail" onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Relatório FactorOne')}&body=${encodeURIComponent(montarTexto(m.relatorio!))}`)}><i className="fa-solid fa-envelope" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(pensando || gerando) && <div style={{ fontSize: 12, color: 'var(--ink-mut)', paddingLeft: 40 }}><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 6 }} />{gerando ? 'montando seu relatório…' : 'pensando…'}</div>}
            <div ref={fim} />
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={() => void gerarRelatorio()} disabled={gerando || pensando} style={{ fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 100, border: '1px solid var(--sage)', background: 'var(--sage-tint)', color: 'var(--sage-deep)', cursor: 'pointer' }}><i className="fa-solid fa-file-lines" style={{ marginRight: 5 }} />Gerar relatório</button>
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
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>Aluguel/mês</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{formatBRL(resumo.aluguelMes)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>Imóveis</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{resumo.imoveis}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>Pipeline</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sage-deep)' }}>{formatBRL(resumo.pipelineAberto)}</div></div>
                </div>
                <button onClick={() => void gerarRelatorio()} disabled={gerando} style={{ marginTop: 2, fontSize: 12, fontWeight: 700, padding: '8px', borderRadius: 9, border: '1px solid var(--sage)', background: 'var(--sage-tint)', color: 'var(--sage-deep)', cursor: 'pointer' }}><i className="fa-solid fa-file-lines" style={{ marginRight: 6 }} />Gerar relatório do dia</button>
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

      {/* Painel do relatório — abre numa tela, dá pra enviar */}
      {relAberto && <RelatorioPanel rel={relAberto} onClose={() => setRelAberto(null)} />}
    </>
  )
}

function RelatorioPanel({ rel, onClose }: { rel: Relatorio; onClose: () => void }) {
  const { r } = rel
  const alertas = [
    ...(r.aClassificar > 0 ? [`${r.aClassificar} transações a classificar`] : []),
    ...(r.aReceberQtd > 0 ? [`${r.aReceberQtd} aluguéis a receber (${formatBRL(r.aReceberValor)})`] : []),
    ...r.vencimentos,
    ...r.obrasEstouro.map(o => `Obra estourando: ${o}`),
    ...(r.atividadesPendentes > 0 ? [`${r.atividadesPendentes} atividades pendentes no CRM`] : []),
  ]
  function copiar() { void navigator.clipboard.writeText(montarTexto(rel)).then(() => toast.success('Relatório copiado')) }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(19,32,29,.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(19,32,29,.3)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="rel-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}><i className="fa-solid fa-file-lines" style={{ marginRight: 8, color: 'var(--sage-deep)' }} />Relatório do dia</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(montarTexto(rel))}`, '_blank')}><i className="fa-brands fa-whatsapp" style={{ marginRight: 5, color: '#25D366' }} />WhatsApp</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Relatório FactorOne')}&body=${encodeURIComponent(montarTexto(rel))}`)}><i className="fa-solid fa-envelope" style={{ marginRight: 5 }} />E-mail</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={copiar}><i className="fa-solid fa-copy" style={{ marginRight: 5 }} />Copiar</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => window.print()}><i className="fa-solid fa-print" style={{ marginRight: 5 }} />PDF</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 9px' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>
        {/* Folha */}
        <div className="rel-folha" style={{ padding: '26px 30px', maxHeight: '78vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>Relatório financeiro</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage-deep)' }}>Factor<span style={{ color: 'var(--gold)' }}>One</span></div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mut)', marginBottom: 20 }}>{rel.gerado}</div>

          {rel.narrativa && <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)', background: 'var(--sage-tint)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>{rel.narrativa}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 22 }}>
            {[
              { l: 'Entrou', v: formatBRL(r.entrou), c: 'var(--sage)' },
              { l: 'Saiu', v: formatBRL(r.saiu), c: '#B0413E' },
              { l: 'Resultado', v: formatBRL(r.resultado), c: r.resultado >= 0 ? 'var(--sage)' : '#B0413E' },
            ].map(k => (
              <div key={k.l} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 22, fontSize: 12.5 }}>
            <div><span style={{ color: 'var(--ink-mut)' }}>Aluguel/mês: </span><b>{formatBRL(r.aluguelMes)}</b> · {r.imoveis} imóveis</div>
            <div><span style={{ color: 'var(--ink-mut)' }}>Pipeline aberto: </span><b style={{ color: 'var(--sage-deep)' }}>{formatBRL(r.pipelineAberto)}</b></div>
          </div>

          {r.topCats?.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Onde você gastou</div>
              {(() => { const max = Math.max(...r.topCats.map(([, v]) => v), 1); return r.topCats.slice(0, 6).map(([c, v]) => (
                <div key={c} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}><span style={{ color: 'var(--ink)' }}>{c}</span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(v)}</span></div>
                  <div style={{ height: 5, background: 'var(--paper-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(v / max) * 100}%`, background: 'var(--sage)', borderRadius: 3 }} /></div>
                </div>
              )) })()}
            </div>
          )}

          {alertas.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Precisa de atenção</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {alertas.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--ink)', display: 'flex', gap: 8 }}><i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--gold)', marginTop: 2 }} />{a}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

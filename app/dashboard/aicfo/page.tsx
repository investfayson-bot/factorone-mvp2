'use client'
import { RespostaIA } from '@/components/aicfo/RespostaIA'
import { useEffect, useRef, useState } from 'react'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Msg = { role: 'user' | 'assistant'; content: string; structured?: unknown }

const SUGESTOES = [
  'Qual o impacto se reduzirmos 15% de Marketing?',
  'Como está meu fluxo de caixa?',
  'Quais são minhas maiores despesas?',
  'Detecte anomalias nos meus gastos',
]

const METRICAS_DEMO = {
  alertas: 3,
  previsao30d: 2_600_000,
  confiancaPct: 94,
  riscoCaixaDias: 67,
  anomalias: 3,
  precisaoIaPct: 94,
}

export default function AICFOPage() {
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const refFim = useRef<HTMLDivElement>(null)

  useEffect(() => { refFim.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, loading])

  async function enviar(m?: string) {
    const texto = (m || input).trim()
    if (!texto || loading) return
    setInput('')
    const novo = [...mensagens, { role: 'user', content: texto } as Msg]
    setMensagens(novo)
    setLoading(true)
    try {
      const res = await fetch('/api/aicfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: texto, context: 'chat_aicfo' }) })
      const data = await res.json()
      setMensagens((prev) => [...prev, { role: 'assistant', content: data.response || data.error || 'Sem resposta', structured: data.structured || null }])
    } catch {
      setMensagens((prev) => [...prev, { role: 'assistant', content: 'Erro de conexão.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">AI CFO</div>
          <div className="page-sub">Análise financeira · Previsões · Risco de caixa</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Alertas</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{METRICAS_DEMO.alertas}</div>
          <div className="kpi-delta warn">⚠ atenção</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Previsão 30d</div>
          <div className="kpi-val">{fmtBRLCompact(METRICAS_DEMO.previsao30d)}</div>
          <div className="kpi-delta up">{METRICAS_DEMO.confiancaPct}% confiança</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Risco caixa</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{METRICAS_DEMO.riscoCaixaDias}d</div>
          <div className="kpi-delta warn">⚠ atenção</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Anomalias</div>
          <div className="kpi-val">{METRICAS_DEMO.anomalias}</div>
          <div className="kpi-delta dn">detectadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Precisão IA</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{METRICAS_DEMO.precisaoIaPct}%</div>
          <div className="kpi-delta up">✓ classificação</div>
        </div>
      </div>

      {/* Chat */}
      <div className="ai-wrap">
        <div className="ai-chat">
          <div className="ai-chat-hdr">
            <div className="ai-av">FO</div>
            <div>
              <div className="ai-name">FactorOne CFO</div>
              <div className="ai-status"><div className="live-dot" style={{ width: 6, height: 6 }} /> online</div>
            </div>
          </div>

          {mensagens.length === 0 && (
            <div className="quick-btns" style={{ paddingTop: 12 }}>
              {SUGESTOES.map(s => (
                <button key={s} className="quick-btn" onClick={() => enviar(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className="ai-msgs">
            {mensagens.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className={`msg-av ${m.role === 'assistant' ? 'ai' : 'user'}`}>
                  {m.role === 'assistant' ? 'FO' : 'VC'}
                </div>
                <div className={`msg-bubble ${m.role === 'assistant' ? 'ai' : 'user'}`}>
                  {m.role === 'assistant' && (m as { structured?: unknown }).structured
                    ? <RespostaIA data={(m as { structured: unknown }).structured as never} />
                    : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg">
                <div className="msg-av ai">FO</div>
                <div className="msg-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', animation: 'fo-pulse 1s infinite' }} />
                  Analisando…
                </div>
              </div>
            )}
            <div ref={refFim} />
          </div>

          <div className="ai-input-row">
            <input
              className="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void enviar()}
              placeholder="Pergunte ao CFO IA..."
            />
            <button className="ai-send" onClick={() => void enviar()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        <div className="ai-sidebar">
          <div className="ai-ctx-card">
            <div className="ai-ctx-title">Dados em contexto</div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Saldo</span><span className="ai-ctx-val">R$487K</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">MRR</span><span className="ai-ctx-val">R$284K</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Burn</span><span className="ai-ctx-val">R$42K/mês</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Runway</span><span className="ai-ctx-val">8.3m</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">A Receber</span><span className="ai-ctx-val">R$157K</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Despesas</span><span className="ai-ctx-val">R$89K</span></div>
          </div>
          <div className="ai-ctx-card">
            <div className="ai-ctx-title">Alertas ativos</div>
            <div style={{ fontSize: 11, color: 'var(--red)', padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>⚠ Invoice TechStart vencida</div>
            <div style={{ fontSize: 11, color: 'var(--gold)', padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>⚡ Budget Marketing 87%</div>
            <div style={{ fontSize: 11, color: 'var(--gold)', padding: '5px 0' }}>⚡ Runway abaixo de 9 meses</div>
          </div>
          <div className="ai-ctx-card">
            <div className="ai-ctx-title">Sugestões rápidas</div>
            {SUGESTOES.map(s => (
              <button key={s} className="quick-btn" style={{ display: 'block', width: '100%', marginBottom: 6, textAlign: 'left' }} onClick={() => enviar(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

'use client'
import { RespostaIA } from '@/components/aicfo/RespostaIA'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Msg = { role: 'user' | 'assistant'; content: string; structured?: unknown }
type Ctx = { saldo: number; receita: number; despesas: number; aReceber: number; runway: number | null }

const SUGESTOES = [
  'Qual o impacto se reduzirmos 15% de Marketing?',
  'Como está meu fluxo de caixa?',
  'Quais são minhas maiores despesas?',
  'Detecte anomalias nos meus gastos',
]

export default function AICFOPage() {
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ctx, setCtx] = useState<Ctx>({ saldo: 0, receita: 0, despesas: 0, aReceber: 0, runway: null })
  const refFim = useRef<HTMLDivElement>(null)

  useEffect(() => { refFim.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, loading])

  const carregarCtx = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    const agora = new Date()
    const ini = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
    const [txRes, contaRes, receberRes] = await Promise.all([
      supabase.from('transacoes').select('tipo,valor').eq('empresa_id', eid).gte('data', ini),
      supabase.from('contas_bancarias').select('saldo_disponivel,saldo').eq('empresa_id', eid).eq('is_principal', true).maybeSingle(),
      supabase.from('contas_receber').select('valor,valor_recebido').eq('empresa_id', eid).in('status', ['pendente', 'vencida']),
    ])
    const txs = txRes.data ?? []
    const rec = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
    const desp = txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
    const saldo = Number(contaRes.data?.saldo_disponivel ?? contaRes.data?.saldo ?? 0)
    const aReceber = (receberRes.data ?? []).reduce((s, r) => s + Math.max(0, Number(r.valor) - Number(r.valor_recebido || 0)), 0)
    const despDia = desp / 30
    const runway = saldo > 0 && despDia > 0 ? Math.min(999, Math.floor(saldo / despDia)) : null
    setCtx({ saldo, receita: rec, despesas: desp, aReceber, runway })
  }, [])

  useEffect(() => { void carregarCtx() }, [carregarCtx])

  async function enviar(m?: string) {
    const texto = (m || input).trim()
    if (!texto || loading) return
    setInput('')
    const novo = [...mensagens, { role: 'user', content: texto } as Msg]
    setMensagens(novo)
    setLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
        body: JSON.stringify({ message: texto, context: 'chat_aicfo' }),
      })
      const data = await res.json() as { response?: string; error?: string; structured?: unknown }
      setMensagens(prev => [...prev, { role: 'assistant', content: data.response || data.error || 'Sem resposta', structured: data.structured || null }])
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro de conexão.' }])
    } finally {
      setLoading(false)
    }
  }

  const runwayLabel = ctx.runway == null ? '—' : ctx.runway > 30 ? `${Math.round(ctx.runway / 30)}m` : `${ctx.runway}d`

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">AI CFO</div>
          <div className="page-sub">Análise financeira · Previsões · Risco de caixa</div>
        </div>
      </div>

      {/* KPIs reais */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Saldo banco</div>
          <div className="kpi-val" style={{ color: ctx.saldo > 0 ? 'var(--navy)' : 'var(--red)' }}>{fmtBRLCompact(ctx.saldo)}</div>
          <div className={`kpi-delta ${ctx.saldo > 0 ? 'up' : 'dn'}`}>{ctx.saldo > 0 ? '✓ disponível' : '⚠ atenção'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Receita mês</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{fmtBRLCompact(ctx.receita)}</div>
          <div className="kpi-delta up">mês atual</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Despesas mês</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{fmtBRLCompact(ctx.despesas)}</div>
          <div className="kpi-delta dn">mês atual</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A receber</div>
          <div className="kpi-val">{fmtBRLCompact(ctx.aReceber)}</div>
          <div className="kpi-delta up">pendente</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Runway</div>
          <div className="kpi-val" style={{ color: ctx.runway != null && ctx.runway < 90 ? 'var(--gold)' : 'var(--navy)' }}>{runwayLabel}</div>
          <div className={`kpi-delta ${ctx.runway == null ? '' : ctx.runway < 90 ? 'warn' : 'up'}`}>{ctx.runway == null ? 'sem saldo' : ctx.runway < 90 ? '⚠ atenção' : '✓ ok'}</div>
        </div>
      </div>

      {/* Chat + sidebar */}
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
                <button key={s} className="quick-btn" onClick={() => void enviar(s)}>{s}</button>
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
                  {m.role === 'assistant' && m.structured
                    ? <RespostaIA data={m.structured as never} />
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
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Saldo banco</span><span className="ai-ctx-val">{fmtBRLCompact(ctx.saldo)}</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Receita mês</span><span className="ai-ctx-val">{fmtBRLCompact(ctx.receita)}</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Despesas mês</span><span className="ai-ctx-val">{fmtBRLCompact(ctx.despesas)}</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">A receber</span><span className="ai-ctx-val">{fmtBRLCompact(ctx.aReceber)}</span></div>
            <div className="ai-ctx-item"><span className="ai-ctx-lbl">Runway</span><span className="ai-ctx-val">{runwayLabel}</span></div>
          </div>
          <div className="ai-ctx-card">
            <div className="ai-ctx-title">Sugestões rápidas</div>
            {SUGESTOES.map(s => (
              <button key={s} className="quick-btn" style={{ display: 'block', width: '100%', marginBottom: 6, textAlign: 'left' }} onClick={() => void enviar(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

'use client'
import { RespostaIA } from '@/components/aicfo/RespostaIA'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtBRLCompact } from '@/lib/dre-calculations'

// Chat direto com a IA financeira (o "AI CFO"), separado do omnichannel de
// clientes — aqui é o dono do negócio falando com a própria IA do sistema.
// Reaproveita a mesma infraestrutura de Tool Use de /api/aicfo. Gap
// conhecido, não implementado nesta passada (reskin puro): streaming SSE e
// histórico de conversas persistido — hoje o chat é síncrono e efêmero.

type Msg = { role: 'user' | 'assistant'; content: string; structured?: unknown }
type Ctx = { saldo: number; receita: number; despesas: number; aReceber: number; runway: number | null }

const SUGESTOES = [
  'Como está meu fluxo de caixa esse mês?',
  'Por que minha margem caiu?',
  'Simule um cenário de contratação',
  'Quais são minhas maiores despesas?',
  'Detecte anomalias nos meus gastos',
  'Quais contas vencem nos próximos 7 dias?',
]

const ACOES_RAPIDAS = [
  { label: 'Resumo do mês',     icon: 'fa-calendar-check',        msg: 'Gere um resumo executivo completo das finanças do mês atual' },
  { label: 'Risco de caixa',    icon: 'fa-triangle-exclamation',  msg: 'Analise o risco de caixa e calcule meu runway com projeção de 90 dias' },
  { label: 'Top despesas',      icon: 'fa-receipt',               msg: 'Quais são as 5 maiores categorias de despesa e como posso reduzi-las?' },
  { label: 'Anomalias',         icon: 'fa-magnifying-glass-chart',msg: 'Detecte anomalias e gastos atípicos nos últimos 30 dias' },
]

export default function AcessorPage() {
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
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Verifique sua conexão e tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  const runwayLabel = ctx.runway == null ? '—' : ctx.runway > 30 ? `${Math.round(ctx.runway / 30)} meses` : `${ctx.runway} dias`

  return (
    <div className="ai-wrap" style={{ gridTemplateColumns: '1fr 220px' }}>
      <div className="ai-chat" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div className="ai-chat-hdr">
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(61,122,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 15, color: '#3D7A6E' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="ai-name">Acessor</div>
            <div className="ai-status"><div className="live-dot" style={{ width: 6, height: 6 }} /> online</div>
          </div>
          <button
            onClick={() => void carregarCtx()}
            title="Atualizar contexto"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: '#fff', color: '#3C4A46', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <i className="fa-solid fa-arrows-rotate" style={{ fontSize: 11 }} />Atualizar
          </button>
        </div>

        {mensagens.length === 0 && (
          <div style={{ padding: '14px 18px 6px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ações rápidas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
              {ACOES_RAPIDAS.map(a => (
                <button
                  key={a.label}
                  onClick={() => void enviar(a.msg)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7,
                    padding: '10px 12px', border: '0.5px solid #E4DCCC', borderRadius: 10,
                    background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3D7A6E'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(61,122,110,0.04)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4DCCC'; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`fa-solid ${a.icon}`} style={{ color: '#3D7A6E', fontSize: 14 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#13201D', lineHeight: 1.3 }}>{a.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Perguntas sugeridas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGESTOES.map(s => (
                <button key={s} className="quick-btn" onClick={() => void enviar(s)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 13, lineHeight: 1.4 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ai-msgs">
          {mensagens.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className={`msg-av ${m.role === 'assistant' ? 'ai' : 'user'}`}>
                {m.role === 'assistant' ? <i className="fa-solid fa-robot" style={{ fontSize: 15 }} /> : 'VC'}
              </div>
              <div className={`msg-bubble ${m.role === 'assistant' ? 'ai' : 'user'}`}>
                {m.role === 'assistant' && m.structured
                  ? <RespostaIA data={m.structured as never} />
                  : <span style={{ fontSize: 14, lineHeight: 1.6 }}>{m.content}</span>
                }
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg">
              <div className="msg-av ai"><i className="fa-solid fa-robot" style={{ fontSize: 15 }} /></div>
              <div className="msg-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#3D7A6E', animation: `fo-pulse 1s ${j * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 14, color: '#7B8C88' }}>Analisando seus dados…</span>
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
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void enviar()}
            placeholder="Pergunte ao Acessor…"
          />
          <button className="ai-send" onClick={() => void enviar()} disabled={!input.trim() || loading}>
            <i className="fa-solid fa-paper-plane" style={{ fontSize: 15, color: '#fff' }} />
          </button>
        </div>
      </div>

      <div className="ai-sidebar">
        <div className="ai-ctx-card">
          <div className="ai-ctx-title">Dados em contexto</div>
          {[
            { l: 'Saldo banco', v: fmtBRLCompact(ctx.saldo), c: ctx.saldo > 0 ? '#3D7A6E' : '#B0413E' },
            { l: 'Receita mês', v: fmtBRLCompact(ctx.receita), c: '#3D7A6E' },
            { l: 'Despesas mês', v: fmtBRLCompact(ctx.despesas), c: '#B0413E' },
            { l: 'A receber', v: fmtBRLCompact(ctx.aReceber), c: '#13201D' },
            { l: 'Runway', v: runwayLabel, c: ctx.runway != null && ctx.runway < 90 ? '#B08A3E' : '#13201D' },
          ].map(item => (
            <div key={item.l} className="ai-ctx-item">
              <span className="ai-ctx-lbl">{item.l}</span>
              <span className="ai-ctx-val" style={{ color: item.c }}>{item.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

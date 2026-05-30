import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { getAgente } from '@/lib/hub-agentes'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Modelo padrão barato via OpenRouter (sobrescrevível por env ou por agente)
const MODELO_PADRAO = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { agentId, messages } = (await req.json()) as { agentId?: string; messages?: ChatMsg[] }
    const agente = agentId ? getAgente(agentId) : undefined
    if (!agente) return NextResponse.json({ error: 'Agente inválido' }, { status: 400 })

    const limpa = (messages ?? [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
    if (!limpa.length) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    const modelo = agente.modelo || MODELO_PADRAO

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'FactorHub',
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 1200,
        usage: { include: true },
        messages: [{ role: 'system', content: agente.system }, ...limpa],
      }),
    })

    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = data?.error?.message || data?.error || 'Falha na geração'
      return NextResponse.json({ error: typeof msg === 'string' ? msg : 'Falha na geração' }, { status: 502 })
    }

    const reply: string = data?.choices?.[0]?.message?.content ?? ''
    const usage = data?.usage ?? {}
    const promptTokens = Number(usage.prompt_tokens ?? 0)
    const completionTokens = Number(usage.completion_tokens ?? 0)
    const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens)
    const custoUsd = Number(usage.cost ?? 0)

    // Registra consumo por agente (RLS por empresa_id). Não bloqueia a resposta em caso de erro.
    await supabase.from('hub_uso_agentes').insert({
      empresa_id: empresaId,
      agente_id: agente.id,
      modelo,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      custo_usd: custoUsd,
    })

    return NextResponse.json({
      reply,
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens, custo_usd: custoUsd },
    })
  } catch (error: unknown) {
    console.error('Erro Hub chat:', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

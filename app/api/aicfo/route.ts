import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'
import { calcularDAS } from '@/lib/fiscal/simples-nacional'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: usrRow } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { message, context } = (await req.json()) as { message?: string; context?: string }
    if (!message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    const hoje = new Date()
    const hojeStr = hoje.toISOString().slice(0, 10)
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30)
    const em30Str = em30.toISOString().slice(0, 10)
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const doze = new Date(hoje); doze.setMonth(doze.getMonth() - 12)
    const mesPassadoInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10)
    const mesPassadoFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10)

    const [txRes, despRes, contasRes, pagarRes, receberRes, pagarVencRes, tx12Res, txMesPassadoRes] = await Promise.all([
      supabase
        .from('transacoes')
        .select('tipo,valor,categoria,data,descricao')
        .eq('empresa_id', empresaId)
        .order('data', { ascending: false })
        .limit(60),
      supabase
        .from('despesas')
        .select('valor,status,categoria,data_despesa,descricao')
        .eq('empresa_id', empresaId)
        .in('status', ['pendente_aprovacao', 'aprovado'])
        .limit(20),
      supabase
        .from('contas_bancarias')
        .select('banco,saldo_disponivel,saldo')
        .eq('empresa_id', empresaId)
        .limit(5),
      supabase
        .from('contas_pagar')
        .select('descricao,valor,data_vencimento,status')
        .eq('empresa_id', empresaId)
        .neq('status', 'pago')
        .lte('data_vencimento', em30Str)
        .order('data_vencimento', { ascending: true })
        .limit(15),
      supabase
        .from('contas_receber')
        .select('descricao,valor,data_vencimento,status')
        .eq('empresa_id', empresaId)
        .neq('status', 'recebido')
        .lte('data_vencimento', em30Str)
        .order('data_vencimento', { ascending: true })
        .limit(15),
      supabase
        .from('contas_pagar')
        .select('valor,data_vencimento')
        .eq('empresa_id', empresaId)
        .neq('status', 'pago')
        .lt('data_vencimento', hojeStr),
      supabase
        .from('transacoes')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'entrada')
        .gte('data', doze.toISOString().slice(0, 10)),
      supabase
        .from('transacoes')
        .select('tipo,valor')
        .eq('empresa_id', empresaId)
        .gte('data', mesPassadoInicio)
        .lte('data', mesPassadoFim),
    ])

    const transacoes = txRes.data ?? []
    const contas = contasRes.data ?? []

    // DAS
    const receitaMes = transacoes.filter(t => t.tipo === 'entrada' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const rbt12 = (tx12Res.data ?? []).reduce((s, t) => s + Number(t.valor || 0), 0)
    const das = calcularDAS(receitaMes, rbt12)

    // Saldo total
    const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || c.saldo || 0), 0)

    // Receita/despesa mês passado
    const txMP = txMesPassadoRes.data ?? []
    const receitaMP = txMP.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor || 0), 0)
    const despesaMP = txMP.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor || 0), 0)

    // Despesa mês atual
    const despesaMes = transacoes.filter(t => t.tipo === 'saida' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)

    // Contas vencidas
    const totalVencido = (pagarVencRes.data ?? []).reduce((s, c) => s + Number(c.valor || 0), 0)
    const qtdVencidas = (pagarVencRes.data ?? []).length

    // Score simplificado (inline)
    let score = 500
    if (saldoTotal > 0 && despesaMes > 0) {
      const runway = saldoTotal / (despesaMes / 30)
      if (runway >= 90) score += 80
      else if (runway >= 30) score += 40
      else if (runway < 7) score -= 100
    }
    if (receitaMes > 0 && despesaMes > 0) {
      const margem = (receitaMes - despesaMes) / receitaMes
      if (margem >= 0.3) score += 60
      else if (margem >= 0.1) score += 30
      else if (margem < 0) score -= 80
    }
    if (receitaMP > 0 && receitaMes > 0) {
      const cresc = (receitaMes - receitaMP) / receitaMP
      if (cresc >= 0.1) score += 40
      else if (cresc < -0.1) score -= 40
    }
    if (qtdVencidas > 0) score -= Math.min(qtdVencidas * 15, 80)
    score = Math.max(0, Math.min(1000, score))

    const dadosContexto = {
      data_hoje: hojeStr,
      saldo_total: saldoTotal,
      receita_mes_atual: receitaMes,
      despesa_mes_atual: despesaMes,
      receita_mes_passado: receitaMP,
      despesa_mes_passado: despesaMP,
      score_financeiro: score,
      das: {
        competencia: das.competencia,
        valor_estimado: das.valorDAS,
        vencimento: das.vencimento,
        alertas: das.alertas,
      },
      contas_pagar_proximos_30d: pagarRes.data ?? [],
      contas_receber_proximos_30d: receberRes.data ?? [],
      contas_pagar_vencidas: { quantidade: qtdVencidas, total: totalVencido },
      transacoes_recentes: transacoes.slice(0, 30),
      despesas_pendentes: despRes.data ?? [],
      contas_bancarias: contas,
      contexto_adicional: context ?? null,
    }

    const systemPrompt = `Você é o CFO Inteligente da FactorOne para PMEs brasileiras. Hoje é ${hojeStr}.

Responda SEMPRE em português brasileiro com este JSON exato (sem texto fora do JSON):
{
  "resumo": "frase curta de 1 linha resumindo a situação financeira atual",
  "status": "positivo" | "atencao" | "critico",
  "cards": [
    {
      "titulo": "título do card",
      "linhas": [
        { "label": "nome do item", "valor": "R$ 0,00 ou texto", "destaque": "positivo" | "negativo" | "neutro" }
      ]
    }
  ],
  "alertas": ["alerta urgente 1", "alerta urgente 2"],
  "proxima_pergunta": "sugestão de próxima pergunta relevante"
}

REGRAS:
- Não use emojis
- Máximo 3 cards, cada um máximo 5 linhas
- Números em formato R$ 1.234,56
- Seja direto e prático como um CFO real
- Priorize alertas urgentes: contas vencidas, DAS vencendo, fluxo negativo
- Score financeiro: 0-400 crítico, 400-600 atenção, 600-800 bom, 800-1000 excelente
- Se dados estiverem zerados, oriente registrar transações

DADOS FINANCEIROS DA EMPRESA:
${JSON.stringify(dadosContexto, null, 2)}`

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'

    try {
      const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
      return NextResponse.json({ response: texto, structured: json })
    } catch {
      return NextResponse.json({ response: texto, structured: null })
    }
  } catch (error: unknown) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json(
      { error: erroDesconhecido(error) || 'Erro interno' },
      { status: 500 }
    )
  }
}

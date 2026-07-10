import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'
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

    // Resolver empresa corretamente
    const { data: usrRow } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const agora = new Date()
    const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
    const doze = new Date(agora); doze.setMonth(doze.getMonth() - 12)

    const [{ data: transacoes }, { data: tx12 }] = await Promise.all([
      supabase.from('transacoes').select('tipo,valor,categoria,data').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(20),
      supabase.from('transacoes').select('valor').eq('empresa_id', empresaId).eq('tipo', 'entrada').gte('data', doze.toISOString().slice(0, 10)),
    ])

    const receitaMes = (transacoes ?? []).filter(t => t.tipo === 'entrada' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const rbt12 = (tx12 ?? []).reduce((s, t) => s + Number(t.valor || 0), 0)
    const das = calcularDAS(receitaMes, rbt12)

    const hojeStr = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    // Se DAS vence em menos de 5 dias, retornar alerta direto sem chamar AI
    if (das.alertas.some(a => a.includes('vence em') || a.includes('atraso'))) {
      const urgente = das.alertas.find(a => a.includes('vence em') || a.includes('atraso')) || das.alertas[0]
      return NextResponse.json({
        tipo: 'tributario',
        titulo: 'DAS vence em breve',
        mensagem: `${urgente} DAS estimado: R$ ${das.valorDAS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        acao: 'Ver Tributacao',
        urgencia: 'alta',
      })
    }

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Você é o CFO IA da FactorOne. Hoje é ${hojeStr}.

Gere UM insight proativo e urgente em JSON (sem texto fora do JSON):
{
  "tipo": "alerta" | "oportunidade" | "tributario" | "fluxo",
  "titulo": "título curto (max 6 palavras, sem emoji)",
  "mensagem": "insight acionável em 2 frases. Seja específico com números quando possível.",
  "acao": "texto do botão de ação (ex: Ver detalhes, Ajustar agora, Saiba mais)",
  "urgencia": "alta" | "media" | "baixa"
}

Varie entre insights financeiros dos dados da empresa e atualizações tributárias relevantes.
Se os dados estiverem vazios, gere um insight sobre boas práticas financeiras para PMEs brasileiras.
CONTEXTO FISCAL: DAS estimado mês ${das.competencia} = R$${das.valorDAS.toFixed(2)}, alíquota efetiva ${(das.aliquotaEfetiva*100).toFixed(2)}%, vencimento ${das.vencimento}.
DADOS DA EMPRESA: ${JSON.stringify(transacoes || [])}`,
      messages: [{ role: 'user', content: 'Gere um insight proativo agora.' }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
    return NextResponse.json(json)
  } catch (error) {
    console.error('Insight error:', error)
    return NextResponse.json({ tipo: 'fluxo', titulo: 'Dica financeira', mensagem: 'Registre suas primeiras transações para ativar os insights do FactorOne IA.', acao: 'Registrar transação', urgencia: 'baixa' })
  }
}

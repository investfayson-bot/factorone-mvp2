import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const eid = ur?.empresa_id ?? user.id

  const [opsR, atvsR, clientesR] = await Promise.all([
    supabase.from('crm_oportunidades').select('titulo,valor,etapa,probabilidade,data_fechamento,responsavel_nome').eq('empresa_id', eid),
    supabase.from('crm_atividades').select('tipo,titulo,data,status').eq('empresa_id', eid).gte('data', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    supabase.from('clientes').select('nome,status,valor_contrato,segmento').eq('empresa_id', eid),
  ])

  const ops = opsR.data ?? []
  const atvs = atvsR.data ?? []
  const clientes = clientesR.data ?? []

  const pipeline = ops.filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa))
  const ganhas = ops.filter(o => o.etapa === 'fechado_ganho')
  const perdidas = ops.filter(o => o.etapa === 'fechado_perdido')
  const totalPipeline = pipeline.reduce((s, o) => s + Number(o.valor ?? 0), 0)
  const taxaConversao = ops.length > 0 ? Math.round(ganhas.length / ops.length * 100) : 0

  const prompt = `Você é o AI CFO da FactorOne analisando o pipeline de CRM de uma empresa brasileira.

DADOS DO PIPELINE:
- Oportunidades abertas: ${pipeline.length} | Valor total: R$ ${totalPipeline.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Ganhas: ${ganhas.length} | Perdidas: ${perdidas.length} | Taxa de conversão: ${taxaConversao}%

Oportunidades por etapa:
${['prospeccao', 'qualificado', 'proposta', 'negociacao'].map(e => {
  const ops_e = pipeline.filter(o => o.etapa === e)
  const valor_e = ops_e.reduce((s, o) => s + Number(o.valor ?? 0), 0)
  return `- ${e}: ${ops_e.length} oportunidades (R$ ${valor_e.toLocaleString('pt-BR')})`
}).join('\n')}

Oportunidades críticas (maiores valores):
${pipeline.sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0)).slice(0, 3).map(o =>
  `- "${o.titulo}" | R$ ${Number(o.valor ?? 0).toLocaleString('pt-BR')} | ${o.etapa} | ${o.probabilidade}% prob${o.data_fechamento ? ` | fecha ${o.data_fechamento}` : ''}`
).join('\n')}

Atividades últimos 30 dias: ${atvs.length} (${atvs.filter(a => a.status === 'realizada').length} realizadas, ${atvs.filter(a => a.status === 'pendente').length} pendentes)

Clientes: ${clientes.length} total | ${clientes.filter(c => c.status === 'ativo').length} ativos | ${clientes.filter(c => c.status === 'prospect').length} prospects

Forneça uma análise executiva em português com:
1. **Situação do Pipeline** — diagnóstico rápido (2-3 frases)
2. **Ações Prioritárias** — 3 ações concretas numeradas para aumentar conversão
3. **Riscos** — 1-2 alertas sobre oportunidades em risco
4. **Previsão** — estimativa de receita que pode ser fechada em 30 dias

Seja direto, use dados reais, máximo 250 palavras. Não mencione "Claude" — você é FactorOne IA.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return NextResponse.json({ insight: text, pipeline: { total: totalPipeline, abertas: pipeline.length, taxaConversao } })
}

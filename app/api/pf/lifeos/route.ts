import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

function autenticar(req: NextRequest): boolean {
  const secret = process.env.LIFEOS_WEBHOOK_SECRET
  if (!secret) return true
  return req.headers.get('x-lifeos-secret') === secret
}

export async function POST(req: NextRequest) {
  try {
    if (!autenticar(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json() as { mensagem?: string; user_id?: string; whatsapp?: string; origem?: string }
    const mensagem = (body.mensagem || '').trim()
    if (!mensagem) return NextResponse.json({ error: 'mensagem obrigatória' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Resolver user_id por whatsapp ou direto
    let userId = body.user_id || ''
    if (!userId && body.whatsapp) {
      const { data: u } = await supabase.from('perfil_usuario').select('user_id').eq('whatsapp', body.whatsapp).maybeSingle()
      userId = (u?.user_id as string) || ''
    }

    const agora = new Date()
    const ini = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
    const mesAtual = agora.toISOString().slice(0, 7)

    const queries = userId ? await Promise.all([
      supabase.from('perfil_usuario').select('nome_completo,renda_mensal').eq('user_id', userId).maybeSingle(),
      supabase.from('despesas_pessoais').select('categoria,valor').eq('user_id', userId).gte('data_despesa', ini),
      supabase.from('assinaturas_pessoais').select('nome,valor,ativa').eq('user_id', userId),
      supabase.from('metas_financeiras_pf').select('nome,valor_meta,valor_atual').eq('user_id', userId),
      supabase.from('investimentos_pf').select('tipo,valor_atual').eq('user_id', userId),
      supabase.from('orcamento_pessoal').select('categoria,limite').eq('user_id', userId).eq('mes', mesAtual),
    ]) : Array(6).fill({ data: null })

    const totalGastos = (queries[1].data ?? []).reduce((s: number, g: { valor: number }) => s + Number(g.valor), 0)
    const renda = Number(queries[0].data?.renda_mensal ?? 0)
    const totalAssinaturas = (queries[2].data ?? []).filter((a: { ativa: boolean }) => a.ativa).reduce((s: number, a: { valor: number }) => s + Number(a.valor), 0)
    const totalInvestido = (queries[4].data ?? []).reduce((s: number, i: { valor_atual: number }) => s + Number(i.valor_atual), 0)

    const contexto = {
      nome: queries[0].data?.nome_completo ?? 'usuário',
      renda_mensal: renda,
      gastos_mes: totalGastos,
      saldo: renda - totalGastos,
      assinaturas_mensais: totalAssinaturas,
      patrimonio_investido: totalInvestido,
      metas: (queries[3].data ?? []).map((m: { nome: string; valor_atual: number; valor_meta: number }) => ({ nome: m.nome, progresso: `${((m.valor_atual / m.valor_meta) * 100).toFixed(0)}%` })),
      data: agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Você é o FactorOne IA, assistente financeiro pessoal enviando resposta via WhatsApp.
Responda em português brasileiro. Seja direto e conciso (máximo 3 parágrafos curtos).
Use os dados reais do usuário. Sem markdown pesado — texto simples com *negrito* no máximo.
Se os dados estiverem vazios, oriente a registrar no FactorOne.

DADOS FINANCEIROS:
${JSON.stringify(contexto, null, 2)}`,
      messages: [{ role: 'user', content: mensagem }],
    })

    const resposta = response.content[0].type === 'text' ? response.content[0].text : 'Não consegui processar.'

    if (userId) {
      await supabase.from('lifeos_interacoes_pf').insert({ user_id: userId, origem: body.origem || 'whatsapp', mensagem_usuario: mensagem, resposta_ia: resposta }).then(() => {})
    }

    return NextResponse.json({ resposta, timestamp: agora.toISOString() })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', servico: 'FactorOne LifeOS PF Webhook' })
}

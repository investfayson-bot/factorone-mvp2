import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// Autenticacao simples por secret header (configurar LIFEOS_WEBHOOK_SECRET no env)
function autenticar(req: NextRequest): boolean {
  const secret = process.env.LIFEOS_WEBHOOK_SECRET
  if (!secret) return true // sem secret = aberto (apenas dev)
  return req.headers.get('x-lifeos-secret') === secret
}

export async function POST(req: NextRequest) {
  try {
    if (!autenticar(req)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await req.json() as {
      mensagem?: string
      user_id?: string        // auth user UUID (opcional)
      empresa_id?: string     // empresa UUID (opcional, alternativa ao user_id)
      origem?: string         // 'whatsapp' | 'zapier' | 'n8n' | 'api'
    }

    const mensagem = (body.mensagem || '').trim()
    if (!mensagem) return NextResponse.json({ error: 'mensagem obrigatoria' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Resolver empresa
    let empresaId = body.empresa_id || ''
    if (!empresaId && body.user_id) {
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', body.user_id).maybeSingle()
      empresaId = (u?.empresa_id as string) || body.user_id
    }

    // Buscar contexto financeiro real
    const agora = new Date()
    const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
    const doze = new Date(agora); doze.setMonth(doze.getMonth() - 12)

    const queries = empresaId ? await Promise.all([
      supabase.from('transacoes').select('tipo,valor,categoria,data,descricao').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(30),
      supabase.from('despesas').select('descricao,valor,status,categoria').eq('empresa_id', empresaId).in('status', ['pendente_aprovacao', 'aprovado']).limit(10),
      supabase.from('contas_bancarias').select('banco,saldo_disponivel').eq('empresa_id', empresaId).limit(3),
      supabase.from('metricas_financeiras').select('competencia,receita_bruta,lucro_liquido,ebitda').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(3),
    ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

    const contexto = {
      transacoes_recentes: queries[0].data ?? [],
      despesas_pendentes:  queries[1].data ?? [],
      saldos:              queries[2].data ?? [],
      dre_recente:         queries[3].data ?? [],
      data_consulta:       agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Voce e o FactorOne IA, assistente financeiro de PMEs brasileiras.
Responda em portugues brasileiro, de forma direta e pratica, como um CFO pessoal.
Seja conciso (maximo 3 paragrafos). Use numeros reais dos dados quando disponivel.
Nao use markdown pesado — apenas texto simples com no maximo um ou dois destaques em negrito.
Se os dados estiverem vazios, oriente o usuario a registrar transacoes no FactorOne.

DADOS FINANCEIROS DA EMPRESA:
${JSON.stringify(contexto, null, 2)}`,
      messages: [{ role: 'user', content: mensagem }],
    })

    const resposta = response.content[0].type === 'text' ? response.content[0].text : 'Nao consegui processar sua mensagem.'

    // Gravar log da interacao (se empresa identificada)
    if (empresaId) {
      await supabase.from('lifeos_interacoes').insert({
        empresa_id: empresaId,
        origem: body.origem || 'api',
        mensagem_usuario: mensagem,
        resposta_ia: resposta,
      }).then(() => {}) // nao bloqueia retorno se tabela nao existir
    }

    return NextResponse.json({
      resposta,
      origem: body.origem || 'api',
      timestamp: agora.toISOString(),
    })
  } catch (e: unknown) {
    console.error('LifeOS webhook error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

// GET para health check / teste via browser
export async function GET() {
  return NextResponse.json({ status: 'ok', servico: 'FactorOne LifeOS Webhook' })
}

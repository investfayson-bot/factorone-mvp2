import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  try {
    const { mensagem, user_id, historico = [] } = await req.json() as {
      mensagem: string
      user_id: string
      historico: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!mensagem || !user_id) return NextResponse.json({ error: 'mensagem e user_id obrigatórios' }, { status: 400 })

    const supabase = db()
    const agora = new Date()
    const ini = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
    const mesAtual = agora.toISOString().slice(0, 7)

    const [perfil, gastos, receitas, assinaturas, metas, orcamento] = await Promise.all([
      supabase.from('perfil_usuario').select('nome_completo,renda_mensal').eq('user_id', user_id).maybeSingle(),
      supabase.from('despesas_pessoais').select('descricao,valor,categoria,data_despesa,status,parcela_atual,total_parcelas').eq('user_id', user_id).gte('data_despesa', ini).order('data_despesa', { ascending: false }),
      supabase.from('receitas_pessoais').select('descricao,valor,categoria').eq('user_id', user_id).gte('data_recebimento', ini),
      supabase.from('assinaturas_pessoais').select('nome,valor,ativa,categoria').eq('user_id', user_id),
      supabase.from('metas_financeiras_pf').select('nome,valor_meta,valor_atual,prazo,icone').eq('user_id', user_id),
      supabase.from('orcamento_pessoal').select('categoria,limite').eq('user_id', user_id).eq('mes', mesAtual),
    ])

    const totalGastos = (gastos.data ?? []).reduce((s, g) => s + Number(g.valor), 0)
    const totalReceitas = (receitas.data ?? []).reduce((s, r) => s + Number(r.valor), 0)
    const renda = Number(perfil.data?.renda_mensal ?? 0) || totalReceitas
    const totalAssinaturas = (assinaturas.data ?? []).filter(a => a.ativa).reduce((s, a) => s + Number(a.valor), 0)

    // Gastos por categoria
    const catMap = new Map<string, number>()
    for (const g of gastos.data ?? []) catMap.set(g.categoria, (catMap.get(g.categoria) ?? 0) + Number(g.valor))

    // Alertas orçamento
    const alertasOrc: string[] = []
    for (const o of orcamento.data ?? []) {
      const gasto = catMap.get(o.categoria) ?? 0
      const pct = o.limite > 0 ? (gasto / o.limite) * 100 : 0
      if (pct > 100) alertasOrc.push(`${o.categoria}: EXTRAPOLADO (${formatBRL(gasto)} de ${formatBRL(o.limite)})`)
      else if (pct > 80) alertasOrc.push(`${o.categoria}: ${pct.toFixed(0)}% do limite`)
    }

    const contexto = {
      nome: perfil.data?.nome_completo ?? 'usuário',
      renda_mensal: renda,
      total_gastos_mes: totalGastos,
      saldo_disponivel: renda - totalGastos,
      pct_gasto: renda > 0 ? ((totalGastos / renda) * 100).toFixed(1) + '%' : 'renda não configurada',
      top_categorias: Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, val]) => ({ categoria: cat, valor: val })),
      assinaturas_ativas: (assinaturas.data ?? []).filter(a => a.ativa).map(a => ({ nome: a.nome, valor: a.valor })),
      total_assinaturas_mensais: totalAssinaturas,
      metas: (metas.data ?? []).map(m => ({ nome: m.nome, progresso: `${m.valor_atual}/${m.valor_meta}`, prazo: m.prazo })),
      alertas_orcamento: alertasOrc,
      data: agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...historico.slice(-8),
      { role: 'user', content: mensagem },
    ]

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `Você é o AI CFO Pessoal do FactorOne, assistente financeiro pessoal para pessoas físicas brasileiras.
Seu tom é amigável, direto e prático — como um amigo que entende de finanças.
Responda em português brasileiro. Máximo 4 parágrafos curtos.
Use os dados financeiros reais do usuário para dar conselhos específicos.
Não invente dados. Se algo não estiver disponível, peça ao usuário para registrar.
Nunca mencione "Claude" — você é FactorOne IA.

SITUAÇÃO FINANCEIRA ATUAL:
${JSON.stringify(contexto, null, 2)}`,
      messages,
    })

    const resposta = response.content[0].type === 'text' ? response.content[0].text : 'Não consegui processar sua mensagem.'

    // Log da interação
    await supabase.from('lifeos_interacoes_pf').insert({ user_id, origem: 'web', mensagem_usuario: mensagem, resposta_ia: resposta }).then(() => {})

    return NextResponse.json({ resposta })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

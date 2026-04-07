import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 500 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { texto } = await req.json()
    if (!texto) {
      return NextResponse.json({ error: 'Texto da nota não enviado' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: 'Você é um especialista em notas fiscais brasileiras. Extraia apenas os dados estruturados solicitados e responda somente JSON válido.',
      messages: [{
        role: 'user',
        content: `Extraia e retorne JSON com: numero, emitente_cnpj, emitente_nome, data_emissao, valor_total, impostos{icms,pis,cofins}, itens[], classificacao, adequado_para_factoring, motivo_factoring.\n\nDocumento:\n${texto}`
      }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(raw)

    const payload = {
      empresa_id: user.id,
      numero: parsed.numero || null,
      emitente_cnpj: parsed.emitente_cnpj || null,
      emitente_nome: parsed.emitente_nome || null,
      data_emissao: parsed.data_emissao || null,
      valor_total: parsed.valor_total || 0,
      impostos: parsed.impostos || {},
      itens: parsed.itens || [],
      classificacao: parsed.classificacao || null,
      adequado_para_factoring: Boolean(parsed.adequado_para_factoring),
      dados_completos: parsed,
      status: 'pendente'
    }

    const { data, error } = await supabase
      .from('notas_fiscais')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ nota: data })
  } catch (error: any) {
    console.error('Erro API nota-fiscal:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

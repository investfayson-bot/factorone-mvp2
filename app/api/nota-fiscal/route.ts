import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { texto } = await req.json()
    if (!texto) return NextResponse.json({ error: 'Texto da nota não enviado' }, { status: 400 })

    const response = await openrouter.chat.completions.create({
      model: 'anthropic/claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'system',
        content: 'Você é um especialista em notas fiscais brasileiras. Extraia apenas os dados estruturados solicitados e responda somente JSON válido.'
      }, {
        role: 'user',
        content: `Extraia e retorne JSON com: numero, emitente_cnpj, emitente_nome, data_emissao, valor_total, impostos{icms,pis,cofins}, itens[], classificacao, adequado_para_factoring, motivo_factoring.\n\nDocumento:\n${texto}`
      }]
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)

    const payload = {
      empresa_id: empresaId,
      numero: parsed.numero || null,
      emitente_cnpj: parsed.emitente_cnpj || null,
      emitente_nome: parsed.emitente_nome || null,
      data_emissao: parsed.data_emissao || null,
      valor_total: parsed.valor_total || 0,
      impostos: parsed.impostos || {},
      itens: parsed.itens || [],
      classificacao: parsed.classificacao || null,
      adequado_para_factoring: Boolean(parsed.adequado_para_factoring),
      motivo_factoring: parsed.motivo_factoring || null,
      dados_completos: parsed,
      status: 'pendente'
    }

    const { data, error } = await supabase.from('notas_fiscais').insert(payload).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ nota: data })
  } catch (error: unknown) {
    console.error('Erro API nota-fiscal:', error)
    return NextResponse.json({ error: erroDesconhecido(error) || 'Erro interno' }, { status: 500 })
  }
}

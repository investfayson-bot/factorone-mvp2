import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { garantirCardPipeline, type TemperaturaLead } from '@/lib/crm/pipeline-auto'

export const runtime = 'nodejs'

type LeadOrigemWebhook = 'telegram' | 'whatsapp' | 'email' | 'formulario' | 'conversa' | 'site'

interface WebhookPayload {
  origem: LeadOrigemWebhook
  titulo: string
  contato?: string
  email?: string
  telefone?: string
  mensagem?: string
  empresa_id?: string
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as WebhookPayload
  const titulo = String(body.titulo ?? '').trim()
  if (!titulo) return NextResponse.json({ error: 'Título do lead obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    // Auto-qualificação: detecta temperatura baseada na origem + contexto
    const temperatura = detectarTemperatura(body)
    const etapaSugerida = body.mensagem?.toLowerCase().includes('comprar') || body.mensagem?.toLowerCase().includes('orçamento') ? 'qualificado' : 'prospeccao'

    const r = await garantirCardPipeline(supabase, {
      empresaId,
      titulo,
      contato: body.contato?.trim() || null,
      temperatura,
      etapaSugerida,
      origem: 'ia',
      detalheOrigem: `Auto-qualificado via webhook ${body.origem}${body.email ? ` (${body.email})` : ''}`,
    })

    // Registra evento de webhook
    if (r.criado) {
      await supabase.from('crm_negociacao_eventos').insert({
        empresa_id: empresaId,
        oportunidade_id: r.id,
        origem: body.origem,
        titulo: `Lead criado automaticamente via ${body.origem}`,
        detalhe: body.mensagem?.slice(0, 200) || 'Sem detalhes adicionais',
      })

      // Se tem email, armazena pra rastreamento
      if (body.email) {
        await supabase.from('crm_oportunidades').update({ email_contato: body.email }).eq('id', r.id).catch(() => null)
      }
    }

    return NextResponse.json({ ok: true, oportunidade_id: r.id, criado: r.criado, temperatura })
  } catch (e) {
    console.error('Webhook lead error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao processar lead' }, { status: 500 })
  }
}

function detectarTemperatura(payload: WebhookPayload): TemperaturaLead {
  const msg = (payload.mensagem || '').toLowerCase()
  const palavrasQuentes = ['comprar', 'orçamento', 'proposta', 'preço', 'quando', 'quanto custa', 'disponível', 'contrato']
  const palavrasFrias = ['info', 'informações', 'dúvida', 'curiosidade', 'não', 'depois', 'talvez']

  if (palavrasQuentes.some(p => msg.includes(p))) return 'quente'
  if (palavrasFrias.some(p => msg.includes(p))) return 'frio'
  if (payload.origem === 'conversa') return 'morno'
  return 'frio'
}

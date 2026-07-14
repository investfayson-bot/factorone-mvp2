import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { garantirCardPipeline } from '@/lib/crm/pipeline-auto'

export const runtime = 'nodejs'

interface EmailPayload {
  de: string
  nome_remetente?: string
  assunto: string
  corpo?: string
  timestamp?: string
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as EmailPayload
  const { de, nome_remetente, assunto, corpo } = body

  if (!de || !assunto) {
    return NextResponse.json({ error: 'De e Assunto obrigatórios' }, { status: 400 })
  }

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    // Normaliza email (remove <> se houver)
    const emailNorm = de.replace(/[<>]/g, '').toLowerCase()

    // Detecta intenção de compra no assunto/corpo
    const todasMensagens = `${assunto} ${corpo || ''}`.toLowerCase()
    const palavrasCompra = ['comprar', 'orçamento', 'proposta', 'preço', 'valor', 'contratação', 'serviço', 'produto', 'quando', 'disponível', 'interesse']
    const temIntencao = palavrasCompra.some(p => todasMensagens.includes(p))

    // Temperatura baseada em intenção
    const temperatura = temIntencao ? 'quente' : 'morno'
    const etapaSugerida = temIntencao ? 'qualificado' : 'prospeccao'

    // Cria card no pipeline
    const r = await garantirCardPipeline(supabase, {
      empresaId,
      titulo: assunto || `Email de ${nome_remetente || de}`,
      contato: nome_remetente || de.split('@')[0],
      temperatura,
      etapaSugerida,
      origem: 'ia',
      detalheOrigem: `Auto-qualificado de email: ${emailNorm}`,
    })

    // Registra email original no histórico
    await supabase.from('crm_negociacao_eventos').insert({
      empresa_id: empresaId,
      oportunidade_id: r.id,
      origem: 'email',
      titulo: `Email recebido: ${assunto}`,
      detalhe: corpo?.slice(0, 500) || 'Sem corpo',
    })

    // Salva contato de email
    if (r.criado) {
      await supabase
        .from('crm_oportunidades')
        .update({ email_contato: emailNorm })
        .eq('id', r.id)
    }

    // Cria nota interna com full email
    await supabase.from('crm_negociacao_eventos').insert({
      empresa_id: empresaId,
      oportunidade_id: r.id,
      origem: 'sistema',
      titulo: 'Email Original Capturado',
      detalhe: `De: ${de}\nAssunto: ${assunto}\n\n${corpo || '(sem corpo)'}`,
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      oportunidade_id: r.id,
      criado: r.criado,
      temperatura,
      intenção_compra: temIntencao,
    })
  } catch (e) {
    console.error('Email webhook error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao processar email' }, { status: 500 })
  }
}

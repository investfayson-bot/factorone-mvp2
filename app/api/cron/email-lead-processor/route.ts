import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { garantirCardPipeline } from '@/lib/crm/pipeline-auto'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // TODO: Integrar com Gmail API ou Resend webhook
    // Por enquanto, processa emails armazenados na tabela crm_emails
    // (placeholder pra quando Gmail/Outlook/Resend webhook estiver conectado)

    const { data: emails } = await supabaseAdmin
      .from('crm_emails')
      .select('*')
      .eq('processado', false)
      .limit(20)

    let processados = 0
    let erros = 0

    if (emails && emails.length > 0) {
      for (const email of emails) {
        try {
          const todasMensagens = `${email.assunto} ${email.corpo || ''}`.toLowerCase()
          const palavrasCompra = ['comprar', 'orçamento', 'proposta', 'preço', 'quando', 'disponível', 'interesse']
          const temIntencao = palavrasCompra.some(p => todasMensagens.includes(p))

          await garantirCardPipeline(supabaseAdmin, {
            empresaId: email.empresa_id,
            titulo: email.assunto || `Email de ${email.nome_remetente}`,
            contato: email.nome_remetente || email.de.split('@')[0],
            temperatura: temIntencao ? 'quente' : 'morno',
            etapaSugerida: temIntencao ? 'qualificado' : 'prospeccao',
            origem: 'ia',
            detalheOrigem: `Email processado: ${email.de}`,
          })

          await supabaseAdmin
            .from('crm_emails')
            .update({ processado: true, processado_em: new Date().toISOString() })
            .eq('id', email.id)

          processados++
        } catch (e) {
          console.error('Email processing error:', e)
          erros++
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processados,
      erros,
      total_na_fila: emails?.length || 0,
    })
  } catch (e) {
    console.error('Cron email error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro no cron' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = (await req.json()) as { nota_emitida_id?: string; email?: string }
    const emailPara = (body.email || '').trim()
    if (!body.nota_emitida_id || !emailPara) {
      return NextResponse.json({ error: 'nota_emitida_id e email obrigatórios' }, { status: 400 })
    }

    const { data: nota, error } = await supabase
      .from('notas_emitidas')
      .select('*')
      .eq('id', body.nota_emitida_id)
      .eq('empresa_id', user.id)
      .single()

    if (error || !nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

    const pdfUrl = nota.pdf_url as string | null
    if (!pdfUrl) return NextResponse.json({ error: 'PDF ainda não disponível' }, { status: 400 })

    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) return NextResponse.json({ error: 'Não foi possível baixar o PDF' }, { status: 502 })
    const buf = Buffer.from(await pdfRes.arrayBuffer())

    const tipoLabel = nota.tipo === 'nfe' ? 'NF-e' : 'NFS-e'
    const num = nota.numero || '—'
    const assunto = `Nota Fiscal ${tipoLabel} nº ${num} — FactorOne`

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px;">
    <strong style="font-size: 20px; color: #1e293b;">FactorOne</strong>
    <div style="color: #64748b; font-size: 13px;">Financial OS para PMEs</div>
  </div>
  <p>Olá,</p>
  <p>Segue em anexo a <strong>${tipoLabel}</strong> número <strong>${num}</strong> emitida para <strong>${nota.destinatario_nome}</strong>.</p>
  <p style="color: #64748b; font-size: 13px;">Este é um envio automático do FactorOne.</p>
</body>
</html>`

    const resend = new Resend(apiKey)
    const from = process.env.RESEND_FROM || 'FactorOne <onboarding@resend.dev>'

    const { data: sent, error: sendErr } = await resend.emails.send({
      from,
      to: emailPara,
      subject: assunto,
      html,
      attachments: [
        {
          filename: `nota-${nota.id}.pdf`,
          content: buf,
        },
      ],
    })

    await supabase.from('notas_email_envios').insert({
      empresa_id: user.id,
      nota_emitida_id: nota.id,
      email_para: emailPara,
      status: sendErr ? 'erro' : 'enviado',
      resend_id: sent?.id ?? null,
      erro: sendErr?.message ?? null,
    })

    if (sendErr) {
      return NextResponse.json({ error: sendErr.message }, { status: 502 })
    }

    return NextResponse.json({ success: true, id: sent?.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

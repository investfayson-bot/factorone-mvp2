import { NextRequest, NextResponse } from 'next/server'
import { authorizationHeader, getNfeioApiKey, getNfeioCompanyId, getNfeioServiceBaseUrl, getNfeioProductBaseUrl } from '@/lib/nfeio'
import { getSupabaseUser } from '@/lib/supabase-route'
import { estornarReceitaNota } from '@/lib/notas-financeiras'
import { erroDesconhecido } from '@/lib/transacao-types'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = (await req.json()) as { justificativa?: string }
    const j = (body.justificativa || '').trim()
    if (j.length < 15) {
      return NextResponse.json({ error: 'Justificativa deve ter no mínimo 15 caracteres' }, { status: 400 })
    }

    if (!getNfeioApiKey()) {
      return NextResponse.json({ error: 'NFe.io não configurado' }, { status: 500 })
    }
    const companyId = getNfeioCompanyId()
    if (!companyId) return NextResponse.json({ error: 'NFEIO_COMPANY_ID ausente' }, { status: 500 })

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: nota, error } = await supabase
      .from('notas_emitidas')
      .select('id, tipo, nfeio_id, status, transacao_id, created_at')
      .eq('id', id)
      .eq('empresa_id', user.id)
      .single()

    if (error || !nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
    if (nota.status === 'cancelada') {
      return NextResponse.json({ error: 'Nota já cancelada' }, { status: 400 })
    }

    const created = new Date(nota.created_at as string).getTime()
    if (Date.now() - created > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Prazo de cancelamento (24h) expirado' }, { status: 400 })
    }

    const base = nota.tipo === 'nfe' ? getNfeioProductBaseUrl() : getNfeioServiceBaseUrl()
    const path =
      nota.tipo === 'nfe'
        ? `/v2/companies/${companyId}/productinvoices/${nota.nfeio_id}/cancel`
        : `/v2/companies/${companyId}/serviceinvoices/${nota.nfeio_id}/cancel`

    const nfeRes = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authorizationHeader(),
      },
      body: JSON.stringify({ reason: j }),
    })

    if (!nfeRes.ok) {
      const errBody = await nfeRes.json().catch(() => ({}))
      return NextResponse.json({ error: 'Falha ao cancelar na NFe.io', details: errBody }, { status: 502 })
    }

    await estornarReceitaNota(supabase, nota.transacao_id as string | null)

    await supabase
      .from('notas_emitidas')
      .update({
        status: 'cancelada',
        cancelada_em: new Date().toISOString(),
        cancelada_motivo: j,
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

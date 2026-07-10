import { NextRequest, NextResponse } from 'next/server'
import { authorizationHeader, getNfeioApiKey, getNfeioCompanyId, getNfeioServiceBaseUrl, getNfeioProductBaseUrl } from '@/lib/nfeio'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!getNfeioApiKey()) {
      return NextResponse.json({ error: 'NFe.io não configurado' }, { status: 500 })
    }
    const companyId = getNfeioCompanyId()
    if (!companyId) return NextResponse.json({ error: 'NFEIO_COMPANY_ID ausente' }, { status: 500 })

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { data: nota, error } = await supabase
      .from('notas_emitidas')
      .select('id, tipo, nfeio_id, status')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

    const base = nota.tipo === 'nfe' ? getNfeioProductBaseUrl() : getNfeioServiceBaseUrl()
    const path =
      nota.tipo === 'nfe'
        ? `/v2/companies/${companyId}/productinvoices/${nota.nfeio_id}`
        : `/v2/companies/${companyId}/serviceinvoices/${nota.nfeio_id}`

    const res = await fetch(`${base}${path}`, {
      headers: { ...authorizationHeader() },
    })
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const inv = (raw.productInvoice || raw.serviceInvoice || raw.data || raw) as Record<string, unknown>
    const st = String(inv?.status ?? 'processando').toLowerCase()
    const statusLabel =
      st.includes('authorized') || st.includes('autorizada')
        ? 'Autorizada'
        : st.includes('reject') || st.includes('rejeit')
          ? 'Rejeitada'
          : st.includes('cancel')
            ? 'Cancelada'
            : 'Processando'

    return NextResponse.json({
      status: statusLabel,
      raw: inv,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

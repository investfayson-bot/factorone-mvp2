import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'
import { erroDesconhecido } from '@/lib/transacao-types'

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const body = (await req.json().catch(() => ({}))) as { empresaId?: string; competencia?: string }
    const empresaId = body.empresaId || user.id
    const competencia = body.competencia ? new Date(body.competencia) : new Date()
    await recalcularDREMes(empresaId, competencia)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

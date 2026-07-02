import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { gerarLancamentos } from '@/lib/contabilidade/motor'
import { erroDesconhecido } from '@/lib/transacao-types'

export const runtime = 'nodejs'

/** POST: gera lançamentos contábeis (partida dobrada) das despesas e notas. */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const r = await gerarLancamentos(supabase, empresaId)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

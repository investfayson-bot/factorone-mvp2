import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Grava a categoria de uma (ou várias) transações — o "Confirmar" do Classificar.
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { ids?: string[]; categorias?: Record<string, string> }
  const categorias = body.categorias ?? {}
  const ids = body.ids ?? Object.keys(categorias)
  if (ids.length === 0) return NextResponse.json({ error: 'Nada para classificar' }, { status: 400 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  for (const id of ids) {
    const cat = categorias[id]
    if (!cat) continue
    await db.from('transacoes').update({ categoria: cat }).eq('id', id).eq('empresa_id', empresaId)
  }
  return NextResponse.json({ ok: true, classificadas: ids.length })
}

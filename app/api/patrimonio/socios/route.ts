import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function empresaDe(userId: string) {
  const { data } = await db().from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  return (data?.empresa_id as string) ?? userId
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, socios: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('socios').select('*').eq('empresa_id', empresa).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ ok: false, socios: [] })
  return NextResponse.json({ ok: true, socios: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { socios?: Record<string, unknown>[] }
  const lista = body.socios ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('socios').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(s => ({ ...s, empresa_id: empresa, updated_at: new Date().toISOString() }))
    const { error } = await d.from('socios').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function empresaDe(userId: string) {
  const { data } = await db().from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  return (data?.empresa_id as string) ?? userId
}
const dataOuNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, obras: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('obras').select('*').eq('empresa_id', empresa).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ ok: false, obras: [] })
  return NextResponse.json({ ok: true, obras: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { obras?: Record<string, unknown>[] }
  const lista = body.obras ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('obras').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(o => ({ ...o, empresa_id: empresa, inicio: dataOuNull(o.inicio), previsao: dataOuNull(o.previsao), updated_at: new Date().toISOString() }))
    const { error } = await d.from('obras').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

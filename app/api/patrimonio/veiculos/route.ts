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
  if (!user) return NextResponse.json({ ok: false, veiculos: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('veiculos').select('*').eq('empresa_id', empresa).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ ok: false, veiculos: [] })
  return NextResponse.json({ ok: true, veiculos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { veiculos?: Record<string, unknown>[] }
  const lista = body.veiculos ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('veiculos').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(v => ({ ...v, empresa_id: empresa, ipva_venc: dataOuNull(v.ipva_venc), seguro_venc: dataOuNull(v.seguro_venc), updated_at: new Date().toISOString() }))
    const { error } = await d.from('veiculos').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

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

// Cada linha é um "toque" de follow-up agendado (satisfação, garantia, recompra…).
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, toques: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('followups').select('*').eq('empresa_id', empresa).order('agendado_para', { ascending: true })
  if (error) return NextResponse.json({ ok: false, toques: [] }) // tabela ausente → front usa localStorage
  return NextResponse.json({ ok: true, toques: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { toques?: Record<string, unknown>[] }
  const lista = body.toques ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('followups').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(t => ({
      id: t.id, empresa_id: empresa,
      cliente: t.cliente ?? '', contato: t.contato ?? '', canal: t.canal ?? 'whatsapp',
      tipo: t.tipo ?? 'satisfacao', mensagem: t.mensagem ?? '', status: t.status ?? 'pendente',
      valor: Number(t.valor ?? 0), agendado_para: dataOuNull(t.agendado_para),
      updated_at: new Date().toISOString(),
    }))
    const { error } = await d.from('followups').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

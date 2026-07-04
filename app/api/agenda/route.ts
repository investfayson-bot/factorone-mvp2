import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function empresaDe(userId: string) {
  const { data } = await db().from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  return (data?.empresa_id as string) ?? userId
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, config: null }, { status: 401 })
  const d = db()
  const empresa = await empresaDe(user.id)
  const { data, error } = await d.from('agenda_config').select('*').eq('empresa_id', empresa).maybeSingle()
  if (error) return NextResponse.json({ ok: false, config: null }) // tabela ainda não existe
  if (data) return NextResponse.json({ ok: true, config: data })
  const token = 'ag_' + randomUUID().replace(/-/g, '')
  const novo = { empresa_id: empresa, token, titulo: 'Reunião', duracao: 30, hora_inicio: '09:00', hora_fim: '18:00', dias: [1, 2, 3, 4, 5] }
  const { error: e2 } = await d.from('agenda_config').insert(novo)
  if (e2) return NextResponse.json({ ok: false, config: null })
  return NextResponse.json({ ok: true, config: novo })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { titulo?: string; duracao?: number; hora_inicio?: string; hora_fim?: string; dias?: number[] }
  const d = db()
  const empresa = await empresaDe(user.id)
  const { data: ex } = await d.from('agenda_config').select('token').eq('empresa_id', empresa).maybeSingle()
  const token = ex?.token ?? ('ag_' + randomUUID().replace(/-/g, ''))
  const { error } = await d.from('agenda_config').upsert({
    empresa_id: empresa, token,
    titulo: b.titulo ?? 'Reunião', duracao: b.duracao ?? 30,
    hora_inicio: b.hora_inicio ?? '09:00', hora_fim: b.hora_fim ?? '18:00',
    dias: b.dias ?? [1, 2, 3, 4, 5], updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, token })
}

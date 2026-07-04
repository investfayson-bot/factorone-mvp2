import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Retorna (ou cria) o token de captação da empresa do usuário.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const d = db()
  const { data: u } = await d.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresa = (u?.empresa_id as string) ?? user.id

  const { data: existente, error } = await d.from('inbound_tokens').select('token').eq('empresa_id', empresa).maybeSingle()
  if (error) return NextResponse.json({ ok: false, token: null }) // tabela ainda não existe
  if (existente?.token) return NextResponse.json({ ok: true, token: existente.token })

  const token = 'fo_' + randomUUID().replace(/-/g, '')
  const { error: e2 } = await d.from('inbound_tokens').insert({ empresa_id: empresa, token })
  if (e2) return NextResponse.json({ ok: false, token: null })
  return NextResponse.json({ ok: true, token })
}

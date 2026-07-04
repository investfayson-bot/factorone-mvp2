import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Webhook público de captação — o "tradutor universal".
// Qualquer ferramenta (Zapier/Make/RD/form) → POST /api/inbound?token=... com o
// lead em qualquer formato comum → normaliza pro modelo canônico (marketing_leads).
function pick(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) { const v = o[k]; if (typeof v === 'string' && v.trim()) return v.trim(); if (typeof v === 'number') return String(v) }
  return ''
}

export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || req.headers.get('x-fo-token') || ''
  if (!token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 })
  const d = db()
  const { data: row } = await d.from('inbound_tokens').select('empresa_id').eq('token', token).maybeSingle()
  if (!row?.empresa_id) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const lead = {
    empresa_id: row.empresa_id as string,
    nome: pick(body, 'nome', 'name', 'full_name', 'fullName', 'first_name') || 'Lead sem nome',
    email: pick(body, 'email', 'e-mail', 'mail'),
    telefone: pick(body, 'telefone', 'phone', 'whatsapp', 'celular', 'tel'),
    origem: pick(body, 'origem', 'source', 'utm_source', 'canal') || 'Webhook',
    notas: pick(body, 'notas', 'message', 'mensagem', 'obs') || null,
    status: 'novo',
  }
  const { error } = await d.from('marketing_leads').insert(lead)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

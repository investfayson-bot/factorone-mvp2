import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  return { user, supabase, empresaId }
}

export async function GET(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regras: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const canal = String(body.canal || '')
  const criterio = String(body.criterio || '').trim()
  if (!['email', 'site', 'telegram'].includes(canal)) return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
  if (!criterio) return NextResponse.json({ error: 'Informe ao menos uma palavra-chave' }, { status: 400 })
  const row = {
    empresa_id: empresaId,
    nome: body.nome ? String(body.nome) : null,
    canal,
    criterio,
    autonomia: body.autonomia === 'automatico' ? 'automatico' : 'rascunho',
    ativa: body.ativa !== false,
  }
  const { data, error } = await supabase.from('donna_regras').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regra: data })
}

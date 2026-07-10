import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { cifrar } from '@/lib/cofre-crypto'

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
  const { data, error } = await supabase
    .from('cofre_pessoal')
    .select('id,rotulo,nota,created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ itens: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const rotulo = String(body.rotulo || '').trim()
  const valor = String(body.valor || '')
  const nota = body.nota ? String(body.nota) : null
  if (!rotulo || !valor) return NextResponse.json({ error: 'Informe rótulo e valor' }, { status: 400 })
  const valor_cifrado = cifrar(valor)
  const { data, error } = await supabase
    .from('cofre_pessoal')
    .insert({ empresa_id: empresaId, user_id: user.id, rotulo, valor_cifrado, nota })
    .select('id,rotulo,nota,created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

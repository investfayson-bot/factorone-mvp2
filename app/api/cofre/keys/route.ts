import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { cifrar, decifrar, mascarar } from '@/lib/cofre-crypto'

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
    .from('cofre_api_keys')
    .select('provider,valor_cifrado,updated_at')
    .eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const itens = (data ?? []).map((r) => {
    let mascarado = '••••'
    try { mascarado = mascarar(decifrar(r.valor_cifrado)) } catch { /* ignore */ }
    return { provider: r.provider as string, mascarado, updated_at: r.updated_at as string }
  })
  return NextResponse.json({ itens })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const provider = String(body.provider || '').trim()
  const valor = String(body.valor || '').trim()
  if (!provider || !valor) return NextResponse.json({ error: 'Informe provider e valor' }, { status: 400 })
  const valor_cifrado = cifrar(valor)
  const { error } = await supabase
    .from('cofre_api_keys')
    .upsert({ empresa_id: empresaId, provider, valor_cifrado, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id,provider' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mascarado: mascarar(valor) })
}

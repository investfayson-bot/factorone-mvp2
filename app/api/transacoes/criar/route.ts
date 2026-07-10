import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Criar transação manual (ou vinda de foto de recibo). Entra como "a revisar" (categoria vazia).
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })

  const b = await req.json().catch(() => ({})) as { descricao?: string; valor?: number; tipo?: string; data?: string; categoria?: string }
  if (!b.descricao?.trim() || !b.valor) return NextResponse.json({ error: 'Descrição e valor obrigatórios' }, { status: 400 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { error } = await db.from('transacoes').insert({
    empresa_id: empresaId,
    descricao: b.descricao.trim(),
    tipo: b.tipo === 'entrada' ? 'entrada' : 'saida',
    valor: Math.abs(Number(b.valor)),
    categoria: b.categoria ?? '',
    status: 'pago',
    data: b.data || new Date().toISOString().slice(0, 10),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

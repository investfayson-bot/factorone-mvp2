import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Marcador para identificar linhas de demo (permite limpar só o que foi semeado).
const DEMO_TAG = '[demo]'

function d(offset: number) {
  const dt = new Date()
  dt.setDate(dt.getDate() - offset)
  return dt.toISOString().slice(0, 10)
}

// tipo 'entrada'|'saida', categoria '' = a classificar
const SEED: { descricao: string; tipo: 'entrada' | 'saida'; valor: number; categoria: string; dias: number }[] = [
  // a revisar (categoria vazia)
  { descricao: 'iFood *Comida Japonesa', tipo: 'saida', valor: 184.90, categoria: '', dias: 1 },
  { descricao: 'Posto Shell BR-101', tipo: 'saida', valor: 312.00, categoria: '', dias: 1 },
  { descricao: 'AWS EMEA SARL', tipo: 'saida', valor: 742.15, categoria: '', dias: 2 },
  { descricao: 'PIX RECEBIDO — Cliente ACME Ltda', tipo: 'entrada', valor: 12500.00, categoria: '', dias: 2 },
  { descricao: 'Meta Ads (Facebook)', tipo: 'saida', valor: 1200.00, categoria: '', dias: 3 },
  { descricao: 'Tarifa pacote mensal', tipo: 'saida', valor: 49.90, categoria: '', dias: 3 },
  { descricao: 'TED — Fornecedor Aço Forte', tipo: 'saida', valor: 3800.00, categoria: '', dias: 4 },
  { descricao: 'Uber *Trip', tipo: 'saida', valor: 37.40, categoria: '', dias: 4 },
  // já classificadas
  { descricao: 'DARF — Simples Nacional', tipo: 'saida', valor: 2140.00, categoria: 'Impostos', dias: 6 },
  { descricao: 'Aluguel Sala Comercial', tipo: 'saida', valor: 4500.00, categoria: 'Aluguel', dias: 7 },
  { descricao: 'PIX RECEBIDO — Cliente Beta SA', tipo: 'entrada', valor: 8300.00, categoria: 'Receita de vendas', dias: 8 },
  { descricao: 'Folha — Salários equipe', tipo: 'saida', valor: 18400.00, categoria: 'Salários', dias: 9 },
  { descricao: 'PIX RECEBIDO — Cliente Gamma', tipo: 'entrada', valor: 6750.00, categoria: 'Receita de vendas', dias: 10 },
]

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = await req.json().catch(() => ({})) as { action?: string }
  const action = body.action ?? 'seed'

  // Limpa sempre as linhas de demo antes (idempotente); 'clear' só limpa.
  await db.from('transacoes').delete().eq('empresa_id', empresaId).ilike('descricao', `%${DEMO_TAG}%`)
  if (action === 'clear') return NextResponse.json({ ok: true, cleared: true })

  const rows = SEED.map(s => ({
    empresa_id: empresaId,
    descricao: `${s.descricao} ${DEMO_TAG}`,
    tipo: s.tipo,
    valor: s.valor,
    categoria: s.categoria,
    status: 'pago',
    data: d(s.dias),
  }))
  const { error } = await db.from('transacoes').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inseridas: rows.length })
}

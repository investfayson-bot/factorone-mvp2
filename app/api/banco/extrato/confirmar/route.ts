import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { confirmarClassificacao } from '@/lib/financeiro/motorClassificacao'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Item = { id: string; titularidade: 'pj' | 'pf'; empresa_id: string | null; descricao: string; categoria: string }

// Confirma classificação (individual ou em lote — "Confirmar em lote" da
// Fase 3). Cada item grava/reforça a regra aprendida (Fase 0, Parte B) e
// marca status_classificacao='confirmada' na linha de origem.
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { itens?: Item[] }
  const itens = body.itens ?? []
  if (!itens.length) return NextResponse.json({ error: 'Nenhum item enviado' }, { status: 400 })

  const db = svc()
  let confirmados = 0
  for (const item of itens) {
    if (item.titularidade === 'pj' && !item.empresa_id) continue
    const tid: Parameters<typeof confirmarClassificacao>[1] = item.titularidade === 'pj' ? { empresaId: item.empresa_id as string } : { pessoaFisicaUserId: user.id }
    await confirmarClassificacao(db, tid, item.descricao, item.categoria)
    const tabela = item.titularidade === 'pj' ? 'extrato_bancario' : 'belvo_transacoes'
    await db.from(tabela).update({ categoria: item.categoria, status_classificacao: 'confirmada' }).eq('id', item.id)
    confirmados++
  }

  return NextResponse.json({ ok: true, confirmados })
}

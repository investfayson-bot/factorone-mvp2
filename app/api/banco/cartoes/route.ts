import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Cartao = { id: string; nome: string; bandeira: string; limite: number; limite_disponivel: number; cor: string; pausado: boolean; empresa_id: string; empresa_nome: string | null }
type Parcela = { id: string; estabelecimento: string; parcela_atual: number; total_parcelas: number; valor: number; empresa_id: string | null; empresa_nome: string | null; categoria: string | null; titularidade: 'pj' | 'pf' }
type GastoCategoria = { categoria: string; valor: number }

// Cartões (Fase 3) — cards visuais reaproveitados de cartoes_corporativos
// (gerenciamento/ações continuam em /dashboard/cartoes, não duplicado aqui).
// O que é novo: parcelas em aberto agregadas por empresa/segmento, a partir
// de belvo_transacoes (Open Finance) — pedido explícito do dono do produto
// ("quantas parcelas tem pra cada empresa e categoria").
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as EscopoBanco) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds, empresaNomes, incluiPf } = resolvido

  const [cartoesR, parcelasPjR, parcelasPfR] = await Promise.all([
    empresaIds.length
      ? db.from('cartoes_corporativos').select('id, nome, bandeira, limite, limite_disponivel, cor, pausado, empresa_id').in('empresa_id', empresaIds)
      : Promise.resolve({ data: [] }),
    empresaIds.length
      ? db.from('belvo_transacoes').select('id, descricao, estabelecimento, valor, categoria, parcela_atual, total_parcelas, empresa_id')
          .in('empresa_id', empresaIds).not('total_parcelas', 'is', null).gt('total_parcelas', 1)
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('belvo_transacoes').select('id, descricao, estabelecimento, valor, categoria, parcela_atual, total_parcelas')
          .eq('user_id', user.id).is('empresa_id', null).not('total_parcelas', 'is', null).gt('total_parcelas', 1)
      : Promise.resolve({ data: [] }),
  ])

  const cartoes: Cartao[] = ((cartoesR.data ?? []) as Array<{ id: string; nome: string; bandeira: string; limite: number; limite_disponivel: number; cor: string; pausado: boolean; empresa_id: string }>).map(c => ({
    ...c, empresa_nome: empresaNomes.get(c.empresa_id) ?? null,
  }))

  const parcelas: Parcela[] = [
    ...((parcelasPjR.data ?? []) as Array<{ id: string; descricao: string | null; estabelecimento: string | null; valor: number; categoria: string | null; parcela_atual: number; total_parcelas: number; empresa_id: string }>)
      .filter(t => t.parcela_atual < t.total_parcelas) // só parcelas ainda EM ABERTO (atual < total)
      .map(t => ({
        id: t.id, estabelecimento: t.estabelecimento || t.descricao || 'Estabelecimento', parcela_atual: t.parcela_atual, total_parcelas: t.total_parcelas,
        valor: Number(t.valor), empresa_id: t.empresa_id, empresa_nome: empresaNomes.get(t.empresa_id) ?? null, categoria: t.categoria, titularidade: 'pj' as const,
      })),
    ...((parcelasPfR.data ?? []) as Array<{ id: string; descricao: string | null; estabelecimento: string | null; valor: number; categoria: string | null; parcela_atual: number; total_parcelas: number }>)
      .filter(t => t.parcela_atual < t.total_parcelas)
      .map(t => ({
        id: t.id, estabelecimento: t.estabelecimento || t.descricao || 'Estabelecimento', parcela_atual: t.parcela_atual, total_parcelas: t.total_parcelas,
        valor: Number(t.valor), empresa_id: null, empresa_nome: null, categoria: t.categoria, titularidade: 'pf' as const,
      })),
  ]

  const gastoPorCategoriaMap = new Map<string, number>()
  for (const p of parcelas) {
    const cat = p.categoria || 'Outros'
    gastoPorCategoriaMap.set(cat, (gastoPorCategoriaMap.get(cat) ?? 0) + p.valor)
  }
  const gastoPorCategoria: GastoCategoria[] = Array.from(gastoPorCategoriaMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor)

  return NextResponse.json({ cartoes, parcelas, gasto_por_categoria: gastoPorCategoria })
}

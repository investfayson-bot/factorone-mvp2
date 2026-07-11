import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type ObrigacaoLinha = {
  id: string
  nome: string
  tipo: string | null
  competencia: string | null
  vencimento: string | null
  valor: number | null
  status: string
  empresa_id: string
  empresa_nome: string
  link_nome: string | null
  link_url: string | null
}

// Obrigações do módulo Contábil & Fiscal (Fase 5, Bloco 3), com o mesmo
// escopo Consolidado/Só empresas/PF do resto do produto — obrigação fiscal
// é sempre PJ, então 'pf' isolado não traz nada (incluiPf é ignorado de
// propósito). Cada linha já vem com o link Gov.br correspondente ao tipo,
// pra abrir a guia certa direto da lista sem o usuário precisar procurar.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as EscopoBanco) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds, empresaNomes } = resolvido

  if (empresaIds.length === 0) {
    return NextResponse.json({ obrigacoes: [] as ObrigacaoLinha[] })
  }

  const [obrigacoesR, linksR] = await Promise.all([
    db.from('tax_obrigacoes')
      .select('id, nome, tipo, competencia, vencimento, valor, status, empresa_id')
      .in('empresa_id', empresaIds)
      .order('vencimento', { ascending: true })
      .limit(200),
    db.from('links_governamentais').select('tipo_obrigacao, nome, url'),
  ])

  const linkPorTipo = new Map<string, { nome: string; url: string }>()
  for (const l of linksR.data ?? []) {
    if (!linkPorTipo.has(l.tipo_obrigacao as string)) linkPorTipo.set(l.tipo_obrigacao as string, { nome: l.nome as string, url: l.url as string })
  }
  const linkOutro = linkPorTipo.get('Outro') ?? null

  const obrigacoes: ObrigacaoLinha[] = (obrigacoesR.data ?? []).map(o => {
    const link = (o.tipo && linkPorTipo.get(o.tipo as string)) || linkOutro
    return {
      id: o.id as string,
      nome: o.nome as string,
      tipo: o.tipo as string | null,
      competencia: o.competencia as string | null,
      vencimento: o.vencimento as string | null,
      valor: o.valor as number | null,
      status: o.status as string,
      empresa_id: o.empresa_id as string,
      empresa_nome: empresaNomes.get(o.empresa_id as string) ?? 'Empresa',
      link_nome: link?.nome ?? null,
      link_url: link?.url ?? null,
    }
  })

  return NextResponse.json({ obrigacoes })
}

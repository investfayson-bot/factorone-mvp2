import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, empresaPertenceAoUsuario, getPapelParaEmpresa, papelPodeEscrever } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const REGIMES = new Set(['simples', 'presumido', 'real'])

// Lista as empresas no escopo (Consolidado/Só empresas), com cnpj/cidade/uf/
// regime — pro card "Onde cada CNPJ está cadastrado" em Impostos & Regime.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as EscopoBanco) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds } = resolvido
  if (empresaIds.length === 0) return NextResponse.json({ empresas: [] })

  const { data } = await db.from('empresas').select('id, nome, cnpj, cidade, uf, regime_tributario').in('id', empresaIds)
  return NextResponse.json({ empresas: data ?? [] })
}

// Editar cidade/UF/regime tributário de uma empresa — usado pelo card
// "Onde cada CNPJ está cadastrado". `empresaId` no body é opcional (cai pra
// empresa ativa do login); quando informado (edição de outra empresa do
// mesmo grupo/Holding a partir da visão consolidada), valida ownership
// antes de gravar — mesmo padrão do fix de Obrigações (Bloco 3).
//
// A RLS de `empresas` (empresa_acesso, FOR ALL) permite escrita direta a
// qualquer membro do tenant sem checar papel — lacuna pré-existente que
// /api/fiscal/registrar-das já contorna com gate na rota; seguindo o mesmo
// padrão aqui em vez de confiar só na RLS.
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { cidade?: string; uf?: string; regimeTributario?: string; empresaId?: string }
  const patch: Record<string, string | null> = {}
  if (body.cidade !== undefined) patch.cidade = String(body.cidade).trim().slice(0, 120) || null
  if (body.uf !== undefined) {
    const uf = String(body.uf).trim().toUpperCase()
    if (uf && !/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ error: 'UF inválida' }, { status: 400 })
    patch.uf = uf || null
  }
  if (body.regimeTributario !== undefined) {
    const regime = String(body.regimeTributario).trim()
    if (regime && !REGIMES.has(regime)) return NextResponse.json({ error: 'Regime inválido' }, { status: 400 })
    patch.regime_tributario = regime || null
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

  const empresaIdBody = String(body.empresaId ?? '').trim()
  let empresaId: string
  if (empresaIdBody) {
    const pertence = await empresaPertenceAoUsuario(supabase, user.id, empresaIdBody)
    if (!pertence) return NextResponse.json({ error: 'Empresa fora do seu acesso' }, { status: 403 })
    empresaId = empresaIdBody
  } else {
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    empresaId = (u?.empresa_id as string) ?? user.id
  }

  const papel = await getPapelParaEmpresa(supabase, user.id, empresaId)
  if (!papelPodeEscrever(papel)) return NextResponse.json({ error: `Papel ${papel} tem acesso somente-leitura.` }, { status: 403 })

  const service = svc()
  const { error } = await service.from('empresas').update(patch).eq('id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Lista os membros do grupo (empresas + PF, se houver) com saldo individual —
// alimenta o dropdown do seletor Holding/PJ/PF e a lista "Empresas do Grupo".
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: grupoId } = await params
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = svc()
  const { data: grupo } = await db.from('grupos_empresariais').select('id, nome').eq('id', grupoId).eq('owner_user_id', user.id).maybeSingle()
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const { data: membros } = await db.from('grupo_membros').select('id, empresa_id, pessoa_fisica_user_id').eq('grupo_id', grupoId)

  const empresaIds = (membros ?? []).map(m => m.empresa_id).filter((v): v is string => !!v)
  const temPf = (membros ?? []).some(m => m.pessoa_fisica_user_id)

  const { data: empresas } = empresaIds.length
    ? await db.from('empresas').select('id, nome, cnpj').in('id', empresaIds)
    : { data: [] }
  const { data: contas } = empresaIds.length
    ? await db.from('contas_bancarias').select('empresa_id, saldo').in('empresa_id', empresaIds).eq('status', 'ativa')
    : { data: [] }

  const saldoPorEmpresa = new Map<string, number>()
  for (const c of contas ?? []) {
    const eid = c.empresa_id as string
    saldoPorEmpresa.set(eid, (saldoPorEmpresa.get(eid) ?? 0) + Number(c.saldo || 0))
  }

  const listaEmpresas = (empresas ?? []).map(e => ({
    tipo: 'empresa' as const,
    id: e.id as string,
    nome: e.nome as string,
    cnpj: e.cnpj as string | null,
    saldo: saldoPorEmpresa.get(e.id as string) ?? 0,
  }))

  let pf: { tipo: 'pf'; id: string; nome: string; saldo: number } | null = null
  if (temPf) {
    // Saldo PF vem das contas Open Finance ligadas ao usuário (sem empresa_id) —
    // mesma tabela que o Banco PF já usa, não existe uma "contas_bancarias" pessoal separada.
    const { data: contasPf } = await db.from('belvo_contas').select('saldo').eq('user_id', user.id).is('empresa_id', null)
    const saldoPf = (contasPf ?? []).reduce((s, c) => s + Number(c.saldo || 0), 0)
    pf = { tipo: 'pf', id: user.id, nome: 'Pessoa física', saldo: saldoPf }
  }

  return NextResponse.json({ grupo, empresas: listaEmpresas, pf })
}

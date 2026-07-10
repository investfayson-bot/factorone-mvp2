import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Escopo = 'consolidado' | 'empresas' | 'pf'

// Resumo consolidado do grupo (Fase 0, Parte A) — soma caixa, receita e
// lucro do mês de todas as empresas do grupo e, se o escopo pedir, da PF do
// dono também. É o dado que alimenta o seletor Holding/PJ/PF no topbar
// (Fase 1 em diante) — aqui só a fundação de backend.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: grupoId } = await params
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const escopo = (new URL(req.url).searchParams.get('escopo') as Escopo) || 'consolidado'

  const db = svc()
  const { data: grupo } = await db.from('grupos_empresariais').select('id, nome').eq('id', grupoId).eq('owner_user_id', user.id).maybeSingle()
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const { data: membros } = await db.from('grupo_membros').select('empresa_id, pessoa_fisica_user_id').eq('grupo_id', grupoId)
  const empresaIds = (membros ?? []).map(m => m.empresa_id).filter((v): v is string => !!v)
  const incluiPf = escopo !== 'empresas' && (membros ?? []).some(m => m.pessoa_fisica_user_id)
  const incluiEmpresas = escopo !== 'pf' && empresaIds.length > 0

  const hoje = new Date()
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)

  let caixaConsolidado = 0
  let receitaMes = 0
  let despesasMes = 0
  const porEmpresa: { empresa_id: string; nome: string; receita: number }[] = []

  if (incluiEmpresas) {
    const [{ data: contas }, { data: txs }, { data: empresas }] = await Promise.all([
      db.from('contas_bancarias').select('empresa_id, saldo').in('empresa_id', empresaIds).eq('status', 'ativa'),
      db.from('transacoes').select('empresa_id, tipo, valor').in('empresa_id', empresaIds).gte('data', ini).lte('data', fim),
      db.from('empresas').select('id, nome').in('id', empresaIds),
    ])

    caixaConsolidado += (contas ?? []).reduce((s, c) => s + Number(c.saldo || 0), 0)

    const receitaPorEmpresa = new Map<string, number>()
    for (const t of txs ?? []) {
      const eid = t.empresa_id as string
      const valor = Number(t.valor || 0)
      if (t.tipo === 'entrada') { receitaMes += valor; receitaPorEmpresa.set(eid, (receitaPorEmpresa.get(eid) ?? 0) + valor) }
      else despesasMes += valor
    }
    for (const e of empresas ?? []) {
      porEmpresa.push({ empresa_id: e.id as string, nome: e.nome as string, receita: receitaPorEmpresa.get(e.id as string) ?? 0 })
    }
  }

  if (incluiPf) {
    const [{ data: contasPf }, { data: despesasPf }, { data: receitasPf }] = await Promise.all([
      db.from('belvo_contas').select('saldo').eq('user_id', user.id).is('empresa_id', null),
      db.from('despesas_pessoais').select('valor').eq('user_id', user.id).gte('data_despesa', ini).lte('data_despesa', fim),
      db.from('receitas_pessoais').select('valor').eq('user_id', user.id).gte('data_recebimento', ini).lte('data_recebimento', fim),
    ])
    caixaConsolidado += (contasPf ?? []).reduce((s, c) => s + Number(c.saldo || 0), 0)
    const receitaPf = (receitasPf ?? []).reduce((s, r) => s + Number(r.valor || 0), 0)
    const despesaPf = (despesasPf ?? []).reduce((s, d) => s + Number(d.valor || 0), 0)
    receitaMes += receitaPf
    despesasMes += despesaPf
    if (receitaPf > 0) porEmpresa.push({ empresa_id: user.id, nome: 'Pessoa física', receita: receitaPf })
  }

  return NextResponse.json({
    grupo,
    escopo,
    caixa_consolidado: caixaConsolidado,
    receita_mes: receitaMes,
    despesas_mes: despesasMes,
    lucro_liquido_mes: receitaMes - despesasMes,
    receita_por_membro: porEmpresa,
    empresas_incluidas: incluiEmpresas ? empresaIds.length : 0,
    pf_incluida: incluiPf,
  })
}

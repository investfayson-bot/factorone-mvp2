import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Escopo = EscopoBanco
type ContaLinha = { id: string; nome: string; instituicao: string; titularidade: 'pj' | 'pf'; empresa_nome: string | null; saldo: number }
type MovLinha = { id: string; descricao: string; valor: number; tipo: 'entrada' | 'saida' | 'rendimento'; titularidade: 'pj' | 'pf'; empresa_nome: string | null; data: string }

// Visão Geral do módulo Banco (Fase 3). Resolve o escopo PJ/PF pelo mesmo
// grupo/holding da Fase 0 (se o usuário tiver um) — sem grupo, cai pro
// padrão de empresa única (usuarios.empresa_id ?? auth.uid()) já usado em
// todo o resto do produto, com PF vindo das contas Open Finance pessoais
// do próprio usuário (belvo_contas.empresa_id IS NULL).
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as Escopo) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds, empresaNomes, incluiPf } = resolvido

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const inicioJanela6m = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString().slice(0, 10)

  const [contasPjR, belvoContasR, invPjR, invPfR, txPjRecenteR, txPfRecenteR, txPj6mR, txPf6mR] = await Promise.all([
    empresaIds.length
      ? db.from('contas_bancarias').select('id, banco_nome, agencia, empresa_id, saldo').in('empresa_id', empresaIds).eq('status', 'ativa')
      : Promise.resolve({ data: [] }),
    empresaIds.length || incluiPf
      ? db.from('belvo_contas').select('id, nome, instituicao, empresa_id, user_id, saldo')
          .or([empresaIds.length ? `empresa_id.in.(${empresaIds.join(',')})` : '', incluiPf ? `user_id.eq.${user.id}` : ''].filter(Boolean).join(','))
      : Promise.resolve({ data: [] }),
    empresaIds.length
      ? db.from('investimentos').select('valor_atual').in('empresa_id', empresaIds).eq('status', 'ativo')
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('investimentos_pf').select('valor_atual').eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    // Feed "recente" — só pro card de extrato recente, limite curto de propósito.
    empresaIds.length
      ? db.from('transacoes').select('id, descricao, valor, tipo, data, empresa_id').in('empresa_id', empresaIds).order('data', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('belvo_transacoes').select('id, descricao, valor, tipo, data').eq('user_id', user.id).is('empresa_id', null).order('data', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    // Janela de 6 meses completa — usada nos cálculos de variação/série, sem
    // limite curto (limite de segurança generoso, não de exibição).
    empresaIds.length
      ? db.from('transacoes').select('valor, tipo, data').in('empresa_id', empresaIds).gte('data', inicioJanela6m).limit(20000)
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('belvo_transacoes').select('valor, tipo, data').eq('user_id', user.id).is('empresa_id', null).gte('data', inicioJanela6m).limit(20000)
      : Promise.resolve({ data: [] }),
  ])

  const belvoContas = (belvoContasR.data ?? []) as { id: string; nome: string | null; instituicao: string | null; empresa_id: string | null; user_id: string | null; saldo: number | null }[]
  const belvoContasPj = belvoContas.filter(c => c.empresa_id)
  const belvoContasPf = belvoContas.filter(c => !c.empresa_id)

  const contas: ContaLinha[] = [
    ...((contasPjR.data ?? []) as { id: string; banco_nome: string; agencia: string | null; empresa_id: string; saldo: number }[]).map(c => ({
      id: c.id, nome: c.banco_nome, instituicao: c.banco_nome, titularidade: 'pj' as const,
      empresa_nome: empresaNomes.get(c.empresa_id) ?? null, saldo: Number(c.saldo || 0),
    })),
    ...belvoContasPj.map(c => ({
      id: c.id, nome: c.instituicao ?? c.nome ?? 'Conta', instituicao: c.instituicao ?? '—', titularidade: 'pj' as const,
      empresa_nome: empresaNomes.get(c.empresa_id as string) ?? null, saldo: Number(c.saldo || 0),
    })),
    ...belvoContasPf.map(c => ({
      id: c.id, nome: c.instituicao ?? c.nome ?? 'Conta', instituicao: c.instituicao ?? '—', titularidade: 'pf' as const,
      empresa_nome: null, saldo: Number(c.saldo || 0),
    })),
  ].sort((a, b) => b.saldo - a.saldo)

  const saldoPj = contas.filter(c => c.titularidade === 'pj').reduce((s, c) => s + c.saldo, 0)
  const saldoPf = contas.filter(c => c.titularidade === 'pf').reduce((s, c) => s + c.saldo, 0)
  const investimentosTotal =
    ((invPjR.data ?? []) as { valor_atual: number }[]).reduce((s, i) => s + Number(i.valor_atual || 0), 0) +
    ((invPfR.data ?? []) as { valor_atual: number }[]).reduce((s, i) => s + Number(i.valor_atual || 0), 0)

  // "Variação no mês" é derivada do resultado (entrada - saída) do mês corrente,
  // não de um histórico de saldo armazenado — a tabela contas_bancarias só guarda
  // o saldo atual, sem série temporal. É uma aproximação, não o número exato do
  // extrato bancário do banco. Usa a janela de 6 meses (sem limite curto) pra
  // não sub-contar empresas com mais movimentação que o tamanho do feed recente.
  const txPjMes = ((txPj6mR.data ?? []) as { valor: number; tipo: string; data: string }[]).filter(t => t.data >= inicioMes)
  const txPfMes = ((txPf6mR.data ?? []) as { valor: number; tipo: string; data: string }[]).filter(t => t.data >= inicioMes)
  const resultadoMesPj = txPjMes.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0)
  const resultadoMesPf = txPfMes.reduce((s, t) => s + (t.tipo === 'INFLOW' ? Number(t.valor) : -Number(t.valor)), 0)

  const extratoRecente: MovLinha[] = [
    ...((txPjRecenteR.data ?? []) as { id: string; descricao: string; valor: number; tipo: string; data: string; empresa_id: string }[]).map(t => ({
      id: t.id, descricao: t.descricao, valor: Number(t.valor), tipo: (t.tipo === 'entrada' ? 'entrada' : 'saida') as 'entrada' | 'saida',
      titularidade: 'pj' as const, empresa_nome: empresaNomes.get(t.empresa_id) ?? null, data: t.data,
    })),
    ...((txPfRecenteR.data ?? []) as { id: string; descricao: string; valor: number; tipo: string; data: string }[]).map(t => ({
      id: t.id, descricao: t.descricao, valor: Number(t.valor), tipo: (t.tipo === 'INFLOW' ? 'entrada' : 'saida') as 'entrada' | 'saida',
      titularidade: 'pf' as const, empresa_nome: null, data: t.data,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6)

  // Série de patrimônio consolidado (área do mockup) — soma saldo atual +
  // reconstrói os 5 meses anteriores subtraindo o resultado mês a mês. Também
  // é aproximação (não existe snapshot histórico de saldo), sinalizada no payload.
  const patrimonioAtual = saldoPj + saldoPf + investimentosTotal
  const serieMeses: { mes: string; valor: number }[] = []
  const todasTx = [
    ...((txPj6mR.data ?? []) as { valor: number; tipo: string; data: string }[]).map(t => ({ valor: Number(t.valor), sinal: t.tipo === 'entrada' ? 1 : -1, data: t.data })),
    ...((txPf6mR.data ?? []) as { valor: number; tipo: string; data: string }[]).map(t => ({ valor: Number(t.valor), sinal: t.tipo === 'INFLOW' ? 1 : -1, data: t.data })),
  ]
  let acumulado = patrimonioAtual
  for (let i = 0; i < 6; i++) {
    const refMes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const chave = refMes.toISOString().slice(0, 7)
    serieMeses.unshift({ mes: chave, valor: acumulado })
    const resultadoDoMes = todasTx.filter(t => t.data.slice(0, 7) === chave).reduce((s, t) => s + t.sinal * t.valor, 0)
    acumulado -= resultadoDoMes
  }

  return NextResponse.json({
    escopo,
    saldo_pj: saldoPj,
    saldo_pf: saldoPf,
    investimentos_total: investimentosTotal,
    patrimonio_total: patrimonioAtual,
    variacao_mes_pj: resultadoMesPj,
    variacao_mes_pf: resultadoMesPf,
    contas,
    extrato_recente: extratoRecente,
    serie_patrimonio: serieMeses,
    serie_aproximada: true,
    empresas_incluidas: empresaIds.length,
    pf_incluida: incluiPf,
  })
}

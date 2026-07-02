import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIAS_PADRAO } from '@/lib/despesas-categorizacao'

/**
 * Motor de lançamentos contábeis automáticos (partida dobrada).
 * Transforma despesas e notas emitidas em lançamentos (débito + crédito) nas
 * contas do plano de contas — idempotente (não duplica o que já foi lançado).
 */

type SB = SupabaseClient
type Conta = { codigo: string; nome: string; tipo: string }
type NovoLanc = {
  empresa_id: string; conta_id: string; descricao: string; valor: number
  tipo: 'debito' | 'credito'; competencia: string; despesa_id?: string; nota_id?: string; origem: string
}

const CONTAS_FIXAS: Conta[] = [
  { codigo: '1.1.1', nome: 'Caixa e Bancos', tipo: 'ativo' },
  { codigo: '1.1.2', nome: 'Contas a Receber', tipo: 'ativo' },
  { codigo: '2.1.1', nome: 'Contas a Pagar', tipo: 'passivo' },
  { codigo: '3.1.1', nome: 'Receita de Vendas e Serviços', tipo: 'receita' },
  { codigo: '5.1.1', nome: 'Impostos sobre Vendas', tipo: 'imposto' },
]
const contasDespesa = (): Conta[] =>
  CATEGORIAS_PADRAO.map((cat, i) => ({ codigo: `4.1.${String(i + 1).padStart(2, '0')}`, nome: `Despesa - ${cat}`, tipo: 'despesa_operacional' }))

/** Garante o plano de contas base (idempotente). Retorna mapa nome -> conta_id. */
export async function garantirPlanoContas(sb: SB, empresaId: string): Promise<Map<string, string>> {
  const { data: existentes } = await sb.from('plano_contas').select('id,codigo,nome').eq('empresa_id', empresaId)
  const porNome = new Map<string, string>()
  const codigosExistentes = new Set<string>()
  for (const c of existentes ?? []) { porNome.set(c.nome as string, c.id as string); codigosExistentes.add(c.codigo as string) }

  const todas = [...CONTAS_FIXAS, ...contasDespesa()]
  const faltantes = todas.filter(c => !codigosExistentes.has(c.codigo))
  if (faltantes.length) {
    const { data: novas } = await sb.from('plano_contas')
      .insert(faltantes.map(c => ({ empresa_id: empresaId, codigo: c.codigo, nome: c.nome, tipo: c.tipo })))
      .select('id,nome')
    for (const c of novas ?? []) porNome.set(c.nome as string, c.id as string)
  }
  return porNome
}

/** Gera os lançamentos que ainda faltam a partir de despesas e notas. */
export async function gerarLancamentos(sb: SB, empresaId: string): Promise<{ gerados: number; despesas: number; notas: number }> {
  const mapa = await garantirPlanoContas(sb, empresaId)
  const caixaId = mapa.get('Caixa e Bancos')
  const receitaId = mapa.get('Receita de Vendas e Serviços')
  const outrasDespId = mapa.get('Despesa - Outros')
  if (!caixaId || !receitaId || !outrasDespId) throw new Error('Falha ao preparar o plano de contas')
  const contaDespesa = (cat: string | null) => mapa.get(`Despesa - ${cat ?? ''}`) ?? outrasDespId

  // O que já foi lançado (dedupe)
  const { data: jaLanc } = await sb.from('lancamentos').select('despesa_id,nota_id').eq('empresa_id', empresaId).limit(10000)
  const despLanc = new Set((jaLanc ?? []).map(l => l.despesa_id).filter(Boolean) as string[])
  const notaLanc = new Set((jaLanc ?? []).map(l => l.nota_id).filter(Boolean) as string[])

  const novos: NovoLanc[] = []
  let nDesp = 0, nNota = 0

  // Despesas → D: despesa / C: caixa
  const { data: despesas } = await sb.from('despesas').select('id,descricao,valor,categoria,data_despesa').eq('empresa_id', empresaId).limit(3000)
  for (const d of despesas ?? []) {
    if (despLanc.has(d.id as string)) continue
    const valor = Number(d.valor ?? 0); if (!valor) continue
    const comp = (d.data_despesa as string) || new Date().toISOString().slice(0, 10)
    const desc = String(d.descricao ?? 'Despesa')
    novos.push({ empresa_id: empresaId, conta_id: contaDespesa(d.categoria as string | null), descricao: desc, valor, tipo: 'debito', competencia: comp, despesa_id: d.id as string, origem: 'despesa' })
    novos.push({ empresa_id: empresaId, conta_id: caixaId, descricao: desc, valor, tipo: 'credito', competencia: comp, despesa_id: d.id as string, origem: 'despesa' })
    nDesp++
  }

  // Notas emitidas → C: receita / D: caixa
  const { data: notas } = await sb.from('notas_emitidas').select('id,destinatario_nome,valor_total,created_at').eq('empresa_id', empresaId).limit(3000)
  for (const n of notas ?? []) {
    if (notaLanc.has(n.id as string)) continue
    const valor = Number(n.valor_total ?? 0); if (!valor) continue
    const comp = String(n.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
    const desc = `NF ${String(n.destinatario_nome ?? '').trim()}`.trim()
    novos.push({ empresa_id: empresaId, conta_id: receitaId, descricao: desc, valor, tipo: 'credito', competencia: comp, nota_id: n.id as string, origem: 'nfe' })
    novos.push({ empresa_id: empresaId, conta_id: caixaId, descricao: desc, valor, tipo: 'debito', competencia: comp, nota_id: n.id as string, origem: 'nfe' })
    nNota++
  }

  if (novos.length) {
    const { error } = await sb.from('lancamentos').insert(novos)
    if (error) throw new Error(error.message)
  }
  return { gerados: novos.length, despesas: nDesp, notas: nNota }
}

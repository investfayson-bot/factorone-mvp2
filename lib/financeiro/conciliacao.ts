import { addDays, subDays } from 'date-fns'
import { createClient } from '@supabase/supabase-js'

type ExtratoBancario = { id: string; valor: number; tipo: 'credito' | 'debito'; data_transacao: string; descricao: string; conciliado: boolean }
type MatchResult = {
  extrato_id: string
  referencia_id: string
  tipo: 'conta_pagar' | 'conta_receber' | 'despesa' | 'transaction'
  confidence: number
  metodo: 'exato' | 'fuzzy'
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function day(s: string): string {
  return new Date(s).toISOString().slice(0, 10)
}

export async function matchExato(extratoItem: ExtratoBancario, empresa_id: string): Promise<MatchResult | null> {
  const dataRef = day(extratoItem.data_transacao)
  const valorAbs = Math.abs(Number(extratoItem.valor))
  if (extratoItem.tipo === 'debito') {
    const { data: pagar } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('empresa_id', empresa_id)
      .in('status', ['pendente', 'vencida'])
      .eq('valor', valorAbs)
      .eq('data_vencimento', dataRef)
      .limit(1)
      .maybeSingle()
    if (pagar) return { extrato_id: extratoItem.id, referencia_id: pagar.id, tipo: 'conta_pagar', confidence: 1, metodo: 'exato' }
  } else {
    const { data: receber } = await supabase
      .from('contas_receber')
      .select('id')
      .eq('empresa_id', empresa_id)
      .in('status', ['pendente', 'vencida'])
      .eq('valor', valorAbs)
      .eq('data_vencimento', dataRef)
      .limit(1)
      .maybeSingle()
    if (receber) return { extrato_id: extratoItem.id, referencia_id: receber.id, tipo: 'conta_receber', confidence: 1, metodo: 'exato' }
  }
  return null
}

export async function matchFuzzy(extratoItem: ExtratoBancario, empresa_id: string): Promise<MatchResult | null> {
  const valorRef = Math.abs(Number(extratoItem.valor))
  const valorMin = valorRef * 0.995
  const valorMax = valorRef * 1.005
  const d = new Date(extratoItem.data_transacao)
  const dataMin = subDays(d, 3).toISOString().slice(0, 10)
  const dataMax = addDays(d, 3).toISOString().slice(0, 10)
  if (extratoItem.tipo === 'debito') {
    const { data } = await supabase.from('contas_pagar').select('id,data_vencimento,valor').eq('empresa_id', empresa_id).in('status', ['pendente', 'vencida']).gte('valor', valorMin).lte('valor', valorMax).gte('data_vencimento', dataMin).lte('data_vencimento', dataMax).limit(1).maybeSingle()
    if (data) {
      const diffValor = Math.abs(Number(data.valor) - valorRef) / Math.max(valorRef, 1)
      const conf = Math.max(0.7, 0.99 - diffValor * 10)
      return { extrato_id: extratoItem.id, referencia_id: data.id, tipo: 'conta_pagar', confidence: conf, metodo: 'fuzzy' }
    }
  } else {
    const { data } = await supabase.from('contas_receber').select('id,data_vencimento,valor').eq('empresa_id', empresa_id).in('status', ['pendente', 'vencida']).gte('valor', valorMin).lte('valor', valorMax).gte('data_vencimento', dataMin).lte('data_vencimento', dataMax).limit(1).maybeSingle()
    if (data) {
      const diffValor = Math.abs(Number(data.valor) - valorRef) / Math.max(valorRef, 1)
      const conf = Math.max(0.7, 0.99 - diffValor * 10)
      return { extrato_id: extratoItem.id, referencia_id: data.id, tipo: 'conta_receber', confidence: conf, metodo: 'fuzzy' }
    }
  }
  return null
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a.includes(b) || b.includes(a)) return 0.7
  const wa = new Set(normalize(a).split(' '))
  const wb = new Set(normalize(b).split(' '))
  const inter = Array.from(wa).filter((x) => wb.has(x)).length
  return inter / Math.max(wa.size, wb.size, 1)
}

export async function matchDescricao(extratoItem: ExtratoBancario, empresa_id: string): Promise<MatchResult | null> {
  const desc = normalize(extratoItem.descricao)
  if (extratoItem.tipo === 'debito') {
    const { data } = await supabase.from('contas_pagar').select('id,fornecedor_nome').eq('empresa_id', empresa_id).in('status', ['pendente', 'vencida']).limit(50)
    const best = (data || []).map((x) => ({ id: x.id, s: similarity(desc, x.fornecedor_nome || '') })).sort((a, b) => b.s - a.s)[0]
    if (best && best.s >= 0.5) return { extrato_id: extratoItem.id, referencia_id: best.id, tipo: 'conta_pagar', confidence: Math.min(0.7, best.s), metodo: 'fuzzy' }
  } else {
    const { data } = await supabase.from('contas_receber').select('id,cliente_nome').eq('empresa_id', empresa_id).in('status', ['pendente', 'vencida']).limit(50)
    const best = (data || []).map((x) => ({ id: x.id, s: similarity(desc, x.cliente_nome || '') })).sort((a, b) => b.s - a.s)[0]
    if (best && best.s >= 0.5) return { extrato_id: extratoItem.id, referencia_id: best.id, tipo: 'conta_receber', confidence: Math.min(0.7, best.s), metodo: 'fuzzy' }
  }
  return null
}

export async function aplicarConciliacao(extrato_id: string, referencia_id: string, tipo: string, empresa_id: string): Promise<void> {
  const { data: extrato } = await supabase.from('extrato_bancario').select('id,conta_id,data_transacao,valor,tipo').eq('id', extrato_id).maybeSingle()
  if (!extrato) return
  await supabase.from('conciliacoes').insert({ empresa_id, conta_id: extrato.conta_id, extrato_id, tipo_match: tipo, referencia_id, confidence: 1, metodo: 'exato' })
  await supabase.from('extrato_bancario').update({ conciliado: true }).eq('id', extrato_id)
  const dt = day(extrato.data_transacao)
  const v = Math.abs(Number(extrato.valor))
  if (tipo === 'conta_pagar') {
    await supabase.from('contas_pagar').update({ status: 'paga', data_pagamento: dt, valor_pago: v, extrato_id }).eq('id', referencia_id)
  }
  if (tipo === 'conta_receber') {
    await supabase.from('contas_receber').update({ status: 'recebida', data_recebimento: dt, valor_recebido: v, extrato_id }).eq('id', referencia_id)
  }
}

export async function conciliarExtrato(empresa_id: string, conta_id: string): Promise<{ conciliados: number; pendentes: number; matches: MatchResult[] }> {
  const { data: extratos } = await supabase.from('extrato_bancario').select('id,valor,tipo,data_transacao,descricao,conciliado').eq('empresa_id', empresa_id).eq('conta_id', conta_id).eq('conciliado', false).order('data_transacao', { ascending: false })
  let conciliados = 0
  const sugestoes: MatchResult[] = []
  for (const item of (extratos || []) as ExtratoBancario[]) {
    const exact = await matchExato(item, empresa_id)
    if (exact) {
      await aplicarConciliacao(exact.extrato_id, exact.referencia_id, exact.tipo, empresa_id)
      conciliados += 1
      continue
    }
    const fuzzy = await matchFuzzy(item, empresa_id)
    if (fuzzy) {
      sugestoes.push(fuzzy)
      continue
    }
    const desc = await matchDescricao(item, empresa_id)
    if (desc) sugestoes.push(desc)
  }
  return { conciliados, pendentes: (extratos || []).length - conciliados, matches: sugestoes }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'
import type { ConfirmarItem, ConfirmarResposta } from '@/lib/banco/types'

export const runtime = 'nodejs'

/**
 * Confirma itens da fila do Banco em lote. Por item, atomicamente do ponto de
 * vista do usuário: concilia extrato → cria transação já classificada
 * (categoria + fornecedor/cliente + vínculo) → baixa conta prevista.
 * Item que falha entra em `falhas` sem derrubar o lote.
 */
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = (await req.json().catch(() => null)) as { itens?: ConfirmarItem[] } | null
  const itens = body?.itens
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 100) {
    return NextResponse.json({ error: 'itens deve ser uma lista de 1 a 100' }, { status: 400 })
  }

  const resp: ConfirmarResposta = { confirmados: [], falhas: [] }
  const mesesTocados = new Set<string>()

  for (const item of itens) {
    try {
      if (!item.extrato_id || !item.categoria?.trim()) throw new Error('extrato_id e categoria obrigatórios')

      // 1. IDOR: extrato precisa ser da empresa da sessão. 2. Idempotência.
      const { data: ex } = await supabase.from('extrato_bancario').select('*').eq('id', item.extrato_id).eq('empresa_id', empresaId).maybeSingle()
      if (!ex) throw new Error('Extrato não encontrado')
      if (ex.conciliado) {
        resp.confirmados.push({ extrato_id: item.extrato_id, transacao_id: ex.transaction_id ?? '', ja_conciliado: true })
        continue
      }

      const ehSaida = ex.tipo === 'debito'
      if (ehSaida && item.conta_receber_id) throw new Error('Transação de saída não pode vincular conta a receber')
      if (!ehSaida && item.conta_pagar_id) throw new Error('Transação de entrada não pode vincular conta a pagar')

      // 3. Cadastro novo (só com confirmação do usuário; dedup por CNPJ da contraparte)
      let fornecedorId = item.fornecedor_id ?? null
      let clienteId = item.cliente_id ?? null
      // IDOR: cadastro escolhido (não criado agora) precisa ser da empresa da sessão.
      if (fornecedorId) {
        const { data: f } = await supabase.from('fornecedores').select('id').eq('id', fornecedorId).eq('empresa_id', empresaId).maybeSingle()
        if (!f) throw new Error('Fornecedor não encontrado')
      }
      if (clienteId) {
        const { data: c } = await supabase.from('clientes').select('id').eq('id', clienteId).eq('empresa_id', empresaId).maybeSingle()
        if (!c) throw new Error('Cliente não encontrado')
      }
      const docCp = String(ex.contraparte_documento ?? '').replace(/\D/g, '')
      if (item.novo_fornecedor?.razao_social?.trim()) {
        if (docCp.length >= 11) {
          const { data: dup } = await supabase.from('fornecedores').select('id').eq('empresa_id', empresaId).eq('cnpj', docCp).maybeSingle()
          if (dup) fornecedorId = dup.id
        }
        if (!fornecedorId) {
          const { data: novo, error: e1 } = await supabase.from('fornecedores')
            .insert({ empresa_id: empresaId, razao_social: item.novo_fornecedor.razao_social.trim(), cnpj: docCp || null })
            .select('id').single()
          if (e1) throw new Error(`Criar fornecedor: ${e1.message}`)
          fornecedorId = novo.id
        }
      }
      if (item.novo_cliente?.nome?.trim()) {
        if (docCp.length >= 11) {
          const { data: dup } = await supabase.from('clientes').select('id').eq('empresa_id', empresaId).eq('cnpj_cpf', docCp).maybeSingle()
          if (dup) clienteId = dup.id
        }
        if (!clienteId) {
          const { data: novo, error: e2 } = await supabase.from('clientes')
            .insert({ empresa_id: empresaId, nome: item.novo_cliente.nome.trim(), cnpj_cpf: docCp || null, status: 'ativo' })
            .select('id').single()
          if (e2) throw new Error(`Criar cliente: ${e2.message}`)
          clienteId = novo.id
        }
      }

      // 4. Valida vínculo de conta prevista (também da empresa — IDOR) e traz valor/já pago
      // pra acumular corretamente em vez de sobrescrever (conta pode já estar parcialmente paga).
      let contaPagar: { valor: number; valor_pago: number } | null = null
      let contaReceber: { valor: number; valor_recebido: number } | null = null
      if (item.conta_pagar_id) {
        const { data: cp } = await supabase.from('contas_pagar').select('valor,valor_pago').eq('id', item.conta_pagar_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cp) throw new Error('Conta a pagar não encontrada')
        contaPagar = { valor: Number(cp.valor ?? 0), valor_pago: Number(cp.valor_pago ?? 0) }
      }
      if (item.conta_receber_id) {
        const { data: cr } = await supabase.from('contas_receber').select('valor,valor_recebido').eq('id', item.conta_receber_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cr) throw new Error('Conta a receber não encontrada')
        contaReceber = { valor: Number(cr.valor ?? 0), valor_recebido: Number(cr.valor_recebido ?? 0) }
      }

      // 5. Cria a transação COMPLETA (nunca existe conciliada-sem-categoria)
      const dataTx = String(ex.data_transacao ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const { data: tx, error: eTx } = await supabase.from('transacoes').insert({
        empresa_id: empresaId,
        descricao: ex.descricao ?? 'Lançamento bancário',
        categoria: item.categoria.trim(),
        tipo: ehSaida ? 'saida' : 'entrada',
        valor: Number(ex.valor ?? 0),
        status: 'pago',
        data: dataTx,
        fornecedor_id: ehSaida ? fornecedorId : null,
        cliente_id: ehSaida ? null : clienteId,
        conta_pagar_id: item.conta_pagar_id ?? null,
        conta_receber_id: item.conta_receber_id ?? null,
      }).select('id').single()
      if (eTx) throw new Error(eTx.message)

      // 6. Marca extrato conciliado
      const { error: eExtrato } = await supabase.from('extrato_bancario').update({ conciliado: true, transaction_id: tx.id }).eq('id', item.extrato_id).eq('empresa_id', empresaId)
      if (eExtrato) throw new Error(`Marcar extrato conciliado: ${eExtrato.message}`)

      // 7. Baixa a conta prevista — acumula sobre o que já estava pago/recebido (a conta
      // pode já estar parcialmente paga/recebida) e só marca quitada quando o total bate,
      // mesmo padrão de app/api/financeiro/{pagar,receber}/[id]/{pagar,receber}/route.ts.
      if (item.conta_pagar_id && contaPagar) {
        const novoValorPago = contaPagar.valor_pago + Number(ex.valor ?? 0)
        const status = novoValorPago >= contaPagar.valor ? 'paga' : 'parcialmente_paga'
        const { error: ePagar } = await supabase.from('contas_pagar')
          .update({ status, valor_pago: novoValorPago, data_pagamento: dataTx })
          .eq('id', item.conta_pagar_id).eq('empresa_id', empresaId)
        if (ePagar) throw new Error(`Baixar conta a pagar: ${ePagar.message}`)
      }
      if (item.conta_receber_id && contaReceber) {
        const novoValorRecebido = contaReceber.valor_recebido + Number(ex.valor ?? 0)
        const status = novoValorRecebido >= contaReceber.valor ? 'recebida' : 'parcialmente_recebida'
        const { error: eReceber } = await supabase.from('contas_receber')
          .update({ status, valor_recebido: novoValorRecebido, data_recebimento: dataTx })
          .eq('id', item.conta_receber_id).eq('empresa_id', empresaId)
        if (eReceber) throw new Error(`Baixar conta a receber: ${eReceber.message}`)
      }

      resp.confirmados.push({ extrato_id: item.extrato_id, transacao_id: tx.id })
      mesesTocados.add(`${dataTx.slice(0, 7)}`)
    } catch (e: unknown) {
      resp.falhas.push({ extrato_id: item.extrato_id ?? '?', erro: e instanceof Error ? e.message : 'Erro interno' })
    }
  }

  // DRE é materializado (metricas_financeiras), não calculado on-the-fly — sem isso o
  // dashboard/relatorios fica desatualizado pra quem só usa o Banco (não emite NFe).
  for (const mes of Array.from(mesesTocados)) {
    await recalcularDREMes(empresaId, new Date(`${mes}-01T12:00:00`))
  }

  return NextResponse.json(resp)
}

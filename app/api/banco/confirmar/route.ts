import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
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

      // 3. Cadastro novo (só com confirmação do usuário; dedup por CNPJ da contraparte)
      let fornecedorId = item.fornecedor_id ?? null
      let clienteId = item.cliente_id ?? null
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

      // 4. Valida vínculo de conta prevista (também da empresa — IDOR)
      if (item.conta_pagar_id) {
        const { data: cp } = await supabase.from('contas_pagar').select('id').eq('id', item.conta_pagar_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cp) throw new Error('Conta a pagar não encontrada')
      }
      if (item.conta_receber_id) {
        const { data: cr } = await supabase.from('contas_receber').select('id').eq('id', item.conta_receber_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cr) throw new Error('Conta a receber não encontrada')
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
      await supabase.from('extrato_bancario').update({ conciliado: true, transaction_id: tx.id }).eq('id', item.extrato_id)

      // 7. Baixa a conta prevista (status reais do schema: 'paga' / 'recebida')
      if (item.conta_pagar_id) {
        await supabase.from('contas_pagar')
          .update({ status: 'paga', valor_pago: Number(ex.valor ?? 0), data_pagamento: dataTx })
          .eq('id', item.conta_pagar_id).eq('empresa_id', empresaId)
      }
      if (item.conta_receber_id) {
        await supabase.from('contas_receber')
          .update({ status: 'recebida', valor_recebido: Number(ex.valor ?? 0), data_recebimento: dataTx })
          .eq('id', item.conta_receber_id).eq('empresa_id', empresaId)
      }

      resp.confirmados.push({ extrato_id: item.extrato_id, transacao_id: tx.id })
    } catch (e: unknown) {
      resp.falhas.push({ extrato_id: item.extrato_id ?? '?', erro: e instanceof Error ? e.message : 'Erro interno' })
    }
  }

  return NextResponse.json(resp)
}

import type { SupabaseClient } from '@supabase/supabase-js'

/** Lança receita em transacoes quando NF autorizada (tipo entrada = receita operacional). */
export async function lancarReceitaNota(
  supabase: SupabaseClient,
  params: {
    empresaId: string
    notaEmitidaId: string
    numero: string | null
    destinatario: string
    valorTotal: number
    competenciaDate: string
  }
): Promise<{ transacaoId: string | null; error: string | null }> {
  const descricao = `NF ${params.numero ? `nº ${params.numero}` : ''} — ${params.destinatario}`.trim()
  const { data, error } = await supabase
    .from('transacoes')
    .insert({
      empresa_id: params.empresaId,
      descricao,
      tipo: 'entrada',
      valor: params.valorTotal,
      status: 'pago',
      categoria: 'Receita Operacional',
      data: params.competenciaDate,
      competencia: params.competenciaDate,
    })
    .select('id')
    .single()

  if (error) return { transacaoId: null, error: error.message }
  const transacaoId = data?.id ?? null
  if (transacaoId) {
    await supabase.from('notas_emitidas').update({ transacao_id: transacaoId }).eq('id', params.notaEmitidaId)
  }
  return { transacaoId, error: null }
}

export async function estornarReceitaNota(
  supabase: SupabaseClient,
  transacaoId: string | null
): Promise<void> {
  if (!transacaoId) return
  await supabase.from('transacoes').delete().eq('id', transacaoId)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularScore } from './score'
import type { HistoricoEntrada, RegistrarResultadoParams } from './types'

/**
 * Único ponto de escrita em work_items. Duas formas de sair:
 * - resolvidoAutomaticamente: true  → nasce com status 'resolvido' e
 *   resolved_at preenchido. Nunca aparece pro usuário, mas fica rastreável
 *   (auditoria, métrica futura do Intelligence).
 * - resolvidoAutomaticamente: false → nasce 'aberto', aparece no Cockpit
 *   conforme o score, alguém precisa agir.
 *
 * Retorna null (sem lançar erro) quando já existe um work_item ABERTO pra
 * mesma origem_ref — é o dedup esperado (unique index parcial), não falha.
 */
export async function registrarResultado(
  db: SupabaseClient,
  params: RegistrarResultadoParams
): Promise<string | null> {
  const agora = new Date()
  const score = calcularScore({
    tipo: params.tipo,
    prazo: params.prazo ?? null,
    impactoValor: params.impactoValor ?? null,
    criadoEm: agora,
  })

  const historico: HistoricoEntrada[] = params.resolvidoAutomaticamente
    ? [{ em: agora.toISOString(), quem: 'ia', acao: 'resolvido_automaticamente', detalhe: params.decisaoDetalhe ?? {} }]
    : [{ em: agora.toISOString(), quem: 'sistema', acao: 'criado' }]

  const { data, error } = await db
    .from('work_items')
    .insert({
      empresa_id: params.empresaId,
      event_id: params.eventoId ?? null,
      tipo: params.tipo,
      origem: params.origem,
      origem_ref: params.origemRef,
      responsavel_papel: params.responsavelPapel,
      status: params.resolvidoAutomaticamente ? 'resolvido' : 'aberto',
      prazo: params.prazo ?? null,
      impacto_valor: params.impactoValor ?? null,
      score,
      sugestao_ia: params.sugestaoIa ?? null,
      arquivo_path: params.arquivoPath ?? null,
      historico,
      resolved_at: params.resolvidoAutomaticamente ? agora.toISOString() : null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505' && error.message.includes('work_items_origem_aberto_idx')) return null
    throw new Error(`registrarResultado falhou (${params.origemRef}): ${error.message}`, { cause: error })
  }
  return data.id as string
}

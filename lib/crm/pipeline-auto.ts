import type { SupabaseClient } from '@supabase/supabase-js'

// Preenchimento automático do Pipeline (spec Fase 6, comportamento
// obrigatório): classificar temperatura de um lead em QUALQUER tela cria o
// card em Prospect se não existir; a IA que detecta intenção de compra
// também cria, já com temperatura sugerida. Mover manualmente sempre tem
// prioridade — este helper NUNCA muda etapa de card existente.

export type TemperaturaLead = 'frio' | 'morno' | 'quente'

export async function garantirCardPipeline(
  db: SupabaseClient,
  opts: {
    empresaId: string
    titulo: string            // nome do negócio/empresa do lead
    contato?: string | null   // nome da pessoa
    temperatura: TemperaturaLead
    origem: 'ia' | 'humano'
    detalheOrigem: string     // ex.: "classificado na conversa do site" / "IA detectou pedido de orçamento"
    valor?: number | null
    etapaSugerida?: 'prospeccao' | 'qualificado' | 'proposta' | 'negociacao'
  },
): Promise<{ id: string; criado: boolean }> {
  const tituloNorm = opts.titulo.trim()

  // já existe card aberto pra esse negócio? (título igual, etapa não fechada)
  const { data: existente } = await db
    .from('crm_oportunidades')
    .select('id, temperatura')
    .eq('empresa_id', opts.empresaId)
    .ilike('titulo', tituloNorm)
    .in('etapa', ['prospeccao', 'qualificado', 'proposta', 'negociacao'])
    .limit(1)
    .maybeSingle()

  if (existente) {
    // só atualiza a temperatura (nunca a etapa — prioridade do manual)
    if (existente.temperatura !== opts.temperatura) {
      await db.from('crm_oportunidades').update({ temperatura: opts.temperatura, updated_at: new Date().toISOString() }).eq('id', existente.id)
      await db.from('crm_negociacao_eventos').insert({
        empresa_id: opts.empresaId, oportunidade_id: existente.id, origem: opts.origem,
        titulo: `Lead classificado como "${opts.temperatura}"`,
        detalhe: opts.detalheOrigem,
      })
    }
    return { id: existente.id as string, criado: false }
  }

  const { data: novo, error } = await db
    .from('crm_oportunidades')
    .insert({
      empresa_id: opts.empresaId,
      titulo: tituloNorm,
      responsavel_nome: opts.contato ?? null,
      valor: opts.valor ?? null,
      etapa: opts.etapaSugerida ?? 'prospeccao',
      temperatura: opts.temperatura,
      ultimo_contato_em: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !novo) throw new Error(error?.message ?? 'Falha ao criar card no pipeline')

  await db.from('crm_negociacao_eventos').insert({
    empresa_id: opts.empresaId, oportunidade_id: novo.id, origem: opts.origem,
    titulo: `Card criado no Pipeline (${opts.etapaSugerida ?? 'prospeccao'}) como "${opts.temperatura}"`,
    detalhe: opts.detalheOrigem,
  })

  return { id: novo.id as string, criado: true }
}

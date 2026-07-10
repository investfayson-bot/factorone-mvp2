import type { SupabaseClient } from '@supabase/supabase-js'
import { categorizarLoteIA } from '@/lib/categorizar-ia'

export type TitularidadeId = { empresaId: string; pessoaFisicaUserId?: never } | { empresaId?: never; pessoaFisicaUserId: string }

export type ClassificacaoResultado = {
  categoria: string
  status: 'aguardando_ok' | 'sugerida'
  confianca: number
}

/** Normaliza o nome do estabelecimento pra virar chave de regra estável —
 * remove número de terminal/filial, caixa, pontuação solta, que costumam
 * variar entre lançamentos do mesmo lugar (ex.: "123 IRMAOS LTDA SP" e
 * "123 Irmaos Ltda - Fil02" viram a mesma chave). */
export function normalizarEstabelecimento(texto: string): string {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b\d{2,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function buscarRegra(db: SupabaseClient, tid: TitularidadeId, chave: string) {
  const base = db.from('regras_classificacao').select('id, categoria, confianca').eq('estabelecimento_normalizado', chave)
  const { data } = 'empresaId' in tid && tid.empresaId
    ? await base.eq('empresa_id', tid.empresaId).is('pessoa_fisica_user_id', null).limit(1).maybeSingle()
    : await base.eq('pessoa_fisica_user_id', (tid as { pessoaFisicaUserId: string }).pessoaFisicaUserId).is('empresa_id', null).limit(1).maybeSingle()
  return data as { id: string; categoria: string; confianca: number } | null
}

/**
 * Motor de classificação (Fase 0, Parte B). Primeira vez que um
 * estabelecimento aparece nesta empresa/PF: chama a IA pra sugerir
 * categoria (status 'sugerida', baixa confiança). Da segunda vez em diante,
 * já existe regra aprendida: classifica sozinho (status 'aguardando_ok'),
 * só falta o usuário confirmar em lote. Regra nunca vaza entre
 * titularidades — mesma chave de estabelecimento em empresa/PF diferente
 * não compartilha regra.
 */
export async function classificar(
  db: SupabaseClient,
  tid: TitularidadeId,
  descricaoOuEstabelecimento: string,
  categorias: string[]
): Promise<ClassificacaoResultado> {
  const chave = normalizarEstabelecimento(descricaoOuEstabelecimento)
  const regra = await buscarRegra(db, tid, chave)

  if (regra) {
    return { categoria: regra.categoria as string, status: 'aguardando_ok', confianca: regra.confianca as number }
  }

  const mapa = await categorizarLoteIA([{ id: chave, texto: descricaoOuEstabelecimento }], categorias)
  const categoria = mapa[chave] || categorias[0] || 'Outros'
  return { categoria, status: 'sugerida', confianca: 0 }
}

/**
 * Confirma (ou corrige) a classificação de um lançamento — grava/atualiza a
 * regra aprendida pra essa titularidade. Chamar sempre que o usuário aprova
 * uma sugestão, corrige uma categoria, ou dá "OK" numa classificação
 * automática. Repetir a mesma categoria aumenta a confiança; trocar de
 * categoria reseta pra 1 (a regra "esquece" o padrão antigo).
 */
export async function confirmarClassificacao(
  db: SupabaseClient,
  tid: TitularidadeId,
  descricaoOuEstabelecimento: string,
  categoria: string
): Promise<void> {
  const chave = normalizarEstabelecimento(descricaoOuEstabelecimento)
  if (!chave) return
  const existente = await buscarRegra(db, tid, chave)

  if (existente) {
    const mesmaCategoria = existente.categoria === categoria
    await db.from('regras_classificacao').update({
      categoria,
      confianca: mesmaCategoria ? Number(existente.confianca || 1) + 1 : 1,
      updated_at: new Date().toISOString(),
    }).eq('id', existente.id)
    return
  }

  await db.from('regras_classificacao').insert({
    empresa_id: 'empresaId' in tid ? tid.empresaId : null,
    pessoa_fisica_user_id: 'pessoaFisicaUserId' in tid ? tid.pessoaFisicaUserId : null,
    estabelecimento_normalizado: chave,
    categoria,
    confianca: 1,
  })
}

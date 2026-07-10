import type { SupabaseClient } from '@supabase/supabase-js'

const TOLERANCIA_CENTAVOS = 0.01
const JANELA_DIAS = 2

/**
 * Tenta achar UMA linha de extrato_bancario que bate com o valor/data de um
 * recibo processado por OCR, e anexa o comprovante nela. Se achar zero ou
 * mais de uma correspondência, não faz nada — errar o match é pior que não
 * casar automaticamente.
 */
export async function matchComprovante(
  db: SupabaseClient,
  empresaId: string,
  reciboId: string,
  valor: number,
  data: string,
  imagemUrl: string
): Promise<boolean> {
  const dataIni = new Date(data)
  dataIni.setDate(dataIni.getDate() - JANELA_DIAS)
  const dataFim = new Date(data)
  dataFim.setDate(dataFim.getDate() + JANELA_DIAS)

  const { data: candidatos } = await db
    .from('extrato_bancario')
    .select('id, valor')
    .eq('empresa_id', empresaId)
    .is('comprovante_url', null)
    .gte('data_transacao', dataIni.toISOString().slice(0, 10))
    .lte('data_transacao', dataFim.toISOString().slice(0, 10))

  const bateValor = (candidatos ?? []).filter(
    c => Math.abs(Number(c.valor) - valor) <= TOLERANCIA_CENTAVOS
  )
  if (bateValor.length !== 1) return false

  const alvo = bateValor[0]
  const { error } = await db
    .from('extrato_bancario')
    .update({ comprovante_url: imagemUrl })
    .eq('id', alvo.id)
  if (error) return false

  await db.from('recibos_fotografados').update({ extrato_bancario_id: alvo.id }).eq('id', reciboId)
  return true
}

/**
 * Varre recibos ainda sem match (extrato_bancario_id IS NULL) de uma empresa
 * e tenta casar cada um contra o extrato — usado pelo cron diário, para o
 * caso em que o recibo chegou antes da movimentação aparecer no Open Finance.
 */
export async function matchComprovantesPendentes(db: SupabaseClient, empresaId: string): Promise<number> {
  const { data: pendentes } = await db
    .from('recibos_fotografados')
    .select('id, valor_extraido, data_extraida, imagem_url')
    .eq('empresa_id', empresaId)
    .is('extrato_bancario_id', null)
    .not('valor_extraido', 'is', null)
    .not('data_extraida', 'is', null)

  let casados = 0
  for (const r of pendentes ?? []) {
    const ok = await matchComprovante(
      db,
      empresaId,
      r.id as string,
      Number(r.valor_extraido),
      r.data_extraida as string,
      r.imagem_url as string
    )
    if (ok) casados++
  }
  return casados
}

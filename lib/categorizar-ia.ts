import OpenAI from 'openai'
import { CATEGORIAS_PADRAO, sugerirCategoriaDespesa } from './despesas-categorizacao'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export type ItemCat = { id: string; texto: string }

/**
 * Categoriza uma LEVA de itens numa única chamada de IA (barato e rápido).
 * Fallback para o categorizador por regex quando não há key ou a IA falha.
 */
export async function categorizarLoteIA(
  itens: ItemCat[],
  categorias: string[] = CATEGORIAS_PADRAO,
): Promise<Record<string, string>> {
  if (itens.length === 0) return {}

  const regexFallback = () =>
    Object.fromEntries(itens.map(i => [i.id, sugerirCategoriaDespesa(i.texto, categorias)]))

  if (!process.env.OPENROUTER_API_KEY) return regexFallback()

  const lista = categorias.join(', ')
  const payload = itens.map((i, idx) => ({ i: idx, t: (i.texto || '').slice(0, 160) }))
  const prompt = `Você é um classificador financeiro para empresas brasileiras. Para cada item, escolha a categoria que melhor descreve o gasto/transação.
Categorias permitidas (use EXATAMENTE uma, sem inventar): ${lista}.
Responda SOMENTE com JSON no formato {"r":[{"i":<indice>,"c":"<categoria>"}]}.
Itens: ${JSON.stringify(payload)}`

  try {
    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { r?: Array<{ i: number; c: string }> }
    const out: Record<string, string> = {}
    for (const r of parsed.r ?? []) {
      const item = itens[r.i]
      if (!item) continue
      const cat = categorias.find(c => c.toLowerCase() === String(r.c ?? '').toLowerCase())
      out[item.id] = cat ?? sugerirCategoriaDespesa(item.texto, categorias)
    }
    // completa quem a IA não retornou
    for (const it of itens) if (!out[it.id]) out[it.id] = sugerirCategoriaDespesa(it.texto, categorias)
    return out
  } catch {
    return regexFallback()
  }
}

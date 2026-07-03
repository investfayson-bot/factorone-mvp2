import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const openrouter = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY || '' })
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// CFO IA: lê as transações classificadas e devolve 3-4 insights acionáveis.
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const eid = (u?.empresa_id as string) ?? user.id

  const { data } = await supabase.from('transacoes').select('tipo,valor,categoria').eq('empresa_id', eid).limit(500)
  const rows = (data ?? []) as { tipo: string; valor: number; categoria: string | null }[]
  if (rows.length === 0) return NextResponse.json({ analise: ['Sem transações ainda — popule ou cadastre para eu analisar.'], fonte: 'regra' })

  const entrou = rows.filter(r => r.tipo === 'entrada').reduce((s, r) => s + Number(r.valor), 0)
  const saiu = rows.filter(r => r.tipo === 'saida').reduce((s, r) => s + Number(r.valor), 0)
  const resultado = entrou - saiu
  const catMap = new Map<string, number>()
  for (const r of rows) if (r.tipo === 'saida' && r.categoria && r.categoria.trim()) catMap.set(r.categoria, (catMap.get(r.categoria) || 0) + Number(r.valor))
  const cats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])

  // fallback determinístico (o demo nunca fica sem análise)
  const fb: string[] = []
  fb.push(resultado >= 0
    ? `Resultado positivo de ${fmt(resultado)} — entrou ${fmt(entrou)} e saiu ${fmt(saiu)}.`
    : `Atenção: resultado negativo de ${fmt(resultado)} — você gastou mais do que entrou.`)
  if (cats[0] && saiu > 0) fb.push(`Seu maior gasto é ${cats[0][0]}: ${fmt(cats[0][1])} (${((cats[0][1] / saiu) * 100).toFixed(0)}% das saídas). Vale revisar.`)
  if (entrou > 0) fb.push(`Margem: ${((resultado / entrou) * 100).toFixed(0)}% da receita virou resultado.`)

  if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ analise: fb, fonte: 'regra' })

  try {
    const resumo = `Entrou: ${fmt(entrou)}. Saiu: ${fmt(saiu)}. Resultado: ${fmt(resultado)}. Gastos por categoria: ${cats.map(([c, v]) => `${c}=${fmt(v)}`).join('; ') || 'nenhum classificado'}.`
    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Você é um CFO objetivo de uma PME brasileira. Analise os números e dê de 3 a 4 insights CURTOS e ACIONÁVEIS (o que observar, onde cortar, qual risco). Direto, sem rodeios, em português. Responda SOMENTE JSON: {"insights":["...","..."]}' },
        { role: 'user', content: resumo },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })
    const txt = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(txt) as { insights?: string[] }
    const insights = Array.isArray(parsed.insights) && parsed.insights.length ? parsed.insights.slice(0, 4) : fb
    return NextResponse.json({ analise: insights, fonte: 'ia' })
  } catch {
    return NextResponse.json({ analise: fb, fonte: 'regra' })
  }
}

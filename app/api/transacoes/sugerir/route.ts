import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'
import { registrarAcaoAgente } from '@/lib/agentes-log'

export const runtime = 'nodejs'

const CATS = [
  'Alimentação', 'Transporte / Combustível', 'Software / SaaS', 'Marketing',
  'Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Serviços',
  'Receita de vendas', 'Tarifas bancárias', 'Outros',
]

const STOP = new Set(['pix', 'ted', 'doc', 'recebido', 'enviado', 'compra', 'pagamento', 'transferencia', 'transferência', 'demo', 'para', 'com', 'sarl'])

// chave = 1º token relevante da descrição (o "estabelecimento"), pra casar histórico
function chave(desc: string): string {
  const toks = desc.toLowerCase().replace(/\[demo\]/g, '').replace(/[^a-z0-9à-ú ]/gi, ' ').split(/\s+/)
  return toks.find(w => w.length >= 3 && !STOP.has(w)) ?? ''
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { data } = await supabase.from('transacoes').select('id,descricao,categoria').eq('empresa_id', empresaId).limit(500)
  const rows = (data ?? []) as { id: string; descricao: string; categoria: string | null }[]
  const pend = rows.filter(r => !r.categoria || r.categoria.trim() === '')
  if (pend.length === 0) return NextResponse.json({ sugestoes: {} })

  // APRENDE do histórico: chave -> categoria mais usada por você
  const hist = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.categoria || !r.categoria.trim()) continue
    const k = chave(r.descricao); if (!k) continue
    if (!hist.has(k)) hist.set(k, new Map())
    const m = hist.get(k)!; m.set(r.categoria, (m.get(r.categoria) || 0) + 1)
  }
  const aprendido = (desc: string): string | null => {
    const k = chave(desc); const m = k ? hist.get(k) : null
    if (!m) return null
    let best = '', n = 0
    for (const [c, ct] of Array.from(m.entries())) if (ct > n) { best = c; n = ct }
    return best || null
  }

  const sugestoes: Record<string, { categoria: string; fonte: 'aprendido' | 'ia' }> = {}
  const paraIA: { id: string; texto: string }[] = []
  for (const r of pend) {
    const ap = aprendido(r.descricao)
    if (ap) sugestoes[r.id] = { categoria: ap, fonte: 'aprendido' }
    else paraIA.push({ id: r.id, texto: r.descricao.replace(/\[demo\]/g, '').trim() })
  }
  if (paraIA.length) {
    const mapa = await categorizarLoteIA(paraIA, CATS)
    for (const [id, cat] of Object.entries(mapa)) sugestoes[id] = { categoria: cat, fonte: 'ia' }
  }
  const nSugeridas = Object.keys(sugestoes).length
  if (nSugeridas > 0) {
    void registrarAcaoAgente(supabase, empresaId, 'louis', `Sugeriu categoria para ${nSugeridas} transaç${nSugeridas === 1 ? 'ão' : 'ões'}`, {
      detalhe: `${paraIA.length} via IA · ${nSugeridas - paraIA.length} aprendidas do histórico`,
    })
  }
  return NextResponse.json({ sugestoes })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { construirHistorico, melhorDoHistorico } from '@/lib/banco/sugestoes'
import { CATEGORIAS } from '@/lib/banco/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { data } = await supabase.from('transacoes').select('id,descricao,categoria').eq('empresa_id', empresaId).limit(500)
  const rows = (data ?? []) as { id: string; descricao: string; categoria: string | null }[]
  const pend = rows.filter(r => !r.categoria || r.categoria.trim() === '')
  if (pend.length === 0) return NextResponse.json({ sugestoes: {} })

  const hist = construirHistorico(rows)

  const sugestoes: Record<string, { categoria: string; fonte: 'aprendido' | 'ia' }> = {}
  const paraIA: { id: string; texto: string }[] = []
  for (const r of pend) {
    const ap = melhorDoHistorico(hist, r.descricao)
    if (ap) sugestoes[r.id] = { categoria: ap, fonte: 'aprendido' }
    else paraIA.push({ id: r.id, texto: r.descricao.replace(/\[demo\]/g, '').trim() })
  }
  if (paraIA.length) {
    const mapa = await categorizarLoteIA(paraIA, [...CATEGORIAS])
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

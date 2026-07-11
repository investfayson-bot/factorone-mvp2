import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'
import { erroDesconhecido } from '@/lib/transacao-types'

// TODO(migração pendente, PRÓXIMA tarefa após Extrato validado em produção
// com dado real): mesma situação de app/api/banco/fila/route.ts — motor
// ANTIGO aqui, motor NOVO (lib/financeiro/motorClassificacao.ts) já rodando
// no Extrato (Fase 3). Não avançar pra Fase 4 do pacote de reskin sem essa
// migração feita ou agendada com data — dois motores coexistindo geram
// categoria divergente pro mesmo estabelecimento.

export const runtime = 'nodejs'

const SEM_CATEGORIA = (c: unknown) => {
  const s = String(c ?? '').trim().toLowerCase()
  return s === '' || s === 'outros' || s === 'sem categoria'
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const bloqueio = await bloquearSeLeitura(supabase, user.id)
    if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id

    const { data, error } = await supabase
      .from('extrato_bancario')
      .select('id, descricao, categoria, contraparte_nome, tipo')
      .eq('empresa_id', empresaId)
      .order('data_transacao', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const pendentes = (data ?? []).filter(t => SEM_CATEGORIA(t.categoria))
    if (pendentes.length === 0) {
      return NextResponse.json({ categorizadas: 0, mensagem: 'Nada a categorizar — extrato já classificado.' })
    }

    const itens = pendentes.map(t => ({
      id: t.id as string,
      texto: [t.descricao, t.contraparte_nome].filter(Boolean).join(' · '),
    }))
    const mapa = await categorizarLoteIA(itens)

    let n = 0
    await Promise.all(
      Object.entries(mapa).map(async ([id, categoria]) => {
        const { error: e } = await supabase.from('extrato_bancario').update({ categoria }).eq('id', id)
        if (!e) n++
      }),
    )

    return NextResponse.json({ categorizadas: n, total_pendentes: pendentes.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'
import { buscarPosicoesConsolidadas, CLASSE_LABEL } from '@/lib/banco/posicoes'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Banco › Investimentos (Fase 3). Une `investimentos` (PJ) e
// `investimentos_pf` (PF) via lib/banco/posicoes.ts — ver TODO de dívida
// técnica lá sobre migrar pra uma tabela única no futuro.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as EscopoBanco) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds, empresaNomes, incluiPf } = resolvido

  const posicoes = await buscarPosicoesConsolidadas(db, { empresaIds, empresaNomes, incluiPf, userId: user.id })

  const patrimonioInvestido = posicoes.reduce((s, p) => s + p.valor_atual, 0)
  const rentabilidadeMedia = patrimonioInvestido > 0
    ? posicoes.reduce((s, p) => s + p.rentabilidade_pct * (p.valor_atual / patrimonioInvestido), 0)
    : 0

  const porClasse = new Map<string, number>()
  for (const p of posicoes) porClasse.set(p.classe, (porClasse.get(p.classe) ?? 0) + p.valor_atual)
  const alocacao = Array.from(porClasse.entries())
    .map(([classe, valor]) => ({ classe, label: CLASSE_LABEL[classe as keyof typeof CLASSE_LABEL], valor, pct: patrimonioInvestido > 0 ? (valor / patrimonioInvestido) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)

  const porInstituicao = new Map<string, number>()
  for (const p of posicoes) porInstituicao.set(p.instituicao ?? 'Manual (sem instituição)', (porInstituicao.get(p.instituicao ?? 'Manual (sem instituição)') ?? 0) + p.valor_atual)
  const instituicoes = Array.from(porInstituicao.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)

  // Proventos: não existe tabela dedicada de dividendos/cupons ainda — em vez
  // de estimar um número sem base real, lemos o que já chega marcado como
  // rendimento no extrato (extrato_bancario.tipo_operacao='rendimento' pro
  // PJ, belvo_transacoes.categoria contendo dividendo/rendimento/juros/cupom
  // pra PF). Se nada estiver marcado assim, o card fica vazio — não inventamos.
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  // Limite alto (não é o tamanho do feed exibido) — só um teto de segurança
  // pra não somar um mês inteiro incompleto quando a lista de proventos passa
  // de "poucos", já que a query está limitada ao mês corrente por data.
  const [proventosPjR, proventosPfR] = await Promise.all([
    empresaIds.length
      ? db.from('extrato_bancario').select('id, descricao, valor, data_transacao').in('empresa_id', empresaIds).eq('tipo_operacao', 'rendimento').gte('data_transacao', inicioMes).order('data_transacao', { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('belvo_transacoes').select('id, descricao, valor, data').eq('user_id', user.id).is('empresa_id', null)
          .or('categoria.ilike.%rendimento%,categoria.ilike.%dividendo%,categoria.ilike.%juros%,categoria.ilike.%cupom%')
          .gte('data', inicioMes).order('data', { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
  ])
  const proventosOrdenados = [
    ...((proventosPjR.data ?? []) as { id: string; descricao: string; valor: number; data_transacao: string }[]).map(p => ({ id: p.id, descricao: p.descricao, valor: Number(p.valor), data: p.data_transacao })),
    ...((proventosPfR.data ?? []) as { id: string; descricao: string; valor: number; data: string }[]).map(p => ({ id: p.id, descricao: p.descricao, valor: Number(p.valor), data: p.data })),
  ].sort((a, b) => b.data.localeCompare(a.data))
  const proventosMes = proventosOrdenados.reduce((s, p) => s + p.valor, 0)

  return NextResponse.json({
    patrimonio_investido: patrimonioInvestido,
    rentabilidade_media_pct: rentabilidadeMedia,
    instituicoes_count: instituicoes.length,
    proventos_mes: proventosMes,
    proventos_recentes: proventosOrdenados.slice(0, 5),
    alocacao,
    instituicoes,
    posicoes,
  })
}

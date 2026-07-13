import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { resolverEscopoBanco, type EscopoBanco } from '@/lib/banco/escopo'
import { classificar } from '@/lib/financeiro/motorClassificacao'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const SEM_CATEGORIA = (c: string | null) => !c || c.trim() === '' || c.trim().toLowerCase() === 'outros'

export type ExtratoLinha = {
  id: string; titularidade: 'pj' | 'pf'; empresa_id: string | null; empresa_nome: string | null
  descricao: string; valor: number; tipo: 'entrada' | 'saida'; data: string
  categoria: string | null; status_classificacao: 'sugerida' | 'aguardando_ok' | 'confirmada'
  origem_documento: string | null; documento_anexo_url: string | null
}

// Extrato (Fase 3) — só o canal NOVO de classificação (motorClassificacao,
// Fase 0). banco/fila e conta-pj/categorizar-extrato continuam no motor
// antigo por decisão explícita (ver TODO nesses arquivos) até migração
// agendada — não mexe neles aqui, de propósito.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const escopo = (url.searchParams.get('escopo') as EscopoBanco) || 'consolidado'
  const grupoId = url.searchParams.get('grupoId')
  const statusFiltro = url.searchParams.get('status') // 'todas'|'classificadas'|'pendentes'
  const tipoFiltro = url.searchParams.get('tipo') // 'todas'|'entrada'|'saida'

  const db = svc()
  const resolvido = await resolverEscopoBanco(db, user.id, escopo, grupoId)
  if ('erro' in resolvido) return NextResponse.json({ error: resolvido.erro }, { status: 404 })
  const { empresaIds, empresaNomes, incluiPf } = resolvido

  const [pjR, pfR] = await Promise.all([
    empresaIds.length
      ? db.from('extrato_bancario')
          .select('id, empresa_id, descricao, valor, tipo, data_transacao, categoria, status_classificacao, origem_documento, comprovante_url, contraparte_nome')
          .in('empresa_id', empresaIds).order('data_transacao', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
    incluiPf
      ? db.from('belvo_transacoes')
          .select('id, descricao, valor, tipo, data, categoria, status_classificacao, origem_documento, documento_anexo_url, estabelecimento')
          .eq('user_id', user.id).is('empresa_id', null).order('data', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
  ])

  let linhas: ExtratoLinha[] = [
    ...((pjR.data ?? []) as Array<{ id: string; empresa_id: string; descricao: string; valor: number; tipo: string; data_transacao: string; categoria: string | null; status_classificacao: string | null; origem_documento: string | null; comprovante_url: string | null; contraparte_nome: string | null }>).map(t => ({
      id: t.id, titularidade: 'pj' as const, empresa_id: t.empresa_id, empresa_nome: empresaNomes.get(t.empresa_id) ?? null,
      descricao: t.contraparte_nome || t.descricao, valor: Number(t.valor), tipo: (t.tipo === 'credito' ? 'entrada' : 'saida') as 'entrada' | 'saida',
      data: String(t.data_transacao).slice(0, 10), categoria: t.categoria,
      status_classificacao: (t.status_classificacao ?? 'confirmada') as ExtratoLinha['status_classificacao'],
      origem_documento: t.origem_documento, documento_anexo_url: t.comprovante_url,
    })),
    ...((pfR.data ?? []) as Array<{ id: string; descricao: string; valor: number; tipo: string; data: string; categoria: string | null; status_classificacao: string | null; origem_documento: string | null; documento_anexo_url: string | null; estabelecimento: string | null }>).map(t => ({
      id: t.id, titularidade: 'pf' as const, empresa_id: null, empresa_nome: null,
      descricao: t.estabelecimento || t.descricao, valor: Number(t.valor), tipo: (t.tipo === 'INFLOW' ? 'entrada' : 'saida') as 'entrada' | 'saida',
      data: String(t.data).slice(0, 10), categoria: t.categoria,
      status_classificacao: (t.status_classificacao ?? 'confirmada') as ExtratoLinha['status_classificacao'],
      origem_documento: t.origem_documento, documento_anexo_url: t.documento_anexo_url,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  // Motor novo (Fase 0) entra só pra quem o motor antigo nunca classificou
  // (categoria vazia/"Outros") — primeira vez que ESSA tela toca a linha.
  const categoriasPj = ['Fornecedores', 'Marketing', 'Impostos/Taxas', 'Folha de Pagamento', 'Serviços de Terceiros', 'Aluguel/Infraestrutura', 'Tecnologia/Software', 'Consultoria', 'Outros']
  const categoriasPf = ['Mercado', 'Lazer', 'Saúde', 'Transporte', 'Moradia', 'Educação', 'Outros']
  const pendentes = linhas.filter(l => SEM_CATEGORIA(l.categoria)).slice(0, 40) // limite de segurança por página

  for (const l of pendentes) {
    const tid: Parameters<typeof classificar>[1] = l.titularidade === 'pj' && l.empresa_id ? { empresaId: l.empresa_id } : { pessoaFisicaUserId: user.id }
    const resultado = await classificar(db, tid, l.descricao, l.titularidade === 'pj' ? categoriasPj : categoriasPf)
    l.categoria = resultado.categoria
    l.status_classificacao = resultado.status
    const tabela = l.titularidade === 'pj' ? 'extrato_bancario' : 'belvo_transacoes'
    await db.from(tabela).update({ categoria: resultado.categoria, status_classificacao: resultado.status }).eq('id', l.id)
  }

  if (statusFiltro === 'classificadas') linhas = linhas.filter(l => l.status_classificacao === 'confirmada')
  if (statusFiltro === 'pendentes') linhas = linhas.filter(l => l.status_classificacao !== 'confirmada')
  if (tipoFiltro === 'entrada' || tipoFiltro === 'saida') linhas = linhas.filter(l => l.tipo === tipoFiltro)

  return NextResponse.json({ linhas, pendentes_confirmacao: linhas.filter(l => l.status_classificacao === 'aguardando_ok').length })
}

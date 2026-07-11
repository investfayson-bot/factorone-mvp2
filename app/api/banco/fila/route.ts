import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { classificarLote } from '@/lib/financeiro/motorClassificacao'

// Migrado pro motor novo (Fase 0/lib/financeiro/motorClassificacao.ts) em
// 2026-07-11, depois do Extrato (Fase 3) validado em produção com dado
// real. Antes disso o "aprendido" vinha de um scan local do histórico de
// transacoes (construirHistorico/melhorDoHistorico) — trocado pela mesma
// fonte persistida (regras_classificacao) que o Extrato usa, pra não ter
// dois motores divergindo pro mesmo estabelecimento.
import { matchContraparte, matchContaPrevista, type Cadastro, type ContaPrevista } from '@/lib/banco/sugestoes'
import { CATEGORIAS, type FilaItem } from '@/lib/banco/types'

export const runtime = 'nodejs'

/**
 * Monta a fila do Banco: itens não conciliados do extrato, cada um com
 * sugestão de categoria (histórico → IA), fornecedor/cliente (CNPJ → nome)
 * e conta a pagar/receber candidata (valor+data, score > 0.5).
 */
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const [exR, fornR, cliR, pgR, rcR] = await Promise.all([
    supabase.from('extrato_bancario')
      .select('id,descricao,valor,tipo,data_transacao,contraparte_nome,contraparte_documento')
      .eq('empresa_id', empresaId).eq('conciliado', false)
      .order('data_transacao', { ascending: false }).limit(100),
    supabase.from('fornecedores').select('id,razao_social,nome_fantasia,cnpj').eq('empresa_id', empresaId),
    supabase.from('clientes').select('id,nome,cnpj_cpf').eq('empresa_id', empresaId),
    supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']),
    supabase.from('contas_receber').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_recebida']),
  ])

  const extrato = exR.data ?? []
  const fornecedores: Cadastro[] = (fornR.data ?? []).map(f => ({ id: f.id, nome: f.nome_fantasia || f.razao_social, documento: f.cnpj }))
  const clientes: Cadastro[] = (cliR.data ?? []).map(c => ({ id: c.id, nome: c.nome, documento: c.cnpj_cpf }))
  const pagar = (pgR.data ?? []).map(p => ({ ...p, valor: Number(p.valor) })) as ContaPrevista[]
  const receber = (rcR.data ?? []).map(r => ({ ...r, valor: Number(r.valor) })) as ContaPrevista[]

  const usadasPagar = new Set<string>(), usadasReceber = new Set<string>()
  const itens: FilaItem[] = []

  for (const e of extrato) {
    const data = String(e.data_transacao).slice(0, 10)
    const ehSaida = e.tipo === 'debito'
    const cadastros = ehSaida ? fornecedores : clientes
    const cad = matchContraparte(e.contraparte_nome, e.contraparte_documento, cadastros)
    const conta = matchContaPrevista(Number(e.valor), data, ehSaida ? pagar : receber, ehSaida ? usadasPagar : usadasReceber)

    itens.push({
      extrato_id: e.id, data, descricao: e.descricao, tipo: e.tipo, valor: Number(e.valor),
      contraparte_nome: e.contraparte_nome, contraparte_documento: e.contraparte_documento,
      sugestao_categoria: null, // preenchido abaixo pelo motor de classificação em lote
      sugestao_cadastro: cad ? { tipo: ehSaida ? 'fornecedor' : 'cliente', ...cad } : null,
      sugestao_criar: !cad && e.contraparte_nome && e.contraparte_nome.trim().length >= 4
        ? { tipo: ehSaida ? 'fornecedor' : 'cliente', nome: e.contraparte_nome.trim() } : null,
      conta_prevista: conta
        ? { tipo: ehSaida ? 'pagar' : 'receber', id: conta.conta.id, descricao: conta.conta.descricao, valor: conta.conta.valor, data_vencimento: conta.conta.data_vencimento, diffPct: conta.diffPct }
        : null,
    })
  }

  if (itens.length) {
    const paraClassificar = extrato.map(e => ({ id: e.id as string, texto: `${e.descricao} ${e.contraparte_nome ?? ''}`.trim() }))
    const resultados = await classificarLote(supabase, { empresaId }, paraClassificar, [...CATEGORIAS])
    const porId = new Map(resultados.map(r => [r.id, r]))
    for (const item of itens) {
      const r = porId.get(item.extrato_id)
      if (r) item.sugestao_categoria = { categoria: r.categoria, fonte: r.status === 'aguardando_ok' ? 'aprendido' : 'ia' }
    }
  }

  return NextResponse.json({ itens })
}

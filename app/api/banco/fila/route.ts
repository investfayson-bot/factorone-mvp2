import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'

// TODO(migração pendente, PRÓXIMA tarefa após Extrato validado em produção
// com dado real): esta rota usa o motor de classificação ANTIGO
// (categorizarLoteIA, sem aprendizado persistente, sem separação PJ/PF).
// O Extrato novo (Fase 3, /dashboard/banco/extrato) já usa o motor NOVO
// (lib/financeiro/motorClassificacao.ts, com regras_classificacao). Manter
// os dois motores coexistindo por mais tempo que o necessário é pior que
// tabela duplicada: pode gerar categoria divergente pro mesmo
// estabelecimento dependendo de qual tela classificou primeiro. Não
// avançar pra Fase 4 do pacote de reskin sem essa migração feita ou pelo
// menos agendada com data. Ver docs/factorone-cursor-package* e a memória
// "pacote-fases-reskin" pro contexto completo dessa decisão.
import { construirHistorico, melhorDoHistorico, matchContraparte, matchContaPrevista, type Cadastro, type ContaPrevista } from '@/lib/banco/sugestoes'
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

  const [exR, txR, fornR, cliR, pgR, rcR] = await Promise.all([
    supabase.from('extrato_bancario')
      .select('id,descricao,valor,tipo,data_transacao,contraparte_nome,contraparte_documento')
      .eq('empresa_id', empresaId).eq('conciliado', false)
      .order('data_transacao', { ascending: false }).limit(100),
    supabase.from('transacoes').select('descricao,categoria').eq('empresa_id', empresaId).limit(500),
    supabase.from('fornecedores').select('id,razao_social,nome_fantasia,cnpj').eq('empresa_id', empresaId),
    supabase.from('clientes').select('id,nome,cnpj_cpf').eq('empresa_id', empresaId),
    supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']),
    supabase.from('contas_receber').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_recebida']),
  ])

  const extrato = exR.data ?? []
  const hist = construirHistorico((txR.data ?? []) as { descricao: string; categoria: string | null }[])
  const fornecedores: Cadastro[] = (fornR.data ?? []).map(f => ({ id: f.id, nome: f.nome_fantasia || f.razao_social, documento: f.cnpj }))
  const clientes: Cadastro[] = (cliR.data ?? []).map(c => ({ id: c.id, nome: c.nome, documento: c.cnpj_cpf }))
  const pagar = (pgR.data ?? []).map(p => ({ ...p, valor: Number(p.valor) })) as ContaPrevista[]
  const receber = (rcR.data ?? []).map(r => ({ ...r, valor: Number(r.valor) })) as ContaPrevista[]

  const usadasPagar = new Set<string>(), usadasReceber = new Set<string>()
  const itens: FilaItem[] = []
  const paraIA: { id: string; texto: string }[] = []

  for (const e of extrato) {
    const data = String(e.data_transacao).slice(0, 10)
    const ehSaida = e.tipo === 'debito'
    const cadastros = ehSaida ? fornecedores : clientes
    const cad = matchContraparte(e.contraparte_nome, e.contraparte_documento, cadastros)
    const conta = matchContaPrevista(Number(e.valor), data, ehSaida ? pagar : receber, ehSaida ? usadasPagar : usadasReceber)
    const ap = melhorDoHistorico(hist, e.descricao)
    if (!ap) paraIA.push({ id: e.id, texto: `${e.descricao} ${e.contraparte_nome ?? ''}`.trim() })

    itens.push({
      extrato_id: e.id, data, descricao: e.descricao, tipo: e.tipo, valor: Number(e.valor),
      contraparte_nome: e.contraparte_nome, contraparte_documento: e.contraparte_documento,
      sugestao_categoria: ap ? { categoria: ap, fonte: 'aprendido' } : null,
      sugestao_cadastro: cad ? { tipo: ehSaida ? 'fornecedor' : 'cliente', ...cad } : null,
      sugestao_criar: !cad && e.contraparte_nome && e.contraparte_nome.trim().length >= 4
        ? { tipo: ehSaida ? 'fornecedor' : 'cliente', nome: e.contraparte_nome.trim() } : null,
      conta_prevista: conta
        ? { tipo: ehSaida ? 'pagar' : 'receber', id: conta.conta.id, descricao: conta.conta.descricao, valor: conta.conta.valor, data_vencimento: conta.conta.data_vencimento, diffPct: conta.diffPct }
        : null,
    })
  }

  if (paraIA.length) {
    const mapa = await categorizarLoteIA(paraIA, [...CATEGORIAS])
    for (const item of itens) {
      const cat = mapa[item.extrato_id]
      if (!item.sugestao_categoria && cat) item.sugestao_categoria = { categoria: cat, fonte: 'ia' }
    }
  }

  return NextResponse.json({ itens })
}

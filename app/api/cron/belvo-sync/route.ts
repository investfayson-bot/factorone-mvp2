import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { belvoFetch } from '@/lib/belvo'
import { matchComprovantesPendentes } from '@/lib/financeiro/matchComprovante'

export const runtime = 'nodejs'
export const maxDuration = 300

function svc(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Owner = { empresa_id: string | null; user_id: string | null }

type BelvoAccount = {
  id: string; name?: string; number?: string; category?: string; type?: string; currency?: string
  institution?: { name?: string }; balance?: { current?: number; available?: number }
  credit_data?: { credit_limit?: number } & Record<string, unknown>
}
type BelvoTransaction = {
  id: string; amount?: number; currency?: string; description?: string
  value_date?: string; accounting_date?: string; type?: string; category?: string
  merchant?: { name?: string } | null; account?: { id?: string; name?: string; number?: string } | null
}

async function persistContas(db: SupabaseClient, link: string, owner: Owner, accounts: BelvoAccount[]) {
  if (!accounts.length) return
  await db.from('belvo_contas').upsert(accounts.map(a => ({
    belvo_id: a.id, link_id: link, empresa_id: owner.empresa_id, user_id: owner.user_id,
    nome: a.name ?? null, numero: a.number ?? null, categoria: a.category ?? null, tipo: a.type ?? null,
    instituicao: a.institution?.name ?? null, saldo: a.balance?.current ?? null, disponivel: a.balance?.available ?? null,
    limite_credito: a.credit_data?.credit_limit ?? null, credit_data: a.credit_data ?? null, moeda: a.currency ?? null,
    updated_at: new Date().toISOString(),
  })), { onConflict: 'belvo_id' })
}

async function persistTransacoes(db: SupabaseClient, link: string, owner: Owner, txs: BelvoTransaction[]) {
  if (!txs.length) return
  await db.from('belvo_transacoes').upsert(txs.map(t => ({
    belvo_id: t.id, link_id: link, conta_belvo_id: t.account?.id ?? null,
    empresa_id: owner.empresa_id, user_id: owner.user_id,
    data: t.value_date || t.accounting_date || null, descricao: t.description ?? null, categoria: t.category ?? null,
    estabelecimento: t.merchant?.name ?? null, conta: t.account?.name ?? t.account?.number ?? null,
    tipo: t.type ?? null, valor: t.amount ?? null, moeda: t.currency ?? null,
  })), { onConflict: 'belvo_id' })
}

function isOut(t: BelvoTransaction) { return (t.type || '').toUpperCase() === 'OUTFLOW' || (t.amount ?? 0) < 0 }
function descTx(t: BelvoTransaction) { return t.description || t.merchant?.name || 'Transação' }
function dataTx(t: BelvoTransaction) { return t.value_date || t.accounting_date || null }

async function syncNativo(db: SupabaseClient, owner: Owner, accounts: BelvoAccount[], txs: BelvoTransaction[]) {
  if (owner.empresa_id) {
    const empresaId = owner.empresa_id
    // find-or-create + atualiza saldo das contas
    const mapa = new Map<string, string>()
    for (const a of accounts) {
      const saldo = a.balance?.current ?? 0
      const disponivel = a.balance?.available ?? a.balance?.current ?? 0
      const existente = await db.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('open_finance_id', a.id).maybeSingle()
      let contaId = existente.data?.id as string | undefined
      if (contaId) {
        await db.from('contas_bancarias').update({ saldo, saldo_disponivel: disponivel }).eq('id', contaId)
      } else {
        const cat = (a.category ?? '').toUpperCase()
        const nova = await db.from('contas_bancarias').insert({
          empresa_id: empresaId, banco_nome: a.institution?.name || a.name || 'Banco (Open Finance)',
          tipo: cat.includes('SAV') || cat.includes('POUP') ? 'poupanca' : 'corrente',
          open_finance_id: a.id, saldo, saldo_disponivel: disponivel, status: 'ativa',
        }).select('id').maybeSingle()
        contaId = nova.data?.id as string | undefined
      }
      if (contaId) mapa.set(a.id, contaId)
    }
    const fallback = await db.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('status', 'ativa').maybeSingle()
    const fallbackId = fallback.data?.id ?? null
    if (txs.length) {
      await db.from('extrato_bancario').upsert(txs.map(t => ({
        empresa_id: empresaId,
        conta_bancaria_id: (t.account?.id && mapa.get(t.account.id)) || fallbackId,
        tipo: isOut(t) ? 'debito' : 'credito', descricao: descTx(t), data_transacao: dataTx(t),
        valor: Math.abs(Number(t.amount ?? 0)), categoria: t.category ?? 'Outros', origem: 'belvo', belvo_tx_id: t.id,
      })), { onConflict: 'belvo_tx_id' })
    }
    return
  }
  // PF
  const userId = owner.user_id
  if (!userId || !txs.length) return
  const despesas = txs.filter(isOut).map(t => ({
    user_id: userId, descricao: descTx(t), valor: Math.abs(Number(t.amount ?? 0)),
    categoria: t.category ?? 'Outros', data_despesa: dataTx(t), status: 'pago', origem: 'belvo', belvo_tx_id: t.id,
  }))
  const receitas = txs.filter(t => !isOut(t)).map(t => ({
    user_id: userId, descricao: descTx(t), valor: Math.abs(Number(t.amount ?? 0)),
    categoria: t.category ?? 'Outros', data_recebimento: dataTx(t), belvo_tx_id: t.id,
  }))
  if (despesas.length) await db.from('despesas_pessoais').upsert(despesas, { onConflict: 'belvo_tx_id' })
  if (receitas.length) await db.from('receitas_pessoais').upsert(receitas, { onConflict: 'belvo_tx_id' })
}

export async function GET(req: NextRequest) {
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = svc()
  const { data: links } = await db.from('belvo_links').select('link_id, empresa_id, user_id')

  const hoje = new Date()
  const df = new Date(hoje.getTime() - 35 * 864e5).toISOString().slice(0, 10) // incremental
  const dt = hoje.toISOString().slice(0, 10)

  let okCount = 0, totalTx = 0
  const erros: { link: string; erro: string }[] = []

  for (const l of links ?? []) {
    const link = l.link_id as string
    const owner: Owner = { empresa_id: (l.empresa_id as string) || null, user_id: (l.user_id as string) || null }
    try {
      const accounts = await belvoFetch<BelvoAccount[]>('/api/accounts/', { method: 'POST', body: JSON.stringify({ link }) })
      const txs = await belvoFetch<BelvoTransaction[]>('/api/transactions/', { method: 'POST', body: JSON.stringify({ link, date_from: df, date_to: dt }) })
      await persistContas(db, link, owner, accounts)
      await persistTransacoes(db, link, owner, txs)
      await syncNativo(db, owner, accounts, txs)
      if (owner.empresa_id) await matchComprovantesPendentes(db, owner.empresa_id)
      okCount++
      totalTx += txs.length
    } catch (e) {
      erros.push({ link, erro: e instanceof Error ? e.message : 'erro' })
    }
  }

  // Classificação automática via Action Engine: linhas sem categoria
  // inseridas na última hora. Confiança >= 3 (estabelecimento já confirmado
  // 3+ vezes por essa empresa) resolve sozinho; caso contrário vira work_item
  // pro usuário confirmar em /dashboard/banco/extrato.
  const { data: pendentes } = await db
    .from('extrato_bancario')
    .select('id, descricao, contraparte_nome, categoria, valor, empresa_id')
    .or('categoria.eq.Outros,categoria.is.null')
    .neq('status_classificacao', 'confirmada')
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    .limit(500)

  const errosClassificacao: { empresaId: string; linhaId: string; erro: string }[] = []

  if (pendentes?.length) {
    const { classificarLote, confirmarClassificacao } = await import('@/lib/financeiro/motorClassificacao')
    const { registrarResultado } = await import('@/lib/action-engine/registrarResultado')
    const { CATEGORIAS } = await import('@/lib/banco/types')
    const LIMIAR_CONFIANCA_AUTO = 3

    const porEmpresa = new Map<string, typeof pendentes>()
    for (const p of pendentes) {
      const eid = p.empresa_id as string
      if (!eid) continue
      if (!porEmpresa.has(eid)) porEmpresa.set(eid, [])
      porEmpresa.get(eid)!.push(p)
    }

    for (const [empresaId, linhas] of Array.from(porEmpresa.entries())) {
      const itens = linhas.map(l => ({ id: l.id as string, texto: [l.descricao, l.contraparte_nome].filter(Boolean).join(' · ') }))
      const resultados = await classificarLote(db, { empresaId }, itens, [...CATEGORIAS])
      const porId = new Map(resultados.map(r => [r.id, r]))

      for (const linha of linhas) {
        const r = porId.get(linha.id as string)
        if (!r) continue
        const resolveSozinho = r.status === 'aguardando_ok' && r.confianca >= LIMIAR_CONFIANCA_AUTO
        const novoStatus = resolveSozinho ? 'confirmada' : r.status

        try {
          // registrarResultado primeiro: garante que todo lançamento
          // auto-classificado tem rastro no Action Engine antes de mutar
          // extrato_bancario/regras_classificacao. Se registrarResultado
          // falhar, a linha não é tocada — fica pendente pra próxima
          // execução, em vez de "confirmada" silenciosamente sem work_item.
          // Trade-off aceito: se registrarResultado tiver sucesso mas um
          // passo SEGUINTE falhar (update/confirmarClassificacao), a linha
          // é reprocessada no próximo ciclo e um SEGUNDO work_item
          // 'resolvido' pode ser criado pro mesmo origem_ref (o índice de
          // dedup só cobre itens abertos) — ruído de auditoria, não perda
          // de dado nem bug visível ao usuário.
          await registrarResultado(db, {
            empresaId,
            tipo: 'transaction_received',
            origem: 'open_finance',
            origemRef: `extrato_bancario:${linha.id}`,
            responsavelPapel: 'financeiro',
            resolvidoAutomaticamente: resolveSozinho,
            impactoValor: Math.abs(Number(linha.valor) || 0),
            sugestaoIa: { categoria: r.categoria, confianca: r.confianca },
            decisaoDetalhe: resolveSozinho ? { categoria: r.categoria, confianca: r.confianca } : undefined,
          })

          await db.from('extrato_bancario').update({ categoria: r.categoria, status_classificacao: novoStatus }).eq('id', linha.id)
          if (resolveSozinho) {
            await confirmarClassificacao(db, { empresaId }, [linha.descricao, linha.contraparte_nome].filter(Boolean).join(' · '), r.categoria)
          }
        } catch (e) {
          // Falha em qualquer etapa não pode abortar o resto do lote — loga,
          // acumula pro response, e segue pra próxima linha.
          const erro = e instanceof Error ? e.message : 'erro'
          console.error(`classificação falhou para extrato_bancario:${linha.id}`, e)
          errosClassificacao.push({ empresaId, linhaId: linha.id as string, erro })
        }
      }
    }
  }

  return NextResponse.json({ links: (links ?? []).length, sincronizados: okCount, transacoes: totalTx, erros, errosClassificacao })
}

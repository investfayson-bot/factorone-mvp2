import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { classificarLote } from '@/lib/financeiro/motorClassificacao'
import { CATEGORIAS } from '@/lib/banco/types'

export const runtime = 'nodejs'
// Max body size for App Router: configure via next.config
// OFX/CSV files typically < 2MB, well within 4MB default

// Migrado pro motor novo (Fase 0/lib/financeiro/motorClassificacao.ts) em
// 2026-07-11, depois do Extrato (Fase 3) validado em produção com dado
// real. categorizarComIA() (prompt Anthropic ad-hoc, categorias
// hardcoded diferentes das outras rotas) foi o terceiro ponto no motor
// antigo — trocado por classificarLote, mesma fonte/categorias que
// Extrato e fila usam agora.

type Transacao = { data: string; descricao: string; valor: number; tipo: 'credito' | 'debito'; categoria?: string; status_classificacao?: 'sugerida' | 'aguardando_ok' }

function parseOFX(text: string): Transacao[] {
  const txs: Transacao[] = []
  const stmtRgx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let m: RegExpExecArray | null
  while ((m = stmtRgx.exec(text)) !== null) {
    const block = m[1]
    const get = (tag: string) => new RegExp(`<${tag}>([^<\r\n]+)`).exec(block)?.[1]?.trim() ?? ''
    const trntype = get('TRNTYPE')
    const dtposted = get('DTPOSTED').slice(0, 8)
    const trnamt = parseFloat(get('TRNAMT').replace(',', '.'))
    const memo = get('MEMO') || get('NAME') || 'Lançamento'
    if (!dtposted || isNaN(trnamt)) continue
    const data = `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`
    txs.push({ data, descricao: memo, valor: Math.abs(trnamt), tipo: trnamt >= 0 || trntype === 'CREDIT' ? 'credito' : 'debito' })
  }
  return txs
}

function parseCSV(text: string): Transacao[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const txs: Transacao[] = []
  const sep = text.includes(';') ? ';' : ','
  for (const line of lines.slice(1)) {
    const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length < 3) continue
    // Try common Brazilian bank CSV formats: date, description, value
    const [rawDate, desc, rawVal] = cols
    const val = parseFloat(rawVal.replace(/[^\d,.-]/g, '').replace(',', '.'))
    if (!rawDate || !desc || isNaN(val)) continue
    // Convert DD/MM/YYYY or YYYY-MM-DD
    let data = rawDate
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, mo, y] = rawDate.split('/')
      data = `${y}-${mo}-${d}`
    }
    txs.push({ data, descricao: desc, valor: Math.abs(val), tipo: val >= 0 ? 'credito' : 'debito' })
  }
  return txs
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = u?.empresa_id as string ?? user.id

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })

  const text = await file.text()
  const isOFX = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.ofc') || text.includes('<OFX>')
  const txs = isOFX ? parseOFX(text) : parseCSV(text)

  if (txs.length === 0) return NextResponse.json({ error: 'Nenhuma transação encontrada. Verifique o formato do arquivo (OFX ou CSV com data;descrição;valor).' }, { status: 422 })

  const itens = txs.map((t, i) => ({ id: String(i), texto: t.descricao }))
  const resultados = await classificarLote(db, { empresaId }, itens, [...CATEGORIAS])
  const categorizadas: Transacao[] = txs.map((t, i) => {
    const r = resultados.find(x => x.id === String(i))
    return { ...t, categoria: r?.categoria ?? 'Outros', status_classificacao: r?.status ?? 'sugerida' }
  })

  const conta = await db.from('contas_bancarias').select('id').eq('empresa_id', empresaId).eq('status', 'ativa').maybeSingle()
  const contaId = conta.data?.id ?? null

  // Insert into extrato_bancario (upsert on date+description to avoid dupes)
  const rows = categorizadas.map(t => ({
    empresa_id: empresaId,
    conta_bancaria_id: contaId,
    tipo: t.tipo,
    descricao: t.descricao,
    data_transacao: t.data,
    valor: t.valor,
    categoria: t.categoria ?? 'Outros',
    status_classificacao: t.status_classificacao,
    origem: 'importacao_ofx',
    origem_documento: 'manual',
  }))

  await db.from('extrato_bancario').insert(rows)

  return NextResponse.json({ importadas: txs.length, categorizadas: categorizadas.filter(t => t.categoria).length })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Item = { simbolo: string; nome: string; valor: number; variacao_pct: number | null; moeda: string }

const DEFAULT_TICKERS = ['PETR4', 'VALE3', 'ITSA4']

// Ticker de mercado (Fase 3, widget novo — não estava no mockup original).
// Fontes gratuitas, sem chave de API configurada hoje:
// - BRAPI (ações B3) funciona sem token para cotação de ação individual, mas
//   índices (^BVSP) e mercado dos EUA (S&P 500) exigem plano pago — por isso
//   não aparecem aqui. Não fabricamos esses números.
// - AwesomeAPI (câmbio USD/BRL) e CoinGecko (Bitcoin) são livres.
// Cache de 10min via `next.revalidate` do fetch (Data Cache do Next),
// conforme pedido no doc da fase (5-15min é aceitável).
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let tickers = DEFAULT_TICKERS
  try {
    const db = svc()
    const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    const [{ data: pf }, { data: pj }] = await Promise.all([
      db.from('investimentos_pf').select('ticker').eq('user_id', user.id).not('ticker', 'is', null).limit(3),
      db.from('investimentos').select('nome').eq('empresa_id', eid).eq('status', 'ativo').limit(10),
    ])
    const daCarteira = [
      ...((pf ?? []).map(p => p.ticker as string)),
      ...((pj ?? []).map(p => (p.nome as string).match(/\b[A-Z]{4}\d{1,2}\b/)?.[0]).filter((v): v is string => !!v)),
    ].filter(Boolean).slice(0, 3)
    if (daCarteira.length) tickers = daCarteira
  } catch { /* sem carteira ainda — usa os tickers padrão */ }

  const itens: Item[] = []

  await Promise.all([
    ...tickers.map(async sym => {
      try {
        const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(sym)}`, { next: { revalidate: 600 } })
        if (!r.ok) return
        const j = await r.json()
        const q = j?.results?.[0]
        if (q?.regularMarketPrice != null) {
          itens.push({ simbolo: sym, nome: q.shortName ?? sym, valor: Number(q.regularMarketPrice), variacao_pct: q.regularMarketChangePercent ?? null, moeda: 'BRL' })
        }
      } catch { /* fonte fora do ar — só não entra no ticker */ }
    }),
    (async () => {
      try {
        const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { next: { revalidate: 600 } })
        if (!r.ok) return
        const j = await r.json()
        const q = j?.USDBRL
        if (q?.bid) itens.push({ simbolo: 'USD/BRL', nome: 'Dólar', valor: Number(q.bid), variacao_pct: q.pctChange ? Number(q.pctChange) : null, moeda: 'BRL' })
      } catch { /* fonte fora do ar */ }
    })(),
    (async () => {
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true', { next: { revalidate: 600 } })
        if (!r.ok) return
        const j = await r.json()
        const q = j?.bitcoin
        if (q?.brl) itens.push({ simbolo: 'BTC', nome: 'Bitcoin', valor: Number(q.brl), variacao_pct: q.brl_24h_change != null ? Number(q.brl_24h_change) : null, moeda: 'BRL' })
      } catch { /* fonte fora do ar */ }
    })(),
  ])

  return NextResponse.json({ itens, atualizado_em: new Date().toISOString() })
}

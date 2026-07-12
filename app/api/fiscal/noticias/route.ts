import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
// Feed público — sem dado de tenant; cache de 1h no servidor basta e evita
// bater nos portais do governo a cada pageview.
export const revalidate = 3600

// Bloco 5 da Fase 5 — notícias de mudança de legislação, direto de RSS
// público gratuito (sem IA nesta fase, conforme spec): Receita Federal
// (Atom) + Agência Brasil economia (RSS), filtrado por palavras-chave
// tributárias. Testados em 2026-07-11, ambos respondem 200.
const FONTES = [
  { nome: 'Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS' },
  { nome: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml' },
]

const PALAVRAS = [
  'iss', 'icms', 'simples nacional', 'das', 'mei', 'irpj', 'csll', 'pis', 'cofins',
  'imposto', 'tribut', 'reforma tributária', 'nota fiscal', 'sped', 'e-cac', 'darf',
  'contribuição', 'alíquota', 'fisco', 'receita federal', 'declaração', 'cnpj',
]

type Noticia = { titulo: string; link: string; data: string | null; trecho: string; fonte: string }

function limparHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pegarTag(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1] : ''
}

// Um parser mínimo cobre os dois formatos: RSS usa <item>/<link>texto,
// Atom usa <entry>/<link href="...">.
function parsearFeed(xml: string, fonte: string): Noticia[] {
  const blocos = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? []
  return blocos.map(b => {
    const titulo = limparHtml(pegarTag(b, 'title'))
    let link = limparHtml(pegarTag(b, 'link'))
    if (!link) {
      const href = b.match(/<link[^>]*href="([^"]+)"/i)
      link = href ? href[1] : ''
    }
    const dataBruta = pegarTag(b, 'pubDate') || pegarTag(b, 'updated') || pegarTag(b, 'published')
    const dt = dataBruta ? new Date(limparHtml(dataBruta)) : null
    const trecho = limparHtml(pegarTag(b, 'description') || pegarTag(b, 'summary') || pegarTag(b, 'content')).slice(0, 180)
    return {
      titulo, link,
      data: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
      trecho, fonte,
    }
  }).filter(n => n.titulo && n.link)
}

function relevante(n: Noticia): boolean {
  const texto = `${n.titulo} ${n.trecho}`.toLowerCase()
  return PALAVRAS.some(p => texto.includes(p))
}

export async function GET() {
  const resultados = await Promise.allSettled(
    FONTES.map(async f => {
      const r = await fetch(f.url, { next: { revalidate: 3600 }, headers: { 'User-Agent': 'FactorOne/1.0 (+https://factorone-mvp2.vercel.app)' } })
      if (!r.ok) throw new Error(`${f.nome}: HTTP ${r.status}`)
      return parsearFeed(await r.text(), f.nome)
    })
  )

  const todas = resultados.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  const vistos = new Set<string>()
  const noticias = todas
    // sem data = item de navegação do portal (ex.: "Todas as notícias"), não é artigo
    .filter(n => n.data && relevante(n) && !vistos.has(n.link) && (vistos.add(n.link), true))
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
    .slice(0, 5)

  const falhas = resultados
    .map((r, i) => (r.status === 'rejected' ? FONTES[i].nome : null))
    .filter(Boolean)

  return NextResponse.json({ noticias, fontes_indisponiveis: falhas })
}

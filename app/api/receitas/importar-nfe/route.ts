import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export const runtime = 'nodejs'

function tag(xml: string, tagName: string): string {
  const m = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i'))
  return m?.[1]?.trim() ?? ''
}

function tagBlock(xml: string, blockTag: string): string {
  const m = xml.match(new RegExp(`<${blockTag}[^>]*>([\\s\\S]*?)</${blockTag}>`, 'i'))
  return m?.[1] ?? ''
}

function isoToDate(s: string): string {
  if (!s) return new Date().toISOString().slice(0, 10)
  return s.slice(0, 10)
}

function sugerirCategoria(descProd: string, natOp: string): string {
  const txt = `${descProd} ${natOp}`.toLowerCase()
  if (/servi[çc]o|software|consultoria|suporte|manuten|ti |tecnolog/.test(txt)) return 'Serviço'
  if (/consult/.test(txt)) return 'Consultoria'
  if (/projetos?/.test(txt)) return 'Projeto'
  if (/assinatura|licen[çc]a|mensalidade/.test(txt)) return 'Assinatura'
  if (/produto|mercadoria|material|peça/.test(txt)) return 'Produto'
  if (/aluguel|locação|locacao/.test(txt)) return 'Aluguel'
  if (/comiss[aã]o/.test(txt)) return 'Comissão'
  return 'Outros'
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let xml = ''
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData()
      const file = fd.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
      xml = await file.text()
    } else {
      const body = await req.json() as { xml?: string }
      xml = body.xml || ''
    }
  } catch {
    return NextResponse.json({ error: 'Falha ao ler arquivo' }, { status: 400 })
  }

  if (!xml) return NextResponse.json({ error: 'XML vazio' }, { status: 400 })

  // --- Detectar tipo: NF-e ou NFS-e ---
  const isNFSe = /<CompNfse|<Nfse|<RazaoSocial/i.test(xml)

  if (isNFSe) {
    // NFS-e (padrão ABRASF/Betha — mais comum)
    const prestadorBlock = tagBlock(xml, 'Prestador') || tagBlock(xml, 'PrestadorServico')
    const emitente = tag(prestadorBlock || xml, 'RazaoSocial') || tag(xml, 'RazaoSocialPrestador') || ''
    const cnpj = tag(prestadorBlock || xml, 'Cnpj') || ''
    const valorStr = tag(xml, 'ValorLiquidoNfse') || tag(xml, 'ValorServicos') || tag(xml, 'Valor') || '0'
    const valor = parseFloat(valorStr.replace(',', '.')) || 0
    const dataRaw = tag(xml, 'DataEmissao') || tag(xml, 'Competencia') || tag(xml, 'DataEmi') || ''
    const data = isoToDate(dataRaw)
    const numero = tag(xml, 'Numero') || tag(xml, 'NumeroNfse') || ''
    const descServico = tag(xml, 'Discriminacao') || tag(xml, 'ItemListaServico') || 'Serviço prestado'

    return NextResponse.json({
      tipo: 'nfse',
      emitente: emitente || 'Não identificado',
      cnpj,
      valor,
      data,
      numero_nf: numero ? `NFS-e ${numero}` : '',
      descricao: descServico.slice(0, 200),
      categoria: 'Serviço',
    })
  }

  // --- NF-e padrão SEFAZ ---
  const ideBlock = tagBlock(xml, 'ide')
  const emitBlock = tagBlock(xml, 'emit')
  const totBlock = tagBlock(xml, 'ICMSTot') || tagBlock(xml, 'total')
  const detBlock = tagBlock(xml, 'det')
  const prodBlock = tagBlock(detBlock || xml, 'prod')

  const natOp = tag(ideBlock || xml, 'natOp')
  const nNF = tag(ideBlock || xml, 'nNF')
  const dhEmi = tag(ideBlock || xml, 'dhEmi') || tag(ideBlock || xml, 'dEmi') || ''
  const data = isoToDate(dhEmi)

  const emitente = tag(emitBlock || xml, 'xNome') || ''
  const cnpj = tag(emitBlock || xml, 'CNPJ') || ''

  const vNF = parseFloat(tag(totBlock || xml, 'vNF').replace(',', '.')) || 0
  const vProd = parseFloat(tag(prodBlock || xml, 'vProd').replace(',', '.')) || 0
  const valor = vNF || vProd || 0

  const xProd = tag(prodBlock || xml, 'xProd') || natOp || 'Produto/Serviço'
  const categoria = sugerirCategoria(xProd, natOp)

  return NextResponse.json({
    tipo: 'nfe',
    emitente: emitente || 'Não identificado',
    cnpj,
    valor,
    data,
    numero_nf: nNF ? `NF-e ${nNF}` : '',
    descricao: xProd.slice(0, 200),
    categoria,
  })
}

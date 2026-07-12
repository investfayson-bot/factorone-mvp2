import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Fase 7 — entrada de imóveis por FOTO/documento (OCR + extração
// estruturada) ou PLANILHA (xlsx/csv). Este endpoint só devolve a PRÉVIA
// editável — nada é salvo aqui; a confirmação é /api/patrimonio/confirmar.

export type ImovelExtraido = {
  endereco: string | null
  cidade: string | null
  uf: string | null
  area_m2: number | null
  valor_aquisicao: number | null
  data_aquisicao: string | null
  tipo_imovel: string | null
  matricula: string | null
}

const TIPOS = new Set(['comercial', 'residencial', 'rural', 'terreno', 'industrial'])

function normalizar(v: Partial<ImovelExtraido>): ImovelExtraido {
  const num = (x: unknown) => { const n = Number(String(x ?? '').replace(/[R$.\s]/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null }
  return {
    endereco: v.endereco ? String(v.endereco).trim().slice(0, 200) : null,
    cidade: v.cidade ? String(v.cidade).trim().slice(0, 80) : null,
    uf: v.uf ? String(v.uf).trim().toUpperCase().slice(0, 2) : null,
    area_m2: num(v.area_m2),
    valor_aquisicao: num(v.valor_aquisicao),
    data_aquisicao: v.data_aquisicao && /^\d{4}-\d{2}-\d{2}$/.test(String(v.data_aquisicao)) ? String(v.data_aquisicao) : null,
    tipo_imovel: v.tipo_imovel && TIPOS.has(String(v.tipo_imovel).toLowerCase()) ? String(v.tipo_imovel).toLowerCase() : null,
    matricula: v.matricula ? String(v.matricula).trim().slice(0, 60) : null,
  }
}

// mapeia cabeçalhos comuns de planilha → campos estruturados
const MAPA_COLUNAS: Record<string, keyof ImovelExtraido> = {
  endereco: 'endereco', 'endereço': 'endereco', logradouro: 'endereco', rua: 'endereco',
  cidade: 'cidade', municipio: 'cidade', 'município': 'cidade',
  uf: 'uf', estado: 'uf',
  area: 'area_m2', 'área': 'area_m2', area_m2: 'area_m2', metragem: 'area_m2', m2: 'area_m2',
  valor: 'valor_aquisicao', preco: 'valor_aquisicao', 'preço': 'valor_aquisicao', valor_aquisicao: 'valor_aquisicao', 'valor de aquisicao': 'valor_aquisicao', 'valor de aquisição': 'valor_aquisicao', vgv: 'valor_aquisicao',
  data: 'data_aquisicao', data_aquisicao: 'data_aquisicao', 'data de aquisicao': 'data_aquisicao', 'data de aquisição': 'data_aquisicao', aquisicao: 'data_aquisicao',
  tipo: 'tipo_imovel', tipo_imovel: 'tipo_imovel',
  matricula: 'matricula', 'matrícula': 'matricula',
}

function parsePlanilha(buffer: Buffer): ImovelExtraido[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  return linhas.slice(0, 100).map(l => {
    const bruto: Partial<ImovelExtraido> = {}
    for (const [col, valor] of Object.entries(l)) {
      const campo = MAPA_COLUNAS[col.trim().toLowerCase()]
      if (!campo || valor == null) continue
      if (campo === 'data_aquisicao' && valor instanceof Date) {
        bruto[campo] = valor.toISOString().slice(0, 10)
      } else {
        (bruto as Record<string, unknown>)[campo] = valor
      }
    }
    return normalizar(bruto)
  }).filter(i => i.endereco || i.cidade || i.valor_aquisicao)
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo acima de 15MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const nome = (file.name || '').toLowerCase()

  // planilha → parser direto
  if (/\.(xlsx|xls|csv)$/.test(nome)) {
    try {
      const imoveis = parsePlanilha(buffer)
      if (imoveis.length === 0) return NextResponse.json({ error: 'Nenhuma linha reconhecida — confira se a planilha tem colunas como endereço, cidade, área, valor' }, { status: 400 })
      return NextResponse.json({ imoveis, origem: 'planilha' })
    } catch (e) {
      return NextResponse.json({ error: `Falha ao ler a planilha: ${e instanceof Error ? e.message : 'formato inválido'}` }, { status: 400 })
    }
  }

  // foto/documento → OCR estruturado (mesmo princípio do OCR de recibo)
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'IA não configurada' }, { status: 500 })
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  if (!/^image\//.test(mediaType)) return NextResponse.json({ error: 'Envie uma imagem (foto do documento/matrícula) ou planilha xlsx/csv' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const completion = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: `Extraia os dados deste documento de imóvel (contrato, matrícula, escritura ou anúncio). Responda APENAS JSON válido:
{"endereco":"rua e número","cidade":"...","uf":"SP","area_m2":0,"valor_aquisicao":0,"data_aquisicao":"AAAA-MM-DD ou null","tipo_imovel":"comercial|residencial|rural|terreno|industrial","matricula":"número ou null"}
Use null pro que não conseguir ler. Valores numéricos sem R$ nem pontos de milhar.` },
      ],
    }],
  })
  const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : '{}'
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const i = clean.indexOf('{'); const j = clean.lastIndexOf('}')
    const extraido = normalizar(JSON.parse(clean.slice(i, j + 1)))
    return NextResponse.json({ imoveis: [extraido], origem: 'foto' })
  } catch {
    return NextResponse.json({ error: 'Não consegui extrair dados legíveis desse documento — tenta uma foto mais nítida ou o cadastro manual' }, { status: 422 })
  }
}

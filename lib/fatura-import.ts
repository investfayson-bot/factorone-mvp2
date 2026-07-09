// Parsers puros pra importação de fatura de cartão (caminho B, independente da Belvo).
// Formatos suportados: CSV/XLSX (colunas), OFX (blocos STMTTRN), PDF (via IA, no route).

export type ItemFaturaImportado = {
  descricao: string
  valor: number
  data: string | null
  parcela_atual: number | null
  total_parcelas: number | null
}

/** "PARC 03/10", "PARCELA 3/10" → { atual: 3, total: 10 }. Conservador: só casa com a palavra PARC(ELA) na frente, pra não confundir com data. */
export function extrairParcela(texto: string): { atual: number; total: number } | null {
  const m = texto.match(/PARC(?:ELA)?\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})/i)
  if (!m) return null
  const atual = Number(m[1])
  const total = Number(m[2])
  if (!Number.isFinite(atual) || !Number.isFinite(total) || total <= 0 || atual > total) return null
  return { atual, total }
}

function toIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function numBRL(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return null
  const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Linhas de planilha (XLSX.utils.sheet_to_json) — colunas Data/Descricao/Valor. */
export function parseLinhasPlanilha(rows: Record<string, unknown>[]): ItemFaturaImportado[] {
  return rows.map(r => {
    const descricao = String(r.Descrição ?? r.Descricao ?? r.descricao ?? '').trim()
    const valor = numBRL(r.Valor ?? r.valor) ?? 0
    const data = toIsoDate(r.Data ?? r.data)
    const parcela = extrairParcela(descricao)
    return {
      descricao,
      valor,
      data,
      parcela_atual: parcela?.atual ?? null,
      total_parcelas: parcela?.total ?? null,
    }
  }).filter(i => i.descricao && i.valor > 0)
}

/** OFX: extrai blocos <STMTTRN>...</STMTTRN> por regex (SGML mal-formado, não vale usar parser XML). */
export function parseOfx(texto: string): ItemFaturaImportado[] {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []
  const campo = (bloco: string, tag: string) => {
    const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
    return m ? m[1].trim() : ''
  }
  return blocos.map(bloco => {
    const memo = campo(bloco, 'MEMO') || campo(bloco, 'NAME')
    const valorBruto = campo(bloco, 'TRNAMT')
    const dataBruta = campo(bloco, 'DTPOSTED') // formato OFX: YYYYMMDDHHMMSS
    const valor = Math.abs(Number(valorBruto)) || 0
    const data = /^\d{8}/.test(dataBruta) ? `${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}` : null
    const parcela = extrairParcela(memo)
    return {
      descricao: memo,
      valor,
      data,
      parcela_atual: parcela?.atual ?? null,
      total_parcelas: parcela?.total ?? null,
    }
  }).filter(i => i.descricao && i.valor > 0)
}

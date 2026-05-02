import * as XLSX from 'xlsx'

export function gerarExcel(rows: Record<string, unknown>[], sheetName = 'Dados'): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(out)
}


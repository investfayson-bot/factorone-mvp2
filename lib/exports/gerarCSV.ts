export type ExportRow = Record<string, string | number | null | undefined>

function esc(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function gerarCSV(rows: ExportRow[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const head = cols.map(esc).join(',')
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n')
  return `${head}\n${body}`
}


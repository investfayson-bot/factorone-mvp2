/**
 * FactorOne PDF Template — elementos reutilizáveis
 * Usado por todos os geradores de PDF do sistema.
 */
import React from 'react'
import ReactPDF from '@react-pdf/renderer'

const { Text, View, StyleSheet } = ReactPDF

// ── Paleta ──────────────────────────────────────────────────
export const COLORS = {
  navy:       '#1C2B2A',
  teal:       '#5E8C87',
  tealLight:  '#EAF5F3',
  green:      '#16A085',
  greenLight: '#DCFCE7',
  red:        '#E74C3C',
  redLight:   '#FEE2E2',
  gold:       '#D97706',
  goldLight:  '#FEF3C7',
  gray:       '#7A8F8E',
  grayLight:  '#F4F6F5',
  border:     '#E2E8E7',
  white:      '#FFFFFF',
  bg:         '#FAFAFA',
} as const

// ── Estilos base ─────────────────────────────────────────────
export const BASE = StyleSheet.create({
  page:           { padding: 0, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: COLORS.bg },
  header:         { backgroundColor: COLORS.navy, padding: '18 28', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLeft:     { flexDirection: 'column' },
  headerLogoWrap: { flexDirection: 'row' },
  headerLogo:     { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  headerAccent:   { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#5E8C87', letterSpacing: -0.5 },
  headerSub:      { fontSize: 7.5, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  headerRight:    { alignItems: 'flex-end' },
  headerTitle:    { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  headerCompany:  { fontSize: 7.5, color: 'rgba(255,255,255,.65)', marginTop: 2 },
  body:           { padding: '14 28' },
  sectionTitle:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#1C2B2A', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 12, paddingBottom: 4, borderBottom: '1 solid #F4F6F5' },
  card:           { backgroundColor: '#FFFFFF', borderRadius: 6, border: '1 solid #E2E8E7', overflow: 'hidden' },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #F4F6F5' },
  rowLast:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12' },
  rowHead:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', backgroundColor: '#F4F6F5', borderBottom: '1 solid #E2E8E7' },
  rowTotal:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '8 12', backgroundColor: '#F4F6F5', borderTop: '1 solid #E2E8E7' },
  cellLabel:      { fontSize: 8, color: '#374151', flex: 1 },
  cellVal:        { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', minWidth: 80 },
  cellHead:       { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: 0.3 },
  kpiRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpi:            { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 6, padding: '9 12', border: '1 solid #E2E8E7' },
  kpiLabel:       { fontSize: 6.5, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue:       { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  kpiSub:         { fontSize: 6.5, color: '#7A8F8E', marginTop: 2 },
  footer:         { position: 'absolute', bottom: 12, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTop: '1 solid #F4F6F5', paddingTop: 6 },
  footerText:     { fontSize: 6.5, color: 'rgba(107,114,128,.65)' },
  badge:          { borderRadius: 3, padding: '1 5', fontSize: 7, fontFamily: 'Helvetica-Bold' },
})

// ── Formatadores ─────────────────────────────────────────────
export function fmtBRL(v: number): string {
  const abs = Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '-' : ''}R$ ${abs}`
}

export function fmtBRLCompact(v: number): string {
  const abs = Math.abs(Number(v))
  if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000).toFixed(1)}K`
  return fmtBRL(v)
}

export function fmtDate(d: string): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export function fmtStatus(s: string): string {
  const m: Record<string, string> = {
    pendente: 'Pendente', paga: 'Paga', pago: 'Pago',
    vencida: 'Vencida', vencido: 'Vencido',
    recebida: 'Recebida', cancelada: 'Cancelada',
    conciliado: 'Conciliado', autorizada: 'Autorizada',
  }
  return m[s] ?? s
}

// ── Componentes reutilizáveis ────────────────────────────────
export function PdfHeader(relatorio: string, empresaNome: string, periodo: string) {
  return React.createElement(
    View, { style: BASE.header },
    React.createElement(
      View, { style: BASE.headerLeft },
      React.createElement(
        View, { style: BASE.headerLogoWrap },
        React.createElement(Text, { style: BASE.headerLogo }, 'Factor'),
        React.createElement(Text, { style: BASE.headerAccent }, 'One')
      ),
      React.createElement(Text, { style: BASE.headerSub }, `Finance OS · ${relatorio}`)
    ),
    React.createElement(
      View, { style: BASE.headerRight },
      React.createElement(Text, { style: BASE.headerTitle }, periodo),
      React.createElement(Text, { style: BASE.headerCompany }, empresaNome)
    )
  )
}

export function PdfFooter(pagina: string) {
  const agora = new Date()
  const datahora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return React.createElement(
    View, { style: BASE.footer },
    React.createElement(Text, { style: BASE.footerText }, `FactorOne Finance OS · Gerado em ${datahora}`),
    React.createElement(Text, { style: BASE.footerText }, pagina)
  )
}

export function PdfKpi(label: string, value: string, color: string, sub?: string) {
  return React.createElement(
    View, { style: BASE.kpi },
    React.createElement(Text, { style: BASE.kpiLabel }, label),
    React.createElement(Text, { style: { ...BASE.kpiValue, color } }, value),
    sub ? React.createElement(Text, { style: BASE.kpiSub }, sub) : null
  )
}

export function PdfSectionTitle(title: string) {
  return React.createElement(Text, { style: BASE.sectionTitle }, title)
}

export function PdfTableHead(cols: { label: string; flex?: number; align?: 'left' | 'right' | 'center' }[]) {
  return React.createElement(
    View, { style: BASE.rowHead },
    ...cols.map((c, i) =>
      React.createElement(Text, {
        key: String(i),
        style: { ...BASE.cellHead, flex: c.flex ?? 1, textAlign: c.align ?? 'left' },
      }, c.label)
    )
  )
}

export function PdfTableRow(
  cols: { value: string; flex?: number; align?: 'left' | 'right' | 'center'; bold?: boolean; color?: string }[],
  opts?: { last?: boolean; bg?: string; total?: boolean }
) {
  const baseRow = opts?.total ? BASE.rowTotal : opts?.last ? BASE.rowLast : BASE.row
  return React.createElement(
    View, { style: { ...baseRow, ...(opts?.bg ? { backgroundColor: opts.bg } : {}) } },
    ...cols.map((c, i) =>
      React.createElement(Text, {
        key: String(i),
        style: {
          ...(c.bold ? BASE.cellVal : BASE.cellLabel),
          flex: c.flex ?? 1,
          textAlign: c.align ?? 'left',
          ...(c.color ? { color: c.color } : {}),
        },
      }, c.value)
    )
  )
}

export function PdfBadge(label: string, bg: string, color: string) {
  return React.createElement(Text, { style: { ...BASE.badge, backgroundColor: bg, color } }, label)
}

import * as XLSX from 'xlsx-js-style'

export type RespostaData = {
  resumo: string
  status: string
  cards: { titulo: string; emoji: string; linhas: { label: string; valor: string; destaque: string }[] }[]
  alertas: string[]
  proxima_pergunta: string
}

export function exportExcel(data: RespostaData, pergunta: string) {
  const wb = XLSX.utils.book_new()
  const ws: Record<string, unknown> = {}

  const navy = '1C2B2A'
  const teal = '2D9B6F'
  const gold = 'B8922A'
  const lightGray = 'F5F6F5'
  const white = 'FFFFFF'
  const red = 'C0504A'
  const green = '2D9B6F'

  let r = 0

  const setCell = (row: number, col: number, value: unknown, style?: Record<string, unknown>) => {
    const ref = XLSX.utils.encode_cell({ r: row, c: col })
    ws[ref] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style || {} }
  }

  const hStyle = {
    font: { bold: true, color: { rgb: white }, sz: 14, name: 'Calibri' },
    fill: { fgColor: { rgb: navy } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const hSubStyle = {
    font: { color: { rgb: white }, sz: 9, name: 'Calibri' },
    fill: { fgColor: { rgb: navy } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const secStyle = {
    font: { bold: true, color: { rgb: white }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: teal } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const colHStyle = {
    font: { bold: true, color: { rgb: white }, sz: 9, name: 'Calibri' },
    fill: { fgColor: { rgb: '3E6E69' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const evenStyle = {
    font: { sz: 9, name: 'Calibri', color: { rgb: '1C2B2A' } },
    fill: { fgColor: { rgb: lightGray } },
    alignment: { vertical: 'center' },
  }
  const oddStyle = {
    font: { sz: 9, name: 'Calibri', color: { rgb: '1C2B2A' } },
    fill: { fgColor: { rgb: white } },
    alignment: { vertical: 'center' },
  }
  const valGreen = { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: green } }, fill: { fgColor: { rgb: lightGray } }, alignment: { horizontal: 'right', vertical: 'center' } }
  const valRed = { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: red } }, fill: { fgColor: { rgb: lightGray } }, alignment: { horizontal: 'right', vertical: 'center' } }
  const valNeutral = { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: navy } }, fill: { fgColor: { rgb: lightGray } }, alignment: { horizontal: 'right', vertical: 'center' } }
  const alertStyle = {
    font: { sz: 9, name: 'Calibri', color: { rgb: '7A3A00' } },
    fill: { fgColor: { rgb: 'FFF3E0' } },
    alignment: { vertical: 'center', wrapText: true },
  }
  const footerStyle = {
    font: { sz: 8, italic: true, color: { rgb: '9A9490' }, name: 'Calibri' },
    fill: { fgColor: { rgb: lightGray } },
    alignment: { horizontal: 'center' },
  }

  // HEADER
  setCell(r, 0, 'FactorOne - CFO Relatorio Financeiro', hStyle)
  setCell(r, 1, '', hStyle)
  r++
  setCell(r, 0, 'Gerado em: ' + new Date().toLocaleDateString('pt-BR') + ' as ' + new Date().toLocaleTimeString('pt-BR'), hSubStyle)
  setCell(r, 1, '', hSubStyle)
  r++
  setCell(r, 0, 'Status: ' + data.status.toUpperCase(), hSubStyle)
  setCell(r, 1, '', hSubStyle)
  r++

  // Resumo
  setCell(r, 0, 'Resumo:', { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: navy } }, fill: { fgColor: { rgb: 'E8F5E9' } } })
  setCell(r, 1, data.resumo, { font: { sz: 9, name: 'Calibri' }, fill: { fgColor: { rgb: 'E8F5E9' } }, alignment: { wrapText: true } })
  r++
  if (pergunta) {
    setCell(r, 0, 'Pergunta:', { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: navy } } })
    setCell(r, 1, pergunta, { font: { sz: 9, name: 'Calibri' }, alignment: { wrapText: true } })
    r++
  }
  r++

  // CARDS
  data.cards?.forEach(card => {
    setCell(r, 0, card.titulo, secStyle)
    setCell(r, 1, '', secStyle)
    r++
    setCell(r, 0, 'Item', colHStyle)
    setCell(r, 1, 'Valor', { ...colHStyle, alignment: { horizontal: 'right', vertical: 'center' } })
    r++
    card.linhas?.forEach((l, idx) => {
      const base = idx % 2 === 0 ? evenStyle : oddStyle
      const valStyle = l.destaque === 'positivo' ? valGreen : l.destaque === 'negativo' ? valRed : valNeutral
      setCell(r, 0, l.label, base)
      setCell(r, 1, l.valor, valStyle)
      r++
    })
    r++
  })

  // ALERTAS
  if (data.alertas?.length > 0) {
    setCell(r, 0, 'ALERTAS E RECOMENDACOES', { ...secStyle, fill: { fgColor: { rgb: gold } } })
    setCell(r, 1, '', { fill: { fgColor: { rgb: gold } } })
    r++
    data.alertas.forEach(a => {
      setCell(r, 0, '- ' + a, alertStyle)
      setCell(r, 1, '', alertStyle)
      r++
    })
    r++
  }

  // PROXIMA ANALISE
  if (data.proxima_pergunta) {
    setCell(r, 0, 'PROXIMA ANALISE SUGERIDA', { ...secStyle, fill: { fgColor: { rgb: '3E6E69' } } })
    setCell(r, 1, '', { fill: { fgColor: { rgb: '3E6E69' } } })
    r++
    setCell(r, 0, data.proxima_pergunta, { font: { sz: 9, italic: true, name: 'Calibri' }, alignment: { wrapText: true } })
    r += 2
  }

  // FOOTER
  setCell(r, 0, 'Powered by FactorOne Finance OS', footerStyle)
  setCell(r, 1, new Date().toLocaleDateString('pt-BR'), { ...footerStyle, alignment: { horizontal: 'right' } })

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 1 } })
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ]
  ws['!cols'] = [{ wch: 42 }, { wch: 24 }]
  ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 18 }]

  XLSX.utils.book_append_sheet(wb, ws, 'CFO IA')
  XLSX.writeFile(wb, 'FactorOne_CFO_' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + '.xlsx')
}

export async function exportPDF(data: RespostaData, pergunta: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hoje = new Date().toLocaleDateString('pt-BR')
  const hora = new Date().toLocaleTimeString('pt-BR')
  const navy: [number, number, number] = [28, 43, 42]
  const teal: [number, number, number] = [45, 155, 111]
  const gold: [number, number, number] = [184, 146, 42]

  doc.setFillColor(...navy)
  doc.rect(0, 0, 210, 38, 'F')
  doc.setFillColor(...teal)
  doc.rect(0, 35, 210, 3, 'F')

  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('FactorOne', 14, 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(94, 140, 135)
  doc.text('FINANCE OS', 56, 16)
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('CFO IA - Relatorio Financeiro', 14, 26)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 195)
  doc.text('Gerado em ' + hoje + ' as ' + hora, 14, 32)

  const statusColor: [number, number, number] = data.status === 'positivo' ? teal : data.status === 'critico' ? [192, 80, 74] : gold
  doc.setFillColor(...statusColor)
  doc.roundedRect(160, 10, 36, 14, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(data.status.toUpperCase(), 178, 18.5, { align: 'center' })

  let y = 46

  doc.setFillColor(232, 245, 240)
  doc.setDrawColor(...teal)
  doc.roundedRect(14, y, 182, 14, 3, 3, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text('RESUMO:', 18, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 60, 58)
  const resumoLines = doc.splitTextToSize(data.resumo, 155)
  doc.text(resumoLines, 38, y + 6)
  y += 20

  if (pergunta) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navy)
    doc.text('PERGUNTA:', 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const pLines = doc.splitTextToSize(pergunta, 165)
    doc.text(pLines, 38, y)
    y += pLines.length * 5 + 4
  }

  data.cards?.forEach(card => {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navy)
    doc.text(card.titulo, 14, y)
    y += 3

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Valor']],
      body: card.linhas?.map(l => [l.label, l.valor]) || [],
      theme: 'grid',
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [245, 246, 245] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,
    })

    y = (doc as any).lastAutoTable.finalY + 8
  })

  if (data.alertas?.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    const boxH = 10 + data.alertas.length * 7
    doc.setFillColor(255, 248, 225)
    doc.setDrawColor(...gold)
    doc.roundedRect(14, y, 182, boxH, 3, 3, 'FD')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...gold)
    doc.text('ALERTAS E RECOMENDACOES', 18, y + 7)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 70, 0)
    data.alertas.forEach(a => {
      const lines = doc.splitTextToSize('- ' + a, 172)
      doc.text(lines, 18, y)
      y += lines.length * 6
    })
    y += 6
  }

  if (data.proxima_pergunta) {
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...teal)
    doc.text('PROXIMA ANALISE SUGERIDA', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const pLines = doc.splitTextToSize(data.proxima_pergunta, 180)
    doc.text(pLines, 14, y)
  }

  const pageH = doc.internal.pageSize.height
  doc.setFillColor(...navy)
  doc.rect(0, pageH - 14, 210, 14, 'F')
  doc.setFillColor(...teal)
  doc.rect(0, pageH - 14, 210, 2, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 195)
  doc.text('Powered by FactorOne Finance OS', 14, pageH - 5)
  doc.text(hoje, 196, pageH - 5, { align: 'right' })

  doc.save('FactorOne_CFO_' + hoje.replace(/\//g, '-') + '.pdf')
}

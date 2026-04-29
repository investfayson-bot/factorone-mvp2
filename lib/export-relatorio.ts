import * as XLSX from 'xlsx'

export type RespostaData = {
  resumo: string
  status: string
  cards: { titulo: string; emoji: string; linhas: { label: string; valor: string; destaque: string }[] }[]
  alertas: string[]
  proxima_pergunta: string
}

export function exportExcel(data: RespostaData, pergunta: string) {
  const wb = XLSX.utils.book_new()

  // Aba resumo
  const resumoRows = [
    ['FactorOne — CFO IA Relatório'],
    ['Pergunta:', pergunta],
    ['Resumo:', data.resumo],
    ['Status:', data.status],
    [],
  ]
  const ws = XLSX.utils.aoa_to_sheet(resumoRows)
  let linha = resumoRows.length

  // Cards como tabelas
  data.cards?.forEach(card => {
    XLSX.utils.sheet_add_aoa(ws, [[card.emoji + ' ' + card.titulo]], { origin: { r: linha, c: 0 } })
    linha++
    XLSX.utils.sheet_add_aoa(ws, [['Item', 'Valor']], { origin: { r: linha, c: 0 } })
    linha++
    card.linhas?.forEach(l => {
      XLSX.utils.sheet_add_aoa(ws, [[l.label, l.valor]], { origin: { r: linha, c: 0 } })
      linha++
    })
    linha++ // linha em branco entre cards
  })

  // Alertas
  if (data.alertas?.length > 0) {
    XLSX.utils.sheet_add_aoa(ws, [['⚠️ Alertas']], { origin: { r: linha, c: 0 } })
    linha++
    data.alertas.forEach(a => {
      XLSX.utils.sheet_add_aoa(ws, [['• ' + a]], { origin: { r: linha, c: 0 } })
      linha++
    })
  }

  ws['!cols'] = [{ wch: 35 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, 'CFO IA')
  XLSX.writeFile(wb, `FactorOne_CFO_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`)
}

export async function exportPDF(data: RespostaData, pergunta: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const hoje = new Date().toLocaleDateString('pt-BR')

  // Header
  doc.setFontSize(18)
  doc.setTextColor(28, 43, 42)
  doc.text('FactorOne — CFO IA', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(`Gerado em ${hoje}`, 14, 28)
  doc.text(`Pergunta: ${pergunta}`, 14, 34)

  doc.setFontSize(11)
  doc.setTextColor(28, 43, 42)
  doc.text(`Resumo: ${data.resumo}`, 14, 44)

  let y = 54

  // Cards como tabelas
  data.cards?.forEach(card => {
    doc.setFontSize(12)
    doc.setTextColor(28, 43, 42)
    doc.text(card.titulo, 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Valor']],
      body: card.linhas?.map(l => [l.label, l.valor]) || [],
      theme: 'grid',
      headStyles: { fillColor: [28, 43, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })

    y = (doc as any).lastAutoTable.finalY + 8
  })

  // Alertas
  if (data.alertas?.length > 0) {
    doc.setFontSize(11)
    doc.setTextColor(180, 100, 0)
    doc.text('Alertas:', 14, y)
    y += 6
    doc.setFontSize(9)
    data.alertas.forEach(a => {
      doc.text('• ' + a, 16, y)
      y += 6
    })
  }

  doc.save(`FactorOne_CFO_${hoje.replace(/\//g, '-')}.pdf`)
}

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { erroDesconhecido } from '@/lib/transacao-types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      dre: Array<Record<string, unknown>>
      comparativo: Array<Record<string, unknown>>
      metricas: Array<Record<string, unknown>>
    }
    const wb = XLSX.utils.book_new()
    const s1 = XLSX.utils.json_to_sheet(body.dre ?? [])
    const s2 = XLSX.utils.json_to_sheet(body.comparativo ?? [])
    const s3 = XLSX.utils.json_to_sheet(body.metricas ?? [])
    XLSX.utils.book_append_sheet(wb, s1, 'DRE Completo')
    XLSX.utils.book_append_sheet(wb, s2, 'Comparativo 12M')
    XLSX.utils.book_append_sheet(wb, s3, 'Metricas')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="dre.xlsx"',
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

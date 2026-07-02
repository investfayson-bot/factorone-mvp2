import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 3600 // 1h

// Séries do BACEN (SGS): 432 = Meta Selic, 4389 = CDI anualizado, 13522 = IPCA 12m
async function sgs(codigo: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`,
      { headers: { 'User-Agent': 'FactorOne/1.0' }, next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    const d = (await res.json()) as Array<{ data: string; valor: string }>
    const v = d?.[0]?.valor
    return v != null ? Number(String(v).replace(',', '.')) : null
  } catch {
    return null
  }
}

export async function GET() {
  const [selic, cdi, ipca] = await Promise.all([sgs(432), sgs(4389), sgs(13522)])
  return NextResponse.json({ selic, cdi, ipca })
}

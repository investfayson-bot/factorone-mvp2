import { NextRequest, NextResponse } from 'next/server'
import { erroDesconhecido } from '@/lib/transacao-types'
import { getSupabaseUser } from '@/lib/supabase-route'
import { gerarDrePdf } from '@/lib/pdf/dre'

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const competencia = searchParams.get('competencia') || new Date().toISOString().slice(0, 7)

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id

    // geração compartilhada com o bot do Telegram (lib/pdf/dre.ts)
    const dre = await gerarDrePdf(supabase, empresaId, competencia)
    return new NextResponse(new Uint8Array(dre.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${dre.filename}"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processarInboxEmpresa } from '@/lib/donna/processar-email'

export const runtime = 'nodejs'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Gatilho-agnóstico: funciona chamado pelo cron da Vercel, por um scheduler
// externo (cron-job.org) ou manualmente — sempre com o mesmo Bearer secret.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { data: contas } = await db().from('google_contas').select('empresa_id').eq('ativo', true)
  let totalProcessados = 0
  const erros: string[] = []
  for (const c of contas ?? []) {
    const r = await processarInboxEmpresa(c.empresa_id as string)
    totalProcessados += r.processados
    if (r.erro) erros.push(`${c.empresa_id}: ${r.erro}`)
  }
  return NextResponse.json({ empresas: contas?.length ?? 0, processados: totalProcessados, erros })
}

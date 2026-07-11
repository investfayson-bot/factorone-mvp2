import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// URL assinada (1h) do arquivo de um documento do Cofre. Valida que o doc
// pertence à empresa do login antes de assinar — o bucket é privado.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: doc } = await service
    .from('cofre_fiscal_documentos')
    .select('arquivo_path')
    .eq('id', id).eq('empresa_id', empresaId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  if (!doc.arquivo_path) return NextResponse.json({ error: 'Documento sem arquivo anexado' }, { status: 400 })

  const { data: signed, error } = await service.storage.from('recibos').createSignedUrl(doc.arquivo_path, 3600)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: error?.message ?? 'Falha ao assinar URL' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}

/* eslint-disable @next/next/no-img-element */
import { createClient } from '@supabase/supabase-js'

type Props = { params: Promise<{ qrCode: string }> }

export default async function AtivoPublicoPage({ params }: Props) {
  const { qrCode } = await params
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await supabase.from('ativos').select('nome,localizacao,responsavel_nome,foto_url,status').eq('qr_code', qrCode).maybeSingle()
  if (!data) return <div className="p-8">Ativo não encontrado.</div>
  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Ativo identificado</h1>
      <div className="rounded-2xl border bg-white p-5">
        <p className="text-lg font-semibold">{data.nome}</p>
        <p className="text-sm text-slate-600">Localização: {data.localizacao || '—'}</p>
        <p className="text-sm text-slate-600">Responsável: {data.responsavel_nome || '—'}</p>
        <p className="text-sm text-slate-600">Status: {data.status}</p>
        {data.foto_url ? <img src={data.foto_url} alt={data.nome} className="mt-3 h-52 w-full rounded-xl object-cover" /> : null}
      </div>
    </div>
  )
}

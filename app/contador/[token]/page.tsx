'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Contador = {
  nome: string
  status: string
  empresa_id: string
  permissoes: Record<string, boolean>
}

export default function PortalContadorPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [loading, setLoading] = useState(true)
  const [cont, setCont] = useState<Contador | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) return
      const { data } = await supabase
        .from('contadores')
        .select('nome,status,empresa_id,permissoes')
        .eq('token_acesso', token)
        .maybeSingle()
      if (!cancelled) {
        setCont((data as Contador) || null)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) return <div className="p-8 text-sm text-[var(--fo-text-muted)]">Carregando portal...</div>
  if (!cont) return <div className="p-8 text-sm text-red-700">Token de acesso inválido.</div>

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-[var(--fo-border)] bg-white p-5">
          <h1 className="text-xl font-bold text-[var(--fo-text)]">Portal Contador</h1>
          <p className="mt-1 text-sm text-[var(--fo-text-muted)]">
            Acesso restrito — modo contador · Status: {cont.status}
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--fo-border)] bg-white p-5">
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">Permissões</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--fo-text-muted)] md:grid-cols-2">
            {Object.entries(cont.permissoes || {}).map(([k, v]) => (
              <li key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                {k}: <strong className={v ? 'text-emerald-700' : 'text-red-700'}>{v ? 'permitido' : 'bloqueado'}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}


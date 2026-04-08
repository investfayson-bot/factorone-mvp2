'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, FileText, AlertTriangle, Radio } from 'lucide-react'
import NotasRecebidas from '@/components/notas/NotasRecebidas'
import EmitirNFe from '@/components/notas/EmitirNFe'
import EmitirNFSe from '@/components/notas/EmitirNFSe'
import HistoricoNotas from '@/components/notas/HistoricoNotas'

const tabs = [
  { id: 'recebidas' as const, label: 'Recebidas' },
  { id: 'nfe' as const, label: 'Emitir NF-e' },
  { id: 'nfse' as const, label: 'Emitir NFS-e' },
  { id: 'historico' as const, label: 'Histórico' },
]

export default function NotasDashboardPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('recebidas')
  const [nfeAutorizadasMes, setNfeAutorizadasMes] = useState<number | null>(null)
  const [rejeitadasMes, setRejeitadasMes] = useState<number | null>(null)
  const isSandbox = process.env.NODE_ENV === 'development'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const [ok, rej] = await Promise.all([
        supabase
          .from('notas_emitidas')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', user.id)
          .eq('status', 'autorizada')
          .gte('created_at', start),
        supabase
          .from('notas_emitidas')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', user.id)
          .eq('status', 'rejeitada')
          .gte('created_at', start),
      ])
      if (cancelled) return
      if (!ok.error) setNfeAutorizadasMes(ok.count ?? 0)
      if (!rej.error) setRejeitadasMes(rej.count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fiscal · NF-e e obrigações</h1>
          <p className="text-sm text-slate-500">Painel resumido, emissão e histórico (NFe.io)</p>
        </div>
        {isSandbox && (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            SANDBOX
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Painel Fiscal</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              NF-e emitidas
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {nfeAutorizadasMes === null ? '—' : nfeAutorizadasMes}
            </p>
            <p className="text-xs text-slate-500">este mês (autorizadas)</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Guias pagas
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-700">—</p>
            <p className="text-xs text-slate-500">integre folha fiscal para totais</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Erros / rejeições
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {rejeitadasMes === null ? '—' : rejeitadasMes}
            </p>
            <p className="text-xs text-slate-500">NF-e rejeitadas no mês</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              <Radio className="h-3.5 w-3.5" />
              SEFAZ
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Online
            </p>
            <p className="text-xs text-emerald-700/90">Transmitindo quando houver NF-e</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recebidas' && <NotasRecebidas />}
      {tab === 'nfe' && <EmitirNFe />}
      {tab === 'nfse' && <EmitirNFSe />}
      {tab === 'historico' && <HistoricoNotas />}
    </div>
  )
}

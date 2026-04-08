'use client'

import { useState } from 'react'
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
  const isSandbox = process.env.NODE_ENV === 'development'

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto min-h-screen bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notas fiscais</h1>
          <p className="text-sm text-slate-500">Leitura inteligente e emissão NF-e / NFS-e (NFe.io)</p>
        </div>
        {isSandbox && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            SANDBOX
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-200'
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

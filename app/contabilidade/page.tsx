'use client'

import { Calculator } from 'lucide-react'

export default function ContabilidadePage() {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fo-text)]">Contabilidade</h1>
            <p className="text-sm text-[var(--fo-text-muted)]">Módulo em consolidação: recibos, lançamentos, portal do contador e exportações.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] bg-[var(--fo-teal-bg)] px-3 py-1 text-xs font-semibold text-[var(--fo-teal)]">
            <span className="fo-live-dot" />
            Tempo Real
          </span>
        </div>
        <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[var(--fo-teal)]" />
            <h2 className="font-semibold text-[var(--fo-text)]">Visão Geral</h2>
          </div>
          <p className="text-sm text-[var(--fo-text-muted)]">
            Esta página já está ativa na navegação e receberá as 6 abas completas do módulo de contabilidade na próxima etapa.
          </p>
        </div>
      </div>
    </div>
  )
}

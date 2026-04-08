'use client'

import { CreditCard, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { fmtBRLCompact } from '@/lib/dre-calculations'

export const dynamic = 'force-dynamic'

/** Dados de demonstração até integração Swap Corpway */
const RESUMO = {
  limiteTotal: 850_000,
  utilizado: 312_000,
  cashbackMes: 1_560,
}

const CARTOES = [
  {
    nome: 'Cartão Marketing',
    ultimos: '3302',
    limite: 50_000,
    usado: 43_500,
    alerta: true,
  },
  {
    nome: 'Cartão Fornecedor / Operacional',
    ultimos: '8741',
    limite: 200_000,
    usado: 68_000,
    alerta: false,
  },
  {
    nome: 'Cartão Viagens',
    ultimos: '7719',
    limite: 80_000,
    usado: 29_000,
    alerta: false,
  },
] as const

export default function CartoesPage() {
  const disp = RESUMO.limiteTotal - RESUMO.utilizado
  const pctUso = (RESUMO.utilizado / RESUMO.limiteTotal) * 100
  const pctDisp = (disp / RESUMO.limiteTotal) * 100

  return (
    <div className="min-h-full bg-[#F9FAFB] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Powered by Swap Corpway</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cartões corporativos</h1>
            <p className="mt-1 text-sm text-gray-600">Limites, uso por cartão virtual e cashback — integração em produção em breve.</p>
          </div>
          <a
            href="mailto:contato@factorone.com.br?subject=Cartões%20FactorOne"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Solicitar acesso antecipado →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Limite total" value={fmtBRLCompact(RESUMO.limiteTotal)} sub="faturamento" accent="border-t-emerald-500" />
          <Kpi
            label="Utilizado"
            value={fmtBRLCompact(RESUMO.utilizado)}
            sub={`${pctUso.toFixed(1)}%`}
            accent="border-t-amber-500"
          />
          <Kpi
            label="Disponível"
            value={fmtBRLCompact(disp)}
            sub={`${pctDisp.toFixed(1)}%`}
            accent="border-t-sky-500"
          />
          <Kpi label="Cashback" value={fmtBRLCompact(RESUMO.cashbackMes)} sub="este mês" accent="border-t-violet-500" />
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Cartões por setor</h2>
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
            {CARTOES.map((c) => {
              const pct = (c.usado / c.limite) * 100
              return (
                <div
                  key={c.nome}
                  className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm transition hover:border-emerald-200/80 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                        <CreditCard className="h-5 w-5 text-gray-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{c.nome}</p>
                        <p className="text-xs text-gray-500">
                          •••• {c.ultimos} · {fmtBRLCompact(c.limite)} limite
                        </p>
                      </div>
                    </div>
                    {c.alerta ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {pct.toFixed(0)}% utilizado
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        OK
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold tabular-nums text-gray-900">{fmtBRLCompact(c.usado)} usados</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${c.alerta ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium text-gray-900">Emissão e gestão via API Swap</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-gray-600">
            Os valores acima são ilustrativos. Com a integração ativa, limites e extratos virão em tempo real da Swap Corpway.
          </p>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent: string
}) {
  return (
    <div className={`rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm ${accent} border-t-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  )
}

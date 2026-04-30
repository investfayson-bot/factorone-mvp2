'use client'

import { useMemo, useState } from 'react'
import { CreditCard, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { fmtBRLCompact } from '@/lib/dre-calculations'
import { supabase } from '@/lib/supabase'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/useToast'

export const dynamic = 'force-dynamic'

/** Dados de demonstração até integração Swap Corpway */
const RESUMO = {
  limiteTotal: 850_000,
  utilizado: 312_000,
  cashbackMes: 1_560,
}

type CartaoItem = {
  nome: string
  ultimos: string
  limite: number
  usado: number
  alerta: boolean
}

const CARTOES_INICIAIS: CartaoItem[] = [
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
]

export default function CartoesPage() {
  const toast = useToast()
  const [cartoes, setCartoes] = useState(CARTOES_INICIAIS.map((c) => ({ ...c, open: false })))
  const [loadingSolic, setLoadingSolic] = useState(false)
  const [form, setForm] = useState({ nome: '', setor: '', limite: '' })

  const utilizadoTotal = useMemo(() => cartoes.reduce((s, c) => s + c.usado, 0), [cartoes])
  const limiteTotal = useMemo(() => Math.max(RESUMO.limiteTotal, cartoes.reduce((s, c) => s + c.limite, 0)), [cartoes])
  const disp = limiteTotal - utilizadoTotal
  const pctUso = (utilizadoTotal / limiteTotal) * 100
  const pctDisp = (disp / limiteTotal) * 100

  function toggleOpen(nome: string) {
    setCartoes((prev) => prev.map((c) => (c.nome === nome ? { ...c, open: !c.open } : c)))
  }

  async function ajustarLimite(nome: string, novoLimite: number) {
    if (!Number.isFinite(novoLimite) || novoLimite <= 0) {
      toast.warning('Informe um limite válido')
      return
    }
    setCartoes((prev) => prev.map((c) => (c.nome === nome ? { ...c, limite: novoLimite } : c)))
    toast.success('Limite ajustado (simulação local)')
  }

  async function solicitarCartao() {
    const limite = Number(form.limite.replace(/\./g, '').replace(',', '.'))
    if (!form.nome.trim()) return toast.warning('Informe o nome do cartão')
    if (!Number.isFinite(limite) || limite <= 0) return toast.warning('Informe um limite válido')
    setLoadingSolic(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/cartoes/solicitar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session?.access_token}` } : {}),
        },
        body: JSON.stringify({
          nome_cartao: form.nome,
          setor: form.setor,
          limite_sugerido: limite,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao solicitar')
      toast.success('Solicitação enviada com sucesso')
      setForm({ nome: '', setor: '', limite: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao solicitar cartão')
    } finally {
      setLoadingSolic(false)
    }
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cartões Corporativos</div>
          <div className="page-sub">Powered by Swap Corpway · Limites e cashback</div>
        </div>
        <a href="mailto:contato@factorone.com.br?subject=Cartões%20FactorOne" className="btn-action btn-ghost" style={{ fontSize: 12 }}>
          Solicitar acesso antecipado →
        </a>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Limite total</div>
          <div className="kpi-val">{fmtBRLCompact(limiteTotal)}</div>
          <div className="kpi-delta up">faturamento</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Utilizado</div>
          <div className="kpi-val" style={{ color: pctUso > 70 ? 'var(--gold)' : 'var(--navy)' }}>{fmtBRLCompact(utilizadoTotal)}</div>
          <div className={`kpi-delta ${pctUso > 70 ? 'warn' : 'up'}`}>{pctUso.toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Disponível</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{fmtBRLCompact(disp)}</div>
          <div className="kpi-delta up">{pctDisp.toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Cashback</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{fmtBRLCompact(RESUMO.cashbackMes)}</div>
          <div className="kpi-delta up">✓ este mês</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="chart-title" style={{ marginBottom: 12 }}>Cartões por setor</div>
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
            {cartoes.map((c) => {
              const pct = (c.usado / c.limite) * 100
              return (
                <div
                  key={c.nome}
                  className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm transition hover:border-emerald-200/80 hover:shadow-md cursor-pointer"
                  onClick={() => toggleOpen(c.nome)}
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
                  {c.open && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <label className="text-xs text-gray-500">Ajustar limite</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          defaultValue={String(c.limite)}
                          type="number"
                          min={1}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => ajustarLimite(c.nome, Number(e.target.value))}
                        />
                        <span className="text-xs text-gray-500">BRL</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6">
          <div className="mb-4 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-gray-900">Solicitar novo cartão</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-gray-600">Formulário funcional com registro no banco.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome do cartão"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.setor}
              onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
              placeholder="Setor (ex: Marketing)"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={form.limite}
              onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))}
              placeholder="Limite sugerido"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <LoadingButton
              loading={loadingSolic}
              loadingText="Enviando..."
              onClick={solicitarCartao}
              className="rounded-xl bg-[var(--fo-teal)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Solicitar cartão
            </LoadingButton>
          </div>
        </div>
    </>
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

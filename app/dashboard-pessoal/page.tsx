'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Row = {
  id: string
  descricao: string
  valor: number | string
  categoria: string
  data_despesa: string
  data_vencimento?: string | null
  status: 'pendente' | 'pago' | 'vencido'
}

export default function DashboardPessoalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [nome, setNome] = useState('Usuário')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      const { data: perfil } = await supabase.from('perfil_usuario').select('tipo,nome_completo').eq('user_id', user.id).maybeSingle()
      if (perfil?.tipo !== 'pessoal') {
        router.push('/onboarding')
        return
      }
      if (perfil?.nome_completo) setNome(perfil.nome_completo)

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('despesas_pessoais')
        .select('id,descricao,valor,categoria,data_despesa,data_vencimento,status')
        .eq('user_id', user.id)
        .gte('data_despesa', inicioMes)
        .order('data_despesa', { ascending: false })
      if (!cancelled) {
        setRows((data || []) as Row[])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const totalGastos = useMemo(() => rows.reduce((s, r) => s + Number(r.valor || 0), 0), [rows])
  const aVencer = useMemo(() => rows.filter((r) => r.status === 'pendente').length, [rows])
  const topCats = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.categoria || 'Outros', (map.get(r.categoria || 'Outros') || 0) + Number(r.valor || 0))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [rows])

  if (loading) return <div className="p-8 text-sm text-[var(--fo-text-muted)]">Carregando painel pessoal...</div>

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fo-text)]">Olá, {nome.split(' ')[0]}! Você está no modo pessoal.</h1>
          <p className="mt-1 text-sm text-[var(--fo-text-muted)]">Controle simples do seu mês com insights de gastos.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Renda do mês" value="R$ —" sub="configure em Perfil" />
          <Card title="Gastos totais" value={fmtBRLCompact(totalGastos)} sub="mês atual" />
          <Card title="Saldo disponível" value="R$ —" sub="renda - gastos" />
          <Card title="Meta poupança" value="—" sub="defina sua meta" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-text-muted)]">Para onde vai meu dinheiro</h2>
            {topCats.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--fo-text-muted)]">Sem gastos no mês.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {topCats.map(([cat, valor]) => {
                  const pct = totalGastos > 0 ? (valor / totalGastos) * 100 : 0
                  return (
                    <li key={cat}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium text-[var(--fo-text)]">{cat}</span>
                        <span className="text-[var(--fo-text-muted)]">{fmtBRLCompact(valor)} · {pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[var(--fo-teal)]" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-text-muted)]">Contas a vencer</h2>
            <p className="mt-3 text-2xl font-bold text-[var(--fo-text)]">{aVencer}</p>
            <p className="text-xs text-[var(--fo-text-muted)]">próximas no mês</p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/despesas')}
              className="mt-4 rounded-xl bg-[var(--fo-teal)] px-4 py-2 text-sm font-semibold text-white"
            >
              Abrir gastos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fo-text-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--fo-text)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--fo-text-muted)]">{sub}</p>
    </div>
  )
}

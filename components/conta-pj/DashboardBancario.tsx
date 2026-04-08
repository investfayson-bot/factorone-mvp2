'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { fmtBRLCompact } from '@/lib/dre-calculations'
import { maskCpfCnpj } from '@/lib/masks'
import ModalPix from './modals/ModalPix'
import ModalTed from './modals/ModalTed'
import ModalBoleto from './modals/ModalBoleto'
import ModalInvestir from './modals/ModalInvestir'

type Conta = {
  id: string
  saldo_disponivel: number
  saldo_bloqueado: number
  saldo: number
  agencia?: string | null
  numero_conta?: string | null
  digito?: string | null
}

type Props = { empresaId: string; empresaNome: string; empresaCnpj: string; conta: Conta }
type ExtratoItem = {
  id: string
  tipo: 'credito' | 'debito'
  descricao: string
  contraparte_nome?: string | null
  data_transacao: string
  valor: number | string
}
type InvestimentoItem = { id: string; valor_aplicado: number | string; rendimento_total: number | string }
type TransferenciaItem = { id: string; destinatario_nome: string; valor: number | string; data_agendada: string }

/** Cartões virtuais por setor (limites de demonstração até API Swap) */
const CARTOES_SETOR = [
  { nome: 'Marketing', limite: 50_000, uso: 43_000, bar: 'bg-rose-500', ring: 'ring-rose-200' },
  { nome: 'Viagens', limite: 80_000, uso: 29_000, bar: 'bg-sky-500', ring: 'ring-sky-200' },
  { nome: 'Manutenção', limite: 40_000, uso: 18_000, bar: 'bg-amber-500', ring: 'ring-amber-200' },
  { nome: 'Fornecedor', limite: 200_000, uso: 68_000, bar: 'bg-violet-500', ring: 'ring-violet-200' },
] as const

export default function DashboardBancario({ empresaId, empresaNome, empresaCnpj, conta }: Props) {
  const [hide, setHide] = useState(false)
  const [extrato, setExtrato] = useState<ExtratoItem[]>([])
  const [investimentos, setInvestimentos] = useState<InvestimentoItem[]>([])
  const [agendadas, setAgendadas] = useState<TransferenciaItem[]>([])
  const [receber30, setReceber30] = useState({ valor: 0, duplicatas: 0 })
  const [modal, setModal] = useState<'pix' | 'ted' | 'boleto' | 'investir' | null>(null)

  const carregar = useCallback(async () => {
    const hoje = new Date().toISOString().slice(0, 10)
    const em30 = new Date()
    em30.setDate(em30.getDate() + 30)
    const lim = em30.toISOString().slice(0, 10)

    const [ex, inv, tr, cr] = await Promise.all([
      supabase.from('extrato_bancario').select('*').eq('empresa_id', empresaId).order('data_transacao', { ascending: false }).limit(10),
      supabase.from('investimentos').select('*').eq('empresa_id', empresaId).eq('status', 'ativo').order('created_at', { ascending: false }),
      supabase.from('transferencias_agendadas').select('*').eq('empresa_id', empresaId).in('status', ['agendado', 'processando']).order('data_agendada', { ascending: true }).limit(10),
      supabase
        .from('contas_receber')
        .select('id,valor,valor_recebido,status,data_vencimento')
        .eq('empresa_id', empresaId)
        .in('status', ['pendente', 'vencida', 'parcialmente_recebida'])
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', lim),
    ])
    setExtrato(ex.data || [])
    setInvestimentos(inv.data || [])
    setAgendadas(tr.data || [])
    const rows = cr.data || []
    const valor = rows.reduce((s, r) => {
      const v = Number(r.valor || 0) - Number(r.valor_recebido || 0)
      return s + Math.max(0, v)
    }, 0)
    setReceber30({ valor, duplicatas: rows.length })
  }, [empresaId])

  useEffect(() => {
    setHide(localStorage.getItem('conta-pj-hide-saldo') === '1')
    void carregar()
  }, [carregar])

  function toggleHide() {
    const n = !hide
    setHide(n)
    localStorage.setItem('conta-pj-hide-saldo', n ? '1' : '0')
  }

  const totalAplicado = useMemo(() => investimentos.reduce((s, i) => s + Number(i.valor_aplicado || 0), 0), [investimentos])
  const rendimentoTotal = useMemo(() => investimentos.reduce((s, i) => s + Number(i.rendimento_total || 0), 0), [investimentos])

  const linhaCc = conta.numero_conta
    ? `AG ${conta.agencia || '0001'} · CC ${conta.numero_conta}${conta.digito != null ? `-${conta.digito}` : ''}`
    : 'AG — · CC —'

  const rendMensalEst = totalAplicado > 0 && rendimentoTotal > 0 ? rendimentoTotal / Math.max(1, investimentos.length) : rendimentoTotal

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">FactorOne Bank</p>
            <h1 className="text-2xl font-bold text-slate-900">Conta PJ</h1>
            <p className="text-sm text-slate-600">
              {empresaNome} • {maskCpfCnpj(empresaCnpj || '')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Conta Ativa</span>
            <Link href="/dashboard/conta-pj/extrato" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              Extrato completo
            </Link>
          </div>
        </div>
      </div>

      {/* Três cards — mock referência */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Conta Corrente</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{hide ? '••••••' : formatBRL(conta.saldo_disponivel)}</p>
          <p className="mt-2 text-xs text-slate-400">{linhaCc}</p>
          <button type="button" onClick={toggleHide} className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            {hide ? <Eye size={14} /> : <EyeOff size={14} />}
            Ocultar saldo
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Aplicações CDI</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{hide ? '••••••' : formatBRL(totalAplicado)}</p>
          <p className="mt-2 text-sm text-slate-600">100% CDI · rend. {hide ? '••••' : formatBRL(rendMensalEst)}/mês</p>
          <Link href="/dashboard/conta-pj/investimentos" className="mt-3 inline-block text-sm font-medium text-emerald-700">
            Gerenciar aplicações
          </Link>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">A Receber 30d</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-950">{hide ? '••••••' : fmtBRLCompact(receber30.valor)}</p>
          <p className="mt-2 text-sm text-emerald-900/80">
            {receber30.duplicatas} {receber30.duplicatas === 1 ? 'duplicata pendente' : 'duplicatas pendentes'}
          </p>
          <Link href="/dashboard/financeiro" className="mt-3 inline-block text-sm font-medium text-emerald-800">
            Contas a receber
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <button type="button" onClick={() => setModal('pix')} className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-200">
          📤 Pix
        </button>
        <button type="button" onClick={() => setModal('ted')} className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-200">
          📋 TED
        </button>
        <button type="button" onClick={() => setModal('boleto')} className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-200">
          📄 Boleto
        </button>
        <button type="button" onClick={() => setModal('investir')} className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-200">
          💰 Investir
        </button>
        <Link href="/dashboard/conta-pj/extrato" className="rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-emerald-200">
          📊 Extrato
        </Link>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Cartões virtuais por setor</h2>
          <Link href="/dashboard/cartoes" className="text-sm font-medium text-emerald-700">
            Ver cartões
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CARTOES_SETOR.map((c) => {
            const pct = Math.round((c.uso / c.limite) * 100)
            return (
              <div
                key={c.nome}
                className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${c.ring}`}
              >
                <p className="text-sm font-semibold text-slate-900">{c.nome}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{fmtBRLCompact(c.limite)}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Uso: {fmtBRLCompact(c.uso)} · {pct}%
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Últimas movimentações</h2>
            <Link href="/dashboard/conta-pj/extrato" className="text-sm text-emerald-700">
              Ver completo
            </Link>
          </div>
          <div className="space-y-2">
            {extrato.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nenhuma movimentação recente.</p>
            ) : (
              extrato.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    {e.tipo === 'credito' ? (
                      <ArrowDownLeft className="text-emerald-600" size={16} />
                    ) : (
                      <ArrowUpRight className="text-red-600" size={16} />
                    )}
                    <div>
                      <p className="text-sm font-medium">{e.descricao}</p>
                      <p className="text-xs text-slate-500">
                        {e.contraparte_nome || '—'} • {new Date(e.data_transacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${e.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {e.tipo === 'credito' ? '+' : '-'}
                    {formatBRL(Number(e.valor || 0))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Investimentos</h3>
              <Link href="/dashboard/conta-pj/investimentos" className="text-xs text-emerald-700">
                Gerenciar
              </Link>
            </div>
            <p className="text-sm text-slate-500">Total aplicado</p>
            <p className="text-xl font-bold">{hide ? '••••' : formatBRL(totalAplicado)}</p>
            <p className="mt-1 text-xs text-emerald-600">Rendimento: {hide ? '••••' : formatBRL(rendimentoTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Transferências agendadas</h3>
            <div className="space-y-2">
              {agendadas.slice(0, 4).map((t) => (
                <div key={t.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <p>{t.destinatario_nome}</p>
                  <p className="text-xs text-slate-500">
                    {formatBRL(Number(t.valor || 0))} • {t.data_agendada}
                  </p>
                </div>
              ))}
            </div>
            <Link href="/dashboard/conta-pj/transferencias" className="mt-2 inline-block text-xs text-emerald-700">
              Ver todas
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Cartões corporativos</h3>
            <p className="text-sm text-slate-600">Limites e extratos dos cartões virtuais.</p>
            <Link
              href="/dashboard/cartoes"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 py-2.5 text-sm font-medium hover:border-emerald-200"
            >
              Abrir cartões
            </Link>
          </div>
        </div>
      </div>
      <ModalPix open={modal === 'pix'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
      <ModalTed open={modal === 'ted'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
      <ModalBoleto open={modal === 'boleto'} onClose={() => setModal(null)} />
      <ModalInvestir open={modal === 'investir'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
    </div>
  )
}

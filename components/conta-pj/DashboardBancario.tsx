'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { maskCpfCnpj } from '@/lib/masks'
import ModalPix from './modals/ModalPix'
import ModalTed from './modals/ModalTed'
import ModalBoleto from './modals/ModalBoleto'
import ModalInvestir from './modals/ModalInvestir'

type Props = { empresaId: string; empresaNome: string; empresaCnpj: string; conta: { id: string; saldo_disponivel: number; saldo_bloqueado: number; saldo: number } }
type ExtratoItem = { id: string; tipo: 'credito' | 'debito'; descricao: string; contraparte_nome?: string | null; data_transacao: string; valor: number | string }
type InvestimentoItem = { id: string; valor_aplicado: number | string; rendimento_total: number | string }
type TransferenciaItem = { id: string; destinatario_nome: string; valor: number | string; data_agendada: string }

export default function DashboardBancario({ empresaId, empresaNome, empresaCnpj, conta }: Props) {
  const [hide, setHide] = useState(false)
  const [extrato, setExtrato] = useState<ExtratoItem[]>([])
  const [investimentos, setInvestimentos] = useState<InvestimentoItem[]>([])
  const [agendadas, setAgendadas] = useState<TransferenciaItem[]>([])
  const [modal, setModal] = useState<'pix' | 'ted' | 'boleto' | 'investir' | null>(null)

  const carregar = useCallback(async () => {
    const [ex, inv, tr] = await Promise.all([
      supabase.from('extrato_bancario').select('*').eq('empresa_id', empresaId).order('data_transacao', { ascending: false }).limit(10),
      supabase.from('investimentos').select('*').eq('empresa_id', empresaId).eq('status', 'ativo').order('created_at', { ascending: false }),
      supabase.from('transferencias_agendadas').select('*').eq('empresa_id', empresaId).in('status', ['agendado', 'processando']).order('data_agendada', { ascending: true }).limit(10),
    ])
    setExtrato(ex.data || []); setInvestimentos(inv.data || []); setAgendadas(tr.data || [])
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

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">FactorOne Bank</p>
            <h1 className="text-2xl font-bold text-slate-900">Conta PJ</h1>
            <p className="text-sm text-slate-600">{empresaNome} • {maskCpfCnpj(empresaCnpj || '')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Conta Ativa</span>
            <Link href="/dashboard/conta-pj/extrato" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Extrato completo</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[['Saldo Disponível', conta.saldo_disponivel], ['Saldo Bloqueado', conta.saldo_bloqueado], ['Rendimento CDI (mês)', rendimentoTotal]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{hide ? '••••••' : formatBRL(Number(value || 0))}</p>
            {label === 'Saldo Disponível' && <button onClick={toggleHide} className="mt-2 flex items-center gap-1 text-xs text-slate-500">{hide ? <Eye size={14} /> : <EyeOff size={14} />} Ocultar saldo</button>}
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <button onClick={() => setModal('pix')} className="rounded-2xl border bg-white p-4 text-left">📤 Pix</button>
        <button onClick={() => setModal('ted')} className="rounded-2xl border bg-white p-4 text-left">📋 TED</button>
        <button onClick={() => setModal('boleto')} className="rounded-2xl border bg-white p-4 text-left">📄 Boleto</button>
        <button onClick={() => setModal('investir')} className="rounded-2xl border bg-white p-4 text-left">💰 Investir</button>
        <Link href="/dashboard/conta-pj/extrato" className="rounded-2xl border bg-white p-4 text-left">📊 Extrato</Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Extrato recente</h2><Link href="/dashboard/conta-pj/extrato" className="text-sm text-blue-700">Ver completo</Link></div>
          <div className="space-y-2">
            {extrato.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-2">{e.tipo === 'credito' ? <ArrowDownLeft className="text-emerald-600" size={16} /> : <ArrowUpRight className="text-red-600" size={16} />}<div><p className="text-sm font-medium">{e.descricao}</p><p className="text-xs text-slate-500">{e.contraparte_nome || '—'} • {new Date(e.data_transacao).toLocaleDateString('pt-BR')}</p></div></div>
                <p className={`text-sm font-semibold ${e.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>{e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor || 0))}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Investimentos</h3><Link href="/dashboard/conta-pj/investimentos" className="text-xs text-blue-700">Gerenciar</Link></div>
            <p className="text-sm text-slate-500">Total aplicado</p><p className="text-xl font-bold">{hide ? '••••' : formatBRL(totalAplicado)}</p>
            <p className="mt-1 text-xs text-emerald-600">Rendimento: {hide ? '••••' : formatBRL(rendimentoTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Transferências agendadas</h3>
            <div className="space-y-2">{agendadas.slice(0, 4).map((t) => <div key={t.id} className="rounded-lg bg-slate-50 p-2 text-sm"><p>{t.destinatario_nome}</p><p className="text-xs text-slate-500">{formatBRL(Number(t.valor || 0))} • {t.data_agendada}</p></div>)}</div>
            <Link href="/dashboard/conta-pj/transferencias" className="mt-2 inline-block text-xs text-blue-700">Ver todas</Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Cartões vinculados</h3>
            <p className="text-sm text-slate-600">Gestão de cartões corporativos em breve.</p>
            <button className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">+ Solicitar cartão</button>
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

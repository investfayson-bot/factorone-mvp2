'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

const CARTOES_SETOR = [
  { nome: 'Marketing', classe: 'vc-marketing', fillClasse: 'vf-amber', limite: 50_000, uso: 43_000 },
  { nome: 'Viagens', classe: 'vc-viagens', fillClasse: 'vf-blue', limite: 80_000, uso: 29_000 },
  { nome: 'Manutenção', classe: 'vc-manutencao', fillClasse: 'vf-orange', limite: 40_000, uso: 18_000 },
  { nome: 'Fornecedor', classe: 'vc-fornecedor', fillClasse: 'vf-green', limite: 200_000, uso: 68_000 },
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
    const em30 = new Date(); em30.setDate(em30.getDate() + 30)
    const lim = em30.toISOString().slice(0, 10)
    const [ex, inv, tr, cr] = await Promise.all([
      supabase.from('extrato_bancario').select('*').eq('empresa_id', empresaId).order('data_transacao', { ascending: false }).limit(10),
      supabase.from('investimentos').select('*').eq('empresa_id', empresaId).eq('status', 'ativo').order('created_at', { ascending: false }),
      supabase.from('transferencias_agendadas').select('*').eq('empresa_id', empresaId).in('status', ['agendado', 'processando']).order('data_agendada', { ascending: true }).limit(10),
      supabase.from('contas_receber').select('id,valor,valor_recebido,status,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_recebida']).gte('data_vencimento', hoje).lte('data_vencimento', lim),
    ])
    setExtrato(ex.data || [])
    setInvestimentos(inv.data || [])
    setAgendadas(tr.data || [])
    const rows = cr.data || []
    const valor = rows.reduce((s, r) => s + Math.max(0, Number(r.valor || 0) - Number(r.valor_recebido || 0)), 0)
    setReceber30({ valor, duplicatas: rows.length })
  }, [empresaId])

  useEffect(() => {
    setHide(localStorage.getItem('conta-pj-hide-saldo') === '1')
    void carregar()
  }, [carregar])

  function toggleHide() {
    const n = !hide; setHide(n)
    localStorage.setItem('conta-pj-hide-saldo', n ? '1' : '0')
  }

  const totalAplicado = useMemo(() => investimentos.reduce((s, i) => s + Number(i.valor_aplicado || 0), 0), [investimentos])
  const rendimentoTotal = useMemo(() => investimentos.reduce((s, i) => s + Number(i.rendimento_total || 0), 0), [investimentos])
  const rendMensalEst = totalAplicado > 0 && rendimentoTotal > 0 ? rendimentoTotal / Math.max(1, investimentos.length) : rendimentoTotal
  const linhaCc = conta.numero_conta ? `AG ${conta.agencia || '0001'} · CC ${conta.numero_conta}${conta.digito != null ? `-${conta.digito}` : ''}` : 'AG — · CC —'

  return (
    <>
      {/* Page header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Banco PJ</div>
          <div className="page-sub">FactorOne Bank · {empresaNome}{empresaCnpj ? ` · ${maskCpfCnpj(empresaCnpj)}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" style={{ fontSize: 11 }} onClick={toggleHide}>
            {hide ? '👁 Mostrar saldos' : '🙈 Ocultar saldos'}
          </button>
          <button className="btn-action" onClick={() => setModal('pix')}>+ Nova operação</button>
        </div>
      </div>

      {/* 3 bank cards */}
      <div className="bank-cards">
        <div className="bank-card dark">
          <div className="bc-lbl">Conta Corrente</div>
          <div className="bc-val">{hide ? '••••••' : formatBRL(conta.saldo_disponivel)}</div>
          <div className="bc-sub">{linhaCc} · Saldo disponível</div>
        </div>
        <div className="bank-card teal">
          <div className="bc-lbl">Aplicações CDI</div>
          <div className="bc-val">{hide ? '••••••' : fmtBRLCompact(totalAplicado)}</div>
          <div className="bc-sub">100% CDI · rend. {hide ? '••••' : formatBRL(rendMensalEst)}/mês</div>
        </div>
        <div className="bank-card light">
          <div className="bc-lbl">A Receber 30d</div>
          <div className="bc-val">{hide ? '••••••' : fmtBRLCompact(receber30.valor)}</div>
          <div className="bc-sub">{receber30.duplicatas} duplicatas pendentes</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: '📤 Pix', action: () => setModal('pix') },
          { label: '📋 TED', action: () => setModal('ted') },
          { label: '📄 Boleto', action: () => setModal('boleto') },
          { label: '💰 Investir', action: () => setModal('investir') },
          { label: '📊 Extrato', href: '/dashboard/conta-pj/extrato' },
        ].map(b => b.href ? (
          <Link key={b.label} href={b.href} className="btn-action btn-ghost" style={{ textAlign: 'center', fontSize: 12, textDecoration: 'none' }}>{b.label}</Link>
        ) : (
          <button key={b.label} className="btn-action btn-ghost" style={{ fontSize: 12 }} onClick={b.action}>{b.label}</button>
        ))}
      </div>

      {/* Virtual cards */}
      <div className="vcards-label">Cartões Virtuais por Setor</div>
      <div className="vcards">
        {CARTOES_SETOR.map(c => {
          const pct = Math.min(100, Math.round((c.uso / c.limite) * 100))
          return (
            <div key={c.nome} className={`vcard ${c.classe}`}>
              <div className="vc-lbl">{c.nome}</div>
              <div className="vc-val">{fmtBRLCompact(c.limite)}</div>
              <div className="vc-used">Uso: {fmtBRLCompact(c.uso)} · {pct}%</div>
              <div className="vc-bar"><div className={`vc-fill ${c.fillClasse}`} style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>

      {/* Transactions + sidebar */}
      <div className="charts-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Últimas movimentações */}
        <div className="txs-card">
          <div className="txs-header">
            <div className="txs-title">Últimas movimentações</div>
            <Link href="/dashboard/conta-pj/extrato" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver completo →</Link>
          </div>
          {extrato.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma movimentação recente.</div>
          ) : extrato.map(e => (
            <div key={e.id} className="tx-item">
              <div className="tx-left">
                <div className="tx-name">{e.descricao}</div>
                <div className="tx-sub">{e.contraparte_nome || '—'} · {new Date(e.data_transacao).toLocaleDateString('pt-BR')}</div>
              </div>
              <div className={`tx-amount ${e.tipo === 'credito' ? 'pos' : 'neg'}`}>
                {e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor || 0))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Investimentos */}
          <div className="chart-card">
            <div className="chart-title">Investimentos</div>
            <div className="dre-row">
              <span className="dre-l">Total aplicado</span>
              <span className="dre-v g">{hide ? '••••' : fmtBRLCompact(totalAplicado)}</span>
            </div>
            <div className="dre-row">
              <span className="dre-l">Rendimento</span>
              <span className="dre-v g">{hide ? '••••' : fmtBRLCompact(rendimentoTotal)}</span>
            </div>
            <Link href="/dashboard/conta-pj/investimentos" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none', display: 'block', marginTop: 10 }}>Gerenciar aplicações →</Link>
          </div>

          {/* Agendadas */}
          <div className="chart-card">
            <div className="chart-title">Transferências agendadas</div>
            {agendadas.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhuma agendada.</div>
            ) : agendadas.slice(0, 4).map(t => (
              <div key={t.id} className="dre-row">
                <span className="dre-l" style={{ fontSize: 11 }}>{t.destinatario_nome}</span>
                <span className="dre-v" style={{ fontSize: 11 }}>{formatBRL(Number(t.valor || 0))}</span>
              </div>
            ))}
            <Link href="/dashboard/conta-pj/transferencias" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none', display: 'block', marginTop: 8 }}>Ver todas →</Link>
          </div>

          {/* Cartões */}
          <div className="chart-card">
            <div className="chart-title">Cartões corporativos</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>Limites e extratos dos cartões virtuais.</div>
            <Link href="/dashboard/cartoes" className="btn-action btn-ghost" style={{ display: 'block', textAlign: 'center', fontSize: 12, textDecoration: 'none' }}>Abrir cartões →</Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ModalPix open={modal === 'pix'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
      <ModalTed open={modal === 'ted'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
      <ModalBoleto open={modal === 'boleto'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
      <ModalInvestir open={modal === 'investir'} onClose={() => setModal(null)} empresaId={empresaId} contaId={conta.id} onDone={carregar} />
    </>
  )
}

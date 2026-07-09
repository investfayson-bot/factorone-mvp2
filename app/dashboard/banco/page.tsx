'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BancoHeader, { type ContaBancaria } from '@/components/banco/BancoHeader'
import FilaTab from '@/components/banco/FilaTab'
import ExtratoTab from '@/components/banco/ExtratoTab'
import ResumoTab from '@/components/banco/ResumoTab'
import VisaoGeralTab from '@/components/banco/VisaoGeralTab'

type Aba = 'geral' | 'fila' | 'extrato' | 'resumo'
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: 'geral', label: 'Visão geral', icon: 'fa-gauge-high' },
  { id: 'fila', label: 'Fila', icon: 'fa-inbox' },
  { id: 'extrato', label: 'Extrato', icon: 'fa-list-ul' },
  { id: 'resumo', label: 'Resumo', icon: 'fa-chart-pie' },
]

function BancoPage() {
  const params = useSearchParams()
  const abaInicial = (params.get('aba') as Aba) || 'geral'
  const [aba, setAba] = useState<Aba>(ABAS.some(a => a.id === abaInicial) ? abaInicial : 'geral')
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState<string | null>(null)
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [receber30, setReceber30] = useState({ valor: 0, duplicatas: 0 })
  const [pendentesFila, setPendentesFila] = useState(0)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    setToken(sess.session?.access_token ?? '')
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)

    const hoje = new Date().toISOString().slice(0, 10)
    const em30 = new Date(); em30.setDate(em30.getDate() + 30)
    const [empR, contasR, crR, filaR] = await Promise.all([
      supabase.from('empresas').select('nome,cnpj').eq('id', eid).maybeSingle(),
      supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,agencia,numero_conta,digito,banco_nome').eq('empresa_id', eid).eq('status', 'ativa').order('is_principal', { ascending: false }),
      supabase.from('contas_receber').select('valor,valor_recebido').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_recebida']).gte('data_vencimento', hoje).lte('data_vencimento', em30.toISOString().slice(0, 10)),
      supabase.from('extrato_bancario').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('conciliado', false),
    ])
    setEmpresaNome(empR.data?.nome ?? '')
    setEmpresaCnpj(empR.data?.cnpj ?? null)
    setContas((contasR.data ?? []) as ContaBancaria[])
    const rows = crR.data ?? []
    setReceber30({ valor: rows.reduce((s, r) => s + Math.max(0, Number(r.valor || 0) - Number(r.valor_recebido || 0)), 0), duplicatas: rows.length })
    setPendentesFila(filaR.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  const onConfirmado = useCallback(() => setRefreshKey(k => k + 1), [])

  if (!loading && contas.length === 0 && pendentesFila === 0) {
    return (
      <>
        <div className="page-hdr"><div><div className="page-title">Banco</div><div className="page-sub">Conecte sua conta e toda transação chega pronta pra classificar.</div></div></div>
        <div className="txs-card" style={{ padding: 56, textAlign: 'center' }}>
          <i className="fa-solid fa-building-columns" style={{ fontSize: 34, color: 'var(--sage)', display: 'block', marginBottom: 14 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Nenhuma conta conectada</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink-mut)', marginBottom: 18 }}>Conecte pelo Open Finance (Belvo) — saldo e extrato entram sozinhos, e a IA classifica cada movimentação.</div>
          <Link href="/dashboard/conexoes" className="btn-action" style={{ fontSize: 14.5, textDecoration: 'none' }}>
            <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Conectar banco
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <BancoHeader empresaNome={empresaNome} empresaCnpj={empresaCnpj} contas={contas} receber30={receber30} />

      <div style={{ display: 'flex', gap: 4, margin: '4px 0 14px' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            fontSize: 14.5, fontWeight: aba === a.id ? 700 : 500, padding: '8px 18px', borderRadius: 22, cursor: 'pointer',
            border: `1px solid ${aba === a.id ? 'var(--sage)' : 'var(--line)'}`,
            background: aba === a.id ? 'var(--sage-tint)' : 'var(--surface, #fff)', color: aba === a.id ? 'var(--sage-deep)' : 'var(--ink-mut)',
          }}>
            <i className={`fa-solid ${a.icon}`} style={{ marginRight: 7, fontSize: 12.5 }} />
            {a.label}{a.id === 'fila' && pendentesFila > 0 ? ` (${pendentesFila})` : ''}
          </button>
        ))}
      </div>

      {aba === 'geral' && <VisaoGeralTab empresaId={empresaId} pendentesFila={pendentesFila} onIrParaFila={() => setAba('fila')} refreshKey={refreshKey} />}
      {aba === 'fila' && <FilaTab token={token} onConfirmado={onConfirmado} />}
      {aba === 'extrato' && <ExtratoTab empresaId={empresaId} />}
      {aba === 'resumo' && <ResumoTab empresaId={empresaId} refreshKey={refreshKey} />}
    </>
  )
}

export default function Page() {
  return <Suspense fallback={<div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>}><BancoPage /></Suspense>
}

'use client'

// Visão Geral do módulo Contábil & Fiscal (Fase 5, Bloco 1) — hub com KPIs
// de dado real (obrigações registradas, notas do mês, lançamentos pendentes)
// + atalhos pras sub-abas e pras telas antigas que continuam standalone
// (livros, contabilidade, portais Gov.br, tax) — mesmo padrão do
// /dashboard/relatorios na Fase 2: linkado, não forçado pra dentro de aba.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Kpis = {
  obrigacoesPendentes: number
  proximoVencimento: { nome: string; vencimento: string; valor: number | null } | null
  notasMes: number
  lancamentosPendentes: number
}

const SUBS = [
  { href: '/dashboard/contabil-fiscal/obrigacoes', icone: 'fa-calendar-check', titulo: 'Obrigações', desc: 'Vencimentos e guias registradas' },
  { href: '/dashboard/contabil-fiscal/impostos-regime', icone: 'fa-percent', titulo: 'Impostos & Regime', desc: 'Estimador de DAS do Simples' },
  { href: '/dashboard/contabil-fiscal/cofre-fiscal', icone: 'fa-vault', titulo: 'Cofre Fiscal', desc: 'Guias, declarações, contratos e procurações' },
  { href: '/dashboard/contabil-fiscal/portal-contador', icone: 'fa-user-tie', titulo: 'Portal do Contador', desc: 'Convide seu contador ou acesse seus clientes' },
]

const FERRAMENTAS = [
  { href: '/dashboard/contabilidade/livros', icone: 'fa-book-open', titulo: 'Livros contábeis', desc: 'Balancete, balanço e fechamento' },
  { href: '/dashboard/contabilidade', icone: 'fa-book', titulo: 'Contabilidade', desc: 'Recibos com OCR, lançamentos, Tributação IA' },
  { href: '/dashboard/fiscal', icone: 'fa-landmark', titulo: 'Portais do Governo', desc: 'Gov.br, SEFAZ, eSocial e outros' },
  { href: '/dashboard/tax', icone: 'fa-file-invoice-dollar', titulo: 'Tax Compliance', desc: 'Registrar pagamento de imposto' },
]

export default function ContabilFiscalVisaoGeral() {
  const [kpis, setKpis] = useState<Kpis>({ obrigacoesPendentes: 0, proximoVencimento: null, notasMes: 0, lancamentosPendentes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const hoje = new Date().toISOString().slice(0, 10)
      const mesIni = hoje.slice(0, 7) + '-01'

      const [obrigRes, notaRes, txRes] = await Promise.all([
        supabase.from('tax_obrigacoes').select('nome, vencimento, valor, status').eq('empresa_id', eid).not('status', 'in', '("entregue","pago")').gte('vencimento', hoje).order('vencimento', { ascending: true }).limit(20),
        supabase.from('notas_fiscais').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('data_emissao', mesIni),
        supabase.from('transacoes').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('data', mesIni).in('status', ['pendente', 'nao_classificado', 'sem_comprovante']),
      ])

      const pendentes = obrigRes.data ?? []
      const prox = pendentes[0]
      setKpis({
        obrigacoesPendentes: pendentes.length,
        proximoVencimento: prox ? { nome: prox.nome as string, vencimento: prox.vencimento as string, valor: prox.valor as number | null } : null,
        notasMes: notaRes.count ?? 0,
        lancamentosPendentes: txRes.count ?? 0,
      })
      setLoading(false)
    })()
  }, [])

  const prox = kpis.proximoVencimento

  return (
    <div style={{ maxWidth: 1040, paddingBottom: 30 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="kpi-v2">
          <div className="l">Próxima obrigação</div>
          {loading ? (
            <div className="v">…</div>
          ) : prox ? (
            <>
              <div className="v" style={{ fontSize: 17 }}>{prox.nome}</div>
              <div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>
                Vence {new Date(prox.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                {prox.valor != null && ` · ${formatBRL(Number(prox.valor))}`}
              </div>
            </>
          ) : (
            <>
              <div className="v" style={{ fontSize: 17 }}>—</div>
              <div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>Nenhuma pendente registrada</div>
            </>
          )}
        </div>
        <div className="kpi-v2">
          <div className="l">Notas fiscais no mês</div>
          <div className="v">{loading ? '…' : kpis.notasMes}</div>
          <div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>emitidas/recebidas</div>
        </div>
        <div className={`kpi-v2${kpis.lancamentosPendentes > 0 ? ' warn' : ''}`}>
          <div className="l">Lançamentos pendentes</div>
          <div className="v">{loading ? '…' : kpis.lancamentosPendentes}</div>
          <div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>sem classificação/comprovante no mês</div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Soluções</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {SUBS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="card-v2" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${a.icone}`} style={{ fontSize: 16, color: 'var(--acc)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.titulo}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>{a.desc}</div>
              </div>
              <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Ferramentas standalone */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Ferramentas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {FERRAMENTAS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="card-v2" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <i className={`fa-solid ${a.icone}`} style={{ fontSize: 15, color: 'var(--acc)', width: 22, textAlign: 'center' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>{a.desc}</div>
              </div>
              <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

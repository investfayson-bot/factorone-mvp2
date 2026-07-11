'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Dados = {
  arrecada: number; custos: number; resultado: number; margem: number
  aReceber: number; aPagar: number; roi: number | null
}

const fmt = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`
  return formatBRL(v)
}

export default function CentralComando({ empresaId }: { empresaId: string }) {
  const [d, setD] = useState<Dados | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    const [mR, arR, apR, mkR] = await Promise.all([
      supabase.from('metricas_financeiras').select('receita_bruta,cmv,despesas_operacionais,lucro_liquido,margem_liquida').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('contas_receber').select('valor,status').eq('empresa_id', empresaId),
      supabase.from('contas_pagar').select('valor,status').eq('empresa_id', empresaId),
      supabase.from('marketing_campanhas').select('gasto,receita_gerada').eq('empresa_id', empresaId),
    ])
    const m = mR.data as { receita_bruta?: number; cmv?: number; despesas_operacionais?: number; lucro_liquido?: number; margem_liquida?: number } | null
    const arr = (arR.data ?? []) as { valor: number | null; status: string }[]
    const ap = (apR.data ?? []) as { valor: number | null; status: string }[]
    const mk = (mkR.data ?? []) as { gasto: number | null; receita_gerada: number | null }[]
    const gasto = mk.reduce((s, c) => s + Number(c.gasto ?? 0), 0)
    const recMk = mk.reduce((s, c) => s + Number(c.receita_gerada ?? 0), 0)
    const custos = Number(m?.cmv ?? 0) + Number(m?.despesas_operacionais ?? 0)
    setD({
      arrecada: Number(m?.receita_bruta ?? 0),
      custos,
      resultado: Number(m?.lucro_liquido ?? (Number(m?.receita_bruta ?? 0) - custos)),
      margem: m?.margem_liquida != null ? (m.margem_liquida > 1 ? m.margem_liquida : m.margem_liquida * 100) : 0,
      aReceber: arr.filter(x => x.status !== 'recebida').reduce((s, x) => s + Number(x.valor ?? 0), 0),
      aPagar: ap.filter(x => x.status !== 'paga').reduce((s, x) => s + Number(x.valor ?? 0), 0),
      roi: gasto > 0 ? ((recMk - gasto) / gasto) * 100 : null,
    })
  }, [empresaId])
  useEffect(() => { void carregar() }, [carregar])

  const cards: { label: string; valor: string; sub: string; cor: string; icon: string; href: string }[] = d ? [
    { label: 'Arrecadação', valor: fmt(d.arrecada), sub: 'receita do mês', cor: '#3D7A6E', icon: 'fa-arrow-trend-up', href: '/dashboard/relatorios' },
    { label: 'Custos', valor: fmt(d.custos), sub: 'CMV + operacional', cor: '#B0413E', icon: 'fa-arrow-trend-down', href: '/dashboard/despesas' },
    { label: 'Resultado', valor: fmt(d.resultado), sub: `margem ${d.margem.toFixed(0)}%`, cor: d.resultado >= 0 ? '#13201D' : '#B0413E', icon: 'fa-scale-balanced', href: '/dashboard/indicadores' },
    { label: 'A receber', valor: fmt(d.aReceber), sub: 'em aberto', cor: '#3D7A6E', icon: 'fa-inbox', href: '/dashboard/financeiro/contas-a-receber' },
    { label: 'A pagar', valor: fmt(d.aPagar), sub: 'em aberto', cor: '#B08A3E', icon: 'fa-paper-plane', href: '/dashboard/financeiro/contas-a-pagar' },
    { label: 'ROI marketing', valor: d.roi != null ? `${d.roi >= 0 ? '+' : ''}${d.roi.toFixed(0)}%` : '—', sub: 'retorno de anúncio', cor: '#2B564D', icon: 'fa-bullseye', href: '/dashboard/indicadores' },
  ] : []

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 14, height: 1, background: 'var(--sage)' }} />Central de comando
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {cards.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, padding: '16px 16px', height: 96, opacity: .55 }}>
              <div style={{ height: 9, width: '55%', background: 'var(--paper-2)', borderRadius: 2, marginBottom: 16 }} />
              <div style={{ height: 18, width: '80%', background: 'var(--paper-2)', borderRadius: 2 }} />
            </div>
          ))
          : cards.map(c => (
            <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
              <div className="cmd-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, padding: '16px', cursor: 'pointer', height: '100%', transition: 'border-color .15s, background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: 'var(--font-mono)' }}>{c.label}</span>
                  <i className={`fa-solid ${c.icon}`} style={{ fontSize: 13, color: c.cor, opacity: .9 }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: c.cor, fontFamily: 'var(--font-display)', letterSpacing: '-.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{c.valor}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6, fontFamily: 'var(--font-mono)', letterSpacing: '.02em' }}>{c.sub}</div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

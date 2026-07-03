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
    { label: 'Arrecadação', valor: fmt(d.arrecada), sub: 'receita do mês', cor: '#16A085', icon: 'fa-arrow-trend-up', href: '/dashboard/relatorios' },
    { label: 'Custos', valor: fmt(d.custos), sub: 'CMV + operacional', cor: '#E74C3C', icon: 'fa-arrow-trend-down', href: '/dashboard/despesas' },
    { label: 'Resultado', valor: fmt(d.resultado), sub: `margem ${d.margem.toFixed(0)}%`, cor: d.resultado >= 0 ? '#1C2B2A' : '#E74C3C', icon: 'fa-scale-balanced', href: '/dashboard/indicadores' },
    { label: 'A receber', valor: fmt(d.aReceber), sub: 'em aberto', cor: '#10B981', icon: 'fa-inbox', href: '/dashboard/financeiro?tab=receber' },
    { label: 'A pagar', valor: fmt(d.aPagar), sub: 'em aberto', cor: '#D97706', icon: 'fa-paper-plane', href: '/dashboard/financeiro?tab=pagar' },
    { label: 'ROI marketing', valor: d.roi != null ? `${d.roi >= 0 ? '+' : ''}${d.roi.toFixed(0)}%` : '—', sub: 'retorno de anúncio', cor: '#7C3AED', icon: 'fa-bullseye', href: '/dashboard/indicadores' },
  ] : []

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="fa-solid fa-gauge-high" style={{ color: '#10B981' }} />Central de comando
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {cards.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '12px 14px', height: 78, opacity: .5 }}>
              <div style={{ height: 10, width: '60%', background: '#EEF2F1', borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 16, width: '80%', background: '#EEF2F1', borderRadius: 4 }} />
            </div>
          ))
          : cards.map(c => (
            <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', height: '100%', transition: 'box-shadow .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: `${c.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fa-solid ${c.icon}`} style={{ fontSize: 10, color: c.cor }} /></div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.cor, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-.02em', lineHeight: 1 }}>{c.valor}</div>
                <div style={{ fontSize: 10, color: '#AAB8B7', marginTop: 4 }}>{c.sub}</div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

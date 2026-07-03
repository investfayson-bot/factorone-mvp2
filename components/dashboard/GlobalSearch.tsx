'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Resultado = {
  id: string
  label: string
  sub: string
  icon: string
  iconColor: string
  href: string
  categoria: string
}

const CATEGORIAS: Record<string, { label: string; icon: string; iconColor: string }> = {
  transacoes:  { label: 'Transações',     icon: 'fa-arrow-right-arrow-left', iconColor: 'var(--teal)' },
  despesas:    { label: 'Despesas',        icon: 'fa-receipt',                iconColor: 'var(--red)' },
  clientes:    { label: 'Clientes',        icon: 'fa-users',                  iconColor: '#1E40AF' },
  fornecedores:{ label: 'Fornecedores',    icon: 'fa-truck',                  iconColor: 'var(--gold)' },
  crm:         { label: 'CRM',             icon: 'fa-handshake',              iconColor: '#7C3AED' },
  rotas:       { label: 'Logística',       icon: 'fa-truck-fast',             iconColor: '#0891b2' },
  nav:         { label: 'Navegação',       icon: 'fa-compass',                iconColor: 'var(--navy)' },
}

const NAV_ITEMS: Resultado[] = [
  { id: 'nav-dash',      label: 'Dashboard',              sub: 'Visão geral financeira',     icon: 'fa-chart-line',             iconColor: 'var(--navy)', href: '/dashboard',                categoria: 'nav' },
  { id: 'nav-cashflow',  label: 'Cash Flow',              sub: 'Fluxo de caixa e projeções', icon: 'fa-water',                  iconColor: 'var(--navy)', href: '/dashboard/cashflow',       categoria: 'nav' },
  { id: 'nav-receitas',  label: 'Receitas',               sub: 'Receitas e faturamento',     icon: 'fa-arrow-trend-up',         iconColor: 'var(--navy)', href: '/dashboard/receitas',       categoria: 'nav' },
  { id: 'nav-fin',       label: 'Contas Pagar/Receber',   sub: 'Financeiro',                 icon: 'fa-arrow-right-arrow-left', iconColor: 'var(--navy)', href: '/dashboard/financeiro',     categoria: 'nav' },
  { id: 'nav-desp',      label: 'Despesas & Recibos',     sub: 'Gestão de despesas',         icon: 'fa-receipt',                iconColor: 'var(--navy)', href: '/dashboard/despesas',       categoria: 'nav' },
  { id: 'nav-crm',       label: 'CRM',                    sub: 'Pipeline de vendas',         icon: 'fa-handshake',              iconColor: 'var(--navy)', href: '/dashboard/crm',            categoria: 'nav' },
  { id: 'nav-clientes',  label: 'Clientes',               sub: 'Gestão de clientes',         icon: 'fa-users',                  iconColor: 'var(--navy)', href: '/dashboard/clientes',       categoria: 'nav' },
  { id: 'nav-mkt',       label: 'Marketing',              sub: 'Campanhas e leads',          icon: 'fa-bullhorn',               iconColor: 'var(--navy)', href: '/dashboard/marketing',      categoria: 'nav' },
  { id: 'nav-log',       label: 'Logística',              sub: 'Rotas e frota',              icon: 'fa-truck-fast',             iconColor: 'var(--navy)', href: '/dashboard/logistica',      categoria: 'nav' },
  { id: 'nav-relat',     label: 'DRE & Relatórios',       sub: 'Relatórios financeiros',     icon: 'fa-file-invoice-dollar',    iconColor: 'var(--navy)', href: '/dashboard/relatorios',     categoria: 'nav' },
  { id: 'nav-planos',    label: 'Planos & Billing',       sub: 'Assinatura e plano',         icon: 'fa-star',                   iconColor: 'var(--navy)', href: '/dashboard/planos',         categoria: 'nav' },
  { id: 'nav-equipe',    label: 'Equipe',                 sub: 'Membros e permissões',       icon: 'fa-users-gear',             iconColor: 'var(--navy)', href: '/dashboard/equipe',         categoria: 'nav' },
]

async function buscarDados(q: string, empresaId: string): Promise<Resultado[]> {
  if (!q.trim() || q.length < 2) return []
  const like = `%${q}%`

  const [txRes, despRes, cliRes, fornRes, crmRes, rotasRes] = await Promise.all([
    supabase.from('transacoes').select('id,descricao,valor,tipo').eq('empresa_id', empresaId).ilike('descricao', like).limit(4),
    supabase.from('despesas').select('id,descricao,valor,categoria').eq('empresa_id', empresaId).ilike('descricao', like).limit(4),
    supabase.from('clientes').select('id,nome,email').eq('empresa_id', empresaId).or(`nome.ilike.${like},email.ilike.${like}`).limit(4),
    supabase.from('fornecedores').select('id,nome,cnpj').eq('empresa_id', empresaId).ilike('nome', like).limit(3),
    supabase.from('crm_oportunidades').select('id,titulo,valor_estimado,etapa').eq('empresa_id', empresaId).ilike('titulo', like).limit(3),
    supabase.from('logistica_rotas').select('id,origem,destino,status').eq('empresa_id', empresaId).or(`origem.ilike.${like},destino.ilike.${like}`).limit(3),
  ])

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const results: Resultado[] = []

  for (const t of txRes.data ?? []) {
    results.push({ id: `tx-${t.id}`, label: t.descricao, sub: `${t.tipo === 'entrada' ? '+' : '-'} ${fmt(t.valor)}`, icon: 'fa-arrow-right-arrow-left', iconColor: 'var(--teal)', href: '/dashboard/cashflow', categoria: 'transacoes' })
  }
  for (const d of despRes.data ?? []) {
    results.push({ id: `d-${d.id}`, label: d.descricao, sub: `${d.categoria ?? 'Despesa'} · ${fmt(d.valor)}`, icon: 'fa-receipt', iconColor: 'var(--red)', href: '/dashboard/despesas', categoria: 'despesas' })
  }
  for (const c of cliRes.data ?? []) {
    results.push({ id: `c-${c.id}`, label: c.nome ?? c.email ?? 'Cliente', sub: c.email ?? '', icon: 'fa-user', iconColor: '#1E40AF', href: '/dashboard/clientes', categoria: 'clientes' })
  }
  for (const f of fornRes.data ?? []) {
    results.push({ id: `f-${f.id}`, label: f.nome, sub: f.cnpj ?? 'Fornecedor', icon: 'fa-truck', iconColor: 'var(--gold)', href: '/dashboard/fornecedores', categoria: 'fornecedores' })
  }
  for (const o of crmRes.data ?? []) {
    results.push({ id: `crm-${o.id}`, label: o.titulo, sub: `${o.etapa} · ${o.valor_estimado ? fmt(o.valor_estimado) : '—'}`, icon: 'fa-handshake', iconColor: '#7C3AED', href: '/dashboard/crm', categoria: 'crm' })
  }
  for (const r of rotasRes.data ?? []) {
    results.push({ id: `rt-${r.id}`, label: `${r.origem} → ${r.destino}`, sub: r.status, icon: 'fa-truck-fast', iconColor: '#0891b2', href: '/dashboard/logistica', categoria: 'rotas' })
  }

  return results
}

export default function GlobalSearch({ empresaId }: { empresaId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setResultados([]) }
  }, [open])

  const pesquisar = useCallback(async (q: string) => {
    setQuery(q)
    setCursor(0)
    if (!q.trim() || q.length < 2) { setResultados([]); return }
    setLoading(true)
    try {
      const res = await buscarDados(q, empresaId)
      setResultados(res)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  const listaFinal = query.length >= 2 ? resultados : NAV_ITEMS.slice(0, 8)

  function navegar(href: string) {
    router.push(href)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, listaFinal.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && listaFinal[cursor]) navegar(listaFinal[cursor].href)
  }

  const grupos = listaFinal.reduce<Record<string, Resultado[]>>((acc, r) => {
    acc[r.categoria] = acc[r.categoria] ?? []
    acc[r.categoria].push(r)
    return acc
  }, {})

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.18)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', gap: 10 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--gray-400)', fontSize: 14 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => pesquisar(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar transações, clientes, páginas..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: 'var(--navy)', background: 'transparent' }}
          />
          {loading && <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--gray-400)', fontSize: 12 }} />}
          <kbd style={{ fontSize: 10, color: 'var(--gray-400)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace' }}>ESC</kbd>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {Object.entries(grupos).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 16px 2px' }}>
                {CATEGORIAS[cat]?.label ?? cat}
              </div>
              {items.map((r, i) => {
                const globalIdx = listaFinal.indexOf(r)
                const ativo = globalIdx === cursor
                return (
                  <div
                    key={r.id}
                    onClick={() => navegar(r.href)}
                    onMouseEnter={() => setCursor(globalIdx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer',
                      background: ativo ? 'rgba(16,185,129,.08)' : 'transparent',
                      borderLeft: ativo ? '2px solid var(--teal)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: ativo ? 'rgba(16,185,129,.12)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${r.icon}`} style={{ color: r.iconColor, fontSize: 12 }} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                      {r.sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>}
                    </div>
                    <i className="fa-solid fa-arrow-right" style={{ color: 'var(--gray-300)', fontSize: 10, flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          ))}
          {query.length >= 2 && !loading && resultados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ display: 'block', marginBottom: 6, fontSize: 20 }} />
              Nenhum resultado para "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--gray-100)', padding: '8px 16px', display: 'flex', gap: 14 }}>
          {[['↑↓', 'navegar'], ['↵', 'abrir'], ['Esc', 'fechar']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ fontSize: 10, color: 'var(--gray-500)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace' }}>{key}</kbd>
              <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

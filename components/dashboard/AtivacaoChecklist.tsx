'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/**
 * Checklist de ativação ("Comece por aqui") — mostra ao novo usuário os passos
 * que geram valor e marca sozinho o que já foi feito (a partir dos dados reais).
 * Some quando tudo estiver feito ou for dispensado.
 */
type Passo = { id: string; label: string; desc: string; icon: string; href: string; done: boolean }

export default function AtivacaoChecklist({ empresaId }: { empresaId: string }) {
  const [passos, setPassos] = useState<Passo[]>([])
  const [dismissed, setDismissed] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    if (localStorage.getItem(`fo_ativacao_${empresaId}`) === 'off') { setLoaded(true); return }

    const { data: txs } = await supabase.from('transacoes').select('categoria').eq('empresa_id', empresaId).limit(500)
    const arr = (txs ?? []) as { categoria: string | null }[]
    const temTx = arr.length > 0
    const classificou = arr.some(t => t.categoria && t.categoria.trim() !== '')
    let temSite = false
    try { const { data: s } = await supabase.from('sites').select('id').eq('empresa_id', empresaId).maybeSingle(); temSite = !!s } catch { /* tabela pode não existir */ }
    let temLead = false
    try { const { count } = await supabase.from('marketing_leads').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId); temLead = (count ?? 0) > 0 } catch { /* ignore */ }

    const lista: Passo[] = [
      { id: 'tx', label: 'Traga suas transações', desc: 'Conecte o banco ou popule dados de teste', icon: 'fa-arrow-down-to-bracket', href: '/dashboard/classificar', done: temTx },
      { id: 'clas', label: 'Classifique com a IA', desc: 'A IA sugere, você confirma', icon: 'fa-layer-group', href: '/dashboard/classificar', done: classificou },
      { id: 'dre', label: 'Veja seu resultado', desc: 'DRE, fluxo e onde você gastou', icon: 'fa-chart-bar', href: '/dashboard/relatorios', done: classificou },
      { id: 'site', label: 'Crie sua presença', desc: 'Gere um site que captura cliente', icon: 'fa-globe', href: '/dashboard/marketing/site', done: temSite },
      { id: 'lead', label: 'Capte seu 1º lead', desc: 'Plugue uma fonte e receba leads', icon: 'fa-magnet', href: '/dashboard/captacao', done: temLead },
    ]
    setPassos(lista)
    setDismissed(lista.every(p => p.done))
    setLoaded(true)
  }, [empresaId])
  useEffect(() => { void carregar() }, [carregar])

  if (!loaded || dismissed || passos.length === 0) return null
  const feitos = passos.filter(p => p.done).length
  const pct = Math.round((feitos / passos.length) * 100)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--sage)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-rocket" style={{ color: 'var(--sage)' }} />Comece por aqui
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sage-deep)', background: 'var(--sage-tint)', padding: '2px 9px', borderRadius: 100 }}>{feitos}/{passos.length}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mut)', marginTop: 3 }}>Alguns passos e o FactorOne já está trabalhando pra você.</div>
        </div>
        <button onClick={() => { localStorage.setItem(`fo_ativacao_${empresaId}`, 'off'); setDismissed(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mut)', fontSize: 12 }} title="Dispensar">Dispensar ✕</button>
      </div>
      <div style={{ height: 6, background: 'var(--paper-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--sage)', borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
        {passos.map(p => (
          <Link key={p.id} href={p.href} style={{ textDecoration: 'none', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line-soft)', background: p.done ? 'var(--sage-tint)' : 'var(--surface-2)', opacity: p.done ? .85 : 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.done ? 'var(--sage)' : 'var(--surface)', border: p.done ? 'none' : '1px solid var(--line)', color: p.done ? '#fff' : 'var(--sage-deep)' }}>
              <i className={`fa-solid ${p.done ? 'fa-check' : p.icon}`} style={{ fontSize: 12 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: p.done ? 'line-through' : 'none' }}>{p.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

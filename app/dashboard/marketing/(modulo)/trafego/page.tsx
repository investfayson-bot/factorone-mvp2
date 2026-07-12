'use client'

// Tráfego Pago (Fase 7) — detalhamento por canal a partir de
// marketing_campanhas. OAuth com Meta Business/Google Ads ainda não existe
// — estado vazio honesto com o botão desabilitado explicando (a spec prevê
// "se ainda não conectado, mostrar estado vazio com botão Conectar").

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Campanha = { id: string; nome: string; tipo: string; status: string; gasto: number | null; impressoes: number; cliques: number; conversoes: number; receita_gerada: number | null }

const CANAIS = [
  { tipo: 'meta_ads', label: 'Meta Ads', icone: 'fa-brands fa-meta' },
  { tipo: 'google_ads', label: 'Google Ads', icone: 'fa-brands fa-google' },
]

export default function TrafegoPagoPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const { data } = await supabase
        .from('marketing_campanhas')
        .select('id, nome, tipo, status, gasto, impressoes, cliques, conversoes, receita_gerada')
        .eq('empresa_id', eid)
        .in('tipo', ['meta_ads', 'google_ads'])
        .order('created_at', { ascending: false })
      setCampanhas((data as Campanha[]) ?? [])
      setLoading(false)
    })()
  }, [])

  const porCanal = useMemo(() => CANAIS.map(c => {
    const lista = campanhas.filter(x => x.tipo === c.tipo)
    const soma = (f: (x: Campanha) => number) => lista.reduce((s, x) => s + f(x), 0)
    const investimento = soma(x => Number(x.gasto ?? 0))
    const impressoes = soma(x => x.impressoes)
    const cliques = soma(x => x.cliques)
    const conversoes = soma(x => x.conversoes)
    const receita = soma(x => Number(x.receita_gerada ?? 0))
    return {
      ...c, lista, investimento, impressoes, cliques, conversoes,
      ctr: impressoes > 0 ? (cliques / impressoes) * 100 : null,
      cpl: conversoes > 0 ? investimento / conversoes : null,
      roas: investimento > 0 ? receita / investimento : null,
    }
  }), [campanhas])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 30 }}>
      {campanhas.length === 0 && (
        <div className="card-v2" style={{ padding: '30px 20px', textAlign: 'center', marginBottom: 14 }}>
          <i className="fa-solid fa-bullseye" style={{ fontSize: 26, color: 'var(--acc)', marginBottom: 10, display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Nenhuma conta de anúncio conectada</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', maxWidth: 460, margin: '0 auto 12px' }}>
            A conexão direta com Meta Business e Google Ads (OAuth) está no roadmap. Enquanto isso, cadastre as campanhas manualmente na aba Campanhas — todas as métricas daqui funcionam com esse dado.
          </div>
          <button className="btn-v2" disabled title="Integração OAuth em desenvolvimento">Conectar conta (em breve)</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {porCanal.map(c => (
          <div key={c.tipo} className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
              <i className={c.icone} style={{ marginRight: 7, color: 'var(--acc)' }} />{c.label}
              <span style={{ fontWeight: 600, color: 'var(--mut)', marginLeft: 6 }}>· {c.lista.length} campanha{c.lista.length === 1 ? '' : 's'}</span>
            </div>
            {[
              ['Investimento', formatBRL(c.investimento)],
              ['Impressões', c.impressoes.toLocaleString('pt-BR')],
              ['Cliques', c.cliques.toLocaleString('pt-BR')],
              ['CTR', c.ctr != null ? `${c.ctr.toFixed(2)}%` : '—'],
              ['Conversões', String(c.conversoes)],
              ['CPL', c.cpl != null ? formatBRL(c.cpl) : '—'],
              ['ROAS', c.roas != null ? `${c.roas.toFixed(2)}x` : '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)', fontWeight: 600 }}>{l}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

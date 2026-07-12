'use client'

// Dashboard de Ofertas (Fase 6, pedido do Fayson) — visão agregada de todos
// os descontos que a IA (ou você) ofereceu através dos negócios ativos.
// Fonte: crm_ofertas + join com crm_oportunidades.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Oferta = {
  id: string; desconto_pct: number; status: string; canal: string | null
  automatica: boolean; created_at: string
  crm_oportunidades: { titulo: string; valor: number | null; temperatura: string | null } | { titulo: string; valor: number | null; temperatura: string | null }[] | null
}

const STATUS_UI: Record<string, { label: string; classe: string }> = {
  aguardando: { label: 'Aguardando resposta', classe: 'y' },
  aceita: { label: 'Aceita', classe: 'g' },
  recusada: { label: 'Recusada', classe: 'r' },
  expirada: { label: 'Expirada', classe: '' },
}

const TEMP_UI: Record<string, { classe: string; label: string }> = {
  frio: { classe: 'cold', label: 'Frio' }, morno: { classe: 'warm', label: 'Morno' }, quente: { classe: 'hot', label: 'Quente' },
}

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [loading, setLoading] = useState(true)
  const [faixa, setFaixa] = useState<'todas' | 'ate10' | 'acima10'>('todas')
  const [tempFiltro, setTempFiltro] = useState<'todas' | 'frio' | 'morno' | 'quente'>('todas')

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const { data } = await supabase
        .from('crm_ofertas')
        .select('id, desconto_pct, status, canal, automatica, created_at, crm_oportunidades(titulo, valor, temperatura)')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false })
        .limit(200)
      setOfertas((data as Oferta[]) ?? [])
      setLoading(false)
    })()
  }, [])

  function negocio(o: Oferta) {
    const n = o.crm_oportunidades
    return Array.isArray(n) ? n[0] ?? null : n
  }

  const filtradas = useMemo(() => ofertas.filter(o => {
    const pct = Number(o.desconto_pct)
    if (faixa === 'ate10' && pct > 10) return false
    if (faixa === 'acima10' && pct <= 10) return false
    if (tempFiltro !== 'todas' && negocio(o)?.temperatura !== tempFiltro) return false
    return true
  }), [ofertas, faixa, tempFiltro])

  const kpis = useMemo(() => {
    const ativas = ofertas.filter(o => o.status === 'aguardando')
    const respondidas = ofertas.filter(o => o.status === 'aceita' || o.status === 'recusada')
    const aceitas = ofertas.filter(o => o.status === 'aceita')
    const descontoMedio = ofertas.length > 0 ? ofertas.reduce((s, o) => s + Number(o.desconto_pct), 0) / ofertas.length : null
    const inicioMes = new Date(); inicioMes.setDate(1)
    const concedidoMes = aceitas
      .filter(o => new Date(o.created_at) >= inicioMes)
      .reduce((s, o) => s + Number(negocio(o)?.valor ?? 0) * (Number(o.desconto_pct) / 100), 0)
    return {
      ativas: ativas.length,
      descontoMedio,
      taxaAceite: respondidas.length > 0 ? (aceitas.length / respondidas.length) * 100 : null,
      concedidoMes,
    }
  }, [ofertas])

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 30 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <div className="kpi-v2"><div className="l">Ofertas ativas agora</div><div className="v">{loading ? '…' : kpis.ativas}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>aguardando resposta</div></div>
        <div className="kpi-v2"><div className="l">Desconto médio</div><div className="v">{loading || kpis.descontoMedio == null ? '—' : `${kpis.descontoMedio.toFixed(1)}%`}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>todas as ofertas</div></div>
        <div className="kpi-v2"><div className="l">Taxa de aceite</div><div className="v">{loading || kpis.taxaAceite == null ? '—' : `${kpis.taxaAceite.toFixed(0)}%`}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>aceitas / respondidas</div></div>
        <div className="kpi-v2 warn"><div className="l">Desconto concedido (mês)</div><div className="v">{loading ? '…' : formatBRL(kpis.concedidoMes)}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>sobre ofertas aceitas</div></div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="seg-v2">
          {([['todas', 'Todas'], ['ate10', 'Até 10%'], ['acima10', 'Acima de 10%']] as const).map(([v, l]) => (
            <span key={v} className={faixa === v ? 'on' : ''} onClick={() => setFaixa(v)}>{l}</span>
          ))}
        </div>
        <div className="seg-v2">
          {([['todas', 'Qualquer temperatura'], ['quente', 'Quente'], ['morno', 'Morno'], ['frio', 'Frio']] as const).map(([v, l]) => (
            <span key={v} className={tempFiltro === v ? 'on' : ''} onClick={() => setTempFiltro(v)}>{l}</span>
          ))}
        </div>
      </div>

      <div className="card-v2" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
            {ofertas.length === 0
              ? 'Nenhuma oferta registrada ainda — quando a IA (ou você) oferecer desconto num negócio do Pipeline, aparece aqui agregado.'
              : 'Nenhuma oferta com esses filtros.'}
          </div>
        ) : filtradas.map(o => {
          const n = negocio(o)
          const st = STATUS_UI[o.status] ?? STATUS_UI.aguardando
          const t = n?.temperatura ? TEMP_UI[n.temperatura] : null
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 12, color: 'var(--acc-ink)', fontVariantNumeric: 'tabular-nums' }}>
                {Number(o.desconto_pct)}%
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{n?.titulo ?? 'Negócio removido'}</div>
                <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>
                  {new Date(o.created_at).toLocaleDateString('pt-BR')}{o.canal ? ` · ${o.canal}` : ''} · {o.automatica ? '🤖 automática' : 'manual'}
                  {n?.valor != null && ` · negócio de ${formatBRL(Number(n.valor))}`}
                </div>
              </div>
              {t && <span className={`temp ${t.classe}`} style={{ margin: 0 }}>{t.label}</span>}
              <span className={`chip-v2 ${st.classe}`}>{st.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AGENTES } from '@/lib/hub-agentes'

type UsageRow = {
  agente_id: string
  modelo: string
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  custo_usd: number
  created_at: string
}

type AgentStats = {
  agente_id: string
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  custo_usd: number
  chamadas: number
}

export default function UsoPage() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id ?? user.id
      const { data } = await supabase
        .from('hub_uso_agentes')
        .select('agente_id,modelo,total_tokens,prompt_tokens,completion_tokens,custo_usd,created_at')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false })
        .limit(500)
      setRows((data ?? []) as UsageRow[])
      setLoading(false)
    })()
  }, [])

  const stats: AgentStats[] = AGENTES.map((a) => {
    const aRows = rows.filter((r) => r.agente_id === a.id)
    return {
      agente_id: a.id,
      total_tokens: aRows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0),
      prompt_tokens: aRows.reduce((s, r) => s + Number(r.prompt_tokens ?? 0), 0),
      completion_tokens: aRows.reduce((s, r) => s + Number(r.completion_tokens ?? 0), 0),
      custo_usd: aRows.reduce((s, r) => s + Number(r.custo_usd ?? 0), 0),
      chamadas: aRows.length,
    }
  }).filter((s) => s.chamadas > 0).sort((a, b) => b.total_tokens - a.total_tokens)

  const totais = stats.reduce((acc, s) => ({
    total_tokens: acc.total_tokens + s.total_tokens,
    custo_usd: acc.custo_usd + s.custo_usd,
    chamadas: acc.chamadas + s.chamadas,
  }), { total_tokens: 0, custo_usd: 0, chamadas: 0 })

  const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total de tokens', value: totais.total_tokens.toLocaleString('pt-BR'), icon: 'fa-coins' },
          { label: 'Custo total (USD)', value: `$${totais.custo_usd.toFixed(4)}`, icon: 'fa-dollar-sign' },
          { label: 'Chamadas', value: totais.chamadas.toLocaleString('pt-BR'), icon: 'fa-bolt' },
        ].map((k) => (
          <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Inter', system-ui, sans-serif" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Por agente */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          Consumo por Agente
        </div>
        {loading ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Carregando…</div>
        ) : stats.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
            <i className="fa-solid fa-chart-bar" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
            Nenhuma conversa registrada ainda.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--gray-50,#f8f9fa)' }}>
                  {['Agente', 'Chamadas', 'Prompt tokens', 'Completion tokens', 'Total tokens', 'Custo (USD)'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'Inter', system-ui, sans-serif", borderBottom: '1px solid var(--gray-100)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const agente = AGENTES.find((a) => a.id === s.agente_id)!
                  return (
                    <tr key={s.agente_id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: agente.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{agente.inicial}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{agente.nome}</div>
                            <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{agente.especialidade}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--navy)' }}>{s.chamadas.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--gray-500)' }}>{s.prompt_tokens.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--gray-500)' }}>{s.completion_tokens.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, color: 'var(--navy)' }}>{s.total_tokens.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: s.custo_usd > 0.1 ? 'var(--gold)' : 'var(--navy)' }}>${s.custo_usd.toFixed(4)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico recente */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          Histórico recente (últimas 50 chamadas)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50,#f8f9fa)' }}>
                {['Data', 'Agente', 'Modelo', 'Tokens', 'Custo (USD)'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'Inter', system-ui, sans-serif", borderBottom: '1px solid var(--gray-100)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, i) => {
                const agente = AGENTES.find((a) => a.id === r.agente_id)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--gray-500)', fontFamily: "'Inter', system-ui, sans-serif" }}>{new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {agente ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 4, background: agente.cor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>{agente.inicial}</span>
                          {agente.nome}
                        </span>
                      ) : r.agente_id}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--gray-400)', fontFamily: "'Inter', system-ui, sans-serif" }}>{r.modelo}</td>
                    <td style={{ padding: '8px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--navy)' }}>{Number(r.total_tokens).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--navy)' }}>${Number(r.custo_usd).toFixed(6)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

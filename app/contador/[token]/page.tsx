'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Contador = {
  nome: string
  status: string
  empresa_id: string
  permissoes: Record<string, boolean>
}

type Metrica = {
  competencia: string
  receita_bruta: number
  lucro_liquido: number
  ebitda: number
  margem_liquida: number
}

type Lancamento = {
  id: string
  descricao: string
  valor: number
  tipo: string
  competencia: string
  origem: string
}

type NotaEmitida = {
  id: string
  numero: string | null
  destinatario_nome: string | null
  valor_total: number
  status: string
  created_at: string
}

type Despesa = {
  id: string
  descricao: string
  valor: number
  categoria: string
  status: string
  data_despesa: string | null
}

const TABS = ['DRE', 'Lancamentos', 'Notas', 'Despesas'] as const
type Tab = (typeof TABS)[number]

function Tag({ v, label }: { v: boolean; label: string }) {
  return (
    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: v ? 'rgba(45,155,111,.1)' : 'rgba(192,80,74,.08)', color: v ? '#2d9b6f' : '#c0504a', fontWeight: 600 }}>
      {label}: {v ? 'permitido' : 'bloqueado'}
    </span>
  )
}

export default function PortalContadorPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [loading, setLoading] = useState(true)
  const [cont, setCont] = useState<Contador | null>(null)
  const [tab, setTab] = useState<Tab>('DRE')
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [notas, setNotas] = useState<NotaEmitida[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const { data } = await supabase
        .from('contadores')
        .select('nome,status,empresa_id,permissoes')
        .eq('token_acesso', token)
        .maybeSingle()
      setCont((data as Contador) || null)
      setLoading(false)
    })()
  }, [token])

  useEffect(() => {
    if (!cont) return
    void carregarTab(tab)
  }, [cont, tab])

  async function carregarTab(t: Tab) {
    if (!cont) return
    const eid = cont.empresa_id
    setDataLoading(true)
    try {
      if (t === 'DRE') {
        const { data } = await supabase
          .from('metricas_financeiras')
          .select('competencia,receita_bruta,lucro_liquido,ebitda,margem_liquida')
          .eq('empresa_id', eid)
          .order('competencia', { ascending: false })
          .limit(12)
        setMetricas((data ?? []) as Metrica[])
      } else if (t === 'Lancamentos') {
        const { data } = await supabase
          .from('lancamentos')
          .select('id,descricao,valor,tipo,competencia,origem')
          .eq('empresa_id', eid)
          .order('competencia', { ascending: false })
          .limit(50)
        setLancamentos((data ?? []) as Lancamento[])
      } else if (t === 'Notas') {
        const { data } = await supabase
          .from('notas_emitidas')
          .select('id,numero,destinatario_nome,valor_total,status,created_at')
          .eq('empresa_id', eid)
          .order('created_at', { ascending: false })
          .limit(30)
        setNotas((data ?? []) as NotaEmitida[])
      } else if (t === 'Despesas') {
        const { data } = await supabase
          .from('despesas')
          .select('id,descricao,valor,categoria,status,data_despesa')
          .eq('empresa_id', eid)
          .order('data_despesa', { ascending: false })
          .limit(50)
        setDespesas((data ?? []) as Despesa[])
      }
    } finally {
      setDataLoading(false)
    }
  }

  const perm = cont?.permissoes ?? {}

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: '#64748b' }}>Carregando portal...</div>
  if (!cont)   return <div style={{ padding: 32, fontSize: 13, color: '#c0504a' }}>Token de acesso invalido ou expirado.</div>
  if (cont.status === 'revogado') return <div style={{ padding: 32, fontSize: 13, color: '#c0504a' }}>Acesso revogado pelo cliente.</div>

  const tabsVisiveis = TABS.filter(t => {
    if (t === 'DRE')         return perm.ver_dre !== false
    if (t === 'Lancamentos') return perm.ver_lancamentos !== false
    if (t === 'Notas')       return perm.ver_notas !== false
    if (t === 'Despesas')    return perm.ver_despesas !== false
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Portal do Contador</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Ola, <strong>{cont.nome}</strong> · Acesso somente leitura
              </div>
            </div>
            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'rgba(45,155,111,.1)', color: '#2d9b6f', fontWeight: 600 }}>
              {cont.status}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            <Tag v={perm.ver_dre !== false}         label="DRE" />
            <Tag v={perm.ver_lancamentos !== false} label="Lancamentos" />
            <Tag v={perm.ver_notas !== false}       label="Notas" />
            <Tag v={perm.ver_despesas !== false}    label="Despesas" />
            <Tag v={perm.exportar !== false}        label="Exportar" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {tabsVisiveis.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? '#0f766e' : '#fff',
                color: tab === t ? '#fff' : '#475569',
                border: tab === t ? 'none' : '1px solid #e2e8f0',
              }}
            >{t}</button>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          {dataLoading && <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Carregando...</div>}

          {!dataLoading && tab === 'DRE' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>DRE — Ultimos 12 meses</div>
              {metricas.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem dados de DRE. Execute o recalculo no modulo Relatorios.</div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['Competencia','Receita Bruta','EBITDA','Lucro Liquido','Margem'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Competencia' ? 'left' : 'right', color: '#64748b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricas.map(m => (
                    <tr key={m.competencia} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1e293b' }}>{m.competencia?.slice(0, 7)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#1e293b' }}>{formatBRL(m.receita_bruta)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#1e293b' }}>{formatBRL(m.ebitda)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: m.lucro_liquido >= 0 ? '#2d9b6f' : '#c0504a', fontWeight: 600 }}>{formatBRL(m.lucro_liquido)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{(m.margem_liquida * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!dataLoading && tab === 'Lancamentos' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Lancamentos contabeis</div>
              {lancamentos.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem lancamentos registrados.</div>}
              {lancamentos.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{l.descricao}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.competencia?.slice(0, 7)} · {l.origem}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: l.tipo === 'credito' ? '#2d9b6f' : '#c0504a' }}>
                    {l.tipo === 'credito' ? '+' : '-'}{formatBRL(l.valor)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!dataLoading && tab === 'Notas' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Notas fiscais emitidas</div>
              {notas.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem notas emitidas.</div>}
              {notas.map(n => (
                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{n.destinatario_nome ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>NF {n.numero ?? '—'} · {n.created_at?.slice(0, 10)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: n.status === 'autorizada' ? 'rgba(45,155,111,.1)' : '#f1f5f9', color: n.status === 'autorizada' ? '#2d9b6f' : '#64748b', fontWeight: 600 }}>{n.status}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{formatBRL(n.valor_total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!dataLoading && tab === 'Despesas' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Despesas</div>
              {despesas.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem despesas registradas.</div>}
              {despesas.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{d.descricao}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.categoria} · {d.data_despesa ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>{d.status}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{formatBRL(Number(d.valor))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'

type PortalData = {
  cliente: { nome: string; email: string | null; cnpj_cpf: string | null; segmento: string | null; status: string; valor_contrato: number | null }
  empresa_nome: string
  faturas: Array<{ descricao: string; valor: number; data_vencimento: string; status: string }>
  entregas: Array<{ origem: string; destino: string; status: string; valor_frete: number | null; data_entrega: string | null; created_at: string }>
  oportunidades: Array<{ titulo: string; etapa: string; valor: number | null; data_fechamento: string | null }>
}

const STATUS_FAT: Record<string, { label: string; color: string; bg: string }> = {
  pendente:  { label: 'Pendente',  color: '#b45309', bg: '#fef3c7' },
  vencida:   { label: 'Vencida',   color: '#dc2626', bg: '#fee2e2' },
  paga:      { label: 'Paga',      color: '#16a34a', bg: '#dcfce7' },
  cancelada: { label: 'Cancelada', color: '#64748b', bg: '#f1f5f9' },
}

const STATUS_ENT: Record<string, { label: string; color: string }> = {
  agendada:   { label: 'Agendada',   color: '#64748b' },
  em_transito:{ label: 'Em trânsito',color: '#0891b2' },
  entregue:   { label: 'Entregue',   color: '#16a34a' },
  cancelada:  { label: 'Cancelada',  color: '#dc2626' },
  problema:   { label: 'Problema',   color: '#d97706' },
}

function fmt(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ClientePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tabAtiva, setTabAtiva] = useState<'faturas' | 'entregas' | 'contratos'>('faturas')

  useEffect(() => {
    params.then(async ({ token }) => {
      const res = await fetch(`/api/clientes/portal/${token}`)
      if (!res.ok) { const d = await res.json() as { error: string }; setError(d.error); setLoading(false); return }
      setData(await res.json() as PortalData)
      setLoading(false)
    })
  }, [params])

  const totalPendente = data?.faturas.filter(f => f.status === 'pendente' || f.status === 'vencida').reduce((s, f) => s + Number(f.valor), 0) ?? 0
  const totalPago = data?.faturas.filter(f => f.status === 'paga').reduce((s, f) => s + Number(f.valor), 0) ?? 0

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
        Carregando portal...
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 380, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <i className="fa-solid fa-circle-xmark" style={{ fontSize: 48, color: '#dc2626', marginBottom: 16, display: 'block' }} />
        <h2 style={{ color: '#0d1b2a', marginBottom: 8 }}>Link inválido</h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  )

  if (!data) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d1b2a', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
          Factor<span style={{ color: '#00A896' }}>One</span>
          <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 12 }}>{data.empresa_nome}</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Portal do Cliente</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px' }}>
        {/* Client card */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0d1b2a' }}>{data.cliente.nome}</div>
              {data.cliente.cnpj_cpf && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{data.cliente.cnpj_cpf}</div>}
              {data.cliente.segmento && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{data.cliente.segmento}</div>}
            </div>
            {data.cliente.valor_contrato && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Contrato</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#00A896' }}>{fmt(data.cliente.valor_contrato)}</div>
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'A pagar', v: fmt(totalPendente), c: totalPendente > 0 ? '#dc2626' : '#16a34a' },
            { l: 'Pago', v: fmt(totalPago), c: '#16a34a' },
            { l: 'Entregas', v: String(data.entregas.filter(e => e.status === 'entregue').length), c: '#0d1b2a' },
          ].map(k => (
            <div key={k.l} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.c, fontFamily: 'monospace' }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['faturas', 'Faturas'], ['entregas', 'Entregas'], ['contratos', 'Contratos']] as [typeof tabAtiva, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTabAtiva(k)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid',
              background: tabAtiva === k ? '#0d1b2a' : '#fff',
              color: tabAtiva === k ? '#fff' : '#64748b',
              borderColor: tabAtiva === k ? '#0d1b2a' : '#e2e8f0',
            }}>{l}</button>
          ))}
        </div>

        {/* Faturas */}
        {tabAtiva === 'faturas' && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {data.faturas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Nenhuma fatura encontrada</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Descrição', 'Vencimento', 'Valor', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.faturas.map((f, i) => {
                    const s = STATUS_FAT[f.status] ?? STATUS_FAT.pendente
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{f.descricao}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(f.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(Number(f.valor))}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: s.bg, color: s.color, fontWeight: 600 }}>{s.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Entregas */}
        {tabAtiva === 'entregas' && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {data.entregas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Nenhuma entrega encontrada</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Rota', 'Frete', 'Entrega', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.entregas.map((e, i) => {
                    const s = STATUS_ENT[e.status] ?? STATUS_ENT.agendada
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{e.origem} → {e.destino}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{fmt(e.valor_frete)}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                          {e.data_entrega ? new Date(e.data_entrega).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#f1f5f9', color: s.color, fontWeight: 600 }}>{s.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Contratos / Oportunidades */}
        {tabAtiva === 'contratos' && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {data.oportunidades.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Nenhum contrato/proposta encontrado</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Proposta', 'Valor', 'Fechamento', 'Etapa'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.oportunidades.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{o.titulo}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(o.valor)}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                        {o.data_fechamento ? new Date(o.data_fechamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>{o.etapa}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#94a3b8' }}>
          Powered by <strong style={{ color: '#00A896' }}>FactorOne</strong>
        </div>
      </div>
    </div>
  )
}

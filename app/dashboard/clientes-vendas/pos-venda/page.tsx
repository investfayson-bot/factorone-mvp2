'use client'

// Pós-venda (Fase 6) — clientes fechados (crm_oportunidades fechado_ganho)
// com anotação simples por cliente, conforme a spec: "estrutura simples de
// anotação por cliente para esta fase, aprofundar depois". A anotação vira
// um evento de auditoria do negócio (crm_negociacao_eventos via API do
// pipeline não cobre texto livre — usa crm_atividades tipo 'outro', que já
// existe e aparece também no Agendamento/CRM).

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Fechado = { id: string; titulo: string; valor: number | null; data_fechamento: string | null; cliente_id: string | null }
type Nota = { id: string; titulo: string; descricao: string | null; data: string }

export default function PosVendaPage() {
  const [fechados, setFechados] = useState<Fechado[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [novaNota, setNovaNota] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('crm_oportunidades')
      .select('id, titulo, valor, data_fechamento, cliente_id')
      .eq('empresa_id', eid)
      .eq('etapa', 'fechado_ganho')
      .order('data_fechamento', { ascending: false, nullsFirst: false })
      .limit(100)
    setFechados((data as Fechado[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (!aberto) { setNotas([]); return }
    void (async () => {
      const { data } = await supabase
        .from('crm_atividades')
        .select('id, titulo, descricao, data')
        .eq('oportunidade_id', aberto)
        .eq('tipo', 'outro')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotas((data as Nota[]) ?? [])
    })()
  }, [aberto])

  async function anotar(op: Fechado) {
    if (!novaNota.trim()) return
    setSalvando(true)
    try {
      const { error } = await supabase.from('crm_atividades').insert({
        empresa_id: empresaId,
        oportunidade_id: op.id,
        cliente_id: op.cliente_id,
        tipo: 'outro',
        titulo: `Pós-venda: ${op.titulo}`,
        descricao: novaNota.trim(),
        status: 'realizada',
      })
      if (error) throw error
      setNovaNota('')
      toast.success('Anotação registrada')
      // recarrega notas do aberto
      setAberto(a => a) // trigger não muda — recarrega manualmente:
      const { data } = await supabase.from('crm_atividades').select('id, titulo, descricao, data').eq('oportunidade_id', op.id).eq('tipo', 'outro').order('created_at', { ascending: false }).limit(20)
      setNotas((data as Nota[]) ?? [])
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ maxWidth: 860, paddingBottom: 30 }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
      ) : fechados.length === 0 ? (
        <div className="card-v2" style={{ padding: '34px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-handshake" style={{ fontSize: 26, color: 'var(--acc)', marginBottom: 10, display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Nenhum cliente fechado ainda</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Quando um negócio do Pipeline for ganho, ele aparece aqui pro acompanhamento pós-venda.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fechados.map(f => (
            <div key={f.id} className="card-v2" style={{ padding: '13px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setAberto(aberto === f.id ? null : f.id)}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-handshake" style={{ fontSize: 13, color: 'var(--acc-ink)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{f.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>
                    Fechado {f.data_fechamento ? `em ${new Date(f.data_fechamento + 'T12:00:00').toLocaleDateString('pt-BR')}` : '(sem data)'}{f.valor != null ? ` · ${formatBRL(Number(f.valor))}` : ''}
                  </div>
                </div>
                <i className={`fa-solid fa-chevron-${aberto === f.id ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--mut)' }} />
              </div>

              {aberto === f.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input className="form-input" placeholder="Anotação de pós-venda (onboarding, feedback, NPS…)" value={novaNota} onChange={e => setNovaNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void anotar(f) }} style={{ flex: 1 }} />
                    <button className="btn-v2 primary" disabled={salvando || !novaNota.trim()} onClick={() => void anotar(f)}>{salvando ? '…' : 'Registrar'}</button>
                  </div>
                  {notas.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--mut)' }}>Sem anotações ainda.</div>
                  ) : notas.map(n => (
                    <div key={n.id} style={{ fontSize: 12, color: 'var(--ink)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                      {n.descricao}
                      <span style={{ color: 'var(--mut)', fontWeight: 600 }}> · {new Date(n.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotasRecebidas from '@/components/notas/NotasRecebidas'
import EmitirNFe from '@/components/notas/EmitirNFe'
import EmitirNFSe from '@/components/notas/EmitirNFSe'
import HistoricoNotas from '@/components/notas/HistoricoNotas'

const tabs = [
  { id: 'recebidas' as const, label: 'Recebidas' },
  { id: 'nfe' as const, label: 'Emitir NF-e' },
  { id: 'nfse' as const, label: 'Emitir NFS-e' },
  { id: 'historico' as const, label: 'Histórico' },
]

export default function NotasDashboardPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('recebidas')
  const [nfeAutorizadasMes, setNfeAutorizadasMes] = useState<number | null>(null)
  const [rejeitadasMes, setRejeitadasMes] = useState<number | null>(null)
  const isSandbox = process.env.NODE_ENV === 'development'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const empresaId = usrRow?.empresa_id ?? user.id
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const [ok, rej] = await Promise.all([
        supabase.from('notas_emitidas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('status', 'autorizada').gte('created_at', start),
        supabase.from('notas_emitidas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('status', 'rejeitada').gte('created_at', start),
      ])
      if (cancelled) return
      if (!ok.error) setNfeAutorizadasMes(ok.count ?? 0)
      if (!rej.error) setRejeitadasMes(rej.count ?? 0)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Fiscal & NF-e</div>
          <div className="page-sub">Emissão e histórico · NFe.io{isSandbox ? ' · SANDBOX' : ''}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">NF-e emitidas</div>
          <div className="kpi-val">{nfeAutorizadasMes === null ? '—' : nfeAutorizadasMes}</div>
          <div className="kpi-delta up">✓ autorizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Guias pagas</div>
          <div className="kpi-val" style={{ color: 'var(--gray-400)' }}>—</div>
          <div className="kpi-delta">integrar folha</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Rejeições</div>
          <div className="kpi-val" style={{ color: rejeitadasMes ? 'var(--red)' : 'var(--navy)' }}>{rejeitadasMes === null ? '—' : rejeitadasMes}</div>
          <div className={`kpi-delta ${rejeitadasMes ? 'dn' : 'up'}`}>{rejeitadasMes ? '⚠ verificar' : '✓ sem erros'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">SEFAZ</div>
          <div className="kpi-val" style={{ color: 'var(--green)', fontSize: 16 }}>● Online</div>
          <div className="kpi-delta up">✓ transmitindo</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`btn-action${tab !== t.id ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recebidas' && <NotasRecebidas />}
      {tab === 'nfe' && <EmitirNFe />}
      {tab === 'nfse' && <EmitirNFSe />}
      {tab === 'historico' && <HistoricoNotas />}
    </>
  )
}

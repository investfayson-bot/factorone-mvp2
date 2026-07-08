'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Regra = {
  id: string
  nome: string
  tipo: string
  ativa: boolean
  config: Record<string, unknown>
  ultima_exec: string | null
}

type TipoInfo = {
  label: string
  desc: string
  icon: string
  color: string
  campos: Array<{ key: string; label: string; type: 'number' | 'text'; placeholder: string; default: number | string }>
}

const TIPOS: Record<string, TipoInfo> = {
  conta_vencendo: {
    label: 'Conta a pagar vencendo',
    desc: 'Notifica quando uma conta está prestes a vencer.',
    icon: 'fa-file-invoice-dollar',
    color: 'var(--gold)',
    campos: [{ key: 'dias', label: 'Dias de antecedência', type: 'number', placeholder: '3', default: 3 }],
  },
  saldo_baixo: {
    label: 'Saldo bancário baixo',
    desc: 'Alerta quando o saldo cai abaixo de um limite.',
    icon: 'fa-building-columns',
    color: 'var(--red)',
    campos: [{ key: 'valor_limite', label: 'Limite (R$)', type: 'number', placeholder: '5000', default: 5000 }],
  },
  reembolso_pendente: {
    label: 'Reembolso sem resposta',
    desc: 'Lembra quando um reembolso fica sem análise por muitos dias.',
    icon: 'fa-money-bill-transfer',
    color: 'var(--teal)',
    campos: [{ key: 'dias', label: 'Dias sem resposta', type: 'number', placeholder: '5', default: 5 }],
  },
  oportunidade_sem_followup: {
    label: 'Oportunidade sem follow-up',
    desc: 'Avisa sobre oportunidades no CRM sem atualização.',
    icon: 'fa-handshake',
    color: '#7A6A9E',
    campos: [{ key: 'dias', label: 'Dias sem atualização', type: 'number', placeholder: '7', default: 7 }],
  },
  pneu_desgaste: {
    label: 'Pneu com desgaste alto',
    desc: 'Notifica quando o percentual de desgaste ultrapassa o limite.',
    icon: 'fa-circle-dot',
    color: 'var(--navy)',
    campos: [{ key: 'pct', label: 'Desgaste mínimo (%)', type: 'number', placeholder: '80', default: 80 }],
  },
  meta_atingida: {
    label: 'Meta de receita atingida',
    desc: 'Celebra quando a receita do mês atinge o orçamento.',
    icon: 'fa-trophy',
    color: 'var(--green)',
    campos: [],
  },
}

const DEFAULT_REGRAS: Omit<Regra, 'id' | 'ultima_exec'>[] = [
  { nome: 'Contas vencendo em 3 dias', tipo: 'conta_vencendo', ativa: true, config: { dias: 3 } },
  { nome: 'Saldo abaixo de R$ 5.000', tipo: 'saldo_baixo', ativa: false, config: { valor_limite: 5000 } },
  { nome: 'Reembolso parado há 5 dias', tipo: 'reembolso_pendente', ativa: true, config: { dias: 5 } },
  { nome: 'Oportunidade sem follow-up há 7 dias', tipo: 'oportunidade_sem_followup', ativa: false, config: { dias: 7 } },
  { nome: 'Pneu com desgaste > 80%', tipo: 'pneu_desgaste', ativa: false, config: { pct: 80 } },
]

export default function AutomacoesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [regras, setRegras] = useState<Regra[]>([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [modal, setModal] = useState<{ regra: Regra } | null>(null)
  const [editConfig, setEditConfig] = useState<Record<string, string>>({})
  const [editNome, setEditNome] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', auth.user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || auth.user.id
    setEmpresaId(eid)
    const { data } = await supabase.from('automacoes_regras').select('*').eq('empresa_id', eid).order('created_at')
    if ((data ?? []).length === 0) {
      // seed defaults
      const { data: inserted } = await supabase.from('automacoes_regras').insert(DEFAULT_REGRAS.map(r => ({ ...r, empresa_id: eid }))).select('*')
      setRegras((inserted ?? []) as Regra[])
    } else {
      setRegras((data ?? []) as Regra[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function toggleAtiva(id: string, atual: boolean) {
    await supabase.from('automacoes_regras').update({ ativa: !atual }).eq('id', id)
    setRegras(prev => prev.map(r => r.id === id ? { ...r, ativa: !atual } : r))
  }

  function abrirModal(regra: Regra) {
    setEditNome(regra.nome)
    const cfg: Record<string, string> = {}
    for (const [k, v] of Object.entries(regra.config)) cfg[k] = String(v)
    setEditConfig(cfg)
    setModal({ regra })
  }

  async function salvarConfig() {
    if (!modal) return
    setSaving(true)
    const config: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(editConfig)) config[k] = isNaN(Number(v)) ? v : Number(v)
    await supabase.from('automacoes_regras').update({ nome: editNome, config }).eq('id', modal.regra.id)
    setRegras(prev => prev.map(r => r.id === modal.regra.id ? { ...r, nome: editNome, config } : r))
    toast.success('Automação salva')
    setSaving(false)
    setModal(null)
  }

  async function executarAgora() {
    setRodando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/automacoes/processar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    })
    const json = await res.json() as { processadas?: number; error?: string }
    if (json.error) toast.error(json.error)
    else toast.success(`${json.processadas ?? 0} notificação(ões) gerada(s)`)
    setRodando(false)
    void load()
  }

  const ativas = regras.filter(r => r.ativa).length

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Automações</div>
          <div className="page-sub">{ativas} regra{ativas !== 1 ? 's' : ''} ativa{ativas !== 1 ? 's' : ''} · notificações automáticas por evento</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 14 }} disabled={rodando} onClick={() => void executarAgora()}>
          {rodando
            ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 5 }} />Executando…</>
            : <><i className="fa-solid fa-play" style={{ marginRight: 5 }} />Executar agora</>}
        </button>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Regras ativas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{ativas}</div>
          <div className="kpi-delta up">monitorando</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total de regras</div>
          <div className="kpi-val">{regras.length}</div>
          <div className="kpi-delta">configuradas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Última execução</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>
            {regras.find(r => r.ultima_exec)
              ? new Date(regras.sort((a, b) => (b.ultima_exec ?? '').localeCompare(a.ultima_exec ?? ''))[0].ultima_exec!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </div>
          <div className="kpi-delta">manual ou agendado</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(61,122,110,.04)', border: '1px solid rgba(61,122,110,.15)', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.7 }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--teal)', marginRight: 6 }} />
        As automações geram notificações no sino do topo. Clique em <strong>Executar agora</strong> para rodar manualmente, ou configure uma tarefa cron em <code>/api/automacoes/processar</code> com Authorization header.
      </div>

      {/* Regras */}
      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}><i className="fa-solid fa-spinner fa-spin" /> Carregando…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {regras.map(regra => {
          const info = TIPOS[regra.tipo]
          if (!info) return null
          return (
            <div key={regra.id} style={{ background: '#fff', border: `1px solid ${regra.ativa ? 'rgba(61,122,110,.2)' : 'var(--gray-100)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: regra.ativa ? 'rgba(61,122,110,.08)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${info.icon}`} style={{ color: regra.ativa ? info.color : 'var(--gray-400)', fontSize: 16 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{regra.nome}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
                  {info.desc}
                  {info.campos.map(c => {
                    const v = regra.config[c.key]
                    return v != null ? <span key={c.key} style={{ marginLeft: 8, background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 10 }}>{c.label}: {String(v)}</span> : null
                  })}
                </div>
                {regra.ultima_exec && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Última exec: {new Date(regra.ultima_exec).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => abrirModal(regra)}>
                  <i className="fa-solid fa-gear" style={{ marginRight: 4 }} />Config
                </button>
                <button
                  onClick={() => void toggleAtiva(regra.id, regra.ativa)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                    background: regra.ativa ? 'var(--teal)' : 'var(--gray-200)',
                    transition: 'background .2s',
                  }}
                  title={regra.ativa ? 'Desativar' : 'Ativar'}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: regra.ativa ? 21 : 3, width: 16, height: 16,
                    borderRadius: '50%', background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal config */}
      {modal && (() => {
        const info = TIPOS[modal.regra.tipo]
        return (
          <div className="modal-bg" onClick={() => setModal(null)}>
            <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 className="modal-title">Configurar automação</h3>
                <button className="modal-close" onClick={() => setModal(null)}><i className="fa-solid fa-xmark" /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>Nome da regra</label>
                <input className="form-input" value={editNome} onChange={e => setEditNome(e.target.value)} />
              </div>
              {info.campos.map(c => (
                <div key={c.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>{c.label}</label>
                  <input className="form-input" type={c.type} placeholder={c.placeholder} value={editConfig[c.key] ?? String(c.default)} onChange={e => setEditConfig(prev => ({ ...prev, [c.key]: e.target.value }))} />
                </div>
              ))}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-action" disabled={saving} onClick={() => void salvarConfig()}>{saving ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

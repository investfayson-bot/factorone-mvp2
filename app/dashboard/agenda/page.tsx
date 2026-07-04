'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Cfg = { token: string; titulo: string; duracao: number; hora_inicio: string; hora_fim: string; dias: number[] }
type Reuniao = { id: string; titulo: string; data: string; hora_inicio: string | null; descricao: string | null; status: string }

const DIAS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]] as const

export default function AgendaPage() {
  const [authToken, setAuthToken] = useState('')
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [dbOk, setDbOk] = useState(true)
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [origin, setOrigin] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setAuthToken(tk)
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    try { const r = await fetch('/api/agenda', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.ok && j.config) setCfg(j.config as Cfg); else setDbOk(false) } catch { setDbOk(false) }
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: atv } = await supabase.from('crm_atividades').select('id,titulo,data,hora_inicio,descricao,status').eq('empresa_id', eid).eq('tipo', 'reuniao').gte('data', hoje).order('data', { ascending: true }).order('hora_inicio', { ascending: true }).limit(50)
    setReunioes((atv ?? []) as Reuniao[])
  }, [])
  useEffect(() => { void carregar(); setOrigin(window.location.origin) }, [carregar])

  async function salvar() {
    if (!cfg) return
    setSalvando(true)
    try {
      const r = await fetch('/api/agenda', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(cfg) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha')
      toast.success('Disponibilidade salva')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }
  function toggleDia(n: number) { if (!cfg) return; setCfg({ ...cfg, dias: cfg.dias.includes(n) ? cfg.dias.filter(d => d !== n) : [...cfg.dias, n].sort() }) }

  const link = cfg ? `${origin}/agendar/${cfg.token}` : ''

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Agendamento</div>
          <div className="page-sub">Seu link público (tipo Calendly). Quem marca vira lead + reunião no CRM.</div>
        </div>
      </div>

      {!dbOk && (
        <div className="alert-bar orange" style={{ marginBottom: 16 }}><i className="fa-solid fa-triangle-exclamation" style={{ marginTop: 2 }} /><span>Rode a migração <b>agenda_config</b> (SQL no chat) pra ativar o agendamento.</span></div>
      )}

      {cfg && (
        <>
          {/* Link público */}
          <div className="txs-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}><i className="fa-solid fa-link" style={{ color: 'var(--sage)', marginRight: 8 }} />Seu link de agendamento</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, minWidth: 220, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', overflow: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{link}</code>
              <button className="btn-action" style={{ fontSize: 12 }} onClick={() => { void navigator.clipboard.writeText(link); toast.success('Link copiado') }}><i className="fa-solid fa-copy" style={{ marginRight: 6 }} />Copiar</button>
              <a href={link} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}><i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 6 }} />Abrir</a>
            </div>
          </div>

          {/* Disponibilidade */}
          <div className="txs-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Disponibilidade</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Título da reunião</label><input className="form-input" value={cfg.titulo} onChange={e => setCfg({ ...cfg, titulo: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Duração (min)</label><select className="form-input" value={cfg.duracao} onChange={e => setCfg({ ...cfg, duracao: Number(e.target.value) })}>{[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} min</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="time" value={cfg.hora_inicio} onChange={e => setCfg({ ...cfg, hora_inicio: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Fim</label><input className="form-input" type="time" value={cfg.hora_fim} onChange={e => setCfg({ ...cfg, hora_fim: e.target.value })} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Dias de atendimento</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIAS.map(([lbl, n]) => { const on = cfg.dias.includes(n); return (
                  <button key={n} onClick={() => toggleDia(n)} style={{ padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: on ? 'var(--sage)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-mut)' }}>{lbl}</button>
                ) })}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-action" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar disponibilidade'}</button></div>
          </div>
        </>
      )}

      {/* Próximas reuniões */}
      <div className="txs-card">
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Próximas reuniões</div>
        {reunioes.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>Nenhuma reunião marcada. Compartilhe seu link.</div>
        ) : reunioes.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < reunioes.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sage-deep)' }}>{r.data.slice(8, 10)}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mut)' }}>{r.data.slice(5, 7)}/{r.data.slice(2, 4)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.hora_inicio ?? ''} · {r.descricao ?? ''}</div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gold)', background: 'var(--gold-tint)' }}>{r.status}</span>
          </div>
        ))}
      </div>
    </>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Cfg = { titulo: string; duracao: number; hora_inicio: string; hora_fim: string; dias: number[]; ocupados: string[] }

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function proximosDias(dias: number[]): string[] {
  const out: string[] = []
  for (let i = 0; i < 30 && out.length < 14; i++) {
    const dt = new Date(); dt.setDate(dt.getDate() + i)
    if (dias.includes(dt.getDay())) out.push(dt.toISOString().slice(0, 10))
  }
  return out
}
function horarios(ini: string, fim: string, dur: number): string[] {
  const [h0, m0] = ini.split(':').map(Number); const [h1, m1] = fim.split(':').map(Number)
  let t = h0 * 60 + m0; const end = h1 * 60 + m1; const out: string[] = []
  while (t + dur <= end) { out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`); t += dur }
  return out
}

export default function AgendarPage() {
  const { token } = useParams<{ token: string }>()
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [erro, setErro] = useState('')
  const [dia, setDia] = useState('')
  const [hora, setHora] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', telefone: '' })
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/agenda/${token}`)
        if (!r.ok) { setErro('Link de agendamento inválido.'); return }
        setCfg(await r.json() as Cfg)
      } catch { setErro('Não foi possível carregar. Tente de novo.') }
    })()
  }, [token])

  const dias = useMemo(() => cfg ? proximosDias(cfg.dias) : [], [cfg])
  const slots = useMemo(() => {
    if (!cfg || !dia) return []
    const todos = horarios(cfg.hora_inicio, cfg.hora_fim, cfg.duracao)
    const agora = new Date()
    const hojeStr = agora.toISOString().slice(0, 10)
    return todos.filter(h => {
      if (cfg.ocupados.includes(`${dia} ${h}`)) return false
      if (dia === hojeStr) { const [hh, mm] = h.split(':').map(Number); if (hh * 60 + mm <= agora.getHours() * 60 + agora.getMinutes()) return false }
      return true
    })
  }, [cfg, dia])

  async function agendar() {
    if (!form.nome.trim()) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/agenda/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dia, hora, nome: form.nome, email: form.email, telefone: form.telefone }) })
      const j = await r.json()
      if (!r.ok) { setErro(j.error || 'Falha ao agendar'); setEnviando(false); return }
      setPronto(true)
    } catch { setErro('Falha de conexão.') }
    finally { setEnviando(false) }
  }

  const fmtDia = (d: string) => { const dt = new Date(d + 'T12:00:00'); return { semana: DIAS_SEMANA[dt.getDay()], dia: dt.getDate(), mes: MESES[dt.getMonth()] } }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-sans)', color: 'var(--ink)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 620, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--sidebar-bg, #16352E)', padding: '20px 28px', color: '#fff' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Factor<span style={{ color: '#6EE7B7' }}>One</span></div>
          {cfg && <div style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{cfg.titulo} · {cfg.duracao} min</div>}
        </div>

        <div style={{ padding: '24px 28px' }}>
          {erro && !pronto ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--brick)' }}><i className="fa-solid fa-circle-exclamation" style={{ fontSize: 26, marginBottom: 10, display: 'block' }} />{erro}</div>
          ) : pronto ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 26 }} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Agendado! 🎉</div>
              <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginTop: 8 }}>{fmtDia(dia).semana}, {fmtDia(dia).dia} de {fmtDia(dia).mes} às {hora}. Você vai receber a confirmação.</div>
            </div>
          ) : !cfg ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-mut)' }}><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 22 }} /></div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>1. Escolha o dia</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 18 }}>
                {dias.map(d => { const f = fmtDia(d); const sel = d === dia; return (
                  <button key={d} onClick={() => { setDia(d); setHora('') }} style={{ flexShrink: 0, width: 62, padding: '10px 0', borderRadius: 10, cursor: 'pointer', border: `1px solid ${sel ? 'var(--sage)' : 'var(--line)'}`, background: sel ? 'var(--sage-tint)' : 'var(--surface)', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-mut)', textTransform: 'uppercase' }}>{f.semana}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: sel ? 'var(--sage-deep)' : 'var(--ink)' }}>{f.dia}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}>{f.mes}</div>
                  </button>
                ) })}
              </div>

              {dia && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>2. Escolha o horário</div>
                  {slots.length === 0 ? <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>Sem horários nesse dia. Tente outro.</div> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 8, marginBottom: 18 }}>
                      {slots.map(h => <button key={h} onClick={() => setHora(h)} style={{ padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600, border: `1px solid ${h === hora ? 'var(--sage)' : 'var(--line)'}`, background: h === hora ? 'var(--sage)' : 'var(--surface)', color: h === hora ? '#fff' : 'var(--ink)' }}>{h}</button>)}
                    </div>
                  )}
                </>
              )}

              {dia && hora && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>3. Seus dados</div>
                  <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
                  </div>
                  <button className="btn-action" style={{ width: '100%', padding: '12px 0', fontSize: 14 }} disabled={enviando || !form.nome.trim()} onClick={() => void agendar()}>
                    {enviando ? 'Confirmando…' : `Confirmar ${fmtDia(dia).dia}/${new Date(dia + 'T12:00:00').getMonth() + 1} às ${hora}`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Patrimônio → Distribuição por sócio (modelo do Excel).
 * Cada sócio tem uma cota (%). A base (lucro do período, puxada das transações)
 * é rateada pelas cotas. "Registrar distribuição" lança a saída de cada sócio
 * no Fluxo/DRE (categoria 'Distribuição a sócios').
 */

type Socio = { id: string; nome: string; cota: number }

export default function SociosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [dbOk, setDbOk] = useState(false)
  const [socios, setSocios] = useState<Socio[]>([])
  const [resultado, setResultado] = useState(0)
  const [base, setBase] = useState('')
  const [busy, setBusy] = useState(false)

  const chave = useCallback((eid: string) => `fo_socios_${eid}`, [])
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setToken(tk)
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
      // base = resultado (entrou − saiu) das transações
      try {
        const { data: txs } = await supabase.from('transacoes').select('tipo,valor').eq('empresa_id', eid).limit(1000)
        const rows = (txs ?? []) as { tipo: string; valor: number }[]
        const ent = rows.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
        const sai = rows.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
        const res = ent - sai; setResultado(res); setBase(String(Math.max(0, Math.round(res * 100) / 100)))
      } catch { /* ignore */ }
      // sócios DB-first
      try { const r = await fetch('/api/patrimonio/socios', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.ok) { setDbOk(true); setSocios((j.socios ?? []) as Socio[]); return } } catch { /* fallback */ }
      try { const raw = localStorage.getItem(chave(eid)); if (raw) setSocios(JSON.parse(raw) as Socio[]) } catch { /* ignore */ }
    })()
  }, [chave])

  function persistir(next: Socio[]) {
    setSocios(next)
    if (dbOk) void fetch('/api/patrimonio/socios', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ socios: next }) }).then(r => { if (!r.ok) toast.error('Falha ao salvar no banco') })
    else try { localStorage.setItem(chave(empresaId), JSON.stringify(next)) } catch { /* ignore */ }
  }
  function addSocio() { persistir([...socios, { id: crypto.randomUUID(), nome: '', cota: 0 }]) }
  function setSocio(id: string, campo: 'nome' | 'cota', v: string) { persistir(socios.map(s => s.id === id ? { ...s, [campo]: campo === 'cota' ? Number(v) : v } : s)) }
  function remover(id: string) { persistir(socios.filter(s => s.id !== id)) }
  function dividirIgual() { if (socios.length === 0) return; const c = Math.round((100 / socios.length) * 100) / 100; persistir(socios.map(s => ({ ...s, cota: c }))) }

  const somaCotas = useMemo(() => socios.reduce((s, x) => s + Number(x.cota), 0), [socios])
  const baseNum = Number(base) || 0

  async function registrar() {
    const validos = socios.filter(s => s.nome.trim() && s.cota > 0)
    if (validos.length === 0) { toast.error('Cadastre sócios com cota'); return }
    if (baseNum <= 0) { toast.error('Base a distribuir inválida'); return }
    if (Math.abs(somaCotas - 100) > 0.5) { if (!window.confirm(`As cotas somam ${somaCotas}% (não 100%). Distribuir mesmo assim?`)) return }
    if (!window.confirm(`Registrar a distribuição de ${formatBRL(baseNum)} entre ${validos.length} sócios? Cada repasse entra como saída no Fluxo/DRE.`)) return
    setBusy(true)
    let n = 0
    for (const s of validos) {
      const valor = Math.round(baseNum * (s.cota / 100) * 100) / 100
      try {
        const r = await fetch('/api/transacoes/criar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ descricao: `Distribuição — ${s.nome} (${s.cota}%)`, valor, tipo: 'saida', categoria: 'Distribuição a sócios' }) })
        if (r.ok) n++
      } catch { /* ignore */ }
    }
    setBusy(false); toast.success(`${n} repasses lançados no Fluxo/DRE`)
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Distribuição por sócio</div>
          <div className="page-sub">Rateie o lucro pelas cotas. Cada repasse vira saída no Fluxo de Caixa e na DRE.</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 14 }} onClick={addSocio}><i className="fa-solid fa-user-plus" style={{ marginRight: 6 }} />Novo sócio</button>
      </div>

      {/* Base */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div className="kpi" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Resultado do período (entrou − saiu)</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: resultado >= 0 ? 'var(--sage)' : '#B0413E', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(resultado)}</div>
        </div>
        <div className="kpi" style={{ padding: '14px 16px' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'block' }}>Base a distribuir (R$)</label>
          <input className="form-input" type="number" step="0.01" value={base} onChange={e => setBase(e.target.value)} style={{ fontSize: 18, fontWeight: 700, padding: '6px 10px' }} />
        </div>
      </div>

      {/* Sócios */}
      <div className="txs-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sócios & cotas</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px' }} onClick={dividirIgual}>Dividir igual</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: Math.abs(somaCotas - 100) < 0.5 ? 'var(--sage-deep)' : 'var(--gold)' }}>Σ {somaCotas}%</span>
          </div>
        </div>
        {socios.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Adicione os sócios e suas cotas.</div>
        ) : socios.map((s, i) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 150px 44px', gap: 12, alignItems: 'center', padding: '10px 18px', borderBottom: i < socios.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <input className="form-input" placeholder="Nome do sócio" value={s.nome} onChange={e => setSocio(s.id, 'nome', e.target.value)} style={{ fontSize: 14.5 }} />
            <div style={{ position: 'relative' }}>
              <input className="form-input" type="number" step="0.01" value={s.cota || ''} onChange={e => setSocio(s.id, 'cota', e.target.value)} style={{ fontSize: 14.5, paddingRight: 24 }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--ink-mut)' }}>%</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sage-deep)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(baseNum * (Number(s.cota) / 100))}</div>
            <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 8px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => remover(s.id)}><i className="fa-solid fa-trash-can" /></button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-action" disabled={busy} onClick={() => void registrar()}>
          <i className="fa-solid fa-money-bill-transfer" style={{ marginRight: 8 }} />Registrar distribuição
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--sage)', marginRight: 6 }} />
        A base já vem do seu resultado real (entrou − saiu). Ao registrar, cada repasse entra como saída na DRE (categoria &quot;Distribuição a sócios&quot;).
      </div>
    </>
  )
}

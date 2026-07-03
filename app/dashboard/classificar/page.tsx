'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Classificar — caixa ÚNICA estilo QuickBooks, ligada às transações REAIS.
 * A revisar (categoria vazia) → confirma → grava a categoria → aparece na DRE,
 * no Fluxo de Caixa e no "Top categorias" do dashboard.
 */

type Tx = { id: string; data: string; descricao: string; tipo: 'entrada' | 'saida'; valor: number; categoria: string | null }

const CATEGORIAS = [
  'Alimentação', 'Transporte / Combustível', 'Software / SaaS', 'Marketing',
  'Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Serviços',
  'Receita de vendas', 'Tarifas bancárias', 'Outros',
]

const OUT = '#B0413E'
const IN = '#3D7A6E'

// sugestão simples por palavra-chave (o "AI suggested" do QuickBooks)
function sugerir(desc: string): string {
  const d = desc.toLowerCase()
  if (/ifood|restaurante|comida|lanche/.test(d)) return 'Alimentação'
  if (/posto|shell|combust|uber|99|gasolina/.test(d)) return 'Transporte / Combustível'
  if (/aws|google|software|saas|assinatura|meta ads|facebook ads/.test(d)) return /ads|facebook|meta/.test(d) ? 'Marketing' : 'Software / SaaS'
  if (/ads|marketing|anúncio|anuncio/.test(d)) return 'Marketing'
  if (/fornecedor|ted —|compra/.test(d)) return 'Fornecedores'
  if (/darf|simples|imposto|das|tribut/.test(d)) return 'Impostos'
  if (/salári|salari|folha/.test(d)) return 'Salários'
  if (/aluguel/.test(d)) return 'Aluguel'
  if (/tarifa|pacote mensal/.test(d)) return 'Tarifas bancárias'
  if (/pix recebido|recebimento|cliente/.test(d)) return 'Receita de vendas'
  return 'Outros'
}
function origemBanco(desc: string) { return /pix|ted|tarifa|darf|aluguel|folha|boleto|transfer/i.test(desc) }
function limpo(desc: string) { return desc.replace(/\s*\[demo\]\s*/i, '').trim() }

export default function ClassificarPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [txs, setTxs] = useState<Tx[]>([])
  const [escolhas, setEscolhas] = useState<Record<string, string>>({}) // id -> categoria escolhida (a revisar)
  const [aba, setAba] = useState<'revisar' | 'classificadas' | 'resumo'>('revisar')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showNova, setShowNova] = useState(false)
  const [nova, setNova] = useState({ descricao: '', valor: '', tipo: 'saida' as 'entrada' | 'saida', data: new Date().toISOString().slice(0, 10) })
  const [ocr, setOcr] = useState(false)
  const [fontes, setFontes] = useState<Record<string, 'aprendido' | 'ia'>>({})
  const [sugerindo, setSugerindo] = useState(false)
  const [analise, setAnalise] = useState<string[]>([])
  const [analisando, setAnalisando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token ?? ''
    setToken(tk)
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)
    const { data } = await supabase.from('transacoes').select('id,data,descricao,tipo,valor,categoria').eq('empresa_id', eid).order('data', { ascending: false }).limit(200)
    const rows = (data ?? []) as Tx[]
    setTxs(rows)
    // fallback local imediato (keyword) enquanto a IA responde
    setEscolhas(prev => {
      const next = { ...prev }
      for (const t of rows) if (!t.categoria && !next[t.id]) next[t.id] = sugerir(t.descricao)
      return next
    })
    setLoading(false)
    void aplicarSugestoes(tk) // IA real + aprende do histórico
  }, [])

  // IA real: chama /sugerir (aprende do histórico → cai pra IA no resto)
  async function aplicarSugestoes(tk: string) {
    setSugerindo(true)
    try {
      const rs = await fetch('/api/transacoes/sugerir', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) } })
      const js = await rs.json()
      const sug = (js.sugestoes ?? {}) as Record<string, { categoria: string; fonte: 'aprendido' | 'ia' }>
      if (Object.keys(sug).length) {
        setEscolhas(prev => { const n = { ...prev }; for (const [id, s] of Object.entries(sug)) n[id] = s.categoria; return n })
        setFontes(prev => { const n = { ...prev }; for (const [id, s] of Object.entries(sug)) n[id] = s.fonte; return n })
      }
    } catch { /* mantém o fallback keyword */ }
    finally { setSugerindo(false) }
  }
  useEffect(() => { void carregar() }, [carregar])

  const auth = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token])
  const revisar = useMemo(() => txs.filter(t => !t.categoria || t.categoria.trim() === ''), [txs])
  const classificadas = useMemo(() => txs.filter(t => t.categoria && t.categoria.trim() !== ''), [txs])
  const lista = aba === 'classificadas' ? classificadas : revisar
  const entrou = useMemo(() => txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0), [txs])
  const saiu = useMemo(() => txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0), [txs])
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of txs) if (t.tipo === 'saida' && t.categoria && t.categoria.trim()) m.set(t.categoria, (m.get(t.categoria) || 0) + Number(t.valor))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [txs])

  async function popular(action: 'seed' | 'clear' | 'reset') {
    if (action === 'reset' && !window.confirm('Zerar TUDO? Isso apaga todas as transações e zera os saldos desta conta. Não dá pra desfazer.')) return
    setBusy(true)
    try {
      const r = await fetch('/api/demo/seed', { method: 'POST', headers: auth, body: JSON.stringify({ action }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      toast.success(action === 'reset' ? 'Tudo zerado — começando do zero' : action === 'clear' ? 'Dados de teste removidos' : `${j.inseridas} transações de teste criadas`)
      await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  async function classificar(mapa: Record<string, string>) {
    const ids = Object.keys(mapa)
    if (ids.length === 0) return
    setBusy(true)
    // otimista
    setTxs(prev => prev.map(t => mapa[t.id] ? { ...t, categoria: mapa[t.id] } : t))
    setSel(new Set())
    try {
      const r = await fetch('/api/transacoes/classificar', { method: 'POST', headers: auth, body: JSON.stringify({ categorias: mapa }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha')
      toast.success(ids.length > 1 ? `${ids.length} classificadas` : 'Classificado — já está na DRE')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); await carregar() }
    finally { setBusy(false) }
  }

  async function analisar() {
    setAnalisando(true)
    try {
      const r = await fetch('/api/transacoes/analisar', { method: 'POST', headers: auth })
      const j = await r.json()
      setAnalise(Array.isArray(j.analise) ? j.analise : [])
    } catch { toast.error('Falha na análise') }
    finally { setAnalisando(false) }
  }
  function confirmarUm(t: Tx) { void classificar({ [t.id]: escolhas[t.id] ?? sugerir(t.descricao) }) }
  function confirmarLote() {
    const mapa: Record<string, string> = {}
    for (const id of Array.from(sel)) { const t = txs.find(x => x.id === id); if (t) mapa[id] = escolhas[id] ?? sugerir(t.descricao) }
    void classificar(mapa)
  }
  async function desfazer(t: Tx) {
    setBusy(true)
    setTxs(prev => prev.map(x => x.id === t.id ? { ...x, categoria: '' } : x))
    try { await fetch('/api/transacoes/classificar', { method: 'POST', headers: auth, body: JSON.stringify({ categorias: { [t.id]: '' } }) }) } catch {}
    setEscolhas(p => ({ ...p, [t.id]: sugerir(t.descricao) })); setBusy(false)
  }
  async function ocrRecibo(file: File) {
    setOcr(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/despesas/extrair-comprovante', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao ler o recibo')
      const ex = (j.extracted ?? {}) as { merchant?: string; description?: string; amount?: number | null; issue_date?: string | null }
      setNova(n => ({ ...n, tipo: 'saida', descricao: ex.merchant || ex.description || n.descricao, valor: ex.amount ? String(ex.amount) : n.valor, data: ex.issue_date || n.data }))
      toast.success('Recibo lido — confira os dados e adicione')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro no OCR') }
    finally { setOcr(false) }
  }
  async function salvarNova() {
    if (!nova.descricao.trim() || !nova.valor) { toast.error('Preencha descrição e valor'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/transacoes/criar', { method: 'POST', headers: auth, body: JSON.stringify({ descricao: nova.descricao.trim(), valor: Number(nova.valor), tipo: nova.tipo, data: nova.data }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha')
      toast.success('Transação adicionada — está em “A revisar”')
      setShowNova(false); setNova({ descricao: '', valor: '', tipo: 'saida', data: new Date().toISOString().slice(0, 10) })
      setAba('revisar'); await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }
  function toggleSel(id: string) { setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleTodos() { setSel(sel.size === revisar.length ? new Set() : new Set(revisar.map(t => t.id))) }

  const cols = aba === 'revisar' ? '30px 60px 1fr 120px 230px 110px' : '60px 1fr 120px 210px 90px'

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Classificar</div>
          <div className="page-sub">Banco e cartão numa caixa só. Confirmou → cai na DRE e no dashboard.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 12, color: '#B0413E', borderColor: '#B0413E' }} disabled={busy} onClick={() => void popular('reset')}>
            <i className="fa-solid fa-trash-can" style={{ marginRight: 6 }} />Zerar tudo
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => void popular('seed')}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} />Dados de teste
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={sugerindo} onClick={() => void aplicarSugestoes(token)}>
            <i className={`fa-solid ${sugerindo ? 'fa-circle-notch fa-spin' : 'fa-robot'}`} style={{ marginRight: 6, color: 'var(--sage)' }} />{sugerindo ? 'Analisando…' : 'Sugerir com IA'}
          </button>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setShowNova(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova transação
          </button>
        </div>
      </div>

      {/* Modal — nova transação (manual ou foto do recibo) */}
      {showNova && (
        <div className="modal-bg" onClick={() => setShowNova(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="modal-title">Nova transação</div>
              <button className="modal-close" onClick={() => setShowNova(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 16 }}>Digite manual ou tire foto do recibo — a IA preenche. Entra em “A revisar”.</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', border: '1.5px dashed var(--line)', borderRadius: 10, cursor: 'pointer', marginBottom: 16, background: 'var(--surface-2)' }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void ocrRecibo(f) }} />
              <i className={`fa-solid ${ocr ? 'fa-circle-notch fa-spin' : 'fa-camera'}`} style={{ color: 'var(--sage)', fontSize: 15 }} />
              <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600 }}>{ocr ? 'Lendo recibo…' : 'Tirar foto / enviar recibo (a IA preenche)'}</span>
            </label>
            <div className="form-group"><label className="form-label">Descrição</label>
              <input className="form-input" value={nova.descricao} onChange={e => setNova(n => ({ ...n, descricao: e.target.value }))} placeholder="Ex: Almoço com cliente" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={nova.valor} onChange={e => setNova(n => ({ ...n, valor: e.target.value }))} placeholder="0,00" /></div>
              <div className="form-group"><label className="form-label">Tipo</label>
                <select className="form-input" value={nova.tipo} onChange={e => setNova(n => ({ ...n, tipo: e.target.value as 'entrada' | 'saida' }))}>
                  <option value="saida">Saída (despesa)</option><option value="entrada">Entrada (receita)</option>
                </select></div>
            </div>
            <div className="form-group"><label className="form-label">Data</label>
              <input className="form-input" type="date" value={nova.data} onChange={e => setNova(n => ({ ...n, data: e.target.value }))} /></div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowNova(false)}>Cancelar</button>
              <button className="btn-action" disabled={busy} onClick={() => void salvarNova()}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { lbl: 'A revisar', val: String(revisar.length), cor: OUT, ic: 'fa-inbox' },
          { lbl: 'Classificadas', val: String(classificadas.length), cor: IN, ic: 'fa-circle-check' },
          { lbl: 'Saídas a revisar', val: formatBRL(revisar.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)), cor: 'var(--navy)', ic: 'fa-money-bill-wave' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 12, color: k.cor }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['revisar', `A revisar (${revisar.length})`], ['classificadas', `Classificadas (${classificadas.length})`], ['resumo', 'Resumo']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            fontSize: 12.5, fontWeight: aba === k ? 700 : 500, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${aba === k ? 'var(--sage)' : 'var(--line)'}`,
            background: aba === k ? 'var(--sage-tint)' : 'var(--surface)', color: aba === k ? 'var(--sage-deep)' : 'var(--ink-mut)',
          }}>{label}</button>
        ))}
      </div>

      {aba === 'resumo' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { lbl: 'Entrou', v: entrou, cor: IN, ic: 'fa-arrow-down' },
              { lbl: 'Saiu', v: saiu, cor: OUT, ic: 'fa-arrow-up' },
              { lbl: 'Resultado', v: entrou - saiu, cor: (entrou - saiu) >= 0 ? IN : OUT, ic: 'fa-scale-balanced' },
            ].map(k => (
              <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
                  <i className={`fa-solid ${k.ic}`} style={{ fontSize: 12, color: k.cor }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(k.v)}</div>
              </div>
            ))}
          </div>
          <div className="txs-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Onde você gastou</div>
            {porCategoria.length === 0 ? (
              <div style={{ color: 'var(--ink-mut)', fontSize: 13 }}>Classifique as saídas pra ver o ranking por categoria.</div>
            ) : porCategoria.map(([cat, val]) => {
              const pct = saiu > 0 ? (val / saiu) * 100 : 0
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{cat}</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(val)} <span style={{ color: 'var(--ink-mut)', fontWeight: 500 }}>· {pct.toFixed(0)}%</span></span>
                  </div>
                  <div style={{ height: 8, background: 'var(--paper-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--sage)', borderRadius: 4 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Análise da IA (CFO) */}
          <div className="txs-card" style={{ padding: '18px 20px', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-robot" style={{ color: 'var(--sage)' }} />Análise do CFO IA
              </div>
              <button className="btn-action" style={{ fontSize: 12, padding: '7px 14px' }} disabled={analisando} onClick={() => void analisar()}>
                <i className={`fa-solid ${analisando ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`} style={{ marginRight: 6 }} />{analisando ? 'Analisando…' : 'Analisar'}
              </button>
            </div>
            {analise.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-mut)' }}>Clique em <b>Analisar</b> — a IA lê seus números e diz onde está o dinheiro, o que cortar e o risco.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analise.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.55, color: 'var(--ink)' }}>
                    <i className="fa-solid fa-circle" style={{ fontSize: 5, color: 'var(--sage)', marginTop: 7, flexShrink: 0 }} />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'revisar' && sel.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--sage-tint)', border: '1px solid var(--sage)', borderRadius: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sage-deep)' }}>{sel.size} selecionada{sel.size > 1 ? 's' : ''}</span>
          <button className="btn-action" style={{ fontSize: 12, padding: '7px 16px', marginLeft: 'auto' }} disabled={busy} onClick={confirmarLote}>
            <i className="fa-solid fa-check" style={{ marginRight: 6 }} />Confirmar em lote
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSel(new Set())}>Limpar</button>
        </div>
      )}

      <div className="txs-card" style={{ display: aba === 'resumo' ? 'none' : undefined }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {aba === 'revisar' && <input type="checkbox" checked={sel.size === revisar.length && revisar.length > 0} onChange={toggleTodos} style={{ accentColor: 'var(--sage)' }} />}
          <span>Data</span><span>Descrição</span><span style={{ textAlign: 'right' }}>Valor</span><span>Categoria</span><span />
        </div>

        {loading ? (
          <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>Carregando…</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 26, color: 'var(--sage)', display: 'block', marginBottom: 10 }} />
            {aba === 'revisar'
              ? (txs.length === 0 ? 'Sem transações. Clique em "Popular dados de teste" pra ver o fluxo.' : 'Tudo classificado! 🎉')
              : 'Nada classificado ainda.'}
          </div>
        ) : lista.map((t, i) => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '12px 18px', borderBottom: i < lista.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'center' }}>
            {aba === 'revisar' && <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} style={{ accentColor: 'var(--sage)' }} />}
            <span style={{ fontSize: 12, color: 'var(--ink-mut)', fontVariantNumeric: 'tabular-nums' }}>{t.data.slice(8, 10)}/{t.data.slice(5, 7)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{limpo(t.descricao)}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 600, marginTop: 3, color: origemBanco(t.descricao) ? 'var(--sage-deep)' : '#7A6A9E', background: origemBanco(t.descricao) ? 'var(--sage-tint)' : '#ECE7F2', padding: '2px 7px', borderRadius: 20 }}>
                <i className={`fa-solid ${origemBanco(t.descricao) ? 'fa-building-columns' : 'fa-credit-card'}`} style={{ fontSize: 9 }} />
                {origemBanco(t.descricao) ? 'Banco' : 'Cartão'}
              </span>
            </div>
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.tipo === 'entrada' ? IN : OUT, fontVariantNumeric: 'tabular-nums' }}>
              {t.tipo === 'entrada' ? '+' : '−'}{formatBRL(Number(t.valor))}
            </span>
            {aba === 'revisar' ? (
              <div>
                <select className="form-input" value={escolhas[t.id] ?? sugerir(t.descricao)} onChange={e => setEscolhas(p => ({ ...p, [t.id]: e.target.value }))} style={{ fontSize: 12, padding: '7px 10px' }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {fontes[t.id] && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, marginTop: 4, color: fontes[t.id] === 'aprendido' ? '#B08A3E' : 'var(--sage)' }}>
                    <i className={`fa-solid ${fontes[t.id] === 'aprendido' ? 'fa-graduation-cap' : 'fa-robot'}`} style={{ fontSize: 8 }} />
                    {fontes[t.id] === 'aprendido' ? 'aprendido do seu histórico' : 'sugerido por IA'}
                  </span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sage-deep)', background: 'var(--sage-tint)', padding: '5px 10px', borderRadius: 8, justifySelf: 'start' }}>
                <i className="fa-solid fa-tag" style={{ marginRight: 6, fontSize: 10 }} />{t.categoria}
              </span>
            )}
            {aba === 'revisar' ? (
              <button className="btn-action" style={{ fontSize: 12, padding: '7px 0' }} disabled={busy} onClick={() => confirmarUm(t)}>
                <i className="fa-solid fa-check" style={{ marginRight: 5 }} />Confirmar
              </button>
            ) : (
              <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} disabled={busy} onClick={() => void desfazer(t)}>Desfazer</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.6 }}>
        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--sage)', marginRight: 6 }} />
        A categoria já vem sugerida. Ao confirmar, a transação entra na <b>DRE</b> (Relatórios) e no <b>Top categorias</b> do dashboard. Use "Popular dados de teste" pra ver tudo vivo.
      </div>
    </>
  )
}

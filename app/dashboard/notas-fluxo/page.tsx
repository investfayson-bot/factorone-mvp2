'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Anotacao = { id: string; titulo: string | null; conteudo: string; cor: string; updated_at: string }
type Node = { id: string; x: number; y: number; texto: string; cor: string }
type Edge = { from: string; to: string }
type Dados = { nodes: Node[]; edges: Edge[] }
type Fluxograma = { id: string; nome: string; dados: Dados }

const CORES_NOTA = ['#F5EFD8', '#E9F0ED', '#F4E4E1', '#E4E8F4']
const CORES_NODE = ['var(--surface)', 'var(--sage-tint)', 'var(--gold-tint)', 'var(--brick-tint)']

const FLUXO_EXEMPLO: Dados = {
  nodes: [
    { id: 'n1', x: 40, y: 20, texto: 'Lead entra (IG/Site)', cor: 'var(--surface)' },
    { id: 'n2', x: 40, y: 130, texto: 'Qualifica + score', cor: 'var(--surface)' },
    { id: 'n3', x: 40, y: 240, texto: 'Quente? → agenda demo', cor: 'var(--gold-tint)' },
    { id: 'n4', x: 40, y: 350, texto: 'Proposta enviada', cor: 'var(--surface)' },
    { id: 'n5', x: 40, y: 460, texto: 'Fechado → onboarding', cor: 'var(--sage-tint)' },
  ],
  edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' }, { from: 'n4', to: 'n5' }],
}

export default function NotasFluxoPage() {
  const [token, setToken] = useState('')
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [notaAtiva, setNotaAtiva] = useState<Anotacao | null>(null)
  const [fluxo, setFluxo] = useState<Fluxograma | null>(null)
  const [loading, setLoading] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [origemConexao, setOrigemConexao] = useState<string | null>(null)
  const [noAtivo, setNoAtivo] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: string; offX: number; offY: number } | null>(null)

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      const a = tk ? { Authorization: `Bearer ${tk}` } : {}
      const [rn, rf] = await Promise.all([
        fetch('/api/anotacoes', { headers: a }),
        fetch('/api/fluxogramas', { headers: a }),
      ])
      const [jn, jf] = await Promise.all([rn.json(), rf.json()])
      if (rn.ok) setAnotacoes(jn.anotacoes ?? [])
      if (rf.ok) {
        let lista: Fluxograma[] = jf.fluxogramas ?? []
        if (lista.length === 0) {
          const rc = await fetch('/api/fluxogramas', { method: 'POST', headers: { 'Content-Type': 'application/json', ...a }, body: JSON.stringify({ nome: 'Fluxo', dados: FLUXO_EXEMPLO }) })
          const jc = await rc.json()
          if (rc.ok) lista = [jc.fluxograma]
        }
        setFluxo(lista[0] ?? null)
      }
      setLoading(false)
    })()
  }, [])

  async function salvarFluxo(dados: Dados) {
    if (!fluxo) return
    setFluxo({ ...fluxo, dados })
    try {
      await fetch(`/api/fluxogramas/${fluxo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ dados }) })
    } catch { /* autosave silencioso */ }
  }

  function addNode(x: number, y: number) {
    if (!fluxo) return
    const id = `n${Date.now()}`
    const novo: Node = { id, x, y, texto: 'Nova etapa', cor: CORES_NODE[0] }
    void salvarFluxo({ ...fluxo.dados, nodes: [...fluxo.dados.nodes, novo] })
    setNoAtivo(id)
  }

  function editarNode(id: string, patch: Partial<Node>) {
    if (!fluxo) return
    void salvarFluxo({ ...fluxo.dados, nodes: fluxo.dados.nodes.map(n => n.id === id ? { ...n, ...patch } : n) })
  }

  function excluirNode(id: string) {
    if (!fluxo) return
    void salvarFluxo({ nodes: fluxo.dados.nodes.filter(n => n.id !== id), edges: fluxo.dados.edges.filter(e => e.from !== id && e.to !== id) })
    setNoAtivo(null)
  }

  function onNodeMouseDown(e: React.MouseEvent, node: Node) {
    if (conectando) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { id: node.id, offX: e.clientX - rect.left - node.x, offY: e.clientY - rect.top - node.y }
  }

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current || !fluxo) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, e.clientX - rect.left - dragState.current.offX)
    const y = Math.max(0, e.clientY - rect.top - dragState.current.offY)
    const id = dragState.current.id
    setFluxo(f => f ? { ...f, dados: { ...f.dados, nodes: f.dados.nodes.map(n => n.id === id ? { ...n, x, y } : n) } } : f)
  }, [fluxo])

  function onCanvasMouseUp() {
    if (dragState.current && fluxo) void salvarFluxo(fluxo.dados)
    dragState.current = null
  }

  function clicarNode(id: string) {
    if (conectando) {
      if (!origemConexao) { setOrigemConexao(id); return }
      if (origemConexao !== id && fluxo) {
        const existe = fluxo.dados.edges.some(e => e.from === origemConexao && e.to === id)
        if (!existe) void salvarFluxo({ ...fluxo.dados, edges: [...fluxo.dados.edges, { from: origemConexao, to: id }] })
      }
      setOrigemConexao(null)
      return
    }
    setNoAtivo(id)
  }

  async function novaNota() {
    try {
      const r = await fetch('/api/anotacoes', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ titulo: 'Nova nota', conteudo: '', cor: CORES_NOTA[anotacoes.length % CORES_NOTA.length] }) })
      const j = await r.json()
      if (!r.ok) throw new Error()
      setAnotacoes(prev => [j.anotacao, ...prev])
      setNotaAtiva(j.anotacao)
    } catch { toast.error('Não consegui criar a nota') }
  }

  async function salvarNota(id: string, patch: Partial<Anotacao>) {
    setAnotacoes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
    if (notaAtiva?.id === id) setNotaAtiva(prev => prev ? { ...prev, ...patch } : prev)
    try { await fetch(`/api/anotacoes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(patch) }) } catch { /* ignore */ }
  }

  async function excluirNota(id: string) {
    if (!window.confirm('Excluir esta nota?')) return
    setAnotacoes(prev => prev.filter(n => n.id !== id))
    if (notaAtiva?.id === id) setNotaAtiva(null)
    try { await fetch(`/api/anotacoes/${id}`, { method: 'DELETE', headers: auth }) } catch { /* ignore */ }
  }

  const nodeById = (id: string) => fluxo?.dados.nodes.find(n => n.id === id)
  const NODE_W = 190, NODE_H = 50

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Notas + Fluxograma</div>
          <div className="page-sub">Bloco de notas ao lado de um canvas visual — arraste as etapas, conecte com setas.</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Bloco de notas */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Bloco de notas</div>
              <button className="btn-ghost" style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => void novaNota()}><i className="fa-solid fa-plus" style={{ marginRight: 4 }} />Nota</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto' }}>
              {anotacoes.length === 0 && <div style={{ fontSize: 14, color: 'var(--ink-faint)', padding: '20px 4px' }}>Nenhuma nota ainda.</div>}
              {anotacoes.map(n => (
                <div key={n.id} style={{ background: n.cor, border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }} onClick={() => setNotaAtiva(n)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{n.titulo || 'Sem título'}</div>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px', border: 'none' }} onClick={e => { e.stopPropagation(); void excluirNota(n.id) }}><i className="fa-solid fa-xmark" /></button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{n.conteudo}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fluxograma canvas */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fluxograma (canvas)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`btn-action${!conectando ? ' btn-ghost' : ''}`} style={{ fontSize: 12.5, padding: '4px 10px' }} onClick={() => { setConectando(c => !c); setOrigemConexao(null) }}>
                  <i className="fa-solid fa-arrow-right-long" style={{ marginRight: 4 }} />{conectando ? (origemConexao ? 'Clique no destino' : 'Clique na origem') : 'Conectar etapas'}
                </button>
              </div>
            </div>
            <div
              ref={canvasRef}
              onDoubleClick={e => { const rect = canvasRef.current?.getBoundingClientRect(); if (rect) addNode(e.clientX - rect.left - NODE_W / 2, e.clientY - rect.top - NODE_H / 2) }}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
              style={{ position: 'relative', height: 620, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', cursor: conectando ? 'crosshair' : 'default' }}
            >
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <defs>
                  <marker id="seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mut)" />
                  </marker>
                </defs>
                {fluxo?.dados.edges.map((e, i) => {
                  const a = nodeById(e.from), b = nodeById(e.to)
                  if (!a || !b) return null
                  const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-mut)" strokeWidth={1.5} markerEnd="url(#seta)" />
                })}
              </svg>
              {fluxo?.dados.nodes.map(n => (
                <div key={n.id}
                  onMouseDown={e => onNodeMouseDown(e, n)}
                  onClick={() => clicarNode(n.id)}
                  style={{
                    position: 'absolute', left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H,
                    background: n.cor, border: `1.5px solid ${origemConexao === n.id ? 'var(--sage)' : noAtivo === n.id ? 'var(--gold)' : 'var(--line)'}`,
                    borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                    fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: conectando ? 'pointer' : 'grab', boxShadow: 'var(--shadow-soft)', userSelect: 'none',
                  }}>
                  {n.texto}
                </div>
              ))}
              {(!fluxo || fluxo.dados.nodes.length === 0) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Dê dois cliques no canvas pra criar a primeira etapa.</div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>Dois cliques no fundo cria uma etapa · arraste pra reposicionar · &quot;Conectar etapas&quot; liga duas caixas com uma seta.</div>
          </div>
        </div>
      )}

      {/* Editor de nota */}
      {notaAtiva && (
        <div className="modal-bg" onClick={() => setNotaAtiva(null)}>
          <div className="modal-box" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <input className="form-input" style={{ fontWeight: 700, border: 'none', padding: 0, fontSize: 15 }} value={notaAtiva.titulo ?? ''} placeholder="Título" onChange={e => void salvarNota(notaAtiva.id, { titulo: e.target.value })} />
              <button className="modal-close" onClick={() => setNotaAtiva(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <textarea className="form-input" style={{ minHeight: 220, resize: 'vertical', fontFamily: 'var(--font-sans)' }} value={notaAtiva.conteudo} placeholder="Escreva aqui…" onChange={e => void salvarNota(notaAtiva.id, { conteudo: e.target.value })} />
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {CORES_NOTA.map(c => (
                <button key={c} onClick={() => void salvarNota(notaAtiva.id, { cor: c })} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: notaAtiva.cor === c ? '2px solid var(--ink)' : '1px solid var(--line)', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor de nó */}
      {noAtivo && fluxo && !conectando && (() => {
        const n = nodeById(noAtivo)
        if (!n) return null
        return (
          <div className="modal-bg" onClick={() => setNoAtivo(null)}>
            <div className="modal-box" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="modal-title" style={{ fontSize: 15 }}>Editar etapa</div>
                <button className="modal-close" onClick={() => setNoAtivo(null)}><i className="fa-solid fa-xmark" /></button>
              </div>
              <div className="form-group"><input className="form-input" value={n.texto} onChange={e => editarNode(n.id, { texto: e.target.value })} autoFocus /></div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {CORES_NODE.map(c => (
                  <button key={c} onClick={() => editarNode(n.id, { cor: c })} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: n.cor === c ? '2px solid var(--ink)' : '1px solid var(--line)', cursor: 'pointer' }} />
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn-ghost" style={{ color: '#B0413E', borderColor: '#B0413E' }} onClick={() => excluirNode(n.id)}>Excluir etapa</button>
                <button className="btn-action" onClick={() => setNoAtivo(null)}>Fechar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

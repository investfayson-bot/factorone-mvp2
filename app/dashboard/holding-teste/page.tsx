'use client'

// Tela de validação da Fase 0 (Holding + motor de classificação) — NÃO é a
// UI final. O seletor de verdade no topbar entra na Fase 1. Serve só pra
// confirmar que criar grupo, adicionar membro e ler o resumo consolidado
// funcionam de ponta a ponta antes de construir a tela bonita em cima disso.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Grupo = { id: string; nome: string; membros: number }
type Resumo = {
  caixa_consolidado: number; receita_mes: number; despesas_mes: number; lucro_liquido_mes: number
  receita_por_membro: { empresa_id: string; nome: string; receita: number }[]
  empresas_incluidas: number; pf_incluida: boolean
}

export default function HoldingTestePage() {
  const [token, setToken] = useState('')
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoAtivo, setGrupoAtivo] = useState<string>('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [escopo, setEscopo] = useState<'consolidado' | 'empresas' | 'pf'>('consolidado')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      setToken(sess.session?.access_token ?? '')
    })()
  }, [])

  async function carregarGrupos(tk: string) {
    const r = await fetch('/api/grupos', { headers: { Authorization: `Bearer ${tk}` } })
    const j = await r.json()
    if (r.ok) setGrupos(j.grupos ?? [])
  }

  useEffect(() => { if (token) void carregarGrupos(token) }, [token])

  async function criarGrupo() {
    if (!nomeNovo.trim()) return
    const r = await fetch('/api/grupos', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome: nomeNovo, incluir_empresa_ativa: true, incluir_pf: true }),
    })
    const j = await r.json()
    if (r.ok) { toast.success('Grupo criado'); setNomeNovo(''); void carregarGrupos(token); setGrupoAtivo(j.grupo.id) }
    else toast.error(j.error)
  }

  async function carregarResumo(gid: string, esc: typeof escopo) {
    if (!gid) return
    setLoading(true)
    try {
      const r = await fetch(`/api/grupos/${gid}/resumo?escopo=${esc}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json()
      if (r.ok) setResumo(j)
      else toast.error(j.error)
    } finally { setLoading(false) }
  }

  useEffect(() => { if (grupoAtivo) void carregarResumo(grupoAtivo, escopo) }, [grupoAtivo, escopo])

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 0' }}>
      <div className="page-hdr"><div><div className="page-title">Teste — Holding (Fase 0)</div><div className="page-sub">Tela de validação, não é UI final</div></div></div>

      <div className="txs-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Criar grupo</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Nome do grupo (ex: Grupo Santos)" value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} />
          <button className="btn-action" onClick={() => void criarGrupo()}>Criar</button>
        </div>
      </div>

      <div className="txs-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Meus grupos ({grupos.length})</div>
        {grupos.length === 0 ? <div style={{ color: 'var(--ink-mut)' }}>Nenhum ainda.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grupos.map(g => (
              <button key={g.id} onClick={() => setGrupoAtivo(g.id)} style={{
                textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer',
                background: grupoAtivo === g.id ? 'var(--sage-tint)' : '#fff',
              }}>{g.nome} — {g.membros} membro(s)</button>
            ))}
          </div>
        )}
      </div>

      {grupoAtivo && (
        <div className="txs-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['consolidado', 'empresas', 'pf'] as const).map(e => (
              <button key={e} onClick={() => setEscopo(e)} className={`btn-action${escopo !== e ? ' btn-ghost' : ''}`} style={{ fontSize: 13 }}>
                {e === 'consolidado' ? 'Consolidado (PJ+PF)' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
              </button>
            ))}
          </div>
          {loading ? <div>Carregando…</div> : resumo && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>Caixa consolidado</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(resumo.caixa_consolidado)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>Receita (mês)</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(resumo.receita_mes)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>Lucro líquido (mês)</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(resumo.lucro_liquido_mes)}</div></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 8 }}>{resumo.empresas_incluidas} empresa(s) · PF {resumo.pf_incluida ? 'incluída' : 'fora'}</div>
              {resumo.receita_por_membro.map(m => (
                <div key={m.empresa_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span>{m.nome}</span><span>{fmt(m.receita)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

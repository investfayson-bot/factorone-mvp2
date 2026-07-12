'use client'

// Propostas (Fase 6) — reskin sobre a tabela `propostas` já existente
// (mesma da tela antiga /dashboard/propostas, que continua servindo o CRUD
// completo). Aqui: lista no padrão v2 + criação rápida.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Proposta = { id: string; cliente: string | null; titulo: string | null; valor: number | null; status: string | null; validade: string | null; created_at: string }

const STATUS_UI: Record<string, { label: string; classe: string }> = {
  rascunho: { label: 'Rascunho', classe: '' },
  enviada: { label: 'Enviada', classe: 'y' },
  aceita: { label: 'Aceita', classe: 'g' },
  recusada: { label: 'Recusada', classe: 'r' },
}

export default function PropostasV2Page() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ cliente: '', titulo: '', valor: '' })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('propostas')
      .select('id, cliente, titulo, valor, status, validade, created_at')
      .eq('empresa_id', eid)
      .order('created_at', { ascending: false })
      .limit(100)
    setPropostas((data as Proposta[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function criar() {
    if (!form.cliente.trim()) { toast.error('Informe o cliente'); return }
    setSalvando(true)
    try {
      const { error } = await supabase.from('propostas').insert({
        empresa_id: empresaId,
        cliente: form.cliente.trim(),
        titulo: form.titulo.trim() || null,
        valor: form.valor ? Number(form.valor) : null,
        status: 'rascunho',
      })
      if (error) throw error
      toast.success('Proposta criada como rascunho')
      setModal(false); setForm({ cliente: '', titulo: '', valor: '' })
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ maxWidth: 940, paddingBottom: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Link href="/dashboard/propostas" className="btn-v2" style={{ textDecoration: 'none' }}>CRUD completo</Link>
        <button className="btn-v2 primary" onClick={() => setModal(true)}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova proposta</button>
      </div>

      <div className="card-v2" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : propostas.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
            Nenhuma proposta ainda. Crie a partir de um negócio do Pipeline ou pelo botão acima.
          </div>
        ) : propostas.map(p => {
          const st = STATUS_UI[p.status ?? 'rascunho'] ?? STATUS_UI.rascunho
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-file-signature" style={{ fontSize: 13, color: 'var(--acc-ink)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.cliente || '—'}{p.titulo ? <span style={{ fontWeight: 500, color: 'var(--mut)' }}> — {p.titulo}</span> : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>
                  Enviada {new Date(p.created_at).toLocaleDateString('pt-BR')}{p.validade ? ` · válida até ${new Date(p.validade + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              {p.valor != null && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(Number(p.valor))}</span>}
              <span className={`chip-v2 ${st.classe}`}>{st.label}</span>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, width: '100%', maxWidth: 440 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 16 }}>Nova proposta</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="form-input" placeholder="Cliente *" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
              <input className="form-input" placeholder="Título (ex: Implantação FactorOne)" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              <input className="form-input" type="number" placeholder="Valor (R$)" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-v2" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-v2 primary" onClick={() => void criar()} disabled={salvando || !form.cliente.trim()}>{salvando ? 'Criando…' : 'Criar rascunho'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

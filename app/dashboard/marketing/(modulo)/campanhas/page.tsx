'use client'

// Campanhas (Fase 7) — tabela completa com pausar/retomar direto (as
// integrações de API externas não existem, então o status é interno).

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Campanha = { id: string; nome: string; tipo: string; status: string; orcamento: number | null; gasto: number | null; conversoes: number; receita_gerada: number | null }

const TIPO_LABEL: Record<string, string> = { meta_ads: 'Meta Ads', google_ads: 'Google Ads', email: 'E-mail', seo: 'SEO', social: 'Social', outro: 'Outro' }

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'meta_ads', orcamento: '' })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('marketing_campanhas')
      .select('id, nome, tipo, status, orcamento, gasto, conversoes, receita_gerada')
      .eq('empresa_id', eid)
      .order('created_at', { ascending: false })
    setCampanhas((data as Campanha[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function alternarStatus(c: Campanha) {
    const novo = c.status === 'ativa' ? 'pausada' : 'ativa'
    setCampanhas(prev => prev.map(x => x.id === c.id ? { ...x, status: novo } : x))
    const { error } = await supabase.from('marketing_campanhas').update({ status: novo }).eq('id', c.id)
    if (error) { toast.error(error.message); void carregar() }
  }

  async function criar() {
    if (!form.nome.trim()) { toast.error('Dê um nome'); return }
    setSalvando(true)
    try {
      const { error } = await supabase.from('marketing_campanhas').insert({
        empresa_id: empresaId, nome: form.nome.trim(), tipo: form.tipo,
        orcamento: form.orcamento ? Number(form.orcamento) : null, status: 'ativa',
      })
      if (error) throw error
      toast.success('Campanha criada')
      setModal(false); setForm({ nome: '', tipo: 'meta_ads', orcamento: '' })
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-v2 primary" onClick={() => setModal(true)}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova campanha</button>
      </div>

      <div className="card-v2" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.7fr 0.7fr 1fr 1fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 10.5, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          <span>Nome</span><span>Canal</span><span style={{ textAlign: 'right' }}>Investido</span><span style={{ textAlign: 'right' }}>Orçamento</span><span style={{ textAlign: 'right' }}>Conv.</span><span style={{ textAlign: 'right' }}>ROAS</span><span>Status</span><span style={{ textAlign: 'right' }}>Ações</span>
        </div>
        {loading ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : campanhas.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Nenhuma campanha ainda.</div>
        ) : campanhas.map(c => {
          const roas = Number(c.gasto ?? 0) > 0 ? Number(c.receita_gerada ?? 0) / Number(c.gasto ?? 1) : null
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.7fr 0.7fr 1fr 1fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              <span style={{ color: 'var(--mut)', fontWeight: 600 }}>{TIPO_LABEL[c.tipo] ?? c.tipo}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(Number(c.gasto ?? 0))}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--mut)' }}>{c.orcamento != null ? formatBRL(Number(c.orcamento)) : '—'}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.conversoes}</span>
              <span style={{ textAlign: 'right', fontWeight: 800, color: roas != null && roas >= 1 ? 'var(--acc-ink)' : 'var(--mut)' }}>{roas != null ? `${roas.toFixed(1)}x` : '—'}</span>
              <span><span className={`chip-v2 ${c.status === 'ativa' ? 'g' : c.status === 'pausada' ? 'y' : ''}`}>{c.status}</span></span>
              <span style={{ textAlign: 'right' }}>
                {['ativa', 'pausada'].includes(c.status) && (
                  <button className="btn-v2" style={{ fontSize: 11, padding: '4px 9px' }} onClick={() => void alternarStatus(c)}>
                    {c.status === 'ativa' ? 'Pausar' : 'Retomar'}
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 16 }}>Nova campanha</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Nome *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input className="form-input" type="number" placeholder="Orçamento (R$)" value={form.orcamento} onChange={e => setForm(f => ({ ...f, orcamento: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-v2" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-v2 primary" disabled={salvando} onClick={() => void criar()}>{salvando ? '…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

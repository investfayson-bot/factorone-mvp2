'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Investimento = {
  id: string; status: 'ativo' | 'vencido' | 'resgatado'; nome: string; tipo: string
  valor_aplicado: number | string; valor_atual: number | string; rendimento_total: number | string
  data_aplicacao?: string | null; data_vencimento?: string | null
}

const TIPOS = ['CDB', 'LCI', 'LCA', 'Tesouro Direto', 'CDI', 'Fundos', 'Ações', 'Outros']
const EMPTY = { nome: '', tipo: 'CDB', valor_aplicado: '', valor_atual: '', data_aplicacao: new Date().toISOString().slice(0, 10), data_vencimento: '' }

export default function InvestimentosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [rows, setRows] = useState<Investimento[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data } = await supabase.from('investimentos').select('*').eq('empresa_id', eid).order('created_at', { ascending: false })
    setRows((data ?? []) as Investimento[])
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const ativos = rows.filter(r => r.status === 'ativo')
  const resgatados = rows.filter(r => r.status === 'resgatado')
  const totalAplicado = useMemo(() => ativos.reduce((s, r) => s + Number(r.valor_aplicado || 0), 0), [ativos])
  const totalAtual = useMemo(() => ativos.reduce((s, r) => s + Number(r.valor_atual || 0), 0), [ativos])
  const rendimento = totalAtual - totalAplicado
  const rentPct = totalAplicado > 0 ? (rendimento / totalAplicado) * 100 : 0

  async function resgatar(id: string) {
    const { error } = await supabase.from('investimentos').update({ status: 'resgatado' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Investimento resgatado'); void carregar()
  }

  async function salvar() {
    if (!form.nome || !form.valor_aplicado) { toast.error('Informe nome e valor'); return }
    setSaving(true)
    const aplicado = Number(form.valor_aplicado)
    const { error } = await supabase.from('investimentos').insert({
      empresa_id: empresaId, nome: form.nome, tipo: form.tipo.toLowerCase().replace(' ', '_'),
      valor_aplicado: aplicado, valor_atual: Number(form.valor_atual) || aplicado,
      data_aplicacao: form.data_aplicacao, data_vencimento: form.data_vencimento || null, status: 'ativo',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Investimento adicionado'); setModal(false); setForm(EMPTY); void carregar()
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Investimentos</div>
          <div className="page-sub">Carteira da empresa · aplicado, rendimento e vencimentos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/conta-pj" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Banco
          </Link>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setModal(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo investimento
          </button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #13201D' }}>
          <div className="kpi-lbl">Total aplicado</div>
          <div className="kpi-val">{formatBRL(totalAplicado)}</div>
          <div className="kpi-delta">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">Valor atual</div>
          <div className="kpi-val">{formatBRL(totalAtual)}</div>
          <div className="kpi-delta up">posição hoje</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">Rendimento</div>
          <div className="kpi-val" style={{ color: rendimento >= 0 ? '#3D7A6E' : '#B0413E' }}>{formatBRL(rendimento)}</div>
          <div className={`kpi-delta ${rendimento >= 0 ? 'up' : 'dn'}`}>{rentPct >= 0 ? '+' : ''}{rentPct.toFixed(1)}%</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
          <div className="kpi-lbl">Resgatados</div>
          <div className="kpi-val">{resgatados.length}</div>
          <div className="kpi-delta">no histórico</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', fontSize: 12, fontWeight: 700, color: '#13201D' }}>Carteira ativa</div>
        {ativos.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 12 }}>
            <i className="fa-solid fa-chart-line" style={{ fontSize: 26, color: '#D1D9D8', display: 'block', marginBottom: 10 }} />
            Nenhum investimento ativo. Clique em <strong>Novo investimento</strong>.
          </div>
        ) : ativos.map((r, i) => {
          const rend = Number(r.valor_atual || 0) - Number(r.valor_aplicado || 0)
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < ativos.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-seedling" style={{ fontSize: 14, color: '#3D7A6E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#13201D' }}>{r.nome}</div>
                <div style={{ fontSize: 10.5, color: '#7B8C88', textTransform: 'uppercase' }}>{r.tipo}{r.data_vencimento ? ` · venc. ${r.data_vencimento}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(r.valor_atual || 0))}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: rend >= 0 ? '#3D7A6E' : '#B0413E' }}>{rend >= 0 ? '+' : ''}{formatBRL(rend)}</div>
              </div>
              <button onClick={() => void resgatar(r.id)} style={{ fontSize: 11, color: '#3C4A46', background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 7, padding: '5px 11px', cursor: 'pointer', fontWeight: 600 }}>Resgatar</button>
            </div>
          )
        })}
      </div>

      {resgatados.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', fontSize: 12, fontWeight: 700, color: '#13201D' }}>Histórico de resgates</div>
          {resgatados.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < resgatados.length - 1 ? '0.5px solid #EFE9DC' : 'none', fontSize: 12 }}>
              <span style={{ color: '#3C4A46' }}>{r.nome} · <span style={{ textTransform: 'uppercase', color: '#7B8C88' }}>{r.tipo}</span></span>
              <span style={{ fontWeight: 700, color: '#13201D' }}>{formatBRL(Number(r.valor_atual || 0))}</span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div><h3 className="modal-title">Novo investimento</h3><div style={{ fontSize: 11, color: '#7B8C88' }}>Adicione uma aplicação à carteira</div></div>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Nome *</label>
                <input className="form-input" placeholder="Ex: CDB Banco XP 110% CDI" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Valor aplicado (R$) *</label>
                  <input className="form-input" type="number" placeholder="0,00" value={form.valor_aplicado} onChange={e => setForm(p => ({ ...p, valor_aplicado: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Valor atual (R$)</label>
                  <input className="form-input" type="number" placeholder="= aplicado" value={form.valor_atual} onChange={e => setForm(p => ({ ...p, valor_atual: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Vencimento</label>
                  <input className="form-input" type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvar()} disabled={saving} style={{ fontSize: 12, padding: '8px 20px' }}>{saving ? 'Salvando…' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

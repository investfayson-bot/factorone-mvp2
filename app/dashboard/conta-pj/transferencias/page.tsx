'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Transferencia = {
  id: string; destinatario_nome: string; tipo: string; data_agendada: string
  valor: number | string; status: string; chave_pix: string | null; descricao: string | null
}

const TIPOS = [
  { v: 'pix', label: 'PIX', icon: 'fa-bolt', desc: 'Instantâneo, 24h' },
  { v: 'ted', label: 'TED', icon: 'fa-building-columns', desc: 'Mesmo dia útil' },
  { v: 'doc', label: 'DOC', icon: 'fa-money-check', desc: 'Próximo dia útil' },
]

const EMPTY = { tipo: 'pix', destinatario_nome: '', chave_pix: '', destinatario_banco: '', destinatario_agencia: '', destinatario_conta: '', valor: '', data_agendada: new Date().toISOString().slice(0, 10), descricao: '' }

const statusCor: Record<string, { bg: string; c: string }> = {
  agendado: { bg: '#F3ECDA', c: '#B08A3E' },
  processando: { bg: '#DBEAFE', c: '#1D4ED8' },
  concluido: { bg: '#E9F0ED', c: '#2B564D' },
  cancelado: { bg: '#F1F5F9', c: '#64748B' },
  erro: { bg: '#F4E4E1', c: '#B0413E' },
}

export default function TransferenciasPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [rows, setRows] = useState<Transferencia[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data } = await supabase.from('transferencias_agendadas').select('*').eq('empresa_id', eid).order('data_agendada', { ascending: false })
    setRows((data ?? []) as Transferencia[])
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    if (!form.destinatario_nome || !form.valor) { toast.error('Preencha destinatário e valor'); return }
    if (form.tipo === 'pix' && !form.chave_pix) { toast.error('Informe a chave PIX'); return }
    if (form.tipo !== 'pix' && (!form.destinatario_banco || !form.destinatario_conta)) { toast.error('Informe banco e conta'); return }
    setSaving(true)
    const { error } = await supabase.from('transferencias_agendadas').insert({
      empresa_id: empresaId,
      tipo: form.tipo,
      valor: Number(form.valor),
      destinatario_nome: form.destinatario_nome,
      destinatario_banco: form.destinatario_banco || null,
      destinatario_agencia: form.destinatario_agencia || null,
      destinatario_conta: form.destinatario_conta || null,
      chave_pix: form.chave_pix || null,
      descricao: form.descricao || null,
      data_agendada: form.data_agendada,
      status: 'agendado',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${form.tipo.toUpperCase()} agendado`)
    setModal(false); setForm(EMPTY)
    void carregar()
  }

  async function cancelar(id: string) {
    const { error } = await supabase.from('transferencias_agendadas').update({ status: 'cancelado' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Transferência cancelada')
    void carregar()
  }

  const pendentes = rows.filter(r => r.status === 'agendado')
  const totalAgendado = pendentes.reduce((s, r) => s + Number(r.valor || 0), 0)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">PIX & Transferências</div>
          <div className="page-sub">Envie PIX, TED e DOC · agende e acompanhe</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/conta-pj" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Banco
          </Link>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setModal(true)}>
            <i className="fa-solid fa-bolt" style={{ marginRight: 6 }} />Nova transferência
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
          <div className="kpi-lbl">Agendadas</div>
          <div className="kpi-val">{pendentes.length}</div>
          <div className="kpi-delta">{formatBRL(totalAgendado)} a enviar</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">Concluídas</div>
          <div className="kpi-val">{rows.filter(r => r.status === 'concluido').length}</div>
          <div className="kpi-delta up">total no histórico</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7A6A9E' }}>
          <div className="kpi-lbl">Total de operações</div>
          <div className="kpi-val">{rows.length}</div>
          <div className="kpi-delta">PIX · TED · DOC</div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', fontSize: 12, fontWeight: 700, color: '#13201D' }}>Histórico de transferências</div>
        {rows.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 12 }}>
            <i className="fa-solid fa-paper-plane" style={{ fontSize: 26, color: '#D1D9D8', display: 'block', marginBottom: 10 }} />
            Nenhuma transferência ainda. Clique em <strong>Nova transferência</strong> para começar.
          </div>
        ) : rows.map((r, i) => {
          const sc = statusCor[r.status] ?? statusCor.agendado
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < rows.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${TIPOS.find(t => t.v === r.tipo)?.icon ?? 'fa-bolt'}`} style={{ fontSize: 14, color: '#3D7A6E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#13201D' }}>{r.destinatario_nome}</div>
                <div style={{ fontSize: 10.5, color: '#7B8C88' }}>{r.tipo.toUpperCase()} · {r.data_agendada}{r.chave_pix ? ` · ${r.chave_pix}` : ''}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', fontFamily: "'Inter', system-ui, sans-serif" }}>{formatBRL(Number(r.valor || 0))}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: sc.bg, color: sc.c }}>{r.status}</span>
              {r.status === 'agendado' && (
                <button onClick={() => void cancelar(r.id)} style={{ fontSize: 11, color: '#B0413E', background: 'none', border: '0.5px solid #E4DCCC', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nova transferência */}
      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div><h3 className="modal-title">Nova transferência</h3><div style={{ fontSize: 11, color: '#7B8C88' }}>PIX, TED ou DOC</div></div>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {TIPOS.map(t => (
                <button key={t.v} onClick={() => setForm(p => ({ ...p, tipo: t.v }))} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px', borderRadius: 10, cursor: 'pointer',
                  border: form.tipo === t.v ? '1px solid #3D7A6E' : '0.5px solid #E4DCCC', background: form.tipo === t.v ? '#E9F0ED' : '#fff',
                }}>
                  <i className={`fa-solid ${t.icon}`} style={{ fontSize: 15, color: form.tipo === t.v ? '#2B564D' : '#7B8C88' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: form.tipo === t.v ? '#2B564D' : '#3C4A46' }}>{t.label}</span>
                  <span style={{ fontSize: 9, color: '#7B8C88' }}>{t.desc}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Destinatário *</label>
                <input className="form-input" placeholder="Nome do favorecido" value={form.destinatario_nome} onChange={e => setForm(p => ({ ...p, destinatario_nome: e.target.value }))} />
              </div>

              {form.tipo === 'pix' ? (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Chave PIX *</label>
                  <input className="form-input" placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" value={form.chave_pix} onChange={e => setForm(p => ({ ...p, chave_pix: e.target.value }))} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Banco *</label>
                    <input className="form-input" placeholder="Ex: Itaú" value={form.destinatario_banco} onChange={e => setForm(p => ({ ...p, destinatario_banco: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Agência</label>
                    <input className="form-input" placeholder="0000" value={form.destinatario_agencia} onChange={e => setForm(p => ({ ...p, destinatario_agencia: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Conta *</label>
                    <input className="form-input" placeholder="00000-0" value={form.destinatario_conta} onChange={e => setForm(p => ({ ...p, destinatario_conta: e.target.value }))} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Valor (R$) *</label>
                  <input className="form-input" type="number" placeholder="0,00" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Data</label>
                  <input className="form-input" type="date" value={form.data_agendada} onChange={e => setForm(p => ({ ...p, data_agendada: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>Descrição</label>
                <input className="form-input" placeholder="Ex: Pagamento fornecedor" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvar()} disabled={saving} style={{ fontSize: 12, padding: '8px 20px' }}>{saving ? 'Enviando…' : 'Confirmar transferência'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

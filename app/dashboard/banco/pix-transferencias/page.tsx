'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Conta = { id: string; banco_nome: string; saldo_disponivel: number; saldo: number }
type Transferencia = {
  id: string; destinatario_nome: string; destinatario_documento: string | null; tipo: string; data_agendada: string
  valor: number | string; status: string; chave_pix: string | null; descricao: string | null
}

const TIPOS = [
  { v: 'pix', label: 'PIX', icon: 'fa-bolt' },
  { v: 'ted', label: 'TED', icon: 'fa-building-columns' },
  { v: 'doc', label: 'DOC', icon: 'fa-money-check' },
]

const EMPTY = { tipo: 'pix', destinatario_nome: '', destinatario_documento: '', chave_pix: '', destinatario_banco: '', destinatario_agencia: '', destinatario_conta: '', valor: '', data_agendada: new Date().toISOString().slice(0, 10), descricao: '' }

const statusCor: Record<string, { bg: string; c: string }> = {
  agendado: { bg: 'var(--warn-soft)', c: 'var(--warn)' },
  concluido: { bg: 'var(--acc-soft)', c: 'var(--acc-ink)' },
  cancelado: { bg: 'var(--line)', c: 'var(--mut)' },
  falhou: { bg: 'var(--neg-soft)', c: 'var(--neg)' },
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function BancoPixPage() {
  const [contas, setContas] = useState<Conta[]>([])
  const [contaOrigemId, setContaOrigemId] = useState('')
  const [rows, setRows] = useState<Transferencia[]>([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    const [{ data: contasData }, { data: hist }] = await Promise.all([
      supabase.from('contas_bancarias').select('id, banco_nome, saldo_disponivel, saldo').eq('empresa_id', eid).eq('status', 'ativa'),
      supabase.from('transferencias_agendadas').select('*').eq('empresa_id', eid).order('data_agendada', { ascending: false }).limit(50),
    ])
    setContas((contasData ?? []) as Conta[])
    if (contasData?.[0]) setContaOrigemId(contasData[0].id as string)
    setRows((hist ?? []) as Transferencia[])
    setLoading(false)
  }
  useEffect(() => { void carregar() }, [])

  const favoritos = useMemo(() => {
    const contagem = new Map<string, { nome: string; chave: string | null; count: number }>()
    for (const r of rows) {
      const key = r.chave_pix || r.destinatario_documento || r.destinatario_nome
      const cur = contagem.get(key) ?? { nome: r.destinatario_nome, chave: r.chave_pix, count: 0 }
      cur.count++
      contagem.set(key, cur)
    }
    return Array.from(contagem.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [rows])

  async function enviar() {
    if (!form.destinatario_nome || !form.valor) { toast.error('Preencha destinatário e valor'); return }
    if (form.tipo === 'pix' && !form.chave_pix) { toast.error('Informe a chave PIX'); return }
    if (form.tipo !== 'pix' && (!form.destinatario_banco || !form.destinatario_conta)) { toast.error('Informe banco e conta'); return }
    if (!contaOrigemId) { toast.error('Nenhuma conta de origem disponível'); return }

    const hoje = new Date().toISOString().slice(0, 10)
    const agendarParaDepois = form.data_agendada > hoje
    setSaving(true)
    try {
      if (agendarParaDepois) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).maybeSingle()
        const eid = (u?.empresa_id as string) || user!.id
        const { error } = await supabase.from('transferencias_agendadas').insert({
          empresa_id: eid, conta_origem_id: contaOrigemId, tipo: form.tipo, valor: Number(form.valor),
          destinatario_nome: form.destinatario_nome, destinatario_documento: form.destinatario_documento || null,
          destinatario_banco: form.destinatario_banco || null, destinatario_agencia: form.destinatario_agencia || null,
          destinatario_conta: form.destinatario_conta || null, chave_pix: form.chave_pix || null,
          descricao: form.descricao || null, data_agendada: form.data_agendada, status: 'agendado',
        })
        if (error) throw new Error(error.message)
        toast.success(`${form.tipo.toUpperCase()} agendado para ${new Date(form.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')}`)
      } else {
        const h = await authHeaders()
        const r = await fetch('/api/conta-pj/transferencia', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ conta_origem_id: contaOrigemId, ...form, data_agendada: hoje }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Falha ao enviar')
        toast.success(`${form.tipo.toUpperCase()} enviado — novo saldo ${formatBRL(j.saldo_atual)}`)
      }
      setForm(EMPTY)
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const contaAtiva = contas.find(c => c.id === contaOrigemId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      {contas.length > 1 && (
        <div className="seg-v2">
          {contas.map(c => (
            <span key={c.id} className={contaOrigemId === c.id ? 'on' : ''} onClick={() => setContaOrigemId(c.id)}>{c.banco_nome}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Fazer PIX/Transferência */}
        <div className="card-v2">
          <div className="card-v2-h"><h3>Fazer PIX / Transferência</h3>{contaAtiva && <span style={{ fontSize: 11.5, color: 'var(--mut)' }}>Saldo disponível: {formatBRL(contaAtiva.saldo_disponivel ?? contaAtiva.saldo)}</span>}</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {TIPOS.map(t => (
              <button key={t.v} onClick={() => setForm(p => ({ ...p, tipo: t.v }))} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px', borderRadius: 9, cursor: 'pointer',
                border: form.tipo === t.v ? '1px solid var(--acc)' : '1px solid var(--line)', background: form.tipo === t.v ? 'var(--acc-soft)' : 'var(--card)',
              }}>
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 14, color: form.tipo === t.v ? 'var(--acc-ink)' : 'var(--mut)' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: form.tipo === t.v ? 'var(--acc-ink)' : 'var(--ink)' }}>{t.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="form-input" placeholder="Nome do favorecido" value={form.destinatario_nome} onChange={e => setForm(p => ({ ...p, destinatario_nome: e.target.value }))} />
            {form.tipo === 'pix' ? (
              <input className="form-input" placeholder="Chave PIX (CPF/CNPJ, e-mail, telefone ou aleatória)" value={form.chave_pix} onChange={e => setForm(p => ({ ...p, chave_pix: e.target.value }))} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Banco" value={form.destinatario_banco} onChange={e => setForm(p => ({ ...p, destinatario_banco: e.target.value }))} />
                <input className="form-input" placeholder="Agência" value={form.destinatario_agencia} onChange={e => setForm(p => ({ ...p, destinatario_agencia: e.target.value }))} />
                <input className="form-input" placeholder="Conta" value={form.destinatario_conta} onChange={e => setForm(p => ({ ...p, destinatario_conta: e.target.value }))} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="form-input" type="number" placeholder="Valor (R$)" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
              <input className="form-input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.data_agendada} onChange={e => setForm(p => ({ ...p, data_agendada: e.target.value }))} />
            </div>
            <input className="form-input" placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            <button className="btn-v2 primary" disabled={saving} onClick={() => void enviar()} style={{ marginTop: 4 }}>
              {saving ? 'Enviando…' : form.data_agendada > new Date().toISOString().slice(0, 10) ? 'Agendar' : `Confirmar ${form.tipo.toUpperCase()}`}
            </button>
          </div>

          {favoritos.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Chaves PIX favoritas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {favoritos.map(f => (
                  <button key={f.nome + (f.chave ?? '')} onClick={() => setForm(p => ({ ...p, tipo: 'pix', destinatario_nome: f.nome, chave_pix: f.chave || '' }))}
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', color: 'var(--ink)' }}>
                    {f.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Histórico */}
        <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-v2-h" style={{ padding: '14px 16px 0' }}><h3>Histórico</h3></div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--mut)', fontSize: 12.5 }}>Carregando…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--mut)', fontSize: 12.5 }}>Nenhuma transferência ainda.</div>
          ) : rows.map(r => {
            const sc = statusCor[r.status] ?? statusCor.agendado
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
                <i className={`fa-solid ${TIPOS.find(t => t.v === r.tipo)?.icon ?? 'fa-bolt'}`} style={{ fontSize: 12, color: 'var(--acc-ink)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{r.destinatario_nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--mut)' }}>{r.tipo.toUpperCase()} · {new Date(r.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{formatBRL(Number(r.valor || 0))}</div>
                <span className="chip-v2" style={{ background: sc.bg, color: sc.c }}>{r.status === 'concluido' ? 'Concluído' : r.status === 'agendado' ? 'Pendente' : r.status === 'cancelado' ? 'Cancelado' : 'Falhou'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

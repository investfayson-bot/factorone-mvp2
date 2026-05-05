'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Solicitacao = {
  id: string
  nome_cartao: string
  setor: string | null
  limite_sugerido: number
  status: 'pendente' | 'aprovado' | 'rejeitado'
  created_at: string
}

type DespesaCartao = {
  id: string
  descricao: string
  fornecedor: string | null
  categoria: string | null
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

const CORES = ['#1e3a5f', '#2d5a4e', '#5e3a1e', '#3a2d5e', '#1e4a3a', '#4a1e2d']

function cartaoColor(nome: string, idx: number) {
  return CORES[idx % CORES.length]
}

export default function CartoesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [despesas, setDespesas] = useState<DespesaCartao[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome_cartao: '', setor: '', limite_sugerido: '' })

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)

    const now = new Date()
    const mes0 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [s, d] = await Promise.all([
      supabase.from('solicitacoes_cartao').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('despesas').select('id,descricao,fornecedor,categoria,valor,data_vencimento,data_pagamento,status')
        .eq('empresa_id', eid).eq('forma_pagamento', 'cartao').gte('data_vencimento', mes0).order('data_vencimento', { ascending: false }),
    ])
    setSolicitacoes((s.data || []) as Solicitacao[])
    setDespesas((d.data || []) as DespesaCartao[])
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const aprovados = useMemo(() => solicitacoes.filter(s => s.status === 'aprovado'), [solicitacoes])
  const totalLimite = aprovados.reduce((s, c) => s + Number(c.limite_sugerido || 0), 0)
  const totalGasto = despesas.reduce((s, d) => s + Number(d.valor || 0), 0)
  const totalDisponivel = totalLimite - totalGasto
  const pendentes = solicitacoes.filter(s => s.status === 'pendente').length

  async function solicitarCartao() {
    if (!form.nome_cartao || !form.limite_sugerido) return
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_cartao').insert({
      empresa_id: empresaId,
      nome_cartao: form.nome_cartao,
      setor: form.setor || null,
      limite_sugerido: Number(form.limite_sugerido.replace(',', '.')),
      status: 'pendente',
    })
    setSaving(false)
    if (error) { toast.error('Erro ao solicitar cartão'); return }
    toast.success('Solicitação enviada!')
    setModalOpen(false)
    setForm({ nome_cartao: '', setor: '', limite_sugerido: '' })
    await carregar()
  }

  async function aprovarSolicitacao(id: string) {
    await supabase.from('solicitacoes_cartao').update({ status: 'aprovado' }).eq('id', id)
    toast.success('Cartão aprovado!')
    await carregar()
  }

  async function rejeitarSolicitacao(id: string) {
    await supabase.from('solicitacoes_cartao').update({ status: 'rejeitado' }).eq('id', id)
    await carregar()
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cartões Corporativos</div>
          <div className="page-sub">{aprovados.length} cartão{aprovados.length !== 1 ? 'ões' : ''} ativo{aprovados.length !== 1 ? 's' : ''} · FactorOne Bank</div>
        </div>
        <button className="btn-action" onClick={() => setModalOpen(true)}>+ Solicitar Cartão</button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Limite total</div>
          <div className="kpi-val">{totalLimite > 0 ? formatBRL(totalLimite) : '—'}</div>
          <div className="kpi-delta">{aprovados.length} cartões</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Utilizado (mês)</div>
          <div className="kpi-val" style={{ color: totalGasto > 0 ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(totalGasto)}</div>
          <div className={`kpi-delta ${totalLimite > 0 && totalGasto / totalLimite > 0.8 ? 'warn' : 'up'}`}>
            {totalLimite > 0 ? `${Math.round((totalGasto / totalLimite) * 100)}% do limite` : 'despesas cartão'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Disponível</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{totalLimite > 0 ? formatBRL(Math.max(0, totalDisponivel)) : '—'}</div>
          <div className="kpi-delta up">para uso</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Solicitações</div>
          <div className="kpi-val" style={{ color: pendentes > 0 ? 'var(--gold)' : 'var(--navy)' }}>{pendentes}</div>
          <div className={`kpi-delta ${pendentes > 0 ? 'warn' : 'up'}`}>{pendentes > 0 ? '⚠ aguardando' : '✓ nenhuma'}</div>
        </div>
      </div>

      {/* Cartões aprovados */}
      {aprovados.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Nenhum cartão ativo</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.7 }}>
            Solicite cartões corporativos virtuais ou físicos para sua equipe. As solicitações são aprovadas pela administração.
          </div>
          <button className="btn-action" onClick={() => setModalOpen(true)}>+ Solicitar primeiro cartão</button>
        </div>
      ) : (
        <div className="vcards" style={{ gridTemplateColumns: `repeat(${Math.min(aprovados.length, 4)}, 1fr)` }}>
          {aprovados.map((c, idx) => {
            const gasto = despesas.filter(d => d.descricao?.toLowerCase().includes(c.nome_cartao.toLowerCase()) || d.categoria?.toLowerCase() === c.setor?.toLowerCase()).reduce((s, d) => s + Number(d.valor || 0), 0)
            const pct = c.limite_sugerido > 0 ? Math.min(Math.round((gasto / c.limite_sugerido) * 100), 100) : 0
            return (
              <div key={c.id} className="vcard" style={{ background: `linear-gradient(135deg, ${cartaoColor(c.nome_cartao, idx)} 0%, ${cartaoColor(c.nome_cartao, idx + 2)} 100%)` }}>
                <div className="vc-lbl">{c.nome_cartao}</div>
                <div className="vc-val">{formatBRL(c.limite_sugerido)}</div>
                <div className="vc-used">{c.setor || 'Corporativo'} · Virtual</div>
                <div className="vc-bar" style={{ marginTop: 10 }}>
                  <div className="vc-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'rgba(255,100,100,.8)' : 'rgba(255,255,255,.5)' }} />
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>
                  {pct >= 80 ? `⚠ ${pct}% utilizado` : `✓ OK`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Solicitações pendentes */}
      {solicitacoes.filter(s => s.status === 'pendente').length > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(184,146,42,.3)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Solicitações pendentes
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Cartão</th>
                  <th>Setor</th>
                  <th style={{ textAlign: 'right' }}>Limite solicitado</th>
                  <th>Solicitado em</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.filter(s => s.status === 'pendente').map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.nome_cartao}</td>
                    <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{s.setor || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{formatBRL(Number(s.limite_sugerido || 0))}</td>
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button className="btn-action" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => void aprovarSolicitacao(s.id)}>Aprovar</button>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--red)', borderColor: 'rgba(192,80,74,.2)' }} onClick={() => void rejeitarSolicitacao(s.id)}>Rejeitar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transações do mês */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
            Despesas no cartão — mês atual ({despesas.length})
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono',monospace" }}>{formatBRL(totalGasto)}</span>
        </div>
        <div className="expenses-table">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {despesas.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0', fontSize: 13 }}>Nenhuma despesa no cartão este mês.</td></tr>
              ) : despesas.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{d.descricao}</td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{d.fornecedor || '—'}</td>
                  <td><span className="tag gray" style={{ fontSize: 10 }}>{d.categoria || '—'}</span></td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{new Date(d.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: 'var(--red)' }}>{formatBRL(Number(d.valor || 0))}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tag ${d.status === 'pago' ? 'green' : d.status === 'vencida' ? 'red' : 'gray'}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal solicitar cartão */}
      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Solicitar Cartão Virtual
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nome do cartão *</label>
              <input className="form-input" placeholder="Ex: Marketing Digital" value={form.nome_cartao} onChange={e => setForm(f => ({ ...f, nome_cartao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Setor / Centro de custo</label>
                <input className="form-input" placeholder="Ex: Marketing, Viagens" value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Limite sugerido (R$) *</label>
                <input className="form-input" placeholder="10.000" value={form.limite_sugerido} onChange={e => setForm(f => ({ ...f, limite_sugerido: e.target.value }))} />
              </div>
            </div>
            <div style={{ background: 'rgba(94,140,135,.05)', border: '1px solid rgba(94,140,135,.15)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 4 }}>
              A solicitação será analisada pela administração. Cartões virtuais ficam disponíveis para uso imediato após aprovação.
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} style={{ opacity: saving ? 0.6 : 1 }} onClick={() => void solicitarCartao()}>
                {saving ? 'Enviando…' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

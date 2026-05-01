'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const MESES_REAL = [
  { label: 'Out/25', entradas: 65, saidas: 48, proj: false },
  { label: 'Nov/25', entradas: 72, saidas: 52, proj: false },
  { label: 'Dez/25', entradas: 78, saidas: 55, proj: false },
  { label: 'Jan/26', entradas: 68, saidas: 50, proj: false },
  { label: 'Fev/26', entradas: 80, saidas: 58, proj: false },
  { label: 'Mar/26', entradas: 90, saidas: 62, proj: false },
  { label: 'Abr/26', entradas: 95, saidas: 64, proj: true },
  { label: 'Mai/26', entradas: 100, saidas: 66, proj: true },
  { label: 'Jun/26', entradas: 108, saidas: 68, proj: true },
]

type AddMes = { label: string; entradas: string; saidas: string; tipo: 'Real' | 'Projeção' }
const ADD_INICIAL: AddMes = { label: '', entradas: '', saidas: '', tipo: 'Projeção' }

export default function CashflowPage() {
  const [meses, setMeses] = useState(MESES_REAL)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<AddMes>(ADD_INICIAL)

  function addMes() {
    if (!form.label || !form.entradas || !form.saidas) { toast.error('Preencha todos os campos'); return }
    setMeses(prev => [...prev, {
      label: form.label,
      entradas: Math.round(Number(form.entradas) / 4000),
      saidas: Math.round(Number(form.saidas) / 4000),
      proj: form.tipo === 'Projeção',
    }])
    setForm(ADD_INICIAL)
    setModalOpen(false)
    toast.success('Mês adicionado!')
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cash Flow Intelligence</div>
          <div className="page-sub">9 meses · Real + Projeção</div>
        </div>
        <button className="btn-action" onClick={() => setModalOpen(true)}>+ Adicionar mês</button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Entradas Mar/26</div>
          <div className="kpi-val">R$312K</div>
          <div className="kpi-delta up">+4.7%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saídas Mar/26</div>
          <div className="kpi-val">R$194K</div>
          <div className="kpi-delta up">-2.1%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saldo Líquido</div>
          <div className="kpi-val">R$118K</div>
          <div className="kpi-delta up">+18.3%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Runway</div>
          <div className="kpi-val">8.3m</div>
          <div className="kpi-delta warn">⚠ atenção</div>
        </div>
      </div>

      <div className="cf-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>Entradas vs Saídas</div>
          <div className="cf-legend">
            <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'var(--teal)' }} /> Entradas</div>
            <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'rgba(184,146,42,.5)' }} /> Saídas</div>
            <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'rgba(94,140,135,.3)', border: '1px dashed var(--teal)' }} /> Projeção</div>
          </div>
        </div>
        <div className="cf-bars">
          {meses.map(m => (
            <div key={m.label} className="cf-col">
              <div className="cf-bgrp">
                <div className={`cf-bar ${m.proj ? 'proj-i' : 'i'}`} style={{ height: m.entradas }} />
                <div className={`cf-bar ${m.proj ? 'proj-o' : 'o'}`} style={{ height: m.saidas }} />
              </div>
              <div className="cf-lbl">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <div className="kpi">
          <div className="kpi-lbl">Projeção 30d</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--green)' }}>+R$136K</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Projeção 60d</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--green)' }}>+R$162K</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Projeção 90d</div>
          <div className="kpi-val" style={{ fontSize: 18, color: 'var(--gold)' }}>+R$148K</div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Adicionar Mês
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mês</label>
                <input className="form-input" placeholder="Ex: Jul/26" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'Real' | 'Projeção' }))}>
                  <option>Real</option><option>Projeção</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Entradas (R$)</label>
                <input className="form-input" type="number" placeholder="0" value={form.entradas} onChange={e => setForm(f => ({ ...f, entradas: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Saídas (R$)</label>
                <input className="form-input" type="number" placeholder="0" value={form.saidas} onChange={e => setForm(f => ({ ...f, saidas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-action" onClick={addMes}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const CARTOES = [
  { nome: 'Marketing', ultimos: '3302', classe: 'vc-marketing', fillClasse: 'vf-amber', limite: 50_000, usado: 43_500, alerta: true },
  { nome: 'Fornecedor / Operacional', ultimos: '8741', classe: 'vc-fornecedor', fillClasse: 'vf-green', limite: 200_000, usado: 68_000, alerta: false },
  { nome: 'Viagens', ultimos: '7719', classe: 'vc-viagens', fillClasse: 'vf-blue', limite: 80_000, usado: 29_000, alerta: false },
  { nome: 'Manutenção', ultimos: '9920', classe: 'vc-manutencao', fillClasse: 'vf-orange', limite: 40_000, usado: 18_000, alerta: false },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`
  return `R$${v.toLocaleString('pt-BR')}`
}

export default function CartoesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const limiteTotal = CARTOES.reduce((s, c) => s + c.limite, 0)
  const utilizado = CARTOES.reduce((s, c) => s + c.usado, 0)
  const disponivel = limiteTotal - utilizado

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cartões Corporativos</div>
          <div className="page-sub">4 cartões ativos · FactorOne Bank</div>
        </div>
        <button className="btn-action" onClick={() => setModalOpen(true)}>+ Novo Cartão</button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Limite Total</div>
          <div className="kpi-val">{fmt(limiteTotal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Utilizado</div>
          <div className="kpi-val">{fmt(utilizado)}</div>
          <div className="kpi-delta warn">{Math.round((utilizado / limiteTotal) * 100)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Disponível</div>
          <div className="kpi-val">{fmt(disponivel)}</div>
          <div className="kpi-delta up">{Math.round((disponivel / limiteTotal) * 100)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Cashback</div>
          <div className="kpi-val">R$1.560</div>
          <div className="kpi-delta up">este mês</div>
        </div>
      </div>

      <div className="vcards" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {CARTOES.map(c => {
          const pct = Math.round((c.usado / c.limite) * 100)
          return (
            <div key={c.nome} className={`vcard ${c.classe}`}>
              <div className="vc-lbl">{c.nome}</div>
              <div className="vc-val">{fmt(c.limite)}</div>
              <div className="vc-used">•••• {c.ultimos} · {fmt(c.usado)} usados</div>
              <div className="vc-bar" style={{ marginTop: 8 }}>
                <div className={`vc-fill ${c.fillClasse}`} style={{ width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                {pct >= 80 ? `⚠ ${pct}% utilizado` : `✓ OK`}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="txs-card">
          <div className="txs-header">
            <div className="txs-title">Transações — Marketing •••• 3302</div>
          </div>
          {[
            { desc: 'Meta Ads — Campanha Q1', data: '27/04', valor: 15_800 },
            { desc: 'Google Ads', data: '24/04', valor: 8_400 },
            { desc: 'Canva Pro', data: '20/04', valor: 320 },
            { desc: 'LinkedIn Ads', data: '18/04', valor: 4_200 },
          ].map(tx => (
            <div key={tx.desc} className="tx-item">
              <div className="tx-left">
                <div className="tx-name">{tx.desc}</div>
                <div className="tx-sub">{tx.data} · Débito automático</div>
              </div>
              <div className="tx-amount neg">-R${tx.valor.toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>

        <div className="txs-card">
          <div className="txs-header">
            <div className="txs-title">Transações — Viagens •••• 7719</div>
          </div>
          {[
            { desc: 'LATAM Airlines — SP/RJ', data: '26/04', valor: 1_840 },
            { desc: 'Hotel Ibis SP Centro', data: '25/04', valor: 680 },
            { desc: 'Uber Business', data: '24/04', valor: 145 },
            { desc: 'LATAM Airlines — RJ/SP', data: '22/04', valor: 1_840 },
          ].map(tx => (
            <div key={tx.desc} className="tx-item">
              <div className="tx-left">
                <div className="tx-name">{tx.desc}</div>
                <div className="tx-sub">{tx.data} · Débito automático</div>
              </div>
              <div className="tx-amount neg">-R${tx.valor.toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Novo Cartão Virtual
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nome do cartão</label>
              <input className="form-input" placeholder="Ex: Marketing Digital" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input"><option>Virtual</option><option>Físico</option></select>
              </div>
              <div className="form-group">
                <label className="form-label">Limite (R$)</label>
                <input className="form-input" type="number" placeholder="10.000" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <input className="form-input" placeholder="Nome do colaborador" />
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => { setModalOpen(false); toast.success('Cartão virtual criado!') }}>Criar Cartão</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

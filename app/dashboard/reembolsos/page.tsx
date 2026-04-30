'use client'

export default function ReembolsosPage() {
  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Reembolsos</div>
          <div className="page-sub">Solicitações de reembolso de colaboradores</div>
        </div>
        <button className="btn-action">Nova solicitação</button>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>3</div>
          <div className="kpi-delta warn">⚠ aguardando</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovados este mês</div>
          <div className="kpi-val">7</div>
          <div className="kpi-delta up">✓ processados</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total reembolsado</div>
          <div className="kpi-val">R$4,2K</div>
          <div className="kpi-delta up">este mês</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">SLA médio</div>
          <div className="kpi-val">1,8d</div>
          <div className="kpi-delta up">✓ ok</div>
        </div>
      </div>
      <div className="expenses-table">
        <div className="txs-header">
          <div className="txs-title">Solicitações de reembolso</div>
        </div>
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
          Módulo de reembolsos em breve. Colaboradores poderão submeter comprovantes diretamente pelo app.
        </div>
      </div>
    </>
  )
}

'use client'

export default function AprovacoesPage() {
  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Aprovações</div>
          <div className="page-sub">Fluxo de aprovação de despesas e reembolsos</div>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>5</div>
          <div className="kpi-delta warn">⚠ aguardando</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovados hoje</div>
          <div className="kpi-val">12</div>
          <div className="kpi-delta up">✓ ok</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Valor pendente</div>
          <div className="kpi-val">R$8,4K</div>
          <div className="kpi-delta warn">em análise</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">SLA médio</div>
          <div className="kpi-val">2,1h</div>
          <div className="kpi-delta up">✓ dentro do prazo</div>
        </div>
      </div>
      <div className="expenses-table">
        <div className="txs-header">
          <div className="txs-title">Aprovações pendentes</div>
        </div>
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
          Módulo de aprovações em breve. Integração com despesas e reembolsos.
        </div>
      </div>
    </>
  )
}

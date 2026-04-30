'use client'

export default function ConciliacaoPage() {
  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Conciliação Bancária</div>
          <div className="page-sub">Reconciliação automática · Extrato vs lançamentos</div>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Conciliados</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>98%</div>
          <div className="kpi-delta up">✓ automático</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>14</div>
          <div className="kpi-delta warn">⚠ verificar</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Divergências</div>
          <div className="kpi-val">2</div>
          <div className="kpi-delta dn">detectadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Último extrato</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>Hoje</div>
          <div className="kpi-delta up">✓ atualizado</div>
        </div>
      </div>
      <div className="expenses-table">
        <div className="txs-header">
          <div className="txs-title">Itens a conciliar</div>
        </div>
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
          Módulo de conciliação bancária em breve. Conecte sua conta PJ para importar extratos automaticamente.
        </div>
      </div>
    </>
  )
}

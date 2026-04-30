'use client'

const APPS = [
  { nome: 'Omie ERP', desc: 'Sincronização bidirecional de lançamentos', categoria: 'ERP', status: 'disponível' },
  { nome: 'Conta Azul', desc: 'Importação automática de notas e pagamentos', categoria: 'ERP', status: 'disponível' },
  { nome: 'Totvs', desc: 'Integração via API com módulo financeiro', categoria: 'ERP', status: 'em breve' },
  { nome: 'Stripe', desc: 'Reconciliação de cobranças e estornos', categoria: 'Pagamentos', status: 'disponível' },
  { nome: 'PagSeguro', desc: 'Lançamento automático de recebíveis', categoria: 'Pagamentos', status: 'disponível' },
  { nome: 'Mercado Pago', desc: 'Importação de transações e splits', categoria: 'Pagamentos', status: 'em breve' },
  { nome: 'Salesforce', desc: 'Sincronização de contratos e faturamento', categoria: 'CRM', status: 'em breve' },
  { nome: 'HubSpot', desc: 'Pipeline de vendas conectado ao fluxo financeiro', categoria: 'CRM', status: 'em breve' },
]

export default function MarketplacePage() {
  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Marketplace</div>
          <div className="page-sub">Integrações e extensões para o seu negócio</div>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Apps disponíveis</div>
          <div className="kpi-val">{APPS.filter(a => a.status === 'disponível').length}</div>
          <div className="kpi-delta up">✓ prontos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Em breve</div>
          <div className="kpi-val">{APPS.filter(a => a.status === 'em breve').length}</div>
          <div className="kpi-delta warn">em desenvolvimento</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Categorias</div>
          <div className="kpi-val">4</div>
          <div className="kpi-delta up">ERP · CRM · Pagamentos · Fiscal</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Instalados</div>
          <div className="kpi-val">0</div>
          <div className="kpi-delta warn">configure na Integrações</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {APPS.map(app => (
          <div key={app.nome} className="int-card" style={app.status === 'disponível' ? {} : { opacity: 0.6 }}>
            <div className="int-name">{app.nome}</div>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace", marginBottom: 6, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{app.categoria}</div>
            <div className="int-desc">{app.desc}</div>
            <div className={`int-status ${app.status === 'disponível' ? 'on' : 'off'}`}>
              <div className="int-dot" />
              {app.status === 'disponível' ? 'Disponível' : 'Em breve'}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

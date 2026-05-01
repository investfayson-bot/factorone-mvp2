'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

type Integracao = { id: string; ic: string; nome: string; desc: string; ativo: boolean }

const INTEGRACOES: Integracao[] = [
  { id: 'swap', ic: '💳', nome: 'Swap Corpway', desc: 'Conta PJ + cartões corporativos BaaS', ativo: true },
  { id: 'claude', ic: '🧠', nome: 'Claude API', desc: 'Motor do AI CFO — análise financeira', ativo: true },
  { id: 'stripe', ic: '💰', nome: 'Stripe', desc: 'Cobrança de assinaturas FactorOne', ativo: true },
  { id: 'celcoin', ic: '⚡', nome: 'Celcoin', desc: 'PIX, boleto, TED', ativo: true },
  { id: 'remessa', ic: '🌐', nome: 'Remessa Online', desc: 'Conta Global USD — pagamentos internacionais', ativo: false },
  { id: 'omie', ic: '🗄️', nome: 'Omie ERP', desc: 'Sync contábil automático com ERP', ativo: false },
  { id: 'openfinance', ic: '🏦', nome: 'Open Finance', desc: 'Conexão com bancos externos via Bacen', ativo: false },
  { id: 'nfeio', ic: '🧾', nome: 'NFe.io', desc: 'Emissão automática de NF-e e NFS-e', ativo: false },
]

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>(INTEGRACOES)

  function conectar(id: string) {
    toast('Em breve! Integração em desenvolvimento.')
  }

  function desconectar(id: string) {
    setIntegracoes(prev => prev.map(i => i.id === id ? { ...i, ativo: false } : i))
    toast('Integração desconectada.')
  }

  const ativas = integracoes.filter(i => i.ativo).length
  const disponiveis = integracoes.filter(i => !i.ativo).length

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Hub de Integrações</div>
          <div className="page-sub">{ativas} ativas · {disponiveis} disponíveis</div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Ativas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{ativas}</div>
          <div className="kpi-delta up">✓ conectadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Disponíveis</div>
          <div className="kpi-val">{disponiveis}</div>
          <div className="kpi-delta warn">em breve</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Sync bancário</div>
          <div className="kpi-val" style={{ color: 'var(--green)', fontSize: 14 }}>✓ Ativo</div>
          <div className="kpi-delta up">Open Finance</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">IA CFO</div>
          <div className="kpi-val" style={{ color: 'var(--green)', fontSize: 14 }}>✓ Online</div>
          <div className="kpi-delta up">Claude API</div>
        </div>
      </div>

      <div className="int-grid">
        {integracoes.map(i => (
          <div key={i.id} className={`int-card${i.ativo ? ' connected' : ''}`}>
            <div className="int-ic">{i.ic}</div>
            <div className="int-name">{i.nome}</div>
            <div className="int-desc">{i.desc}</div>
            <div className={`int-status ${i.ativo ? 'on' : 'off'}`}>
              <div className="int-dot" />
              {i.ativo ? 'Ativo' : 'Não conectado'}
            </div>
            {!i.ativo && (
              <button
                className="btn-action"
                onClick={() => conectar(i.id)}
                style={{ marginTop: 10, width: '100%', fontSize: 11, padding: '5px 0' }}
              >+ Conectar</button>
            )}
            {i.ativo && (
              <button
                onClick={() => desconectar(i.id)}
                style={{ marginTop: 10, width: '100%', fontSize: 11, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(192,80,74,.2)', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}
              >Desconectar</button>
            )}
          </div>
        ))}
      </div>

      {/* API Banner */}
      <div style={{ background: 'linear-gradient(135deg,var(--navy) 0%,#243736 100%)', borderRadius: 14, padding: '18px 22px', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>FactorOne API</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
            Integre qualquer sistema via <strong style={{ color: 'rgba(255,255,255,.8)' }}>REST API + webhooks</strong>
          </div>
        </div>
        <button
          onClick={() => toast('Documentação da API em breve!')}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--teal)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >Ver documentação →</button>
      </div>
    </>
  )
}

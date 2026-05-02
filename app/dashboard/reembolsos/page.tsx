'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

type Reembolso = {
  id: string
  initials: string
  nome: string
  descricao: string
  detalhes: string
  data: string
  valor: number
  status: 'pendente' | 'aprovado'
}

const INICIAL: Reembolso[] = [
  { id: '1', initials: 'AS', nome: 'Ana Souza', descricao: 'Viagem São Paulo', detalhes: 'Táxi + Hotel + Alimentação · 3 recibos · 28/04', data: '28/04', valor: 2_840, status: 'pendente' },
  { id: '2', initials: 'MR', nome: 'Marcos Ribeiro', descricao: 'Material de Escritório', detalhes: 'Compra Kalunga · 1 recibo · 26/04', data: '26/04', valor: 680, status: 'pendente' },
  { id: '3', initials: 'LC', nome: 'Lucas Carvalho', descricao: 'Confraternização Equipe', detalhes: 'Restaurante · 2 recibos · 25/04', data: '25/04', valor: 4_820, status: 'aprovado' },
]

export default function ReembolsosPage() {
  const [items, setItems] = useState<Reembolso[]>(INICIAL)
  const [removidos, setRemovidos] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  function aprovar(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'aprovado' } : i))
    toast.success('Reembolso aprovado!')
  }

  function rejeitar(id: string) {
    setRemovidos(prev => { const s = new Set(prev); s.add(id); return s })
    toast('Rejeitado.')
  }

  function pagarPix(item: Reembolso) {
    toast.success(`PIX R$${item.valor.toLocaleString('pt-BR')} enviado para ${item.nome.split(' ')[0]}!`)
    setRemovidos(prev => { const s = new Set(prev); s.add(item.id); return s })
  }

  const visíveis = items.filter(i => !removidos.has(i.id))
  const pendentes = visíveis.filter(i => i.status === 'pendente').length
  const aprovados = visíveis.filter(i => i.status === 'aprovado').length
  const totalPendente = visíveis.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Reembolsos</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>
            {pendentes} pendentes · PIX D+1 após aprovação
          </div>
        </div>
        <button className="btn-action" onClick={() => setModalOpen(true)}>+ Solicitar reembolso</button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{pendentes}</div>
          <div className="kpi-delta warn">R${totalPendente.toLocaleString('pt-BR')} total</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovados</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{aprovados}</div>
          <div className="kpi-delta up">aguardando PIX</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pagos este mês</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>R$12.400</div>
          <div className="kpi-delta up">✓ PIX D+1</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Tempo médio</div>
          <div className="kpi-val">1.2 dias</div>
          <div className="kpi-delta up">↓ melhorando</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 14 }}>
          Solicitações pendentes
        </div>
        {visíveis.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma solicitação pendente.</div>
        ) : visíveis.map((item, idx) => (
          <div
            key={item.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < visíveis.length - 1 ? '1px solid var(--gray-100)' : 'none' }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', flexShrink: 0 }}>
              {item.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}>{item.nome} — {item.descricao}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.detalhes}</div>
            </div>
            <div style={{ textAlign: 'right', marginRight: 12 }}>
              <div style={{ fontWeight: 700, fontFamily: "'DM Mono',monospace", color: 'var(--navy)' }}>R${item.valor.toLocaleString('pt-BR')}</div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: item.status === 'aprovado' ? 'rgba(94,140,135,.12)' : 'rgba(184,146,42,.12)', color: item.status === 'aprovado' ? 'var(--teal2)' : 'var(--gold)', fontWeight: 600 }}>
                {item.status === 'aprovado' ? 'Aprovado' : 'Pendente'}
              </span>
            </div>
            {item.status === 'pendente' ? (
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  onClick={() => aprovar(item.id)}
                  style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.25)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}
                >✓ Aprovar</button>
                <button
                  onClick={() => rejeitar(item.id)}
                  style={{ background: 'rgba(192,80,74,.08)', color: 'var(--red)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}
                >✗</button>
              </div>
            ) : (
              <button
                onClick={() => pagarPix(item)}
                style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}
              >⚡ Pagar PIX</button>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Solicitar Reembolso
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Ex: Viagem São Paulo — Hotel" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-input">
                <option>Viagens</option><option>Alimentação</option><option>Material</option><option>Tecnologia</option><option>Outros</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => { setModalOpen(false); toast.success('Solicitação enviada!') }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

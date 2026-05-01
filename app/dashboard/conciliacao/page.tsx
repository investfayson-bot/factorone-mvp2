'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

type ConcItem = { id: string; desc: string; banco: string; lancamento: string; data: string; valor: number; status: 'conciliado' | 'pendente' | 'divergencia' }

const TRANSACOES: ConcItem[] = [
  { id: '1', desc: 'TED Recebida — Aço Brasil Ltda', banco: '+R$48.000', lancamento: 'Duplicata #004521', data: '22/04', valor: 48_000, status: 'conciliado' },
  { id: '2', desc: 'PIX Saída — Folha Abril', banco: '-R$42.000', lancamento: 'Folha de Pagamento Abr/26', data: '21/04', valor: 42_000, status: 'conciliado' },
  { id: '3', desc: 'PIX Recebido — E-commerce Pro', banco: '+R$34.000', lancamento: 'Invoice INV-2026', data: '20/04', valor: 34_000, status: 'conciliado' },
  { id: '4', desc: 'Débito — Amazon Web Services', banco: '-R$8.420', lancamento: 'Despesa Tecnologia', data: '19/04', valor: 8_420, status: 'pendente' },
  { id: '5', desc: 'PIX Recebido — Growth Lab', banco: '+R$8.900', lancamento: '?', data: '18/04', valor: 8_900, status: 'pendente' },
  { id: '6', desc: 'TED Saída — Assessoria Jurídica', banco: '-R$4.500', lancamento: 'R$4.300 (divergência)', data: '17/04', valor: 4_500, status: 'divergencia' },
  { id: '7', desc: 'Meta Ads — Débito Automático', banco: '-R$15.800', lancamento: 'R$15.000 (divergência)', data: '16/04', valor: 15_800, status: 'divergencia' },
]

export default function ConciliacaoPage() {
  const [items, setItems] = useState<ConcItem[]>(TRANSACOES)

  function conciliar(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'conciliado' } : i))
    toast.success('Item conciliado!')
  }

  function executarIA() {
    setItems(prev => prev.map(i => i.status === 'pendente' ? { ...i, status: 'conciliado' } : i))
    toast.success('IA matching executado · 134 conciliadas!')
  }

  const conciliadas = items.filter(i => i.status === 'conciliado').length
  const pendentes = items.filter(i => i.status === 'pendente').length
  const divergencias = items.filter(i => i.status === 'divergencia').length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Conciliação Bancária</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>Open Finance · Matching automático por IA</div>
        </div>
        <button className="btn-action" onClick={executarIA}>✨ Executar IA matching</button>
      </div>

      {/* Open Finance bancos */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
          Open Finance — Bancos conectados
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          {[
            { nome: 'Itaú Empresas', sub: 'Open Finance · Ag 0001', ativo: true },
            { nome: 'BTG Pactual', sub: 'Open Finance · Investimentos', ativo: true },
          ].map(b => (
            <div key={b.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 11, background: 'rgba(45,155,111,.02)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 20 }}>🏦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{b.nome}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{b.sub}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(45,155,111,.12)', color: 'var(--green)', fontWeight: 600 }}>✓ Ativo</span>
            </div>
          ))}
          <div
            onClick={() => toast('Conectando via Open Finance...', { icon: '🏦' })}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 11, background: 'var(--cream)', border: '1px solid var(--gray-100)', borderRadius: 10, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 20 }}>+</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)' }}>Adicionar banco</div>
              <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>Open Finance · API</div>
            </div>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Transações banco</div>
          <div className="kpi-val">148</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Conciliadas IA</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{conciliadas + 127}</div>
          <div className="kpi-delta up">{Math.round(((conciliadas + 127) / 148) * 100)}% auto</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Não conciliadas</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{pendentes}</div>
          <div className="kpi-delta warn">revisão manual</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Divergências</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{divergencias}</div>
          <div className="kpi-delta dn">verificar</div>
        </div>
      </div>

      <div className="expenses-table">
        <table>
          <thead>
            <tr>
              <th>Transação bancária</th>
              <th>Lançamento sistema</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.desc}</td>
                <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.lancamento}</td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{item.data}</td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>R${item.valor.toLocaleString('pt-BR')}</td>
                <td>
                  {item.status === 'conciliado' && <span className="tag green">conciliado</span>}
                  {item.status === 'pendente' && <span className="tag amber">pendente</span>}
                  {item.status === 'divergencia' && <span className="tag red">divergência</span>}
                </td>
                <td>
                  {item.status !== 'conciliado' && (
                    <button
                      onClick={() => conciliar(item.id)}
                      style={{ border: 'none', background: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 11 }}
                    >Conciliar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

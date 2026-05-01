'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

type AprovItem = {
  id: string
  icon: string
  iconBg: string
  nome: string
  sub: string
  politica: string
  politicaColor: string
  valor: number
  nivel: 'Nível 1' | 'Nível 2' | 'Fora política'
  nivelColor: string
  status: 'pendente' | 'aprovado' | 'rejeitado'
}

const INICIAL: AprovItem[] = [
  {
    id: '1', icon: '✈️', iconBg: 'rgba(94,140,135,.1)',
    nome: 'Ana Lima — Passagem São Paulo',
    sub: 'Viagem comercial · NF-e anexada · 29/04',
    politica: '✓ Dentro da política de viagens', politicaColor: 'var(--teal)',
    valor: 1_840, nivel: 'Nível 1', nivelColor: 'rgba(94,140,135,.12)', status: 'pendente',
  },
  {
    id: '2', icon: '🍽️', iconBg: 'rgba(184,146,42,.1)',
    nome: 'Pedro Carvalho — Jantar Clientes',
    sub: 'Relacionamento comercial · Recibo foto · 28/04',
    politica: '⚠ Acima do limite de alimentação (R$800)', politicaColor: 'var(--gold)',
    valor: 2_340, nivel: 'Nível 1', nivelColor: 'rgba(94,140,135,.12)', status: 'pendente',
  },
  {
    id: '3', icon: '💻', iconBg: 'rgba(124,58,237,.1)',
    nome: 'TI — Novos Notebooks (3 unidades)',
    sub: 'Equipamentos · Proposta fornecedor · 27/04',
    politica: '🔒 Exige aprovação CFO (valor > R$5.000)', politicaColor: '#7C3AED',
    valor: 18_900, nivel: 'Nível 2', nivelColor: 'rgba(124,58,237,.12)', status: 'pendente',
  },
  {
    id: '4', icon: '⚠️', iconBg: 'rgba(192,80,74,.1)',
    nome: 'Compra Eletrônicos — Fornecedor não cadastrado',
    sub: 'Sem NF-e · Fornecedor novo · 25/04',
    politica: '✗ Fora da política — recibo inválido', politicaColor: 'var(--red)',
    valor: 890, nivel: 'Fora política', nivelColor: 'rgba(192,80,74,.12)', status: 'pendente',
  },
]

export default function AprovacoesPage() {
  const [items, setItems] = useState<AprovItem[]>(INICIAL)

  function aprovar(id: string) {
    const item = items.find(i => i.id === id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'aprovado' } : i))
    toast.success(`${item?.nome.split('—')[0].trim()} aprovado!`)
  }

  function rejeitar(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'rejeitado' } : i))
    toast('Rejeitado.')
  }

  function aprovarTodos() {
    setItems(prev => prev.map(i => i.nivel !== 'Fora política' && i.status === 'pendente' ? { ...i, status: 'aprovado' } : i.nivel === 'Fora política' ? { ...i, status: 'rejeitado' } : i))
    toast.success('4 aprovadas · 1 rejeitada')
  }

  const pendentes = items.filter(i => i.status === 'pendente').length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Central de Aprovações</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>Política multi-nível · {pendentes} pendentes</div>
        </div>
        <button className="btn-action btn-ghost" onClick={() => toast('Abrindo configuração de políticas...')}>⚙ Configurar políticas</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 14 }}>
        <div style={{ background: 'rgba(45,155,111,.04)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>✓ Aprovação automática</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>Despesas até <strong>R$500</strong> com recibo · aprovadas automaticamente</div>
        </div>
        <div style={{ background: 'rgba(184,146,42,.04)', border: '1px solid rgba(184,146,42,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>⚡ Aprovação nível 1</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>Entre <strong>R$500–R$5.000</strong> → aprovação do gestor direto</div>
        </div>
        <div style={{ background: 'rgba(124,58,237,.04)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 4 }}>🔒 Aprovação nível 2</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>Acima de <strong>R$5.000</strong> → diretor + CFO obrigatório</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
            Pendentes ({pendentes})
          </div>
          <button
            onClick={aprovarTodos}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--gray-200)', background: 'transparent', color: 'var(--gray-700)', fontSize: 11, cursor: 'pointer' }}
          >✓ Aprovar dentro da política</button>
        </div>

        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
              borderBottom: idx < items.length - 1 ? '1px solid var(--gray-100)' : 'none',
              opacity: item.status !== 'pendente' ? 0.4 : 1,
              pointerEvents: item.status !== 'pendente' ? 'none' : 'auto',
              transition: 'opacity .2s',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: item.iconBg }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: item.nivel === 'Fora política' ? 'var(--red)' : 'var(--navy)' }}>{item.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.sub}</div>
              <div style={{ fontSize: 10.5, color: item.politicaColor, marginTop: 2 }}>{item.politica}</div>
            </div>
            <div style={{ textAlign: 'right', marginRight: 12 }}>
              <div style={{ fontWeight: 700, fontFamily: "'DM Mono',monospace", fontSize: 14, color: item.nivel === 'Fora política' ? 'var(--red)' : 'var(--navy)' }}>
                R${item.valor.toLocaleString('pt-BR')}
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: item.nivelColor, color: item.nivel === 'Fora política' ? 'var(--red)' : item.nivel === 'Nível 2' ? '#7C3AED' : 'var(--teal2)', fontWeight: 600 }}>
                {item.nivel}
              </span>
            </div>
            {item.nivel === 'Fora política' ? (
              <button
                onClick={() => rejeitar(item.id)}
                style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}
              >✗ Rejeitar</button>
            ) : (
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  onClick={() => aprovar(item.id)}
                  style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.25)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✓ {item.nivel === 'Nível 2' ? 'Aprovar como CFO' : 'Aprovar'}
                </button>
                <button
                  onClick={() => rejeitar(item.id)}
                  style={{ background: 'rgba(192,80,74,.08)', color: 'var(--red)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}
                >✗</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

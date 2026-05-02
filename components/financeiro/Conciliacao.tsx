'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

type Extrato = { id: string; data_transacao: string; descricao: string; valor: number; tipo: 'credito' | 'debito'; conta_id: string }
type Match = { extrato_id: string; referencia_id: string; tipo: string; confidence: number; metodo: string }

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }

export default function Conciliacao() {
  const [extratos, setExtratos] = useState<Extrato[]>([])
  const [pendentes, setPendentes] = useState<Array<{ id: string; tipo: 'pagar' | 'receber'; nome: string; valor: number; data: string }>>([])
  const [sugestoes, setSugestoes] = useState<Match[]>([])
  const [selectedExtrato, setSelectedExtrato] = useState<Extrato | null>(null)
  const [stats, setStats] = useState<{ percentual: number; conciliados: number; nao_conciliados: number } | null>(null)

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    const h = await authHeaders()
    const [ex, pg, rc, st] = await Promise.all([
      supabase.from('extrato_bancario').select('id,data_transacao,descricao,valor,tipo,conta_id').eq('empresa_id', eid).eq('conciliado', false).order('data_transacao', { ascending: false }).limit(100),
      supabase.from('contas_pagar').select('id,fornecedor_nome,valor,data_vencimento,status,extrato_id').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_paga']).is('extrato_id', null),
      supabase.from('contas_receber').select('id,cliente_nome,valor,data_vencimento,status,extrato_id').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_recebida']).is('extrato_id', null),
      fetch('/api/financeiro/conciliacao', { headers: { ...h } }).then((r) => r.json()).catch(() => null),
    ])
    setExtratos((ex.data || []) as Extrato[])
    setPendentes([
      ...(pg.data || []).map((x) => ({ id: x.id, tipo: 'pagar' as const, nome: x.fornecedor_nome, valor: Number(x.valor || 0), data: x.data_vencimento })),
      ...(rc.data || []).map((x) => ({ id: x.id, tipo: 'receber' as const, nome: x.cliente_nome, valor: Number(x.valor || 0), data: x.data_vencimento })),
    ])
    setStats(st)
  }
  useEffect(() => { void carregar() }, [])

  async function conciliarAutomatico(contaId: string) {
    const h = await authHeaders()
    const res = await fetch('/api/financeiro/conciliacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ conta_id: contaId }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha na conciliação')
    setSugestoes(payload.matches || [])
    alert(`${payload.conciliados} conciliados automaticamente; ${payload.matches?.length || 0} sugestões para revisão.`)
    await carregar()
  }

  const destaque = selectedExtrato
    ? pendentes.filter((p) => {
        const diffVal = Math.abs(Number(selectedExtrato.valor || 0) - Number(p.valor || 0)) / Math.max(Number(selectedExtrato.valor || 1), 1)
        return diffVal <= 0.01
      })
    : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Extrato (não conciliados)</div>
          {extratos[0]?.conta_id && (
            <button className="btn-action" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => void conciliarAutomatico(extratos[0].conta_id)}>✨ Auto-conciliar</button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {extratos.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedExtrato(e)}
              style={{ width: '100%', borderRadius: 8, border: selectedExtrato?.id === e.id ? '1.5px solid var(--teal)' : '1px solid var(--gray-100)', background: selectedExtrato?.id === e.id ? 'rgba(94,140,135,.07)' : '#fff', padding: '8px 10px', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{new Date(e.data_transacao).toLocaleDateString('pt-BR')} · {e.descricao}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: e.tipo === 'credito' ? 'var(--green)' : 'var(--red)' }}>{formatBRL(Number(e.valor || 0))}</div>
            </button>
          ))}
          {extratos.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: 16 }}>Nenhum extrato pendente.</div>}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Lançamentos internos pendentes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(selectedExtrato ? destaque : pendentes).map((p) => (
            <div key={p.id} style={{ borderRadius: 8, border: selectedExtrato ? '1px solid var(--gold)' : '1px solid var(--gray-100)', background: selectedExtrato ? 'rgba(184,146,42,.06)' : '#fff', padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.nome} · {p.data}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{formatBRL(p.valor)} <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>({p.tipo})</span></div>
            </div>
          ))}
          {(selectedExtrato ? destaque : pendentes).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: 16 }}>
              {selectedExtrato ? 'Nenhum match encontrado.' : 'Nenhum lançamento pendente.'}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...card, gridColumn: 'span 2' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Estatísticas de conciliação</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>% Conciliado</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{stats?.percentual?.toFixed(1) || '0'}%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Conciliados</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>{stats?.conciliados || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Não conciliados</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>{stats?.nao_conciliados || 0}</div>
          </div>
          {sugestoes.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Sugestões fuzzy</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--teal)' }}>{sugestoes.length}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

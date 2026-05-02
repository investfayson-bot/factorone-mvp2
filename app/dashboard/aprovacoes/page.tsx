'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'

type Despesa = {
  id: string
  descricao: string
  valor: number
  categoria: string
  status: string
  data_despesa: string | null
  responsavel_nome: string | null
  comprovante_url: string | null
  observacao: string | null
}

function nivel(valor: number): { label: string; color: string; bg: string } {
  if (valor <= 500)  return { label: 'Auto',    color: 'var(--green)',  bg: 'rgba(45,155,111,.1)' }
  if (valor <= 5000) return { label: 'Nível 1', color: 'var(--teal2)', bg: 'rgba(94,140,135,.12)' }
  return               { label: 'Nível 2',       color: '#7C3AED',      bg: 'rgba(124,58,237,.12)' }
}

export default function AprovacoesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [userId, setUserId]       = useState('')
  const [rows, setRows]           = useState<Despesa[]>([])
  const [loading, setLoading]     = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    setUserId(auth.user.id)
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', auth.user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || auth.user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('despesas')
      .select('id,descricao,valor,categoria,status,data_despesa,responsavel_nome,comprovante_url,observacao')
      .eq('empresa_id', eid)
      .eq('status', 'pendente_aprovacao')
      .order('data_despesa', { ascending: false })
    setRows((data ?? []) as Despesa[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function aprovar(id: string) {
    setAtualizando(id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('despesas')
      .update({ status: 'aprovado', aprovado_por: userId, aprovado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error(error.message) }
    else { toast.success('Despesa aprovada'); setRows(prev => prev.filter(r => r.id !== id)) }
    setAtualizando(null)
  }

  async function rejeitar(id: string, motivo = 'Rejeitado pelo gestor') {
    setAtualizando(id)
    const { error } = await supabase
      .from('despesas')
      .update({ status: 'rejeitado', rejeitado_motivo: motivo })
      .eq('id', id)
    if (error) { toast.error(error.message) }
    else { toast('Despesa rejeitada'); setRows(prev => prev.filter(r => r.id !== id)) }
    setAtualizando(null)
  }

  async function aprovarTodos() {
    const dentro = rows.filter(r => r.valor <= 5000)
    for (const d of dentro) await aprovar(d.id)
  }

  const pendentes = rows.length
  const totalValor = rows.reduce((s, r) => s + Number(r.valor), 0)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Central de Aprovacoes</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>
            Politica multi-nivel · {pendentes} pendentes · {formatBRL(totalValor)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 14 }}>
        <div style={{ background: 'rgba(45,155,111,.04)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Aprovacao automatica</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>Despesas ate <strong>R$ 500</strong> com recibo</div>
        </div>
        <div style={{ background: 'rgba(184,146,42,.04)', border: '1px solid rgba(184,146,42,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>Nivel 1</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>R$ 500 – R$ 5.000 → gestor direto</div>
        </div>
        <div style={{ background: 'rgba(124,58,237,.04)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 4 }}>Nivel 2</div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)' }}>Acima de <strong>R$ 5.000</strong> → CFO obrigatorio</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
            Pendentes ({pendentes})
          </div>
          {pendentes > 0 && (
            <button
              onClick={() => void aprovarTodos()}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--gray-200)', background: 'transparent', color: 'var(--gray-700)', fontSize: 11, cursor: 'pointer' }}
            >Aprovar nivel 1 e auto</button>
          )}
        </div>

        {loading && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Carregando...</div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
            Nenhuma despesa pendente de aprovacao
          </div>
        )}

        {rows.map((item, idx) => {
          const n = nivel(Number(item.valor))
          const bloqueado = atualizando === item.id
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                borderBottom: idx < rows.length - 1 ? '1px solid var(--gray-100)' : 'none',
                opacity: bloqueado ? 0.5 : 1,
                transition: 'opacity .2s',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: n.bg, color: n.color, fontWeight: 700 }}>
                {n.label[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.descricao}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                  {item.categoria}{item.responsavel_nome ? ` · ${item.responsavel_nome}` : ''}{item.data_despesa ? ` · ${item.data_despesa.split('-').reverse().join('/')}` : ''}
                </div>
                {item.comprovante_url && (
                  <div style={{ fontSize: 10.5, color: 'var(--teal2)', marginTop: 2 }}>Comprovante anexado</div>
                )}
              </div>
              <div style={{ textAlign: 'right', marginRight: 12 }}>
                <div style={{ fontWeight: 700, fontFamily: "'DM Mono',monospace", fontSize: 14, color: 'var(--navy)' }}>
                  {formatBRL(Number(item.valor))}
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: n.bg, color: n.color, fontWeight: 600 }}>
                  {n.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  onClick={() => void aprovar(item.id)}
                  disabled={bloqueado}
                  style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.25)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  {n.label === 'Nível 2' ? 'Aprovar CFO' : 'Aprovar'}
                </button>
                <button
                  onClick={() => void rejeitar(item.id)}
                  disabled={bloqueado}
                  style={{ background: 'rgba(192,80,74,.08)', color: 'var(--red)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}
                >Rejeitar</button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

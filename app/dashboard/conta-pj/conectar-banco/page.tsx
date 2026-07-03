'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Banco = { nome: string; codigo: string; cor: string }
type Conta = { id: string; banco_nome: string | null; banco_codigo: string | null; agencia: string | null; numero_conta: string | null; digito: string | null; saldo_disponivel: number; open_finance_id: string | null }

const BANCOS: Banco[] = [
  { nome: 'Itaú', codigo: '341', cor: '#EC7000' },
  { nome: 'Bradesco', codigo: '237', cor: '#CC092F' },
  { nome: 'Banco do Brasil', codigo: '001', cor: '#F9DD16' },
  { nome: 'Santander', codigo: '033', cor: '#EC0000' },
  { nome: 'Nubank', codigo: '260', cor: '#820AD1' },
  { nome: 'Inter', codigo: '077', cor: '#FF7A00' },
  { nome: 'C6 Bank', codigo: '336', cor: '#242424' },
  { nome: 'BTG Pactual', codigo: '208', cor: '#001E62' },
]

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export default function ConectarBancoPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [contas, setContas] = useState<Conta[]>([])
  const [conectando, setConectando] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('contas_bancarias')
      .select('id,banco_nome,banco_codigo,agencia,numero_conta,digito,saldo_disponivel,open_finance_id')
      .eq('empresa_id', eid)
      .not('open_finance_id', 'is', null)
    setContas((data ?? []) as Conta[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const conectadoPorCodigo = (codigo: string) => contas.find(c => c.banco_codigo === codigo)

  async function conectar(banco: Banco) {
    if (!empresaId) return
    if (conectadoPorCodigo(banco.codigo)) { toast.error(`${banco.nome} já conectado`); return }
    setConectando(banco.codigo)
    // Simulação de Open Finance: cria a conta conectada com dados gerados
    const { error } = await supabase.from('contas_bancarias').insert({
      empresa_id: empresaId,
      tipo: 'corrente',
      banco_nome: banco.nome,
      banco_codigo: banco.codigo,
      agencia: String(rand(1, 9999)).padStart(4, '0'),
      numero_conta: String(rand(10000, 99999)),
      digito: String(rand(0, 9)),
      saldo: rand(500, 80000),
      saldo_disponivel: rand(500, 80000),
      is_principal: false,
      open_finance_id: `of_${banco.codigo}_${Date.now()}`,
      status: 'ativa',
    })
    setConectando(null)
    if (error) { toast.error(error.message); return }
    toast.success(`${banco.nome} conectado via Open Finance`)
    void carregar()
    window.dispatchEvent(new Event('fo-apps-changed'))
  }

  async function desconectar(conta: Conta) {
    const { error } = await supabase.from('contas_bancarias').delete().eq('id', conta.id)
    if (error) { toast.error(error.message); return }
    toast.success(`${conta.banco_nome} desconectado`)
    void carregar()
  }

  const totalConectado = contas.reduce((s, c) => s + Number(c.saldo_disponivel ?? 0), 0)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Open Finance</div>
          <div className="page-sub">Conecte seus bancos e veja saldo e extrato unificados</div>
        </div>
        <Link href="/dashboard/conta-pj" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Voltar ao Banco
        </Link>
      </div>

      {/* Resumo conectado */}
      {contas.length > 0 && (
        <div style={{ background: '#13201D', borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Saldo consolidado · {contas.length} banco{contas.length > 1 ? 's' : ''} conectado{contas.length > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: "var(--font-sans)", letterSpacing: '-.02em', marginTop: 2 }}>{formatBRL(totalConectado)}</div>
          </div>
          <Link href="/dashboard/conta-pj" style={{ fontSize: 12, color: '#6FA595', textDecoration: 'none', fontWeight: 600 }}>Ver no dashboard →</Link>
        </div>
      )}

      {/* Contas conectadas */}
      {contas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Conectados</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {contas.map(c => {
              const banco = BANCOS.find(b => b.codigo === c.banco_codigo)
              return (
                <div key={c.id} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: banco?.cor ?? '#13201D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="fa-solid fa-building-columns" style={{ fontSize: 13, color: '#fff' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D' }}>{c.banco_nome}</div>
                        <div style={{ fontSize: 10, color: '#7B8C88', fontFamily: 'monospace' }}>Ag {c.agencia} · CC {c.numero_conta}-{c.digito}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#2B564D', background: '#E9F0ED', padding: '2px 7px', borderRadius: 20 }}>ATIVO</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.saldo_disponivel ?? 0))}</div>
                  <button onClick={() => void desconectar(c)} style={{ marginTop: 8, fontSize: 10.5, color: '#B0413E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                    <i className="fa-solid fa-link-slash" style={{ marginRight: 5 }} />Desconectar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bancos disponíveis */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Conectar um banco</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {BANCOS.map(b => {
          const conectado = conectadoPorCodigo(b.codigo)
          const isConn = conectando === b.codigo
          return (
            <div key={b.codigo} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: b.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-building-columns" style={{ fontSize: 15, color: b.codigo === '001' ? '#13201D' : '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D' }}>{b.nome}</div>
                  <div style={{ fontSize: 10, color: '#7B8C88' }}>Código {b.codigo}</div>
                </div>
              </div>
              <button
                onClick={() => void conectar(b)}
                disabled={!!conectado || isConn}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '9px', borderRadius: 9, border: 'none', cursor: conectado ? 'default' : 'pointer',
                  background: conectado ? '#E9F0ED' : '#13201D', color: conectado ? '#2B564D' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .15s',
                }}
              >
                {conectado ? (<><i className="fa-solid fa-circle-check" />Conectado</>)
                  : isConn ? (<><i className="fa-solid fa-circle-notch fa-spin" />Conectando…</>)
                    : (<><i className="fa-solid fa-link" />Conectar</>)}
              </button>
            </div>
          )
        })}
      </div>

      {!loading && (
        <div style={{ marginTop: 20, fontSize: 11, color: '#A6B0AC', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-shield-halved" style={{ color: '#3D7A6E' }} />
          Conexão via Open Finance regulado pelo Banco Central · seus dados são somente leitura.
        </div>
      )}
    </>
  )
}

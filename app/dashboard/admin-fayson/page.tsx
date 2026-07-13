'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string | null
  user_id: string | null
  plano: string
  trial_expira_em: string | null
  created_at: string
  dono_email: string | null
  dono_nome: string | null
}

export default function AdminFaysonPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email !== 'invest.fayson@gmail.com') {
        window.location.href = '/dashboard'
        return
      }
      setUserEmail(user.email)

      const { data } = await supabase.from('empresas').select('*').order('created_at', { ascending: false })
      const empresasComDono = (data || []).map(e => ({
        ...e,
        dono_email: e.user_id ? e.user_id : 'Sem dono',
        dono_nome: e.nome,
      }))
      setEmpresas(empresasComDono)
      setLoading(false)
    }
    void carregar()
  }, [])

  const calcularDiasRestantes = (expiraEm: string | null) => {
    if (!expiraEm) return null
    const dias = Math.ceil((new Date(expiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return dias > 0 ? dias : 0
  }

  async function estenderTrial(empresaId: string) {
    const novaData = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('empresas').update({ trial_expira_em: novaData }).eq('id', empresaId)
    if (error) {
      alert('Erro: ' + error.message)
    } else {
      window.location.reload()
    }
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Painel Admin — Fayson</h1>
        <div style={{ fontSize: 13, color: 'var(--mut)' }}>Logado como: {userEmail}</div>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div>
          <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--card)', borderRadius: 8, fontSize: 14 }}>
            Total de empresas: <strong>{empresas.length}</strong>
            {' | '}
            Em trial: <strong>{empresas.filter(e => e.plano === 'trial').length}</strong>
            {' | '}
            Pagos: <strong>{empresas.filter(e => e.plano !== 'trial').length}</strong>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Empresa</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Dono</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Plano</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Dias Restantes</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 13, fontWeight: 700 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map(e => {
                  const diasRest = calcularDiasRestantes(e.trial_expira_em)
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px', fontSize: 13 }}>{e.nome || '(sem nome)'}</td>
                      <td style={{ padding: '12px', fontSize: 13 }}>{e.dono_email || '(sem dono)'}</td>
                      <td style={{ padding: '12px', fontSize: 13 }}>
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: e.plano === 'trial' ? '#fef3c7' : '#E9F0ED', fontSize: 12, fontWeight: 600, color: e.plano === 'trial' ? '#B08A3E' : '#3D7A6E' }}>
                          {e.plano === 'trial' ? 'Trial 30d' : 'Pago'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: 13 }}>
                        {diasRest !== null ? (
                          <span style={{ color: diasRest < 5 ? '#B0413E' : 'inherit' }}>
                            {diasRest === 0 ? '⏰ Expirou' : `${diasRest}d`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '12px', fontSize: 13 }}>
                        {e.plano === 'trial' && diasRest !== null && (
                          <button
                            onClick={() => void estenderTrial(e.id)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              background: '#16A34A',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            +30 dias
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

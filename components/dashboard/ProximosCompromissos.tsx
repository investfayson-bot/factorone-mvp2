'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Atividade = {
  id: string; tipo: string; titulo: string; data: string
  hora_inicio: string | null; local: string | null
  clientes?: { nome: string } | null
}

const TIPO_ICON: Record<string, string> = { reuniao: 'fa-users', ligacao: 'fa-phone', email: 'fa-envelope', tarefa: 'fa-square-check', visita: 'fa-map-marker-alt', whatsapp: 'fa-comment', outro: 'fa-ellipsis' }

// Widget "mais visível" no Dashboard — próximos compromissos/tarefas do CRM,
// alimentado pelos mesmos agendamentos criados via app, WhatsApp ou Telegram.
export default function ProximosCompromissos({ empresaId }: { empresaId: string }) {
  const [itens, setItens] = useState<Atividade[]>([])
  const [loaded, setLoaded] = useState(false)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    const hoje = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('crm_atividades')
      .select('id,tipo,titulo,data,hora_inicio,local,clientes(nome)')
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .gte('data', hoje)
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true, nullsFirst: false })
      .limit(5)
    setItens((data ?? []) as unknown as Atividade[])
    setLoaded(true)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar])

  if (!loaded) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          <i className="fa-solid fa-calendar-days" style={{ marginRight: 7, color: 'var(--sage)' }} />Próximos compromissos
        </div>
        <Link href="/dashboard/crm?tab=agenda" style={{ fontSize: 11, color: 'var(--sage-deep)', fontWeight: 600, textDecoration: 'none' }}>Ver agenda →</Link>
      </div>

      {itens.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-mut)' }}>
          Nenhum compromisso agendado. Marque pelo CRM, ou peça pro assistente no WhatsApp/Telegram: <i>&quot;marca visita com [cliente] amanhã 14h&quot;</i>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {itens.map(a => (
            <Link key={a.id} href="/dashboard/crm?tab=agenda" style={{ textDecoration: 'none', display: 'flex', gap: 12, alignItems: 'center', padding: '8px 4px', borderRadius: 8, transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase' }}>
                  {new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(a.data + 'T12:00:00').getDate()}
                </div>
              </div>
              <i className={`fa-solid ${TIPO_ICON[a.tipo] || 'fa-circle'}`} style={{ fontSize: 12, color: 'var(--sage-deep)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>
                  {a.hora_inicio ? a.hora_inicio.slice(0, 5) : 'dia todo'}{a.clientes?.nome ? ` · ${a.clientes.nome}` : ''}{a.local ? ` · ${a.local}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Notif = {
  id: string
  tipo: 'vencimento' | 'orcamento' | 'conciliacao' | 'ai' | 'info'
  titulo: string
  mensagem: string
  href: string
  lida: boolean
  created_at: string
}

async function gerarNotificacoes(empresaId: string): Promise<Notif[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const notifs: Notif[] = []

  const [pagarRes, receberRes, txRes] = await Promise.all([
    supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento,status').eq('empresa_id', empresaId).lte('data_vencimento', em7dias).in('status', ['pendente', 'vencida']).order('data_vencimento').limit(5),
    supabase.from('contas_receber').select('id,descricao,valor,data_vencimento,status,dias_atraso').eq('empresa_id', empresaId).eq('status', 'vencida').limit(3),
    supabase.from('transacoes').select('id').eq('empresa_id', empresaId).is('categoria', null).limit(1),
  ])

  // Contas vencidas
  const vencidas = (pagarRes.data ?? []).filter(p => p.status === 'vencida')
  if (vencidas.length > 0) {
    notifs.push({
      id: 'vencidas-pagar',
      tipo: 'vencimento',
      titulo: `${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}`,
      mensagem: `Total: R$ ${vencidas.reduce((s, p) => s + Number(p.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      href: '/dashboard/financeiro?tab=pagar',
      lida: false,
      created_at: new Date().toISOString(),
    })
  }

  // Vence em 7 dias
  const proximas = (pagarRes.data ?? []).filter(p => p.status === 'pendente' && p.data_vencimento <= em7dias && p.data_vencimento >= hoje)
  if (proximas.length > 0) {
    notifs.push({
      id: 'vencendo-em-breve',
      tipo: 'vencimento',
      titulo: `${proximas.length} conta${proximas.length > 1 ? 's' : ''} vence${proximas.length > 1 ? 'm' : ''} em 7 dias`,
      mensagem: proximas[0]?.descricao ?? 'Ver lançamentos',
      href: '/dashboard/financeiro?tab=pagar',
      lida: false,
      created_at: new Date().toISOString(),
    })
  }

  // A receber vencidas
  if ((receberRes.data ?? []).length > 0) {
    notifs.push({
      id: 'receber-vencidas',
      tipo: 'vencimento',
      titulo: `${receberRes.data!.length} recebimento${receberRes.data!.length > 1 ? 's' : ''} em atraso`,
      mensagem: 'Clique para enviar cobranças',
      href: '/dashboard/financeiro?tab=receber',
      lida: false,
      created_at: new Date().toISOString(),
    })
  }

  // Transações sem categoria
  if ((txRes.data ?? []).length > 0) {
    notifs.push({
      id: 'sem-categoria',
      tipo: 'conciliacao',
      titulo: 'Transações sem categoria',
      mensagem: 'Classifique para o DRE ficar preciso',
      href: '/dashboard/conciliacao',
      lida: false,
      created_at: new Date().toISOString(),
    })
  }

  return notifs
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [lidas, setLidas] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id || user.id
      const n = await gerarNotificacoes(eid)
      setNotifs(n)
    })
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const naoLidas = notifs.filter(n => !lidas.has(n.id)).length

  function marcarTodas() {
    setLidas(new Set(notifs.map(n => n.id)))
  }

  const iconeTipo = {
    vencimento: { icon: 'fa-clock', bg: '#F3ECDA', color: '#B08A3E' },
    orcamento: { icon: 'fa-chart-pie', bg: '#F1ECE1', color: '#7B8C88' },
    conciliacao: { icon: 'fa-building-columns', bg: '#E6F1FB', color: '#3D6E8E' },
    ai: { icon: 'fa-robot', bg: '#E9F0ED', color: '#3D7A6E' },
    info: { icon: 'fa-circle-info', bg: '#F1ECE1', color: '#7B8C88' },
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: 34, height: 34, borderRadius: 9, border: '0.5px solid #E4DCCC', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
      >
        <i className="fa-solid fa-bell" style={{ fontSize: 14, color: naoLidas > 0 ? '#B08A3E' : '#7B8C88' }} />
        {naoLidas > 0 && (
          <div style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#B0413E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', border: '2px solid #fff' }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </div>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 42, right: 0, width: 320, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', fontFamily: "'Inter', sans-serif" }}>Notificações</div>
            {naoLidas > 0 && (
              <button onClick={marcarTodas} style={{ fontSize: 10, color: '#3D7A6E', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 12 }}>
              <i className="fa-solid fa-check-circle" style={{ fontSize: 24, color: '#3D7A6E', marginBottom: 8, display: 'block' }} />
              Tudo em dia! Sem alertas.
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.map(n => {
                const ic = iconeTipo[n.tipo]
                const isLida = lidas.has(n.id)
                return (
                  <Link key={n.id} href={n.href} onClick={() => { setLidas(l => { const next = new Set(l); next.add(n.id); return next }); setOpen(false) }} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: '0.5px solid #EFE9DC', background: isLida ? '#fff' : '#FAFCFB', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F7F4EE')}
                      onMouseLeave={e => (e.currentTarget.style.background = isLida ? '#fff' : '#FAFCFB')}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fa-solid ${ic.icon}`} style={{ fontSize: 13, color: ic.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: isLida ? 500 : 700, color: '#13201D', marginBottom: 2 }}>{n.titulo}</div>
                        <div style={{ fontSize: 11, color: '#7B8C88', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.mensagem}</div>
                      </div>
                      {!isLida && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3D7A6E', flexShrink: 0, marginTop: 6 }} />}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

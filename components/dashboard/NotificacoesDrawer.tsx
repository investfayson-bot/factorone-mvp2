'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Notif = {
  id: string
  titulo: string
  mensagem: string | null
  tipo: 'info' | 'sucesso' | 'aviso' | 'erro'
  modulo: string
  link: string | null
  lida: boolean
  created_at: string
}

const TIPO_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  info:    { color: 'var(--teal)',  bg: '#e0f2fe', icon: 'fa-circle-info' },
  sucesso: { color: 'var(--green)', bg: '#dcfce7', icon: 'fa-circle-check' },
  aviso:   { color: 'var(--gold)',  bg: '#fef3c7', icon: 'fa-triangle-exclamation' },
  erro:    { color: 'var(--red)',   bg: '#fee2e2', icon: 'fa-circle-xmark' },
}

export function useNotificacoes(empresaId: string) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!empresaId) return
    const { count: c } = await supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('lida', false)
    setCount(c ?? 0)
  }, [empresaId])

  useEffect(() => { void refresh() }, [refresh])
  return { count, refresh }
}

export default function NotificacoesDrawer({ empresaId, open, onClose, onRead }: {
  empresaId: string
  open: boolean
  onClose: () => void
  onRead: () => void
}) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && empresaId) void carregar()
  }, [open, empresaId])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs((data ?? []) as Notif[])
    setLoading(false)
  }

  async function marcarLida(id: string) {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, lida: true } : n))
    onRead()
  }

  async function marcarTodasLidas() {
    await supabase.from('notificacoes').update({ lida: true }).eq('empresa_id', empresaId).eq('lida', false)
    setNotifs(ns => ns.map(n => ({ ...n, lida: true })))
    onRead()
  }

  const naoLidas = notifs.filter(n => !n.lida).length

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        zIndex: 1001, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>Notificações</div>
            {naoLidas > 0 && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{naoLidas} não lida{naoLidas > 1 ? 's' : ''}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas} style={{ fontSize: 11, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Marcar todas como lidas
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--gray-400)' }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}><i className="fa-solid fa-spinner fa-spin" /></div>}
          {!loading && notifs.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
              <i className="fa-regular fa-bell" style={{ fontSize: 36, marginBottom: 12, display: 'block' }} />
              <div style={{ fontSize: 13 }}>Nenhuma notificação ainda</div>
            </div>
          )}
          {notifs.map(n => {
            const s = TIPO_STYLE[n.tipo] ?? TIPO_STYLE.info
            const content = (
              <div
                key={n.id}
                onClick={() => { if (!n.lida) void marcarLida(n.id) }}
                style={{
                  padding: '14px 20px', borderBottom: '1px solid #f1f5f9', cursor: n.lida ? 'default' : 'pointer',
                  background: n.lida ? '#fff' : 'rgba(0,168,150,.03)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <i className={`fa-solid ${s.icon}`} style={{ color: s.color, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.lida ? 400 : 600, color: 'var(--navy)', marginBottom: 2 }}>{n.titulo}</div>
                  {n.mensagem && <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.4 }}>{n.mensagem}</div>}
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {n.modulo !== 'sistema' && <span style={{ marginLeft: 6, background: '#f1f5f9', padding: '1px 5px', borderRadius: 10 }}>{n.modulo}</span>}
                  </div>
                </div>
                {!n.lida && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0, marginTop: 6 }} />}
              </div>
            )
            return n.link ? <Link key={n.id} href={n.link} style={{ textDecoration: 'none' }}>{content}</Link> : content
          })}
        </div>
      </div>
    </>
  )
}

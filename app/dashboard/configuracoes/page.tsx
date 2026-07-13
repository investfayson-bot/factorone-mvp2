'use client'

// Placeholder da Fase 1 — item novo na sidebar (MESTRE do pacote de reskin).
// Conteúdo real (senha, hierarquia, IA, cores) é escopo de uma fase futura;
// aqui só evita 404 no link do menu.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import FontSizeControl from '@/components/dashboard/FontSizeControl'

async function chamarSeed(action: 'seed' | 'clear' | 'reset') {
  const { data: sess } = await supabase.auth.getSession()
  const res = await fetch('/api/demo/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token ?? ''}` },
    body: JSON.stringify({ action }),
  })
  return await res.json() as { ok?: boolean; error?: string; inseridas?: Record<string, number> }
}

const LABEL_TABELA: Record<string, string> = {
  transacoes: 'Transações', contas_bancarias: 'Conta bancária', extrato: 'Extrato', cartoes: 'Cartão', investimentos: 'Investimentos',
  clientes: 'Clientes', oportunidades: 'Oportunidades (pipeline)', atividades: 'Atividades (follow-up)',
  conversas: 'Conversas', emails: 'E-mails',
}

function DadosDemonstracao() {
  const [rodando, setRodando] = useState<'seed' | 'clear' | 'reset' | ''>('')
  const [ultimoResultado, setUltimoResultado] = useState<Record<string, number> | null>(null)

  async function rodar(action: 'seed' | 'clear' | 'reset', confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setRodando(action)
    try {
      const d = await chamarSeed(action)
      if (!d.ok) { toast.error(d.error ?? 'Erro ao rodar'); return }
      if (action === 'seed') {
        setUltimoResultado(d.inseridas ?? null)
        toast.success('Dados de demonstração populados')
      } else if (action === 'clear') {
        setUltimoResultado(null)
        toast.success('Dados de demonstração removidos')
      } else {
        setUltimoResultado(null)
        toast.success('Tudo zerado')
      }
    } finally {
      setRodando('')
    }
  }

  return (
    <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: 24, marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Dados de demonstração</div>
      <div style={{ fontSize: 13, color: 'var(--mut, #7B8C88)', marginBottom: 16 }}>
        Sem banco real conectado ainda? Popula o sistema com dados simulados (transações, conta bancária,
        cartão, investimento, cliente + oportunidade + follow-up no CRM, uma conversa e um e-mail pendente)
        pra você testar as telas de ponta a ponta. Tudo marcado com <code>[demo]</code> — dá pra limpar sem
        afetar dado real.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-action" disabled={rodando !== ''} onClick={() => void rodar('seed')}>
          {rodando === 'seed' ? 'Populando...' : 'Popular dados de demonstração'}
        </button>
        <button className="btn-ghost" disabled={rodando !== ''} onClick={() => void rodar('clear')}>
          {rodando === 'clear' ? 'Limpando...' : 'Limpar dados de demonstração'}
        </button>
        <button
          className="btn-ghost"
          disabled={rodando !== ''}
          style={{ color: '#B0413E', borderColor: 'rgba(176,65,62,.3)' }}
          onClick={() => void rodar('reset', 'Isso apaga TODAS as transações e zera os saldos das contas — não só as de demo. Confirma?')}
        >
          {rodando === 'reset' ? 'Zerando...' : 'Zerar tudo'}
        </button>
      </div>
      {ultimoResultado && (
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft, #3C4A46)' }}>
          {Object.entries(ultimoResultado).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-block', marginRight: 14 }}>
              {LABEL_TABELA[k] ?? k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <div>
      <div className="page-hdr">
        <div>
          <div className="page-title">Configurações</div>
          <div className="page-sub">Senha, hierarquia, IA, cores e preferências gerais</div>
        </div>
      </div>
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--mut, #7B8C88)' }}>
        <i className="fa-solid fa-sliders" style={{ fontSize: 26, marginBottom: 12, display: 'block' }} />
        Em construção — chega numa fase futura do reskin.
      </div>
      <FontSizeControl />
      <DadosDemonstracao />
    </div>
  )
}

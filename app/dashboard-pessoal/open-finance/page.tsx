'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Conexao = { id: string; banco: string; status: string; ultimo_sync: string | null }

const BANCOS_SUPORTADOS = [
  { nome: 'Nubank', icon: '🟣', desc: 'Conta, cartão e investimentos' },
  { nome: 'Itaú', icon: '🟠', desc: 'Conta corrente e poupança' },
  { nome: 'Bradesco', icon: '🔴', desc: 'Conta corrente e cartão' },
  { nome: 'Banco do Brasil', icon: '🟡', desc: 'Conta corrente e poupança' },
  { nome: 'Santander', icon: '🔴', desc: 'Conta corrente e cartão' },
  { nome: 'Inter', icon: '🟠', desc: 'Conta digital e investimentos' },
  { nome: 'C6 Bank', icon: '⚫', desc: 'Conta digital e cartão' },
  { nome: 'XP Investimentos', icon: '🔵', desc: 'Carteira de investimentos' },
]

export default function OpenFinancePage() {
  const [userId, setUserId] = useState('')
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [temPluggyKey, setTemPluggyKey] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('open_finance_conexoes').select('*').eq('user_id', user.id)
      setConexoes((data ?? []) as Conexao[])
      // Verifica se Pluggy está configurado (via env var no servidor)
      const res = await fetch('/api/pf/open-finance/status')
      if (res.ok) { const d = await res.json() as { configurado: boolean }; setTemPluggyKey(d.configurado) }
    })
  }, [])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Open Finance</div>
          <div className="page-sub">Conecte seus bancos e veja tudo em um lugar</div>
        </div>
      </div>

      {/* Status Pluggy */}
      {!temPluggyKey ? (
        <div style={{ background: 'linear-gradient(90deg, var(--navy) 0%, #1e3a5f 100%)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <i className="fa-solid fa-plug" style={{ fontSize: 28, color: "var(--gray-300)", display: "block" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Open Finance via Pluggy</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 16 }}>
                Para conectar seus bancos automaticamente, configure a chave da API Pluggy no Vercel.
                O Pluggy é o agregador Open Finance mais completo do Brasil — suporta +200 instituições.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '1. Crie conta em pluggy.ai (plano gratuito disponível)',
                  '2. Gere suas chaves de API no dashboard Pluggy',
                  '3. No Vercel: Settings → Environment Variables',
                  '4. Adicione: PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET',
                ].map(step => (
                  <div key={step} style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--teal)', fontWeight: 700 }}>→</span> {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(45,155,111,.08)', border: '1px solid rgba(45,155,111,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--teal)', fontWeight: 600 }}>
          ✓ Pluggy configurado — você pode conectar seus bancos abaixo
        </div>
      )}

      {/* Conexões ativas */}
      {conexoes.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Bancos conectados</div>
          {conexoes.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{c.banco}</span>
              <span className={`tag ${c.status === 'ativo' ? 'green' : 'gray'}`}>{c.status}</span>
              <span style={{ color: 'var(--gray-400)' }}>{c.ultimo_sync ? `Sync: ${new Date(c.ultimo_sync).toLocaleDateString('pt-BR')}` : 'Nunca sincronizado'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bancos disponíveis */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Instituições disponíveis</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 16 }}>+200 bancos e fintechs via Open Finance Brasil</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {BANCOS_SUPORTADOS.map(b => (
            <div key={b.nome} style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{b.nome}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{b.desc}</div>
              </div>
              {temPluggyKey ? (
                <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 8px' }}>Conectar</button>
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--gray-400)', fontWeight: 600 }}>API KEY</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Score Serasa */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Score de Crédito Serasa</div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#7C3AED', color: '#fff' }}>EM BREVE</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Consulte seu score sem sair do FactorOne — integração via Serasa Experian API</div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', border: '6px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: 'var(--gray-400)' }}>?</div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>Seu score</div>
          </div>
          <div style={{ flex: 1 }}>
            {[
              { range: '0–300', label: 'Muito baixo', cor: 'var(--red)' },
              { range: '301–500', label: 'Baixo', cor: 'var(--gold)' },
              { range: '501–700', label: 'Regular', cor: '#f59e0b' },
              { range: '701–900', label: 'Bom', cor: 'var(--teal)' },
              { range: '901–1000', label: 'Excelente', cor: 'var(--green)' },
            ].map(s => (
              <div key={s.range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.cor }} />
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.range}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--gray-400)' }}>
          Configure <code style={{ background: 'var(--gray-100)', padding: '1px 4px', borderRadius: 4 }}>SERASA_API_KEY</code> no Vercel para ativar.
        </div>
      </div>
    </>
  )
}

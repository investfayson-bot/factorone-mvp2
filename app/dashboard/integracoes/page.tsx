'use client'
import React from 'react'
export const dynamic = 'force-dynamic'
export default function IntegracoesPage() {
  const integrations = [
    { n:'Swap Corpway', c:'BaaS / Cartões', ic:'💳', ok:true, d:'Conta PJ + cartões corporativos' },
    { n:'Celcoin', c:'BaaS / Pagamentos', ic:'⚡', ok:true, d:'PIX, boleto, TED' },
    { n:'Claude API', c:'AI Engine', ic:'🧠', ok:true, d:'Motor do AI CFO' },
    { n:'Stripe', c:'Billing', ic:'💰', ok:true, d:'Cobrança de assinaturas' },
    { n:'Remessa Online', c:'Câmbio / USD', ic:'🌐', ok:false, d:'Conta Global em dólar' },
    { n:'Open Finance', c:'Dados bancários', ic:'🏦', ok:false, d:'Conexão com bancos' },
    { n:'NFe.io', c:'Notas Fiscais', ic:'🧾', ok:false, d:'Emissão automática NF-e' },
    { n:'QuickBooks', c:'Contabilidade', ic:'📊', ok:false, d:'Sync contábil' },
    { n:'HubSpot', c:'CRM', ic:'🔶', ok:false, d:'Pipeline de vendas' },
    { n:'Google Ads', c:'Marketing', ic:'📢', ok:false, d:'Controle de gastos em ads' },
    { n:'Meta Ads', c:'Marketing', ic:'📘', ok:false, d:'Facebook e Instagram' },
    { n:'Omie ERP', c:'ERP', ic:'🗄️', ok:false, d:'Sync contábil automático' },
  ]

  const S = { card: { background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:16 } as any }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:18, fontWeight:700, fontFamily:'Sora,sans-serif', margin:0 }}>Integrações</h1>
        <p style={{ fontSize:11, color:'#7A9290', fontFamily:'monospace', margin:0 }}>
          {integrations.filter(i=>i.ok).length} ativas · {integrations.filter(i=>!i.ok).length} disponíveis
        </p>
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Conectadas</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
          {integrations.filter(i=>i.ok).map(int=>(
            <div key={int.n} style={{ ...S.card, borderColor:'rgba(34,201,122,.3)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{int.ic}</span>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'rgba(34,201,122,.15)', color:'#22C97A', fontFamily:'monospace' }}>Ativo</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'#E4E8E7', marginBottom:2 }}>{int.n}</div>
              <div style={{ fontSize:11, color:'#7A9290', marginBottom:8 }}>{int.d}</div>
              <div style={{ fontSize:10, color:'#4A6260', fontFamily:'monospace' }}>{int.c}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Disponíveis para conectar</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
          {integrations.filter(i=>!i.ok).map(int=>(
            <div key={int.n} style={S.card}>
              <div style={{ fontSize:22, marginBottom:8 }}>{int.ic}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#E4E8E7', marginBottom:2 }}>{int.n}</div>
              <div style={{ fontSize:11, color:'#7A9290', marginBottom:10 }}>{int.d}</div>
              <div style={{ fontSize:10, color:'#4A6260', fontFamily:'monospace', marginBottom:10 }}>{int.c}</div>
              <button style={{ width:'100%', padding:'7px 0', background:'#C8F135', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', color:'#000' }}
                onClick={()=>alert('Em breve! Entre em contato: contato@factorone.com.br')}>
                + Conectar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

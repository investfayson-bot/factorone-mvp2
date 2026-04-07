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

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Integrações</h1>
        <p className="text-sm text-slate-500">
          {integrations.filter(i=>i.ok).length} ativas · {integrations.filter(i=>!i.ok).length} disponíveis
        </p>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Conectadas</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {integrations.filter(i=>i.ok).map(int=>(
            <div key={int.n} className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span style={{ fontSize:22 }}>{int.ic}</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-semibold">Ativo</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 mb-1">{int.n}</div>
              <div className="text-sm text-slate-500 mb-2">{int.d}</div>
              <div className="text-xs text-slate-400">{int.c}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Disponíveis para conectar</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {integrations.filter(i=>!i.ok).map(int=>(
            <div key={int.n} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
              <div style={{ fontSize:22 }} className="mb-2">{int.ic}</div>
              <div className="text-sm font-semibold text-slate-800 mb-1">{int.n}</div>
              <div className="text-sm text-slate-500 mb-3">{int.d}</div>
              <div className="text-xs text-slate-400 mb-3">{int.c}</div>
              <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all w-full"
                onClick={() => alert('Em breve! Entre em contato: contato@factorone.com.br')}>
                + Conectar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

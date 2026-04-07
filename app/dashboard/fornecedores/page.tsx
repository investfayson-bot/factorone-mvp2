'use client'
import React from 'react'
export const dynamic = 'force-dynamic'
export default function FornecedoresPage() {
  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:18, fontWeight:700, fontFamily:'Sora,sans-serif', margin:0 }}>Fornecedores & Pagamentos</h1>
        <p style={{ fontSize:11, color:'#7A9290', fontFamily:'monospace', margin:0 }}>Gestão de contas a pagar</p>
      </div>
      <div style={{ background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:40, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🏢</div>
        <div style={{ fontSize:16, fontWeight:600, fontFamily:'Sora,sans-serif', marginBottom:8, color:'#E4E8E7' }}>Módulo em desenvolvimento</div>
        <div style={{ fontSize:13, color:'#7A9290', maxWidth:400, margin:'0 auto', lineHeight:1.6 }}>
          Gestão de fornecedores, contas a pagar e pagamentos via PIX/TED estarão disponíveis na próxima versão do MVP.
        </div>
      </div>
    </div>
  )
}

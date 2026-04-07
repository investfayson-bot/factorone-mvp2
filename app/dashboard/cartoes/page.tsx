'use client'
import React from 'react'
export const dynamic = 'force-dynamic'
export default function CartoesPage() {
  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:18, fontWeight:700, fontFamily:'Sora,sans-serif', margin:0 }}>Cartões Corporativos</h1>
        <p style={{ fontSize:11, color:'#7A9290', fontFamily:'monospace', margin:0 }}>Powered by Swap Corpway</p>
      </div>
      <div style={{ background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:40, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
        <div style={{ fontSize:16, fontWeight:600, fontFamily:'Sora,sans-serif', marginBottom:8, color:'#E4E8E7' }}>Cartões em breve</div>
        <div style={{ fontSize:13, color:'#7A9290', maxWidth:400, margin:'0 auto 20px', lineHeight:1.6 }}>
          A integração com Swap Corpway para emissão de cartões corporativos virtuais e físicos estará disponível na próxima versão.
        </div>
        <a href="mailto:contato@factorone.com.br?subject=Interesse em Cartões Corporativos"
          style={{ padding:'10px 24px', background:'#C8F135', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#000', textDecoration:'none', display:'inline-block' }}>
          Solicitar acesso antecipado →
        </a>
      </div>
    </div>
  )
}

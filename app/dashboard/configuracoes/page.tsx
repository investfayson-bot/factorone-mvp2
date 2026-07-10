'use client'

// Placeholder da Fase 1 — item novo na sidebar (MESTRE do pacote de reskin).
// Conteúdo real (senha, hierarquia, IA, cores) é escopo de uma fase futura;
// aqui só evita 404 no link do menu.

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
    </div>
  )
}

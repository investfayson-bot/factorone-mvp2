'use client'

const PORTAIS = [
  {
    grupo: 'Receita Federal',
    cor: '#13201D', corBg: '#E9F0ED',
    icone: 'fa-landmark',
    items: [
      { nome: 'e-CAC', desc: 'Centro Virtual de Atendimento — emissão de certidões, parcelamentos, procurações', url: 'https://cav.receita.fazenda.gov.br', tag: 'Essencial' },
      { nome: 'Simples Nacional', desc: 'Consulta DAS, histórico de pagamentos, desenquadramento e opção pelo Simples', url: 'https://www8.receita.fazenda.gov.br/simplesnacional', tag: 'MEI/ME' },
      { nome: 'Consulta CNPJ', desc: 'Situação cadastral, QSA, natureza jurídica e atividade principal', url: 'https://www.receita.fazenda.gov.br/pessoajuridica/cnpj/cnpjreva/cnpjrevareva.asp', tag: 'Consulta' },
      { nome: 'PGFNDigital', desc: 'Regularização de débitos com a Procuradoria Geral da Fazenda Nacional', url: 'https://www.regularize.pgfn.gov.br', tag: 'Débitos' },
    ],
  },
  {
    grupo: 'SEFAZ — Notas Fiscais',
    cor: '#13201D', corBg: '#E9F0ED',
    icone: 'fa-file-invoice-dollar',
    items: [
      { nome: 'NF-e Nacional (SVRS)', desc: 'Emissão, consulta e cancelamento de NF-e — Sefaz Virtual', url: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx', tag: 'NF-e' },
      { nome: 'NFS-e Nacional', desc: 'Emissão e consulta de Nota Fiscal de Serviço eletrônica', url: 'https://www.nfse.gov.br', tag: 'NFS-e' },
      { nome: 'CT-e', desc: 'Conhecimento de Transporte eletrônico', url: 'https://www.cte.fazenda.gov.br', tag: 'Transporte' },
      { nome: 'SINTEGRA', desc: 'Situação cadastral ICMS estadual para fornecedores e clientes', url: 'http://www.sintegra.gov.br', tag: 'ICMS' },
    ],
  },
  {
    grupo: 'eSocial & Trabalhista',
    cor: '#13201D', corBg: '#E9F0ED',
    icone: 'fa-users',
    items: [
      { nome: 'eSocial', desc: 'Admissões, desligamentos, folha de pagamento e obrigações trabalhistas', url: 'https://www.esocial.gov.br', tag: 'RH' },
      { nome: 'FGTS Digital', desc: 'Geração e pagamento de guias do FGTS mensalmente', url: 'https://www.fgtsdigital.com.br', tag: 'FGTS' },
      { nome: 'CAGED', desc: 'Declaração de admissões e desligamentos de trabalhadores celetistas', url: 'https://empregabrasil.mte.gov.br', tag: 'Emprego' },
    ],
  },
  {
    grupo: 'Certidões & Regularidade',
    cor: '#13201D', corBg: '#E9F0ED',
    icone: 'fa-file-shield',
    items: [
      { nome: 'CND Federal (Receita + PGFN)', desc: 'Certidão Negativa de Débitos Federais — válida para licitações e financiamentos', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir', tag: 'Certidão' },
      { nome: 'CRF — FGTS', desc: 'Certidão de Regularidade do FGTS junto à Caixa Econômica Federal', url: 'https://consulta-crf.caixa.gov.br', tag: 'FGTS' },
      { nome: 'CND Estadual (MG)', desc: 'Certidão Negativa de Débitos Estaduais — SEFAZ MG', url: 'https://www.fazenda.mg.gov.br', tag: 'Estadual' },
      { nome: 'SERASA Experian PJ', desc: 'Consulta de score e situação creditícia da empresa', url: 'https://www.serasaexperian.com.br/solucoes/consulta-cnpj/', tag: 'Crédito' },
    ],
  },
  {
    grupo: 'Outros portais úteis',
    cor: '#13201D', corBg: '#E9F0ED',
    icone: 'fa-globe',
    items: [
      { nome: 'gov.br — Empresas', desc: 'Portal central do governo federal para serviços empresariais', url: 'https://www.gov.br/empresas-e-negocios/pt-br', tag: 'Portal' },
      { nome: 'REDESIM', desc: 'Abertura, alteração e encerramento de empresas', url: 'https://redesim.gov.br', tag: 'Abertura' },
      { nome: 'Portal do Empreendedor (MEI)', desc: 'Emissão de DAS, CCMEI, relatório anual e certificado MEI', url: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor', tag: 'MEI' },
      { nome: 'JUCESP / JUCEMG', desc: 'Junta Comercial — registros, alterações e certidões', url: 'https://www.jucemg.mg.gov.br', tag: 'Registro' },
    ],
  },
]

function tagColor(tag: string) {
  const m: Record<string, { bg: string; color: string }> = {
    Essencial: { bg: '#E9F0ED', color: '#2B564D' },
    'MEI/ME': { bg: '#EAF3DE', color: '#3B6D11' },
    Consulta: { bg: '#E6F1FB', color: '#185FA5' },
    Débitos: { bg: '#F4E4E1', color: '#B0413E' },
    'NF-e': { bg: '#E9F0ED', color: '#2B564D' },
    'NFS-e': { bg: '#E9F0ED', color: '#2B564D' },
    Transporte: { bg: '#F1EFE8', color: '#5F5E5A' },
    ICMS: { bg: '#F3ECDA', color: '#B08A3E' },
    RH: { bg: '#EEEDFE', color: '#3C3489' },
    FGTS: { bg: '#EAF3DE', color: '#3B6D11' },
    Emprego: { bg: '#E6F1FB', color: '#185FA5' },
    Certidão: { bg: '#E9F0ED', color: '#2B564D' },
    Estadual: { bg: '#F1EFE8', color: '#5F5E5A' },
    Crédito: { bg: '#F4E4E1', color: '#B0413E' },
    Portal: { bg: '#13201D', color: '#6FA595' },
    Abertura: { bg: '#EAF3DE', color: '#3B6D11' },
    MEI: { bg: '#EAF3DE', color: '#3B6D11' },
    Registro: { bg: '#F1EFE8', color: '#5F5E5A' },
  }
  return m[tag] ?? { bg: '#F7F4EE', color: '#3C4A46' }
}

export default function FiscalPortaisPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-hdr">
        <div>
          <div className="page-title">Portais Fiscais & Gov.br</div>
          <div className="page-sub">Acesso rápido aos principais portais do governo federal e estadual</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E9F0ED', color: '#2B564D', fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 600 }}>
          <i className="fa-solid fa-link" style={{ fontSize: 12 }} />Links verificados
        </div>
      </div>

      {/* Banner */}
      <div style={{ background: '#13201D', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(61,122,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fa-solid fa-shield-halved" style={{ fontSize: 20, color: '#6FA595' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Fase 2 — Integração com Certificado Digital A1</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Em breve: faça upload do seu certificado A1 e o FactorOne buscará DAS, certidões e situação fiscal automaticamente — sem precisar entrar em cada portal.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 12, background: 'rgba(61,122,110,0.2)', color: '#6FA595', padding: '4px 12px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>Em breve</div>
        </div>
      </div>

      {/* Grupos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PORTAIS.map(grupo => (
          <div key={grupo.grupo} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', gap: 10, background: '#FBF8F1' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#13201D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa-solid ${grupo.icone}`} style={{ fontSize: 15, color: '#6FA595' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D' }}>{grupo.grupo}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {grupo.items.map((item, idx) => {
                const tc = tagColor(item.tag)
                const isLast = idx >= grupo.items.length - 2
                const isRight = idx % 2 === 1
                return (
                  <a key={item.nome} href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s',
                      borderBottom: isLast ? 'none' : '0.5px solid #EFE9DC',
                      borderRight: isRight ? 'none' : '0.5px solid #EFE9DC',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FBF8F1')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#13201D' }}>{item.nome}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: tc.bg, color: tc.color, marginLeft: 'auto', flexShrink: 0 }}>{item.tag}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 11, color: '#A6B0AC', flexShrink: 0 }} />
                      </div>
                      <div style={{ fontSize: 13, color: '#7B8C88', lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: '#A6B0AC', marginTop: 16 }}>
        Links externos — o FactorOne não se responsabiliza pela disponibilidade dos portais governamentais
      </div>
    </div>
  )
}

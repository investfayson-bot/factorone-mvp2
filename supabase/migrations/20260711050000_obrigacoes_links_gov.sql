-- Fase 5, Bloco 3 — Obrigações: link direto pro Gov.br/e-CAC por tipo de
-- obrigação (pedido explícito do dono do produto: não é login único via
-- Gov.br, só um atalho pra página oficial certa, configurável sem deploy).
--
-- Tabela de referência global (não é por empresa) — mesmos links servem
-- todo mundo. Leitura pra qualquer autenticado; escrita só via migration/
-- service role por enquanto (não há tela de admin pra isso ainda).

CREATE TABLE IF NOT EXISTS public.links_governamentais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_obrigacao text NOT NULL,
  nome           text NOT NULL,
  url            text NOT NULL,
  descricao      text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_gov_tipo ON public.links_governamentais (tipo_obrigacao);
CREATE UNIQUE INDEX IF NOT EXISTS uq_links_gov_tipo_nome ON public.links_governamentais (tipo_obrigacao, nome);

ALTER TABLE public.links_governamentais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "links_gov_select" ON public.links_governamentais;
CREATE POLICY "links_gov_select" ON public.links_governamentais
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.links_governamentais (tipo_obrigacao, nome, url, descricao) VALUES
  ('DAS',    'Simples Nacional — emissão de guia', 'https://www8.receita.fazenda.gov.br/simplesnacional', 'Consulta DAS, histórico de pagamentos e opção pelo Simples'),
  ('DCTF',   'e-CAC — DCTFWeb', 'https://cav.receita.fazenda.gov.br', 'Declaração e consulta de débitos e créditos tributários federais'),
  ('SPED',   'Sped — Sistema Público de Escrituração Digital', 'https://sped.rfb.gov.br', 'Transmissão e consulta de escriturações do Sped'),
  ('EFD',    'Sped — EFD-Contribuições', 'https://sped.rfb.gov.br/pasta/show/1573', 'Escrituração Fiscal Digital das Contribuições'),
  ('GIA',    'SINTEGRA — situação cadastral ICMS', 'http://www.sintegra.gov.br', 'Guia de Informação e Apuração do ICMS'),
  ('ISS',    'gov.br — Empresas', 'https://www.gov.br/empresas-e-negocios/pt-br', 'ISS é municipal — consulte o portal da prefeitura da sua cidade'),
  ('ICMS',   'SINTEGRA — situação cadastral ICMS', 'http://www.sintegra.gov.br', 'Situação cadastral ICMS estadual'),
  ('eSocial','eSocial', 'https://www.esocial.gov.br', 'Admissões, desligamentos, folha e obrigações trabalhistas'),
  ('FGTS',   'FGTS Digital', 'https://www.fgtsdigital.com.br', 'Geração e pagamento de guias do FGTS'),
  ('Outro',  'e-CAC — Centro Virtual de Atendimento', 'https://cav.receita.fazenda.gov.br', 'Certidões, parcelamentos, procurações e consultas gerais')
ON CONFLICT (tipo_obrigacao, nome) DO NOTHING;

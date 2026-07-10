-- Sprint Patrimônio B4 — Imóveis
-- Rode no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.imoveis_detalhes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id            uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id          uuid NOT NULL,
  tipo_imovel         text CHECK (tipo_imovel IN ('comercial','residencial','rural','terreno','industrial')) DEFAULT 'comercial',
  area_m2             decimal(10,2),
  endereco            text,
  cep                 text,
  cidade              text,
  estado              text,
  matricula           text,
  escritura_url       text,
  valor_venal         decimal(15,2),
  valor_iptu          decimal(12,2) DEFAULT 0,
  iptu_vencimento     date,
  iptu_pago           boolean DEFAULT false,
  alugado             boolean DEFAULT false,
  inquilino           text,
  valor_aluguel       decimal(15,2) DEFAULT 0,
  contrato_inicio     date,
  contrato_vencimento date,
  administradora      text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(ativo_id)
);
ALTER TABLE public.imoveis_detalhes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imoveis_detalhes_rls" ON public.imoveis_detalhes;
CREATE POLICY "imoveis_detalhes_rls" ON public.imoveis_detalhes FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_imoveis_detalhes_ativo ON public.imoveis_detalhes(ativo_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_detalhes_empresa ON public.imoveis_detalhes(empresa_id);

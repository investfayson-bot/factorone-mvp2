-- Sprint Patrimônio B1+B2+B3 — Lifecycle, Frota, Máquinas
-- Rode no SQL Editor do Supabase

-- 1. Extend ativos with frota/máquina fields
ALTER TABLE public.ativos
  ADD COLUMN IF NOT EXISTS tipo_ativo text DEFAULT 'outros',
  ADD COLUMN IF NOT EXISTS placa text,
  ADD COLUMN IF NOT EXISTS renavam text,
  ADD COLUMN IF NOT EXISTS chassi text,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS ano_fabricacao int,
  ADD COLUMN IF NOT EXISTS km_atual decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_operacao decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro_vencimento date,
  ADD COLUMN IF NOT EXISTS ipva_vencimento date,
  ADD COLUMN IF NOT EXISTS valor_fipe decimal(15,2),
  ADD COLUMN IF NOT EXISTS taxa_depreciacao_anual decimal(5,2);

-- Add tipo_ativo check constraint (safe even if column existed)
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_tipo_ativo_check;
ALTER TABLE public.ativos ADD CONSTRAINT ativos_tipo_ativo_check
  CHECK (tipo_ativo IN ('veiculo_leve','veiculo_pesado','imovel','maquina','equipamento','movel','outros'));

-- Expand status to include sucateado
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_status_check;
ALTER TABLE public.ativos ADD CONSTRAINT ativos_status_check
  CHECK (status IN ('ativo','em_manutencao','baixado','alienado','perdido','sucateado'));

-- 2. frota_abastecimentos
CREATE TABLE IF NOT EXISTS public.frota_abastecimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id        uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL,
  data            date NOT NULL DEFAULT CURRENT_DATE,
  km_atual        decimal(12,2),
  litros          decimal(8,3) NOT NULL,
  valor_total     decimal(15,2) NOT NULL,
  preco_litro     decimal(8,3),
  posto           text,
  combustivel     text CHECK (combustivel IN ('diesel','gasolina','etanol','gnv','eletrico')) DEFAULT 'diesel',
  nota_fiscal_url text,
  observacao      text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.frota_abastecimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frota_abastecimentos_rls" ON public.frota_abastecimentos;
CREATE POLICY "frota_abastecimentos_rls" ON public.frota_abastecimentos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 3. frota_itinerarios
CREATE TABLE IF NOT EXISTS public.frota_itinerarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id        uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL,
  data            date NOT NULL DEFAULT CURRENT_DATE,
  origem          text,
  destino         text,
  km_percorrido   decimal(10,2),
  km_inicial      decimal(12,2),
  km_final        decimal(12,2),
  valor_frete     decimal(15,2) DEFAULT 0,
  motorista       text,
  carga           text,
  nota_fiscal_url text,
  status          text CHECK (status IN ('planejado','em_rota','concluido','cancelado')) DEFAULT 'planejado',
  observacao      text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.frota_itinerarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frota_itinerarios_rls" ON public.frota_itinerarios;
CREATE POLICY "frota_itinerarios_rls" ON public.frota_itinerarios FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 4. patrimonio_manutencoes (richer than manutencoes_ativo)
CREATE TABLE IF NOT EXISTS public.patrimonio_manutencoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id          uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id        uuid NOT NULL,
  tipo              text CHECK (tipo IN ('preventiva','corretiva','calibracao','vistoria','seguro','ipva','outros')) DEFAULT 'corretiva',
  descricao         text,
  data              date NOT NULL DEFAULT CURRENT_DATE,
  km_ou_horas       decimal(12,2),
  valor             decimal(15,2) DEFAULT 0,
  oficina           text,
  nota_fiscal_url   text,
  proxima_data      date,
  proximos_km_horas decimal(12,2),
  concluida         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE public.patrimonio_manutencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patrimonio_manutencoes_rls" ON public.patrimonio_manutencoes;
CREATE POLICY "patrimonio_manutencoes_rls" ON public.patrimonio_manutencoes FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 5. maquinas_operacao
CREATE TABLE IF NOT EXISTS public.maquinas_operacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id    uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL,
  data        date NOT NULL DEFAULT CURRENT_DATE,
  horas_inicio decimal(10,2) NOT NULL,
  horas_fim    decimal(10,2) NOT NULL,
  operador    text,
  producao    text,
  custo_hora  decimal(10,2) DEFAULT 0,
  observacao  text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.maquinas_operacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "maquinas_operacao_rls" ON public.maquinas_operacao;
CREATE POLICY "maquinas_operacao_rls" ON public.maquinas_operacao FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 6. patrimonio_documentos
CREATE TABLE IF NOT EXISTS public.patrimonio_documentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id     uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL,
  tipo         text CHECK (tipo IN ('nota_entrada','escritura','laudo','seguro','ipva','crlv','licenca','outro')) DEFAULT 'outro',
  nome         text NOT NULL,
  url          text,
  extraido_ocr jsonb,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.patrimonio_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patrimonio_documentos_rls" ON public.patrimonio_documentos;
CREATE POLICY "patrimonio_documentos_rls" ON public.patrimonio_documentos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_frota_abastecimentos_ativo ON public.frota_abastecimentos(ativo_id);
CREATE INDEX IF NOT EXISTS idx_frota_abastecimentos_empresa ON public.frota_abastecimentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_frota_itinerarios_ativo ON public.frota_itinerarios(ativo_id);
CREATE INDEX IF NOT EXISTS idx_frota_itinerarios_empresa ON public.frota_itinerarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_manutencoes_ativo ON public.patrimonio_manutencoes(ativo_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_manutencoes_empresa ON public.patrimonio_manutencoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_maquinas_operacao_ativo ON public.maquinas_operacao(ativo_id);
CREATE INDEX IF NOT EXISTS idx_maquinas_operacao_empresa ON public.maquinas_operacao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ativos_tipo ON public.ativos(tipo_ativo);

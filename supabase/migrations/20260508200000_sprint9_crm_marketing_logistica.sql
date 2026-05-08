-- Sprint 9 — CRM, Clientes, Fornecedores, Marketing, Logística
-- Rode no SQL Editor do Supabase

-- ── CLIENTES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  nome            text NOT NULL,
  tipo            text CHECK (tipo IN ('pj','pf')) DEFAULT 'pj',
  cnpj_cpf        text,
  email           text,
  telefone        text,
  whatsapp        text,
  website         text,
  segmento        text,
  responsavel_id  uuid,
  responsavel_nome text,
  status          text CHECK (status IN ('prospect','ativo','inativo','churned')) DEFAULT 'prospect',
  origem          text,
  notas           text,
  endereco        text,
  cidade          text,
  estado          text,
  cep             text,
  valor_contrato  decimal(15,2),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_rls" ON public.clientes;
CREATE POLICY "clientes_rls" ON public.clientes FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes(empresa_id);

-- Contatos do cliente
CREATE TABLE IF NOT EXISTS public.clientes_contatos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  cliente_id  uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  cargo       text,
  email       text,
  telefone    text,
  whatsapp    text,
  principal   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_contatos_rls" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_rls" ON public.clientes_contatos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- ── FORNECEDORES (cadastro standalone) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  razao_social    text NOT NULL,
  nome_fantasia   text,
  cnpj            text,
  email           text,
  telefone        text,
  whatsapp        text,
  website         text,
  categoria       text DEFAULT 'Fornecedores',
  contato_nome    text,
  contato_cargo   text,
  endereco        text,
  cidade          text,
  estado          text,
  cep             text,
  tipo_pagamento_pref text DEFAULT 'pix',
  chave_pix       text,
  banco           text,
  agencia         text,
  conta           text,
  digito          text,
  prazo_pagamento int DEFAULT 30,
  status          text CHECK (status IN ('ativo','inativo','bloqueado')) DEFAULT 'ativo',
  avaliacao       int CHECK (avaliacao BETWEEN 1 AND 5),
  notas           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fornecedores_rls" ON public.fornecedores;
CREATE POLICY "fornecedores_rls" ON public.fornecedores FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa ON public.fornecedores(empresa_id);

-- ── CRM ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  valor           decimal(15,2),
  etapa           text CHECK (etapa IN ('prospeccao','qualificado','proposta','negociacao','fechado_ganho','fechado_perdido')) DEFAULT 'prospeccao',
  probabilidade   int CHECK (probabilidade BETWEEN 0 AND 100) DEFAULT 20,
  data_fechamento date,
  responsavel_id  uuid,
  responsavel_nome text,
  descricao       text,
  motivo_perda    text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_oportunidades_rls" ON public.crm_oportunidades;
CREATE POLICY "crm_oportunidades_rls" ON public.crm_oportunidades FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_op_empresa ON public.crm_oportunidades(empresa_id);

CREATE TABLE IF NOT EXISTS public.crm_atividades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  tipo            text CHECK (tipo IN ('reuniao','ligacao','email','tarefa','visita','whatsapp','outro')) DEFAULT 'tarefa',
  titulo          text NOT NULL,
  descricao       text,
  data            date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio     time,
  hora_fim        time,
  local           text,
  status          text CHECK (status IN ('pendente','realizada','cancelada')) DEFAULT 'pendente',
  responsavel_id  uuid,
  responsavel_nome text,
  lembrete        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_atividades_rls" ON public.crm_atividades;
CREATE POLICY "crm_atividades_rls" ON public.crm_atividades FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_atv_empresa ON public.crm_atividades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_crm_atv_data ON public.crm_atividades(data);

-- ── MARKETING ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_campanhas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  tipo        text CHECK (tipo IN ('google_ads','meta_ads','email','seo','social','outro')) DEFAULT 'outro',
  status      text CHECK (status IN ('rascunho','ativa','pausada','concluida','cancelada')) DEFAULT 'rascunho',
  orcamento   decimal(15,2),
  gasto       decimal(15,2) DEFAULT 0,
  impressoes  int DEFAULT 0,
  cliques     int DEFAULT 0,
  conversoes  int DEFAULT 0,
  receita_gerada decimal(15,2) DEFAULT 0,
  data_inicio date,
  data_fim    date,
  url_destino text,
  notas       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_campanhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mkt_campanhas_rls" ON public.marketing_campanhas;
CREATE POLICY "mkt_campanhas_rls" ON public.marketing_campanhas FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_conteudo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  titulo      text NOT NULL,
  tipo        text CHECK (tipo IN ('post_instagram','post_linkedin','blog','video','email','story','reel','outro')) DEFAULT 'post_instagram',
  status      text CHECK (status IN ('ideia','producao','revisao','agendado','publicado','cancelado')) DEFAULT 'ideia',
  data_pub    date,
  hora_pub    time,
  canal       text,
  copy        text,
  url_midia   text,
  responsavel text,
  campanha_id uuid REFERENCES public.marketing_campanhas(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_conteudo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mkt_conteudo_rls" ON public.marketing_conteudo;
CREATE POLICY "mkt_conteudo_rls" ON public.marketing_conteudo FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text,
  email       text,
  telefone    text,
  origem      text,
  campanha_id uuid REFERENCES public.marketing_campanhas(id) ON DELETE SET NULL,
  status      text CHECK (status IN ('novo','contato','qualificado','convertido','perdido')) DEFAULT 'novo',
  cliente_id  uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  notas       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mkt_leads_rls" ON public.marketing_leads;
CREATE POLICY "mkt_leads_rls" ON public.marketing_leads FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- ── LOGÍSTICA ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistica_rotas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  codigo          text,
  origem          text NOT NULL,
  destino         text NOT NULL,
  distancia_km    decimal(10,2),
  tempo_estimado  int, -- minutos
  veiculo_id      uuid REFERENCES public.ativos(id) ON DELETE SET NULL,
  motorista       text,
  carga           text,
  peso_kg         decimal(10,2),
  valor_frete     decimal(15,2),
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  status          text CHECK (status IN ('agendada','em_transito','entregue','cancelada','problema')) DEFAULT 'agendada',
  data_saida      timestamptz,
  data_chegada    timestamptz,
  data_entrega    timestamptz,
  lat_atual       decimal(10,7),
  lng_atual       decimal(10,7),
  ocr_romaneio    jsonb,
  notas           text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.logistica_rotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logistica_rotas_rls" ON public.logistica_rotas;
CREATE POLICY "logistica_rotas_rls" ON public.logistica_rotas FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_logistica_rotas_empresa ON public.logistica_rotas(empresa_id);

CREATE TABLE IF NOT EXISTS public.logistica_pneus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  veiculo_id  uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  posicao     text NOT NULL, -- DD, DE, TD, TE, estepe...
  marca       text,
  modelo      text,
  dot         text,
  km_instalado decimal(10,2) DEFAULT 0,
  km_rodado   decimal(10,2) DEFAULT 0,
  km_limite   decimal(10,2) DEFAULT 70000,
  data_instalacao date,
  status      text CHECK (status IN ('ativo','desgastado','recapado','descartado')) DEFAULT 'ativo',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.logistica_pneus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logistica_pneus_rls" ON public.logistica_pneus;
CREATE POLICY "logistica_pneus_rls" ON public.logistica_pneus FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.logistica_checklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  veiculo_id  uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  rota_id     uuid REFERENCES public.logistica_rotas(id) ON DELETE SET NULL,
  motorista   text,
  data        date NOT NULL DEFAULT CURRENT_DATE,
  itens       jsonb NOT NULL DEFAULT '{}',
  assinatura  text,
  status      text CHECK (status IN ('pendente','aprovado','reprovado')) DEFAULT 'pendente',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.logistica_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logistica_checklist_rls" ON public.logistica_checklist;
CREATE POLICY "logistica_checklist_rls" ON public.logistica_checklist FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

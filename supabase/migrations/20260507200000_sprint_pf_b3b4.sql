-- Sprint PF Blocos 3+4 — Investimentos, IR, Open Finance
-- Rode no SQL Editor do Supabase

-- 1. investimentos_pf
CREATE TABLE IF NOT EXISTS public.investimentos_pf (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  tipo            text CHECK (tipo IN ('CDB','Poupança','Ações','FIIs','Tesouro Direto','Cripto','Outros')) DEFAULT 'CDB',
  instituicao     text,
  valor_aplicado  decimal(15,2) NOT NULL DEFAULT 0,
  valor_atual     decimal(15,2) NOT NULL DEFAULT 0,
  data_aplicacao  date DEFAULT CURRENT_DATE,
  vencimento      date,
  rentabilidade   text,
  liquidez        text CHECK (liquidez IN ('diária','no vencimento','longo prazo')) DEFAULT 'diária',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.investimentos_pf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investimentos_pf_rls" ON public.investimentos_pf;
CREATE POLICY "investimentos_pf_rls" ON public.investimentos_pf FOR ALL USING (user_id = auth.uid());

-- 2. deducoes_ir_pf (deduções para cálculo do IR)
CREATE TABLE IF NOT EXISTS public.deducoes_ir_pf (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ano         int NOT NULL DEFAULT date_part('year', now())::int,
  dependentes int DEFAULT 0,
  saude       decimal(15,2) DEFAULT 0,
  educacao    decimal(15,2) DEFAULT 0,
  inss        decimal(15,2) DEFAULT 0,
  previdencia decimal(15,2) DEFAULT 0,
  outros      decimal(15,2) DEFAULT 0,
  UNIQUE(user_id, ano)
);
ALTER TABLE public.deducoes_ir_pf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deducoes_ir_rls" ON public.deducoes_ir_pf;
CREATE POLICY "deducoes_ir_rls" ON public.deducoes_ir_pf FOR ALL USING (user_id = auth.uid());

-- 3. open_finance_conexoes (futuro Pluggy)
CREATE TABLE IF NOT EXISTS public.open_finance_conexoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  banco         text NOT NULL,
  item_id       text,
  status        text CHECK (status IN ('pendente','ativo','erro','expirado')) DEFAULT 'pendente',
  ultimo_sync   timestamptz,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.open_finance_conexoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_finance_rls" ON public.open_finance_conexoes;
CREATE POLICY "open_finance_rls" ON public.open_finance_conexoes FOR ALL USING (user_id = auth.uid());

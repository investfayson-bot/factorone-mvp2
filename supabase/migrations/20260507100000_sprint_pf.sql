-- Sprint PF — Pessoa Física: tabelas completas
-- Rode no SQL Editor do Supabase

-- 1. perfil_usuario (complementar se já existir)
CREATE TABLE IF NOT EXISTS public.perfil_usuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tipo            text CHECK (tipo IN ('empresarial','pessoal')) DEFAULT 'pessoal',
  nome_completo   text,
  cpf             text,
  renda_mensal    decimal(15,2) DEFAULT 0,
  whatsapp        text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_proprio" ON public.perfil_usuario;
CREATE POLICY "perfil_proprio" ON public.perfil_usuario FOR ALL USING (user_id = auth.uid());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='perfil_usuario' AND column_name='renda_mensal') THEN
    ALTER TABLE public.perfil_usuario ADD COLUMN renda_mensal decimal(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='perfil_usuario' AND column_name='cpf') THEN
    ALTER TABLE public.perfil_usuario ADD COLUMN cpf text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='perfil_usuario' AND column_name='whatsapp') THEN
    ALTER TABLE public.perfil_usuario ADD COLUMN whatsapp text;
  END IF;
END $$;

-- 2. despesas_pessoais
CREATE TABLE IF NOT EXISTS public.despesas_pessoais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao        text NOT NULL,
  valor            decimal(15,2) NOT NULL,
  categoria        text DEFAULT 'Outros',
  data_despesa     date DEFAULT CURRENT_DATE,
  data_vencimento  date,
  status           text CHECK (status IN ('pendente','pago','vencido')) DEFAULT 'pendente',
  recorrente       boolean DEFAULT false,
  parcela_atual    int,
  total_parcelas   int,
  cartao_id        uuid,
  origem           text DEFAULT 'manual',
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.despesas_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "despesas_pf_rls" ON public.despesas_pessoais;
CREATE POLICY "despesas_pf_rls" ON public.despesas_pessoais FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_despesas_pf_user_data ON public.despesas_pessoais(user_id, data_despesa DESC);

-- 3. receitas_pessoais
CREATE TABLE IF NOT EXISTS public.receitas_pessoais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao        text NOT NULL,
  valor            decimal(15,2) NOT NULL,
  categoria        text DEFAULT 'Salário',
  data_recebimento date DEFAULT CURRENT_DATE,
  recorrente       boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.receitas_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receitas_pf_rls" ON public.receitas_pessoais;
CREATE POLICY "receitas_pf_rls" ON public.receitas_pessoais FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_receitas_pf_user_data ON public.receitas_pessoais(user_id, data_recebimento DESC);

-- 4. assinaturas_pessoais
CREATE TABLE IF NOT EXISTS public.assinaturas_pessoais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  valor            decimal(15,2) NOT NULL,
  dia_vencimento   int CHECK (dia_vencimento BETWEEN 1 AND 31) DEFAULT 1,
  categoria        text DEFAULT 'Streaming',
  ativa            boolean DEFAULT true,
  ciclo            text CHECK (ciclo IN ('mensal','anual','semanal')) DEFAULT 'mensal',
  ultimo_uso       date,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.assinaturas_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assinaturas_pf_rls" ON public.assinaturas_pessoais;
CREATE POLICY "assinaturas_pf_rls" ON public.assinaturas_pessoais FOR ALL USING (user_id = auth.uid());

-- 5. orcamento_pessoal
CREATE TABLE IF NOT EXISTS public.orcamento_pessoal (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mes         text NOT NULL, -- 'YYYY-MM'
  categoria   text NOT NULL,
  limite      decimal(15,2) NOT NULL,
  UNIQUE(user_id, mes, categoria)
);
ALTER TABLE public.orcamento_pessoal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orcamento_pf_rls" ON public.orcamento_pessoal;
CREATE POLICY "orcamento_pf_rls" ON public.orcamento_pessoal FOR ALL USING (user_id = auth.uid());

-- 6. metas_financeiras_pf
CREATE TABLE IF NOT EXISTS public.metas_financeiras_pf (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  descricao    text,
  valor_meta   decimal(15,2) NOT NULL,
  valor_atual  decimal(15,2) DEFAULT 0,
  prazo        date,
  categoria    text DEFAULT 'Reserva',
  icone        text DEFAULT '🎯',
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.metas_financeiras_pf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas_pf_rls" ON public.metas_financeiras_pf;
CREATE POLICY "metas_pf_rls" ON public.metas_financeiras_pf FOR ALL USING (user_id = auth.uid());

-- 7. cartoes_pessoais
CREATE TABLE IF NOT EXISTS public.cartoes_pessoais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  bandeira         text DEFAULT 'Visa',
  limite           decimal(15,2) DEFAULT 0,
  dia_fechamento   int DEFAULT 1,
  dia_vencimento   int DEFAULT 10,
  cor              text DEFAULT '#1B2E4B',
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.cartoes_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cartoes_pf_rls" ON public.cartoes_pessoais;
CREATE POLICY "cartoes_pf_rls" ON public.cartoes_pessoais FOR ALL USING (user_id = auth.uid());

-- FK cartao_id em despesas_pessoais (garante que coluna existe antes da FK)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='despesas_pessoais' AND column_name='cartao_id'
  ) THEN
    ALTER TABLE public.despesas_pessoais ADD COLUMN cartao_id uuid;
  END IF;
END $$;
ALTER TABLE public.despesas_pessoais DROP CONSTRAINT IF EXISTS despesas_pf_cartao_fk;
ALTER TABLE public.despesas_pessoais
  ADD CONSTRAINT despesas_pf_cartao_fk
  FOREIGN KEY (cartao_id) REFERENCES public.cartoes_pessoais(id) ON DELETE SET NULL;

-- 8. lifeos_interacoes_pf (log de mensagens WhatsApp PF)
CREATE TABLE IF NOT EXISTS public.lifeos_interacoes_pf (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  origem          text DEFAULT 'whatsapp',
  mensagem_usuario text,
  resposta_ia     text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.lifeos_interacoes_pf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifeos_pf_rls" ON public.lifeos_interacoes_pf;
CREATE POLICY "lifeos_pf_rls" ON public.lifeos_interacoes_pf FOR ALL USING (user_id = auth.uid());

-- Sprint 3 — Reembolsos + LifeOS log

-- 1. Tabela reembolsos
CREATE TABLE IF NOT EXISTS public.reembolsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitante_id uuid REFERENCES auth.users(id),
  solicitante_nome text,
  descricao text NOT NULL,
  valor numeric NOT NULL CHECK (valor > 0),
  categoria text DEFAULT 'Outros',
  data_despesa date,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'pago')),
  comprovante_url text,
  observacao text,
  aprovado_por uuid,
  aprovado_em timestamptz,
  rejeitado_motivo text,
  pago_em timestamptz,
  transaction_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reembolsos_empresa" ON public.reembolsos;
CREATE POLICY "reembolsos_empresa" ON public.reembolsos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 2. Tabela log LifeOS (interacoes via webhook)
CREATE TABLE IF NOT EXISTS public.lifeos_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  origem text DEFAULT 'api',
  mensagem_usuario text,
  resposta_ia text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.lifeos_interacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifeos_empresa" ON public.lifeos_interacoes;
CREATE POLICY "lifeos_empresa" ON public.lifeos_interacoes FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

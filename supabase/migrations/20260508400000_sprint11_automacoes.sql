-- Sprint 11 — Automações de Notificação
-- Rode no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.automacoes_regras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN (
    'conta_vencendo',
    'saldo_baixo',
    'reembolso_pendente',
    'oportunidade_sem_followup',
    'pneu_desgaste',
    'meta_atingida'
  )),
  ativa       boolean DEFAULT true,
  config      jsonb DEFAULT '{}',  -- { dias: 3, valor_limite: 5000, ... }
  ultima_exec timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.automacoes_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automacoes_rls" ON public.automacoes_regras;
CREATE POLICY "automacoes_rls" ON public.automacoes_regras FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_automacoes_empresa ON public.automacoes_regras(empresa_id);

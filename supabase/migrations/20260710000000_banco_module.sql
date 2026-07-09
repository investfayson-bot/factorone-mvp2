-- Banco module: vínculo de transação com cadastro real e lançamento previsto.
-- Spec: docs/superpowers/specs/2026-07-08-banco-module-design.md
-- Todas nullable: nenhuma linha existente quebra.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS fornecedor_id   uuid REFERENCES public.fornecedores(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id      uuid REFERENCES public.clientes(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_pagar_id  uuid REFERENCES public.contas_pagar(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_receber_id uuid REFERENCES public.contas_receber(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_fornecedor_id    ON public.transacoes(fornecedor_id)    WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_cliente_id       ON public.transacoes(cliente_id)       WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_pagar_id   ON public.transacoes(conta_pagar_id)   WHERE conta_pagar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_receber_id ON public.transacoes(conta_receber_id) WHERE conta_receber_id IS NOT NULL;

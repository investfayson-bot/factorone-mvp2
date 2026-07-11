-- Fase 4 (Agentes IA) — bloco "Precisamos de você" precisa exibir o motivo
-- específico de cada pendência (nunca genérico). atendimento_conversas ainda
-- não guardava esse motivo quando a IA transferia ou pausava pra aprovação.
ALTER TABLE public.atendimento_conversas
  ADD COLUMN IF NOT EXISTS motivo text;

-- Fase 4 (Agentes IA) — omnichannel de verdade. atendimento_conversas só
-- tinha canal "Site" implícito (widget), sem coluna nenhuma pra distinguir.
-- Telegram (bot de cliente via deep link /start <empresaId>) precisa saber
-- qual conversa pertence a qual chat_id do Telegram.
--
-- O bot do Telegram é global (um token só pra todo o FactorOne, cliente
-- entra via deep link específico da empresa) — então o MESMO chat_id pode
-- legitimamente ser cliente de mais de uma empresa ao mesmo tempo. A
-- unicidade certa é por empresa, não global: previne linha duplicada se o
-- cliente clicar o link de novo, sem impedir que ele também converse com
-- outra empresa que usa o mesmo bot.
ALTER TABLE public.atendimento_conversas
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'site' CHECK (canal IN ('site', 'telegram')),
  ADD COLUMN IF NOT EXISTS canal_identificador text;

-- Sem WHERE parcial de propósito: linhas com canal_identificador NULL (Site,
-- que não usa essa coluna) nunca colidem entre si por semântica padrão de
-- NULL em unique constraint — e um índice não-parcial é o que permite usar
-- upsert(..., { onConflict: 'empresa_id,canal,canal_identificador' }) no
-- webhook do Telegram (ON CONFLICT do Postgres não infere índice parcial
-- sem repetir o predicado, que o upsert do supabase-js não expõe).
CREATE UNIQUE INDEX IF NOT EXISTS atendimento_conversas_canal_id_uidx
  ON public.atendimento_conversas (empresa_id, canal, canal_identificador);

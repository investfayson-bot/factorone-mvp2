-- Fecha dois furos críticos de RLS achados na revisão do Bloco 1 da Fase 5
-- (revisor rls-tenant-guardian, 2026-07-11):
--
-- 1. contadores_public_read (sprint5_fixes) deixava anon/authenticated ler
--    TODOS os tokens de acesso de TODAS as empresas (USING status='ativo',
--    sem filtro de tenant). O portal /contador/[token] não precisa dela:
--    app/api/contador/[token]/* usa service role e busca por token exato.
--
-- 2. membros_equipe_token_read (sprint10) era USING (true) — qualquer login
--    de qualquer empresa listava a equipe (e tokens de convite pendentes!)
--    de todos os tenants. A página de aceite de convite, que dependia dela
--    pra exibir o convite antes do login, passa a usar o endpoint
--    /api/equipe/convite/[token] (service role, busca por token exato).
--
-- As policies escopadas por empresa (contadores_rls, membros_equipe_rls)
-- continuam valendo pra UI do dono — nada além do acesso indevido quebra.

DROP POLICY IF EXISTS "contadores_public_read" ON public.contadores;
DROP POLICY IF EXISTS "membros_equipe_token_read" ON public.membros_equipe;

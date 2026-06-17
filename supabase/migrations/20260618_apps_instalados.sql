-- Marketplace: apps instalados por empresa (PJ) ou usuário (PF).

CREATE TABLE IF NOT EXISTS public.apps_instalados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      text NOT NULL,
  empresa_id  uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT apps_instalados_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Um app único por "dono" (empresa quando houver, senão usuário).
CREATE UNIQUE INDEX IF NOT EXISTS uq_apps_instalados_owner
  ON public.apps_instalados (COALESCE(empresa_id, user_id), app_id);

ALTER TABLE public.apps_instalados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_instalados_own" ON public.apps_instalados;
CREATE POLICY "apps_instalados_own" ON public.apps_instalados FOR ALL
  USING ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()));

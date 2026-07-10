-- Belvo (Open Finance): vínculos bancários (links) por empresa (PJ) ou usuário (PF).

CREATE TABLE IF NOT EXISTS public.belvo_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     text NOT NULL UNIQUE,           -- id do link na Belvo
  empresa_id  uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  institution text,
  status      text NOT NULL DEFAULT 'valid',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT belvo_links_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_belvo_links_empresa ON public.belvo_links(empresa_id);
CREATE INDEX IF NOT EXISTS idx_belvo_links_user ON public.belvo_links(user_id);

ALTER TABLE public.belvo_links ENABLE ROW LEVEL SECURITY;

-- Visível/editável se o link pertence à empresa do usuário (PJ) OU ao próprio usuário (PF).
DROP POLICY IF EXISTS "belvo_links_own" ON public.belvo_links;
CREATE POLICY "belvo_links_own" ON public.belvo_links FOR ALL
  USING (
    (empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    (empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  );

-- Fase 0 (Parte A) — Holding multi-CNPJ + Pessoa Física. Camada de agregação
-- por cima de `empresas` (que não muda em nada) — um grupo soma dado de N
-- empresas E, opcionalmente, da pessoa física do dono, sem misturar dado de
-- quem não tem acesso a cada membro individualmente.

CREATE TABLE IF NOT EXISTS public.grupos_empresariais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grupos_empresariais_owner ON public.grupos_empresariais(owner_user_id);
ALTER TABLE public.grupos_empresariais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grupos_empresariais_select" ON public.grupos_empresariais;
CREATE POLICY "grupos_empresariais_select" ON public.grupos_empresariais FOR SELECT
  USING (owner_user_id = auth.uid());
-- Sem policy de insert/update/delete pro client: toda escrita passa por rota
-- server-side (service role), mesmo padrão de usuario_empresas.

-- Cada linha é OU uma empresa do grupo OU a pessoa física do dono, nunca as
-- duas — é assim que o seletor "Consolidado / Só empresas / Só PF" sabe o
-- que somar em cada modo.
CREATE TABLE IF NOT EXISTS public.grupo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_empresariais(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  pessoa_fisica_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT grupo_membros_um_tipo_chk CHECK (
    (empresa_id IS NOT NULL AND pessoa_fisica_user_id IS NULL) OR
    (empresa_id IS NULL AND pessoa_fisica_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_membros_empresa_unica
  ON public.grupo_membros(grupo_id, empresa_id) WHERE empresa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_membros_pf_unica
  ON public.grupo_membros(grupo_id, pessoa_fisica_user_id) WHERE pessoa_fisica_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grupo_membros_grupo ON public.grupo_membros(grupo_id);

ALTER TABLE public.grupo_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grupo_membros_select" ON public.grupo_membros;
-- Lê quem é dono do grupo, OU quem tem membership (usuario_empresas) numa
-- das empresas que já pertencem ao grupo -- reaproveita a fonte autoritativa
-- de acesso por empresa que o resto do sistema já usa.
CREATE POLICY "grupo_membros_select" ON public.grupo_membros FOR SELECT
  USING (
    grupo_id IN (SELECT id FROM public.grupos_empresariais WHERE owner_user_id = auth.uid())
    OR (empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuario_empresas WHERE user_id = auth.uid()))
    OR pessoa_fisica_user_id = auth.uid()
  );

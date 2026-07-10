-- Libera 'contador' como role convidável em membros_equipe.
-- Sem isso, /api/equipe/convidar falha (CHECK constraint) ao tentar convidar
-- um contador — e o cockpit do escritório (/dashboard/escritorio, papel='contador'
-- em usuario_empresas) nunca teria como encher.
ALTER TABLE public.membros_equipe DROP CONSTRAINT IF EXISTS membros_equipe_role_check;
ALTER TABLE public.membros_equipe ADD CONSTRAINT membros_equipe_role_check
  CHECK (role IN ('admin','financeiro','comercial','operacional','logistica','viewer','contador'));

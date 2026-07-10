-- Libera 'contador' como role convidável em membros_equipe.
-- Sem isso, /api/equipe/convidar falha (CHECK constraint) ao tentar convidar
-- um contador — e o cockpit do escritório (/dashboard/escritorio, papel='contador'
-- em usuario_empresas) nunca teria como encher.
--
-- Acha o CHECK constraint da coluna role dinamicamente (não assume o nome
-- padrão do Postgres) e substitui pela versão que inclui 'contador'.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'membros_equipe'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.membros_equipe DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.membros_equipe ADD CONSTRAINT membros_equipe_role_check
  CHECK (role IN ('admin','financeiro','comercial','operacional','logistica','viewer','contador'));

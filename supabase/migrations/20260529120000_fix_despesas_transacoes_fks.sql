-- ============================================================================
-- Correção completa de FKs do módulo de Despesas (P0 — AGENTS.md)
-- ----------------------------------------------------------------------------
-- 1) despesas.responsavel_id : auth.users(id) -> usuarios(id)
-- 2) despesas.aprovado_por   : auth.users(id) -> usuarios(id)
-- 3) transacoes.empresa_id   : auth.users(id) -> empresas(id)
-- 4) despesas.transaction_id : FK robusta -> tabela FÍSICA de transações
--                              (transactions pós-consolidação; senão transacoes)
--
-- Idempotente e seguro p/ instalações híbridas. Faz backfill antes de cada FK;
-- valores que não mapeiam viram NULL (colunas nullable / ON DELETE SET NULL).
-- ============================================================================

-- 1) despesas.responsavel_id -> usuarios(id)
DO $$
DECLARE fk record;
BEGIN
  IF to_regclass('public.despesas') IS NULL OR to_regclass('public.usuarios') IS NULL THEN
    RAISE NOTICE 'despesas/usuarios ausentes; pulando responsavel_id.'; RETURN;
  END IF;

  UPDATE public.despesas d
  SET responsavel_id = NULL
  WHERE responsavel_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = d.responsavel_id);

  FOR fk IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'despesas' AND con.contype = 'f'
      AND (SELECT attname FROM pg_attribute
           WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'responsavel_id'
  LOOP
    EXECUTE format('ALTER TABLE public.despesas DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE public.despesas
    ADD CONSTRAINT despesas_responsavel_id_fkey
    FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
END $$;

-- 2) despesas.aprovado_por -> usuarios(id)
DO $$
DECLARE fk record;
BEGIN
  IF to_regclass('public.despesas') IS NULL OR to_regclass('public.usuarios') IS NULL THEN
    RAISE NOTICE 'despesas/usuarios ausentes; pulando aprovado_por.'; RETURN;
  END IF;

  UPDATE public.despesas d
  SET aprovado_por = NULL
  WHERE aprovado_por IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = d.aprovado_por);

  FOR fk IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'despesas' AND con.contype = 'f'
      AND (SELECT attname FROM pg_attribute
           WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'aprovado_por'
  LOOP
    EXECUTE format('ALTER TABLE public.despesas DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE public.despesas
    ADD CONSTRAINT despesas_aprovado_por_fkey
    FOREIGN KEY (aprovado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;
END $$;

-- 3) transacoes.empresa_id -> empresas(id)  (tabela física)
DO $$
DECLARE tbl text; fk record;
BEGIN
  SELECT c.relname INTO tbl
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('transactions', 'transacoes')
  ORDER BY (c.relname = 'transactions') DESC LIMIT 1;

  IF tbl IS NULL THEN
    RAISE NOTICE 'transacoes/transactions ausente; pulando empresa_id.'; RETURN;
  END IF;

  -- backfill via usuarios (empresa_id que aponta p/ um usuário -> empresa real)
  EXECUTE format($f$
    UPDATE public.%I t SET empresa_id = u.empresa_id
    FROM public.usuarios u
    WHERE t.empresa_id = u.id AND u.empresa_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = t.empresa_id)
  $f$, tbl);

  -- fallback p/ instalações que usam empresas.user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'user_id') THEN
    EXECUTE format($f$
      UPDATE public.%I t SET empresa_id = e.id
      FROM public.empresas e
      WHERE e.user_id = t.empresa_id
        AND NOT EXISTS (SELECT 1 FROM public.empresas e2 WHERE e2.id = t.empresa_id)
    $f$, tbl);
  END IF;

  -- zera órfãos remanescentes
  EXECUTE format($f$
    UPDATE public.%I t SET empresa_id = NULL
    WHERE empresa_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = t.empresa_id)
  $f$, tbl);

  FOR fk IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl AND con.contype = 'f'
      AND (SELECT attname FROM pg_attribute
           WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'empresa_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, fk.conname);
  END LOOP;

  EXECUTE format($f$
    ALTER TABLE public.%I ADD CONSTRAINT %I
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE
  $f$, tbl, tbl || '_empresa_id_fkey');
END $$;

-- 4) despesas.transaction_id -> tabela FÍSICA de transações (nunca a VIEW)
DO $$
DECLARE tbl text; fk record;
BEGIN
  IF to_regclass('public.despesas') IS NULL THEN RETURN; END IF;

  SELECT c.relname INTO tbl
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('transactions', 'transacoes')
  ORDER BY (c.relname = 'transactions') DESC LIMIT 1;

  IF tbl IS NULL THEN
    RAISE NOTICE 'sem tabela física de transações; pulando transaction_id.'; RETURN;
  END IF;

  EXECUTE format($f$
    UPDATE public.despesas d SET transaction_id = NULL
    WHERE transaction_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.%I t WHERE t.id = d.transaction_id)
  $f$, tbl);

  FOR fk IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'despesas' AND con.contype = 'f'
      AND (SELECT attname FROM pg_attribute
           WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'transaction_id'
  LOOP
    EXECUTE format('ALTER TABLE public.despesas DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  EXECUTE format($f$
    ALTER TABLE public.despesas ADD CONSTRAINT despesas_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES public.%I(id) ON DELETE SET NULL
  $f$, tbl);
END $$;

-- Sprint 6 — Portal Contador + WhatsApp + melhorias
-- Rode no SQL Editor do Supabase

-- 1. Coluna whatsapp em usuarios (para vinculação WhatsApp webhook)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='whatsapp'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN whatsapp text;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_whatsapp ON public.usuarios(whatsapp) WHERE whatsapp IS NOT NULL;
  END IF;
END $$;

-- 2. Índice de performance para lookup de token em contadores
CREATE INDEX IF NOT EXISTS idx_contadores_token ON public.contadores(token_acesso);
CREATE INDEX IF NOT EXISTS idx_contadores_empresa ON public.contadores(empresa_id, status);

-- 3. Índice para usuarios por whatsapp
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios(empresa_id);

-- 4. Coluna updated_at em contadores (opcional, para auditoria)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contadores' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.contadores ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

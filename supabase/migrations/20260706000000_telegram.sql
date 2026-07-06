-- Telegram bot — vínculo usuário <-> chat_id (piloto acessor de bolso)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='telegram_chat_id'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN telegram_chat_id text;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_telegram_chat_id ON public.usuarios(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
  END IF;
END $$;

-- Código de pareamento (curto, expira) — evita vincular chat_id por e-mail "no chute"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='telegram_link_code'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN telegram_link_code text;
    ALTER TABLE public.usuarios ADD COLUMN telegram_link_code_exp timestamptz;
  END IF;
END $$;

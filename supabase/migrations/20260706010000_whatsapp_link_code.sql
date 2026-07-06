-- WhatsApp — código de pareamento (mesmo padrão do Telegram), evita vincular
-- o número de outra pessoa por engano/má-fé.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='whatsapp_link_code'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN whatsapp_link_code text;
    ALTER TABLE public.usuarios ADD COLUMN whatsapp_link_code_exp timestamptz;
  END IF;
END $$;

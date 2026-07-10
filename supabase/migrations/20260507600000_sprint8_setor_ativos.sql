-- Sprint 8 — Setor nos ativos para hierarquia por departamento
-- Rode no SQL Editor do Supabase

ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS setor text;
CREATE INDEX IF NOT EXISTS idx_ativos_setor ON public.ativos(setor);

-- Setor também nos usuarios para filtrar visão por departamento
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS setor text;

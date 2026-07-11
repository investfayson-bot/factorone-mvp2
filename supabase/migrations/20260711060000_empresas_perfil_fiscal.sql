-- Fase 5, Bloco 4 — colunas aditivas em empresas pro card "Onde cada CNPJ
-- está cadastrado" (Impostos & Regime): cidade/UF de registro e o regime
-- tributário vigente informado pelo usuário. Nullable, sem valor padrão —
-- não inventa dado que a empresa não confirmou.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS regime_tributario text CHECK (regime_tributario IS NULL OR regime_tributario IN ('simples', 'presumido', 'real'));

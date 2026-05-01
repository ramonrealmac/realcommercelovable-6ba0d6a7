ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS tempo_animacao integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.empresa.tempo_animacao IS
  'Intervalo (s) entre execucoes da animacao do bot RealSys. 0 desativa.';
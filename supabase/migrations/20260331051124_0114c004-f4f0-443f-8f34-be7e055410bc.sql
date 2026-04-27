
ALTER TABLE public.parametro_horario
  ADD COLUMN IF NOT EXISTS xhr_inicio_noturno time without time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS xhr_fim_noturno time without time zone DEFAULT NULL;

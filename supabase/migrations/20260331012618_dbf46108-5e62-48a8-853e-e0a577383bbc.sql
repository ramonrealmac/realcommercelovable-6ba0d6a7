
-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nm_usuario text,
  ADD COLUMN IF NOT EXISTS ds_login text,
  ADD COLUMN IF NOT EXISTS ds_foto text;

-- Create perfil_horario table for shift schedule
CREATE TABLE IF NOT EXISTS public.perfil_horario (
  perfil_horario_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  perfil_id bigint NOT NULL,
  nr_dia_semana smallint NOT NULL CHECK (nr_dia_semana BETWEEN 0 AND 6),
  fl_matutino boolean NOT NULL DEFAULT false,
  fl_vespertino boolean NOT NULL DEFAULT false,
  fl_noturno boolean NOT NULL DEFAULT false,
  hr_matutino_inicio time DEFAULT '06:00',
  hr_matutino_fim time DEFAULT '12:00',
  hr_vespertino_inicio time DEFAULT '12:00',
  hr_vespertino_fim time DEFAULT '18:00',
  hr_noturno_inicio time DEFAULT '18:00',
  hr_noturno_fim time DEFAULT '23:59',
  fl_excluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_perfil_horario_perfil FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id)
);

-- Unique index: one entry per empresa+perfil+dia
CREATE UNIQUE INDEX IF NOT EXISTS iu_perfil_horario_empresa_perfil_dia
  ON public.perfil_horario (empresa_id, perfil_id, nr_dia_semana)
  WHERE fl_excluido = false;

-- RLS
ALTER TABLE public.perfil_horario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read PERFIL_HORARIO"
  ON public.perfil_horario FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert PERFIL_HORARIO"
  ON public.perfil_horario FOR INSERT TO authenticated
  WITH CHECK (fu_is_admin(auth.uid(), empresa_id));

CREATE POLICY "Admins can update PERFIL_HORARIO"
  ON public.perfil_horario FOR UPDATE TO authenticated
  USING (fu_is_admin(auth.uid(), empresa_id));

-- Trigger for updated_at
CREATE TRIGGER tr_perfil_horario_updated_at
  BEFORE UPDATE ON public.perfil_horario
  FOR EACH ROW EXECUTE FUNCTION fu_update_updated_at();

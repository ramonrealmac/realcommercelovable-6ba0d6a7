CREATE TABLE public.usuario_atalho (
  usuario_atalho_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  nm_menu TEXT NOT NULL,
  nr_ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iu_usuario_atalho UNIQUE (user_id, nm_menu)
);

CREATE INDEX ix_usuario_atalho_user ON public.usuario_atalho(user_id);

ALTER TABLE public.usuario_atalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario pode ver seus atalhos"
ON public.usuario_atalho FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuario pode inserir seus atalhos"
ON public.usuario_atalho FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario pode atualizar seus atalhos"
ON public.usuario_atalho FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario pode excluir seus atalhos"
ON public.usuario_atalho FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER tr_usuario_atalho_updated_at
BEFORE UPDATE ON public.usuario_atalho
FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();

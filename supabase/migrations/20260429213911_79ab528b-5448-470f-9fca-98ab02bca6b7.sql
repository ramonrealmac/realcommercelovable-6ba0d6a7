-- Tabela de salas (DM ou grupo)
CREATE TABLE public.chat_sala (
  chat_sala_id BIGSERIAL PRIMARY KEY,
  tp_sala TEXT NOT NULL CHECK (tp_sala IN ('D','G')),
  ds_nome TEXT,
  empresa_id BIGINT,
  criado_por UUID NOT NULL,
  dt_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros da sala
CREATE TABLE public.chat_sala_membro (
  chat_sala_membro_id BIGSERIAL PRIMARY KEY,
  chat_sala_id BIGINT NOT NULL REFERENCES public.chat_sala(chat_sala_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dt_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_ultima_leitura TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_sala_id, user_id)
);
CREATE INDEX ix_chat_sala_membro_user ON public.chat_sala_membro(user_id);

-- Mensagens
CREATE TABLE public.chat_sala_mensagem (
  chat_sala_mensagem_id BIGSERIAL PRIMARY KEY,
  chat_sala_id BIGINT NOT NULL REFERENCES public.chat_sala(chat_sala_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ds_conteudo TEXT,
  ds_anexo_url TEXT,
  ds_anexo_tipo TEXT,
  ds_audio_url TEXT,
  dt_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_sala_mensagem_sala ON public.chat_sala_mensagem(chat_sala_id, dt_criacao DESC);

-- Função auxiliar: usuário é membro da sala? (SECURITY DEFINER evita recursão RLS)
CREATE OR REPLACE FUNCTION public.fu_chat_is_membro(_sala_id BIGINT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_sala_membro
    WHERE chat_sala_id = _sala_id AND user_id = _user_id
  );
$$;

-- Trigger: atualiza dt_atualizacao da sala a cada nova mensagem
CREATE OR REPLACE FUNCTION public.fu_chat_sala_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_sala SET dt_atualizacao = now() WHERE chat_sala_id = NEW.chat_sala_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_chat_sala_mensagem_touch
AFTER INSERT ON public.chat_sala_mensagem
FOR EACH ROW EXECUTE FUNCTION public.fu_chat_sala_touch();

-- RLS
ALTER TABLE public.chat_sala ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sala_membro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sala_mensagem ENABLE ROW LEVEL SECURITY;

-- chat_sala
CREATE POLICY "membros veem suas salas" ON public.chat_sala
FOR SELECT TO authenticated
USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));

CREATE POLICY "qualquer autenticado cria sala" ON public.chat_sala
FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "criador atualiza sala" ON public.chat_sala
FOR UPDATE TO authenticated
USING (criado_por = auth.uid());

-- chat_sala_membro
CREATE POLICY "membros veem membros da sala" ON public.chat_sala_membro
FOR SELECT TO authenticated
USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));

CREATE POLICY "membro insere a si mesmo ou criador adiciona" ON public.chat_sala_membro
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.chat_sala s WHERE s.chat_sala_id = chat_sala_id AND s.criado_por = auth.uid())
);

CREATE POLICY "membro atualiza sua propria leitura" ON public.chat_sala_membro
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "membro sai da sala" ON public.chat_sala_membro
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- chat_sala_mensagem
CREATE POLICY "membros leem mensagens" ON public.chat_sala_mensagem
FOR SELECT TO authenticated
USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));

CREATE POLICY "membros enviam mensagens" ON public.chat_sala_mensagem
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.fu_chat_is_membro(chat_sala_id, auth.uid())
);

CREATE POLICY "autor exclui sua mensagem" ON public.chat_sala_mensagem
FOR DELETE TO authenticated
USING (user_id = auth.uid());
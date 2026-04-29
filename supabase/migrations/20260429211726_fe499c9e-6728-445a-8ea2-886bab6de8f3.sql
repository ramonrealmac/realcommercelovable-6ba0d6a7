-- Tabela de conversas
CREATE TABLE public.chat_conversa (
  chat_conversa_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id BIGINT,
  ds_titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  dt_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_chat_conversa_user ON public.chat_conversa(user_id, dt_atualizacao DESC);

ALTER TABLE public.chat_conversa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas conversas" ON public.chat_conversa
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuario cria suas conversas" ON public.chat_conversa
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario altera suas conversas" ON public.chat_conversa
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuario remove suas conversas" ON public.chat_conversa
  FOR DELETE USING (auth.uid() = user_id);

-- Tabela de mensagens
CREATE TABLE public.chat_mensagem (
  chat_mensagem_id BIGSERIAL PRIMARY KEY,
  chat_conversa_id BIGINT NOT NULL REFERENCES public.chat_conversa(chat_conversa_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tp_remetente TEXT NOT NULL CHECK (tp_remetente IN ('user','assistant','system','tool')),
  ds_conteudo TEXT,
  ds_anexo_url TEXT,
  ds_anexo_tipo TEXT,
  ds_audio_url TEXT,
  tp_acao TEXT,
  dados_acao JSONB,
  dt_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_chat_mensagem_conversa ON public.chat_mensagem(chat_conversa_id, dt_criacao);

ALTER TABLE public.chat_mensagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas mensagens" ON public.chat_mensagem
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuario cria suas mensagens" ON public.chat_mensagem
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario altera suas mensagens" ON public.chat_mensagem
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuario remove suas mensagens" ON public.chat_mensagem
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para dt_atualizacao da conversa
CREATE OR REPLACE FUNCTION public.fu_chat_touch_conversa()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversa SET dt_atualizacao = now() WHERE chat_conversa_id = NEW.chat_conversa_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_chat_mensagem_touch
AFTER INSERT ON public.chat_mensagem
FOR EACH ROW EXECUTE FUNCTION public.fu_chat_touch_conversa();

-- Bucket de anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-anexos', 'chat-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Usuario ve seus anexos chat" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuario envia seus anexos chat" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuario altera seus anexos chat" ON storage.objects
  FOR UPDATE USING (bucket_id = 'chat-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuario remove seus anexos chat" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);
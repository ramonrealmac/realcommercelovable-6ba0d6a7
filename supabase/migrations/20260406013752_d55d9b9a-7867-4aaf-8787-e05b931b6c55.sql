
-- 1. Add all parametro columns to empresa (without x prefix)
ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS cor_secundaria TEXT DEFAULT '#6D28D9',
  ADD COLUMN IF NOT EXISTS cor_destaque TEXT DEFAULT '#F59E0B',
  ADD COLUMN IF NOT EXISTS cor_fundo TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS cor_fundo_card TEXT DEFAULT '#F8FAFC',
  ADD COLUMN IF NOT EXISTS cor_texto_principal TEXT DEFAULT '#1E293B',
  ADD COLUMN IF NOT EXISTS cor_texto_secundario TEXT DEFAULT '#64748B',
  ADD COLUMN IF NOT EXISTS cor_botao TEXT DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS cor_botao_negativo TEXT DEFAULT '#EF4444',
  ADD COLUMN IF NOT EXISTS cor_header TEXT DEFAULT '#7C3AED',
  ADD COLUMN IF NOT EXISTS cor_link TEXT DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS cor_menu TEXT DEFAULT '#4C1D95',
  ADD COLUMN IF NOT EXISTS nm_escola TEXT DEFAULT 'Escola',
  ADD COLUMN IF NOT EXISTS url_logo TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS url_favicon TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS url_banner_vendas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS url_link_vendas TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS msg_pos_pagamento TEXT DEFAULT 'Pagamento confirmado! Seu lanche estará disponível para retirada.',
  ADD COLUMN IF NOT EXISTS lg_valida_estoque_link BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS lg_valida_estoque_pdv BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_remetente TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS abacatepay_api_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS abacatepay_webhook_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS abacatepay_webhook_secret TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS css_customizado TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logomarca TEXT DEFAULT '';

-- 2. Copy data from parametro to all empresas
UPDATE public.empresa e SET
  cor_primaria = COALESCE(p.xcor_primaria, e.cor_primaria),
  cor_secundaria = COALESCE(p.xcor_secundaria, e.cor_secundaria),
  cor_destaque = COALESCE(p.xcor_destaque, e.cor_destaque),
  cor_fundo = COALESCE(p.xcor_fundo, e.cor_fundo),
  cor_fundo_card = COALESCE(p.xcor_fundo_card, e.cor_fundo_card),
  cor_texto_principal = COALESCE(p.xcor_texto_principal, e.cor_texto_principal),
  cor_texto_secundario = COALESCE(p.xcor_texto_secundario, e.cor_texto_secundario),
  cor_botao = COALESCE(p.xcor_botao, e.cor_botao),
  cor_botao_negativo = COALESCE(p.xcor_botao_negativo, e.cor_botao_negativo),
  cor_header = COALESCE(p.xcor_header, e.cor_header),
  cor_link = COALESCE(p.xcor_link, e.cor_link),
  cor_menu = COALESCE(p.xcor_menu, e.cor_menu),
  nm_escola = COALESCE(p.xnm_escola, e.nm_escola),
  url_logo = COALESCE(p.xurl_logo, e.url_logo),
  url_favicon = COALESCE(p.xurl_favicon, e.url_favicon),
  url_banner_vendas = COALESCE(p.xurl_banner_vendas, e.url_banner_vendas),
  url_link_vendas = COALESCE(p.xurl_link_vendas, e.url_link_vendas),
  msg_pos_pagamento = COALESCE(p.xmsg_pos_pagamento, e.msg_pos_pagamento),
  lg_valida_estoque_link = COALESCE(p.xlg_valida_estoque_link, e.lg_valida_estoque_link),
  lg_valida_estoque_pdv = COALESCE(p.xlg_valida_estoque_pdv, e.lg_valida_estoque_pdv),
  email_remetente = COALESCE(p.xemail_remetente, e.email_remetente),
  abacatepay_api_key = COALESCE(p.xabacatepay_api_key, e.abacatepay_api_key),
  abacatepay_webhook_url = COALESCE(p.xabacatepay_webhook_url, e.abacatepay_webhook_url),
  abacatepay_webhook_secret = COALESCE(p.xabacatepay_webhook_secret, e.abacatepay_webhook_secret),
  css_customizado = COALESCE(p.xcss_customizado, e.css_customizado)
FROM (SELECT * FROM public.parametro WHERE excluido = false LIMIT 1) p;

-- 3. Rename parametro_horario to empresa_hs_lojavirtual
ALTER TABLE public.parametro_horario RENAME TO empresa_hs_lojavirtual;

-- 4. Rename xparametro_id column to empresa_id
ALTER TABLE public.empresa_hs_lojavirtual RENAME COLUMN xparametro_id TO empresa_id;

-- 5. Add FK to empresa
ALTER TABLE public.empresa_hs_lojavirtual
  ADD CONSTRAINT fk_empresa_hs_lojavirtual_empresa
  FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);

-- 6. Drop old RLS policies on renamed table
DROP POLICY IF EXISTS "Anyone can view horarios" ON public.empresa_hs_lojavirtual;
DROP POLICY IF EXISTS "Auth can insert parametro_horario" ON public.empresa_hs_lojavirtual;
DROP POLICY IF EXISTS "Auth can update parametro_horario" ON public.empresa_hs_lojavirtual;

-- 7. Create new RLS policies
CREATE POLICY "Auth can view empresa_hs_lojavirtual"
  ON public.empresa_hs_lojavirtual FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth can insert empresa_hs_lojavirtual"
  ON public.empresa_hs_lojavirtual FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Auth can update empresa_hs_lojavirtual"
  ON public.empresa_hs_lojavirtual FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view empresa_hs_lojavirtual"
  ON public.empresa_hs_lojavirtual FOR SELECT
  TO anon USING (true);

-- 8. Create logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policy for logos bucket
CREATE POLICY "Auth can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

CREATE POLICY "Auth can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Auth can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');

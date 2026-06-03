-- Migration: 20260601141500_create_cadastro_motorista.sql
-- Cria a tabela de cadastro_motorista vinculada a empresas e cadastros/parceiros de forma independente

CREATE TABLE public.cadastro_motorista (
    motorista_id integer NOT NULL GENERATED ALWAYS AS IDENTITY,
    empresa_id integer NOT NULL REFERENCES public.empresa(empresa_id) ON DELETE CASCADE,
    cadastro_id integer NOT NULL REFERENCES public.cadastro(cadastro_id) ON DELETE CASCADE,
    cpf character varying(11) NOT NULL,
    nome character varying(100) NOT NULL,
    telefone character varying(20),
    chave_pix character varying(100),
    ativo boolean DEFAULT true,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);

-- Primary Key constraint
ALTER TABLE ONLY public.cadastro_motorista
    ADD CONSTRAINT cadastro_motorista_pkey PRIMARY KEY (motorista_id);

-- Enable RLS
ALTER TABLE public.cadastro_motorista ENABLE ROW LEVEL SECURITY;

-- Policy to enable all for authenticated users
CREATE POLICY "Enable all for authenticated" ON public.cadastro_motorista TO authenticated USING (true) WITH CHECK (true);

-- System version record
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.6',
  'Tabela de Cadastro de Motoristas',
  'Implementada a nova tabela cadastro_motorista para gerenciar condutores e motoristas associados diretamente a transportadores e fornecedores na tela de parceiros.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Schema']
);

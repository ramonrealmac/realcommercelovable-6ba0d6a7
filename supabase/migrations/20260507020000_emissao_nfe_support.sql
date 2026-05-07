-- Motor de Emissão NF-e/NF-Ce — Campos de suporte
-- Execute no Supabase SQL Editor

-- 1. Campos fiscais na tabela empresa
ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS cnpj                varchar(18)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS inscricao_estadual  varchar(30)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS inscricao_municipal varchar(30)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS regime_trib         varchar(1)   DEFAULT 'S' NOT NULL, -- S=Simples, L=Presumido, N=Real
  ADD COLUMN IF NOT EXISTS endereco_cidade_id  integer,
  ADD COLUMN IF NOT EXISTS endereco_logradouro varchar(60)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS endereco_numero     varchar(10)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS endereco_bairro     varchar(40)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS endereco_cep        varchar(10)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS fone_geral          varchar(15)  DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS email               varchar(120) DEFAULT '' NOT NULL;

-- 2. Campos na tabela funcionario
ALTER TABLE public.funcionario
  ADD COLUMN IF NOT EXISTS nfe_config_item  integer REFERENCES public.fiscal_config_item(fiscal_config_item_id),
  ADD COLUMN IF NOT EXISTS nfce_config_item integer REFERENCES public.fiscal_config_item(fiscal_config_item_id);

-- 3. Campos na tabela movimento (rastreabilidade da NF-e gerada)
ALTER TABLE public.movimento
  ADD COLUMN IF NOT EXISTS tp_operacao_id    integer,
  ADD COLUMN IF NOT EXISTS vl_frete          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_despesa        numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_seguro         numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfe_cabecalho_id  bigint REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id);

-- 4. Campo fiscal_grupo_produto_id no produto (consolidado)
ALTER TABLE public.produto
  ADD COLUMN IF NOT EXISTS fiscal_grupo_produto_id integer,
  ADD COLUMN IF NOT EXISTS origem                  varchar(1) DEFAULT '0';

-- 5. Atualiza fiscal_grupo_produto_id a partir do grupo_icms_id existente
UPDATE public.produto SET fiscal_grupo_produto_id = grupo_icms_id
  WHERE fiscal_grupo_produto_id IS NULL AND grupo_icms_id IS NOT NULL;

-- 6. Estado (UF) na tabela cidade (se não existir com nome correto)
ALTER TABLE public.cidade
  ADD COLUMN IF NOT EXISTS estado_id varchar(2) DEFAULT 'SP';

-- Sincroniza estado_id com uf (campo existente)
UPDATE public.cidade SET estado_id = uf WHERE estado_id IS NULL OR estado_id = 'SP';

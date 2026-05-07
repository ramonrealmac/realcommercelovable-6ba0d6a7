-- Adiciona campos de rastreabilidade ao fiscal_evento
-- Para vincular evento ao registro que originou a nota fiscal

ALTER TABLE public.fiscal_evento
  ADD COLUMN IF NOT EXISTS referencia_id      bigint,       -- ID do registro referenciado (ex: nfe_cabecalho_id)
  ADD COLUMN IF NOT EXISTS referencia_tabela  varchar(60),  -- Nome da tabela (ex: fiscal_nfe_cabecalho)
  ADD COLUMN IF NOT EXISTS dados              text,         -- INI gerado para envio (separado do payload JSON)
  ADD COLUMN IF NOT EXISTS config             jsonb,        -- Config de certificado/ambiente
  ADD COLUMN IF NOT EXISTS usuario_id         uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ambiente           integer;      -- 1=Produção, 2=Homologação

-- Index para busca por referência
CREATE INDEX IF NOT EXISTS ix_fiscal_evento_ref ON public.fiscal_evento(referencia_tabela, referencia_id);

-- Política de UPDATE para o worker poder atualizar o status
DROP POLICY IF EXISTS "service_role can update fiscal_evento" ON public.fiscal_evento;
CREATE POLICY "service_role can update fiscal_evento" ON public.fiscal_evento
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Adiciona campos que podem estar faltando ao fiscal_nfe_cabecalho 
-- (campos de retorno da SEFAZ)
ALTER TABLE public.fiscal_nfe_cabecalho
  ADD COLUMN IF NOT EXISTS chave_nfe     varchar(44) DEFAULT '',
  ADD COLUMN IF NOT EXISTS nr_protocolo  varchar(50) DEFAULT '',
  ADD COLUMN IF NOT EXISTS c_stat        integer,
  ADD COLUMN IF NOT EXISTS x_motivo      varchar(255),
  ADD COLUMN IF NOT EXISTS xml_nf        text,
  ADD COLUMN IF NOT EXISTS recibo_sefaz  varchar(50),
  ADD COLUMN IF NOT EXISTS vl_desconto   numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_frete      numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_seguro     numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_despesa    numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_total_nf   numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS obs_nf        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS modelo        varchar(2) DEFAULT '55',
  ADD COLUMN IF NOT EXISTS serie         varchar(3) DEFAULT '001',
  ADD COLUMN IF NOT EXISTS tp_nf         integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fin_nfe       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tp_emis       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nat_op        varchar(60) DEFAULT '',
  ADD COLUMN IF NOT EXISTS origem_inclusao varchar(1) DEFAULT 'M',
  ADD COLUMN IF NOT EXISTS st_nf         varchar(1) DEFAULT 'A';

-- Adiciona campos que podem estar faltando ao fiscal_nfe_item
ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS produto_id    bigint,
  ADD COLUMN IF NOT EXISTS nr_item       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nm_produto    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ncm           varchar(10) DEFAULT '',
  ADD COLUMN IF NOT EXISTS cest          varchar(8) DEFAULT '',
  ADD COLUMN IF NOT EXISTS gtin          varchar(14) DEFAULT '',
  ADD COLUMN IF NOT EXISTS cfop          varchar(6) DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidade       varchar(6) DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS qt_movimento  numeric(15,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vl_unit       numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_desconto   numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_total      numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS csosn         varchar(3) DEFAULT '',
  ADD COLUMN IF NOT EXISTS origem        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pc_icms       numeric(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_icms       numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pc_icms_st    numeric(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_bc_st      numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mod_bc        integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS mod_bc_st     integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS mva_st        numeric(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_enq         varchar(3) DEFAULT '999',
  ADD COLUMN IF NOT EXISTS vl_ipi        numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_pis        numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_cofins     numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cst_pis       varchar(3) DEFAULT '07',
  ADD COLUMN IF NOT EXISTS cst_cofins    varchar(3) DEFAULT '07';

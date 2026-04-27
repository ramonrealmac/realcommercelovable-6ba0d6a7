
ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS empresa_matriz_id integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ie varchar(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS identificacao varchar(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_cidade_id integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS endereco_logradouro varchar(60) DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_numero varchar(8) DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_bairro varchar(40) DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_cep varchar(10) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fone_geral varchar(15) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fone_comercial varchar(15) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fone_financeiro varchar(15) DEFAULT '',
  ADD COLUMN IF NOT EXISTS fone_faturamento varchar(15) DEFAULT '',
  ADD COLUMN IF NOT EXISTS vl_venda_qt_decimais smallint DEFAULT 2,
  ADD COLUMN IF NOT EXISTS qt_venda_qt_decimais smallint DEFAULT 2,
  ADD COLUMN IF NOT EXISTS vl_saida_qt_decimais smallint DEFAULT 2,
  ADD COLUMN IF NOT EXISTS qt_saida_qt_decimais smallint DEFAULT 2,
  ADD COLUMN IF NOT EXISTS regime_trib varchar(1) DEFAULT 'S';

COMMENT ON COLUMN public.empresa.empresa_matriz_id IS 'Empresa à qual esta está vinculada (FK para empresa)';
COMMENT ON COLUMN public.empresa.regime_trib IS 'S=Simples Nacional, N=Normal, L=Lucro Presumido';

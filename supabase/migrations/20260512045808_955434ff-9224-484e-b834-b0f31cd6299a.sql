
-- =========================================================
-- 1. Novos campos em fiscal_nfe_cabecalho
-- =========================================================
ALTER TABLE public.fiscal_nfe_cabecalho
  ADD COLUMN IF NOT EXISTS vl_fcp         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_fcp_st      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_fcp_st_ret  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_icms_deson  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_ii          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_ipi_devol   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_outro       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS movimento_id   bigint;

-- =========================================================
-- 2. Novos campos em fiscal_nfe_item
-- =========================================================
ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS vl_frete            numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_seguro           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_outro            numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qt_tributavel       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_unit_tributavel  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_bc_ipi           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_bc_pis           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_bc_cofins        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pc_fcp              numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_fcp              numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mod_bc              smallint DEFAULT 3,
  ADD COLUMN IF NOT EXISTS mod_bc_st           smallint DEFAULT 4,
  ADD COLUMN IF NOT EXISTS pc_red_bc           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pc_red_bc_st        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_icms_deson       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pc_cred_sn          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vl_cred_sn          numeric NOT NULL DEFAULT 0;

-- =========================================================
-- 3. Índice para acelerar a cascata de filtros
-- =========================================================
CREATE INDEX IF NOT EXISTS ix_fiscal_regra_item_cascata
  ON public.fiscal_regra_item (fiscal_regra_id, tipo_imposto, fiscal_grupo_produto_id);

CREATE INDEX IF NOT EXISTS ix_fiscal_regra_cfop_cascata
  ON public.fiscal_regra_cfop (fiscal_regra_id, fiscal_grupo_produto_id);

-- =========================================================
-- 4. Arredondamento ABNT NBR 5891 (round half to even / banker's rounding)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fu_round_abnt(p_val numeric, p_dec int DEFAULT 2)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_factor numeric;
  v_scaled numeric;
  v_floor  numeric;
  v_diff   numeric;
BEGIN
  IF p_val IS NULL THEN RETURN 0; END IF;
  v_factor := power(10, p_dec);
  v_scaled := p_val * v_factor;
  v_floor  := floor(abs(v_scaled));
  v_diff   := abs(v_scaled) - v_floor;

  IF v_diff < 0.5 THEN
    v_scaled := sign(p_val) * v_floor;
  ELSIF v_diff > 0.5 THEN
    v_scaled := sign(p_val) * (v_floor + 1);
  ELSE
    -- exatamente .5 → arredonda para o par mais próximo
    IF (v_floor::bigint % 2) = 0 THEN
      v_scaled := sign(p_val) * v_floor;
    ELSE
      v_scaled := sign(p_val) * (v_floor + 1);
    END IF;
  END IF;
  RETURN v_scaled / v_factor;
END;
$$;

-- =========================================================
-- 5. Função principal: fu_calcular_impostos_movimento
-- =========================================================
CREATE OR REPLACE FUNCTION public.fu_calcular_impostos_movimento(
  p_movimento_id bigint,
  p_modelo       text DEFAULT '55',          -- '55' NF-e | '65' NFC-e
  p_serie        text DEFAULT '001',
  p_nr_nota      text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov            RECORD;
  v_emp            RECORD;
  v_cad            RECORD;
  v_uf_dest        text;
  v_uf_orig        text;
  v_cli            text;       -- 'C','N','I','F'
  v_regra_id       int;
  v_regime         text;
  v_item           RECORD;
  v_prod           RECORD;
  v_grupo_id       int;

  v_ri             RECORD;     -- fiscal_regra_item escolhido
  v_cfop_row       RECORD;
  v_cfop_cd        text;

  v_qt             numeric;
  v_vl_unit        numeric;
  v_vl_bruto       numeric;
  v_vl_desc        numeric;
  v_vl_liq         numeric;
  v_vl_prod_total  numeric;
  v_rateio_frete   numeric;
  v_rateio_seguro  numeric;
  v_rateio_outro   numeric;

  v_bc_icms        numeric;
  v_vl_icms        numeric;
  v_bc_st          numeric;
  v_vl_st          numeric;
  v_vl_ipi         numeric;
  v_vl_pis         numeric;
  v_vl_cofins      numeric;
  v_vl_ibs         numeric;
  v_vl_cbs         numeric;
  v_vl_is          numeric;
  v_vl_fcp         numeric;
  v_vl_fcp_st      numeric;
  v_vl_cred_sn     numeric;

  v_csosn          text;
  v_cst_icms       text;

  -- totais de cabeçalho
  v_t_prod    numeric := 0;
  v_t_desc    numeric := 0;
  v_t_bc      numeric := 0;
  v_t_icms    numeric := 0;
  v_t_bcst    numeric := 0;
  v_t_st      numeric := 0;
  v_t_ipi     numeric := 0;
  v_t_pis     numeric := 0;
  v_t_cofins  numeric := 0;
  v_t_ibs     numeric := 0;
  v_t_cbs     numeric := 0;
  v_t_is      numeric := 0;
  v_t_fcp     numeric := 0;
  v_t_fcpst   numeric := 0;

  v_nfe_id    bigint;
  v_nr        int := 0;
  v_errors    text[] := ARRAY[]::text[];
  v_motivo    text;
BEGIN
  -- 1. Movimento
  SELECT * INTO v_mov FROM public.movimento WHERE movimento_id = p_movimento_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'FISCAL_CALC: movimento % não encontrado', p_movimento_id; END IF;

  -- 2. Empresa + UF origem
  SELECT e.*, c.estado_id AS uf
    INTO v_emp
    FROM public.empresa e
    LEFT JOIN public.cidade c ON c.cidade_id = e.endereco_cidade_id
   WHERE e.empresa_id = v_mov.empresa_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'FISCAL_CALC: empresa não encontrada'; END IF;
  v_regime  := COALESCE(v_emp.regime_trib, 'S');
  v_uf_orig := COALESCE(v_emp.uf, 'SP');

  -- 3. Cadastro destinatário
  SELECT cad.*, c.estado_id AS uf
    INTO v_cad
    FROM public.cadastro cad
    LEFT JOIN public.cidade c ON c.cidade_id = cad.endereco_cidade_id
   WHERE cad.cadastro_id = v_mov.cadastro_id;
  v_uf_dest := COALESCE(v_cad.uf, v_uf_orig);

  -- 4. Tipo cliente: C contribuinte, N não contribuinte, I isento, F consumidor final
  IF v_cad IS NULL THEN
    v_cli := 'F';
  ELSIF UPPER(COALESCE(v_cad.tp_contribuinte,'')) IN ('S','C','1') THEN
    v_cli := 'C';
  ELSIF UPPER(COALESCE(v_cad.tp_contribuinte,'')) IN ('I','2') THEN
    v_cli := 'I';
  ELSIF UPPER(COALESCE(v_cad.tp_pessoa,'')) = 'F' THEN
    v_cli := 'F';
  ELSE
    v_cli := 'N';
  END IF;

  -- 5. fiscal_regra (operação + regime + empresa)
  SELECT fiscal_regra_id INTO v_regra_id
    FROM public.fiscal_regra
   WHERE empresa_id = v_mov.empresa_id
     AND excluido = false
     AND (tp_operacao_id = v_mov.tp_operacao_id OR tp_operacao_id IS NULL)
     AND (regime_trib = v_regime OR regime_trib IS NULL OR regime_trib = '')
   ORDER BY (tp_operacao_id = v_mov.tp_operacao_id) DESC,
            COALESCE(prioridade,0) DESC,
            fiscal_regra_id DESC
   LIMIT 1;
  IF v_regra_id IS NULL THEN
    RAISE EXCEPTION 'FISCAL_CALC: nenhuma fiscal_regra para empresa % / tp_operacao % / regime %',
      v_mov.empresa_id, v_mov.tp_operacao_id, v_regime;
  END IF;

  -- soma de produtos para rateio
  SELECT COALESCE(SUM(qt_movimento * vl_und_produto - COALESCE(vl_desconto,0)),0)
    INTO v_vl_prod_total
    FROM public.movimento_item
   WHERE movimento_id = p_movimento_id AND excluido = false;
  IF v_vl_prod_total <= 0 THEN v_vl_prod_total := 1; END IF;

  -- 6. Cria cabeçalho
  INSERT INTO public.fiscal_nfe_cabecalho (
    empresa_id, cadastro_id, movimento_id, modelo, serie, nr_nota,
    tp_nf, fin_nfe, tp_emis, nat_op, origem_inclusao, st_nf,
    dt_emissao, dt_saida, vl_produto, vl_desconto, vl_frete, vl_seguro,
    vl_despesa, vl_outro
  ) VALUES (
    v_mov.empresa_id, v_mov.cadastro_id, p_movimento_id, p_modelo, p_serie,
    COALESCE(p_nr_nota,'0'),
    1, 1, 1, 'VENDA DE MERCADORIA', 'M', 'A',
    CURRENT_DATE, CURRENT_DATE, 0, 0,
    COALESCE(v_mov.vl_frete,0), COALESCE(v_mov.vl_seguro,0),
    COALESCE(v_mov.vl_despesa,0), COALESCE(v_mov.vl_outro,0)
  ) RETURNING nfe_cabecalho_id INTO v_nfe_id;

  -- 7. Itens
  FOR v_item IN
    SELECT * FROM public.movimento_item
     WHERE movimento_id = p_movimento_id AND excluido = false
     ORDER BY movimento_item_id
  LOOP
    v_nr := v_nr + 1;

    SELECT * INTO v_prod FROM public.produto WHERE produto_id = v_item.produto_id;
    IF v_prod IS NULL THEN
      v_errors := v_errors || format('item %s: produto não encontrado', v_nr);
      CONTINUE;
    END IF;

    v_qt       := COALESCE(v_item.qt_movimento, 0);
    v_vl_unit  := COALESCE(v_item.vl_und_produto, 0);
    v_vl_bruto := v_qt * v_vl_unit;
    v_vl_desc  := COALESCE(v_item.vl_desconto, 0);
    v_vl_liq   := v_vl_bruto - v_vl_desc;

    v_rateio_frete  := public.fu_round_abnt(COALESCE(v_mov.vl_frete,0)  * v_vl_liq / v_vl_prod_total, 2);
    v_rateio_seguro := public.fu_round_abnt(COALESCE(v_mov.vl_seguro,0) * v_vl_liq / v_vl_prod_total, 2);
    v_rateio_outro  := public.fu_round_abnt((COALESCE(v_mov.vl_despesa,0)+COALESCE(v_mov.vl_outro,0)) * v_vl_liq / v_vl_prod_total, 2);

    -- ===== CFOP (cascata) =====
    SELECT rc.*, c.cd_cfop INTO v_cfop_row
      FROM public.fiscal_regra_cfop rc
      LEFT JOIN public.cfop c ON c.cfop_id = rc.cfop_id
     WHERE rc.fiscal_regra_id = v_regra_id
       AND (rc.uf_destino = v_uf_dest OR rc.uf_destino = 'ZZ' OR rc.uf_destino IS NULL OR rc.uf_destino = '')
       AND (rc.fiscal_grupo_produto_id = v_prod.grupo_icms_id OR rc.fiscal_grupo_produto_id IS NULL)
       AND (rc.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text OR rc.origem_produto = '99' OR rc.origem_produto IS NULL OR rc.origem_produto = '')
       AND (rc.ncm_filtro = COALESCE(v_prod.ncm,'') OR rc.ncm_filtro = '99999999' OR rc.ncm_filtro IS NULL OR rc.ncm_filtro = '')
       AND (rc.cliente_contribuinte = v_cli OR rc.cliente_contribuinte = 'Z' OR rc.cliente_contribuinte IS NULL OR rc.cliente_contribuinte = '')
     ORDER BY (rc.uf_destino = v_uf_dest) DESC,
              (rc.fiscal_grupo_produto_id = v_prod.grupo_icms_id) DESC,
              (rc.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text) DESC,
              (rc.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC,
              (rc.cliente_contribuinte = v_cli) DESC
     LIMIT 1;

    v_cfop_cd := COALESCE(v_cfop_row.cd_cfop, '5102');
    IF v_cfop_row IS NULL THEN
      v_errors := v_errors || format('item %s: CFOP não encontrado para UF %s', v_nr, v_uf_dest);
    END IF;

    -- ===== Helper inline: busca regra_item por tipo =====
    -- ICMS
    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'ICMS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_icms_id OR ri.fiscal_grupo_produto_id IS NULL)
       AND (ri.uf_destino = v_uf_dest OR ri.uf_destino = 'ZZ' OR ri.uf_destino IS NULL OR ri.uf_destino = '')
       AND (ri.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text OR ri.origem_produto = '99' OR ri.origem_produto IS NULL OR ri.origem_produto = '')
       AND (ri.ncm_filtro = COALESCE(v_prod.ncm,'') OR ri.ncm_filtro = '99999999' OR ri.ncm_filtro IS NULL OR ri.ncm_filtro = '')
       AND (ri.cliente_contribuinte = v_cli OR ri.cliente_contribuinte = 'Z' OR ri.cliente_contribuinte IS NULL OR ri.cliente_contribuinte = '')
     ORDER BY (ri.uf_destino = v_uf_dest) DESC,
              (ri.fiscal_grupo_produto_id = v_prod.grupo_icms_id) DESC,
              (ri.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text) DESC,
              (ri.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC,
              (ri.cliente_contribuinte = v_cli) DESC
     LIMIT 1;

    v_csosn := NULL; v_cst_icms := NULL;
    v_bc_icms := 0; v_vl_icms := 0; v_bc_st := 0; v_vl_st := 0;
    v_vl_fcp := 0; v_vl_fcp_st := 0; v_vl_cred_sn := 0;

    IF v_ri IS NULL THEN
      v_errors := v_errors || format('item %s: sem regra ICMS para grupo %s/UF %s', v_nr, v_prod.grupo_icms_id, v_uf_dest);
    ELSE
      IF v_regime = 'S' THEN v_csosn := v_ri.cst_csosn; ELSE v_cst_icms := v_ri.cst_csosn; END IF;
      v_bc_icms := public.fu_round_abnt(v_vl_liq * (1 - COALESCE(v_ri.base_reducao,0)/100), 2);
      v_vl_icms := public.fu_round_abnt(v_bc_icms * COALESCE(v_ri.aliquota,0)/100, 2);
      IF COALESCE(v_ri.icms_st_aliquota,0) > 0 THEN
        v_bc_st := public.fu_round_abnt(v_vl_liq * (1 + COALESCE(v_ri.icms_st_mva,0)/100) * (1 - COALESCE(v_ri.icms_st_base_reducao,0)/100), 2);
        v_vl_st := public.fu_round_abnt(v_bc_st * v_ri.icms_st_aliquota/100 - v_vl_icms, 2);
        IF v_vl_st < 0 THEN v_vl_st := 0; END IF;
      END IF;
      IF v_regime = 'S' AND COALESCE(v_ri.p_cre_sn,0) > 0 THEN
        v_vl_cred_sn := public.fu_round_abnt(v_vl_liq * v_ri.p_cre_sn/100, 2);
      END IF;
    END IF;

    -- IPI
    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'IPI'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_ipi_id OR ri.fiscal_grupo_produto_id IS NULL)
       AND (ri.uf_destino = v_uf_dest OR ri.uf_destino = 'ZZ' OR ri.uf_destino IS NULL OR ri.uf_destino = '')
       AND (ri.ncm_filtro = COALESCE(v_prod.ncm,'') OR ri.ncm_filtro = '99999999' OR ri.ncm_filtro IS NULL OR ri.ncm_filtro = '')
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_ipi_id) DESC,
              (ri.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC
     LIMIT 1;
    v_vl_ipi := CASE WHEN v_ri IS NULL THEN 0
                     ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    -- PIS
    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'PIS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id) DESC
     LIMIT 1;
    v_vl_pis := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    -- COFINS
    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'COFINS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id) DESC
     LIMIT 1;
    v_vl_cofins := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    -- IBS/CBS/IS
    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) IN ('CBSIBS','IBSCBS','IBS')
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_ibscbs_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_ibscbs_id) DESC
     LIMIT 1;
    v_vl_ibs := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.ibs_aliquota,0)/100, 2) END;
    v_vl_cbs := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.cbs_aliquota,0)/100, 2) END;
    v_vl_is  := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.is_aliquota,0)/100, 2) END;

    -- 7.x INSERT item
    INSERT INTO public.fiscal_nfe_item (
      nfe_cabecalho_id, empresa_id, produto_id, nr_item, cd_prod_fornec,
      nm_produto, ncm, cest, gtin, cfop, unidade,
      qt_entrada, vl_unit, vl_desconto, vl_total,
      vl_frete, vl_seguro, vl_outro,
      qt_tributavel, vl_unit_tributavel,
      origem, csosn, cst_icms,
      vl_bc, pc_icms, vl_icms,
      mod_bc, pc_red_bc, pc_cred_sn, vl_cred_sn,
      vl_bc_st, pc_icms_st, vl_icms_st, mod_bc_st, pc_red_bc_st,
      cst_ipi, c_enq, vl_bc_ipi, pc_ipi, vl_ipi,
      cst_pis, vl_bc_pis, pc_pis, vl_pis,
      cst_cofins, vl_bc_cofins, pc_cofins, vl_cofins,
      cst_ibs, pc_ibs, vl_ibs,
      cst_cbs, pc_cbs, vl_cbs,
      cst_is,  pc_is,  vl_is
    ) VALUES (
      v_nfe_id, v_mov.empresa_id, v_prod.produto_id, v_nr,
      COALESCE(v_prod.referencia, v_prod.produto_id::text),
      COALESCE(v_item.nm_produto, v_prod.nome),
      COALESCE(v_prod.ncm,''), COALESCE(v_prod.cest,''),
      COALESCE(NULLIF(v_prod.gtin,''),'SEM GTIN'),
      v_cfop_cd, COALESCE(v_prod.unidade_id::text,'UN'),
      v_qt, v_vl_unit, v_vl_desc, v_vl_liq,
      v_rateio_frete, v_rateio_seguro, v_rateio_outro,
      v_qt, v_vl_unit,
      COALESCE(v_prod.tb_a_origem::smallint, 0),
      COALESCE(v_csosn,''), COALESCE(v_cst_icms,''),
      v_bc_icms, COALESCE((SELECT aliquota FROM public.fiscal_regra_item WHERE fiscal_regra_id=v_regra_id AND UPPER(tipo_imposto)='ICMS' AND (fiscal_grupo_produto_id=v_prod.grupo_icms_id OR fiscal_grupo_produto_id IS NULL) LIMIT 1),0),
      v_vl_icms,
      3, 0, 0, v_vl_cred_sn,
      v_bc_st, 0, v_vl_st, 4, 0,
      '', '999', v_vl_liq, 0, v_vl_ipi,
      '49', v_vl_liq, 0, v_vl_pis,
      '49', v_vl_liq, 0, v_vl_cofins,
      '', 0, v_vl_ibs,
      '', 0, v_vl_cbs,
      '', 0, v_vl_is
    );

    v_t_prod   := v_t_prod   + v_vl_bruto;
    v_t_desc   := v_t_desc   + v_vl_desc;
    v_t_bc     := v_t_bc     + v_bc_icms;
    v_t_icms   := v_t_icms   + v_vl_icms;
    v_t_bcst   := v_t_bcst   + v_bc_st;
    v_t_st     := v_t_st     + v_vl_st;
    v_t_ipi    := v_t_ipi    + v_vl_ipi;
    v_t_pis    := v_t_pis    + v_vl_pis;
    v_t_cofins := v_t_cofins + v_vl_cofins;
    v_t_ibs    := v_t_ibs    + v_vl_ibs;
    v_t_cbs    := v_t_cbs    + v_vl_cbs;
    v_t_is     := v_t_is     + v_vl_is;
    v_t_fcp    := v_t_fcp    + v_vl_fcp;
    v_t_fcpst  := v_t_fcpst  + v_vl_fcp_st;
  END LOOP;

  -- 8. Atualiza totais do cabeçalho
  UPDATE public.fiscal_nfe_cabecalho SET
    vl_produto   = public.fu_round_abnt(v_t_prod,2),
    vl_desconto  = public.fu_round_abnt(v_t_desc,2),
    vl_bc        = public.fu_round_abnt(v_t_bc,2),
    vl_icms      = public.fu_round_abnt(v_t_icms,2),
    vl_icms_st   = public.fu_round_abnt(v_t_st,2),
    vl_ipi       = public.fu_round_abnt(v_t_ipi,2),
    vl_pis       = public.fu_round_abnt(v_t_pis,2),
    vl_cofins    = public.fu_round_abnt(v_t_cofins,2),
    vl_ibs       = public.fu_round_abnt(v_t_ibs,2),
    vl_cbs       = public.fu_round_abnt(v_t_cbs,2),
    vl_is        = public.fu_round_abnt(v_t_is,2),
    vl_fcp       = public.fu_round_abnt(v_t_fcp,2),
    vl_fcp_st    = public.fu_round_abnt(v_t_fcpst,2),
    vl_total_nf  = public.fu_round_abnt(
                     v_t_prod - v_t_desc + v_t_st + v_t_ipi + v_t_fcp + v_t_fcpst
                     + COALESCE(v_mov.vl_frete,0) + COALESCE(v_mov.vl_seguro,0)
                     + COALESCE(v_mov.vl_despesa,0) + COALESCE(v_mov.vl_outro,0), 2),
    obs_nf = CASE WHEN array_length(v_errors,1) IS NULL THEN COALESCE(v_mov.observacao,'')
                  ELSE COALESCE(v_mov.observacao,'') || E'\n[CALC] ' || array_to_string(v_errors, ' | ') END
  WHERE nfe_cabecalho_id = v_nfe_id;

  -- 9. Vincula ao movimento (se a coluna existir)
  BEGIN
    EXECUTE 'UPDATE public.movimento SET nfe_cabecalho_id = $1 WHERE movimento_id = $2'
      USING v_nfe_id, p_movimento_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  IF array_length(v_errors,1) IS NOT NULL THEN
    RAISE EXCEPTION 'FISCAL_CALC_ERRORS: %', array_to_string(v_errors,' | ');
  END IF;

  RETURN v_nfe_id;
END;
$$;

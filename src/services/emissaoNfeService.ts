import { supabase } from "@/integrations/supabase/client";
import { buscarTributosParaItem, ResultadoTributos } from "./regraFiscalEngine";
import { gerarIniNfe } from "./gerarIniNfe";

const db = supabase as any;

export interface EmissaoParams {
  movimento_id: number;
  modelo: '55' | '65'; // NFe | NFCe
  empresa_id: number;
  funcionario_id: number;
}

export interface EmissaoResult {
  sucesso: boolean;
  nfe_cabecalho_id?: number;
  fiscal_evento_id?: number;
  erro?: string;
}

/**
 * Serviço principal de emissão de NF-e / NF-Ce.
 * 1. Carrega dados do movimento, empresa, fiscal_config, produto.
 * 2. Aplica regras fiscais por produto.
 * 3. Grava fiscal_nfe_cabecalho, fiscal_nfe_item, fiscal_nfe_pagamento.
 * 4. Incrementa sequencial no fiscal_config_item.
 * 5. Cria fiscal_evento (PENDENTE) para o worker transmitir.
 */
export async function emitirNfe(params: EmissaoParams): Promise<EmissaoResult> {
  const { movimento_id, modelo, empresa_id, funcionario_id } = params;

  try {
    // ──────────────────────────────────────────────────────────────
    // 1. CARREGAR DADOS DO MOVIMENTO
    // ──────────────────────────────────────────────────────────────
    const { data: mov, error: eMov } = await db
      .from('movimento')
      .select(`
        *,
        cadastro:cadastro_id ( *, cidade:endereco_cidade_id ( uf, estado_id ) )
      `)
      .eq('movimento_id', movimento_id)
      .single();

    if (eMov || !mov) throw new Error('Movimento não encontrado: ' + (eMov?.message || ''));

    const { data: itens, error: eItens } = await db
      .from('movimento_item')
      .select(`
        *,
        produto:produto_id (
          produto_id, nome, ncm, cest, gtin, unidade_id, origem,
          grupo_icms_id, grupo_ipi_id, grupo_pis_cofins_id,
          fiscal_grupo_produto_id, peso_liquido, peso_bruto
        )
      `)
      .eq('movimento_id', movimento_id)
      .eq('excluido', false);

    if (eItens) throw new Error('Erro ao carregar itens: ' + eItens.message);

    const { data: pagamentos } = await db
      .from('movimento_pagamento')
      .select('*')
      .eq('movimento_id', movimento_id)
      .eq('excluido', false);

    // ──────────────────────────────────────────────────────────────
    // 2. CARREGAR EMPRESA
    // ──────────────────────────────────────────────────────────────
    const { data: empresa } = await db
      .from('empresa')
      .select('*, cidade:endereco_cidade_id ( uf, estado_id )')
      .eq('empresa_id', empresa_id)
      .single();

    if (!empresa) throw new Error('Empresa não encontrada.');

    // ──────────────────────────────────────────────────────────────
    // 3. CARREGAR FISCAL_CONFIG + FISCAL_CONFIG_ITEM
    // ──────────────────────────────────────────────────────────────
    const { data: fiscalConfig } = await db
      .from('fiscal_config')
      .select('*')
      .eq('empresa_id', empresa_id)
      .single();

    if (!fiscalConfig) throw new Error('Configuração fiscal não encontrada para a empresa.');

    // Obtém o config_item correto do funcionário (NFe ou NFCe)
    const { data: funcionario } = await db
      .from('funcionario')
      .select('nfe_config_item, nfce_config_item')
      .eq('funcionario_id', funcionario_id)
      .single();

    const configItemId = modelo === '65'
      ? funcionario?.nfce_config_item
      : funcionario?.nfe_config_item;

    if (!configItemId) throw new Error(`Funcionário não tem fiscal_config_item para modelo ${modelo}. Configure em Cadastros → Funcionários.`);

    const { data: configItem } = await db
      .from('fiscal_config_item')
      .select('*')
      .eq('fiscal_config_item_id', configItemId)
      .single();

    if (!configItem) throw new Error('fiscal_config_item não encontrado.');

    // ──────────────────────────────────────────────────────────────
    // 4. DETERMINAR UF DO DESTINO
    // ──────────────────────────────────────────────────────────────
    const ufDestino = mov.cadastro?.cidade?.uf || mov.cadastro?.cidade?.estado_id || '*';
    const ufEmitente = empresa.cidade?.uf || empresa.cidade?.estado_id || 'SP';

    const filtroRegra = {
      tp_operacao_id: mov.tp_operacao_id || null,
      regime_trib: empresa.regime_trib || 'S',
      empresa_id,
    };

    // ──────────────────────────────────────────────────────────────
    // 5. CALCULAR TRIBUTOS POR ITEM + MONTAR ITENS DA NOTA
    // ──────────────────────────────────────────────────────────────
    const itensNota: any[] = [];
    let vl_total_produtos = 0;
    let vl_total_ipi = 0;
    let vl_total_icms_st = 0;
    let vl_total_pis = 0;
    let vl_total_cofins = 0;
    let vl_total_ibs = 0;
    let vl_total_cbs = 0;
    let vl_total_desconto = 0;

    for (let i = 0; i < (itens || []).length; i++) {
      const item = itens[i];
      const prod = item.produto || {};
      const qtd = Number(item.qt_movimento || 1);
      const vlUnit = Number(item.vl_und_produto || 0);
      const vlDescItem = Number(item.vl_desconto || 0);
      const vlBruto = qtd * vlUnit;
      const vlLiq = vlBruto - vlDescItem;

      const filtroItem = {
        ncm: prod.ncm || '99999999',
        cest: prod.cest || '9999999',
        fiscal_grupo_produto_id: prod.fiscal_grupo_produto_id || prod.grupo_icms_id || null,
        origem: prod.origem || '0',
        uf_destino: ufDestino,
        is_contribuinte: mov.cadastro?.tp_contribuinte === 'S',
        is_consumidor_final: true,
      };

      const trib: ResultadoTributos = await buscarTributosParaItem(filtroRegra, filtroItem);

      // Cálculo de impostos
      const bcIcms = vlLiq * (1 - trib.base_reducao_icms / 100);
      const vlIcms = bcIcms * trib.pc_icms / 100;
      const vlIcmsSt = vlLiq * trib.mva_st / 100 * trib.pc_icms_st / 100;
      const vlIpi = vlLiq * trib.pc_ipi / 100;
      const vlPis = vlLiq * trib.pc_pis / 100;
      const vlCofins = vlLiq * trib.pc_cofins / 100;
      const vlIbs = vlLiq * trib.pc_ibs / 100;
      const vlCbs = vlLiq * trib.pc_cbs / 100;

      vl_total_produtos += vlBruto;
      vl_total_desconto += vlDescItem;
      vl_total_ipi += vlIpi;
      vl_total_icms_st += vlIcmsSt;
      vl_total_pis += vlPis;
      vl_total_cofins += vlCofins;
      vl_total_ibs += vlIbs;
      vl_total_cbs += vlCbs;

      itensNota.push({
        empresa_id,
        nr_item: i + 1,
        produto_id: prod.produto_id || null,
        nm_produto: item.nm_produto || prod.nome || '',
        ncm: prod.ncm || '',
        cest: prod.cest || '',
        gtin: prod.gtin || 'SEM GTIN',
        cfop: trib.cfop,
        unidade: prod.unidade_id || item.unidade_id || 'UN',
        qt_movimento: qtd,
        vl_unit: vlUnit,
        vl_desconto: vlDescItem,
        vl_total: vlLiq,
        // ICMS
        cst_icms: trib.cst_icms,
        csosn: trib.csosn,
        origem: Number(prod.origem || 0),
        pc_icms: trib.pc_icms,
        vl_icms: arred(vlIcms),
        vl_bc_st: arred(vlLiq * trib.mva_st / 100),
        vl_icms_st: arred(vlIcmsSt),
        pc_icms_st: trib.pc_icms_st,
        // IPI
        cst_ipi: trib.cst_ipi,
        c_enq: trib.c_enq,
        pc_ipi: trib.pc_ipi,
        vl_ipi: arred(vlIpi),
        // PIS / COFINS
        cst_pis: trib.cst_pis,
        cst_cofins: trib.cst_cofins,
        pc_pis: trib.pc_pis,
        pc_cofins: trib.pc_cofins,
        vl_pis: arred(vlPis),
        vl_cofins: arred(vlCofins),
        // Reforma
        cst_ibs: '', pc_ibs: trib.pc_ibs, vl_ibs: arred(vlIbs),
        cst_cbs: '', pc_cbs: trib.pc_cbs, vl_cbs: arred(vlCbs),
        cst_is: '',  pc_is: trib.pc_is,   vl_is: 0,
      });
    }

    const vl_frete   = Number(mov.vl_frete   || 0);
    const vl_despesa = Number(mov.vl_despesa || 0);
    const vl_seguro  = Number(mov.vl_seguro  || 0);
    const vl_total_nf = arred(
      vl_total_produtos - vl_total_desconto + vl_total_ipi + vl_total_icms_st
      + vl_frete + vl_despesa + vl_seguro
    );

    const nr_nf = String(configItem.sequencia || 1).padStart(9, '0');

    // ──────────────────────────────────────────────────────────────
    // 6. GRAVAR fiscal_nfe_cabecalho
    // ──────────────────────────────────────────────────────────────
    const cabecalhoData = {
      empresa_id,
      cadastro_id: mov.cadastro_id || null,
      modelo,
      serie: configItem.serie || '001',
      nr_nota: nr_nf,
      tp_nf: 1,  // 1 = Saída
      fin_nfe: 1, // 1 = Normal
      tp_emis: 1, // 1 = Normal
      nat_op: 'VENDA DE MERCADORIA',
      origem_inclusao: 'M', // M = Movimento
      st_nf: 'A', // A = Aguardando transmissão
      dt_emissao: new Date().toISOString().split('T')[0],
      dt_saida: new Date().toISOString().split('T')[0],
      vl_produto: arred(vl_total_produtos),
      vl_desconto: arred(vl_total_desconto),
      vl_frete,
      vl_seguro,
      vl_despesa,
      vl_ipi: arred(vl_total_ipi),
      vl_icms_st: arred(vl_total_icms_st),
      vl_pis: arred(vl_total_pis),
      vl_cofins: arred(vl_total_cofins),
      vl_ibs: arred(vl_total_ibs),
      vl_cbs: arred(vl_total_cbs),
      vl_is: 0,
      vl_total_nf,
      obs_nf: mov.observacao || '',
    };

    const { data: cab, error: eCab } = await db
      .from('fiscal_nfe_cabecalho')
      .insert(cabecalhoData)
      .select('nfe_cabecalho_id')
      .single();

    if (eCab) throw new Error('Erro ao gravar cabeçalho NF-e: ' + eCab.message);

    const nfe_cabecalho_id = cab.nfe_cabecalho_id;

    // ──────────────────────────────────────────────────────────────
    // 7. GRAVAR fiscal_nfe_item
    // ──────────────────────────────────────────────────────────────
    const itensParaInserir = itensNota.map(it => ({
      ...it,
      nfe_cabecalho_id,
    }));

    const { error: eItensNf } = await db
      .from('fiscal_nfe_item')
      .insert(itensParaInserir);

    if (eItensNf) throw new Error('Erro ao gravar itens NF-e: ' + eItensNf.message);

    // ──────────────────────────────────────────────────────────────
    // 8. GRAVAR fiscal_nfe_pagamento
    // ──────────────────────────────────────────────────────────────
    if (pagamentos?.length) {
      const pagNfe = pagamentos.map((p: any) => ({
        nfe_cabecalho_id,
        t_pag: mapearFormaPagamento(p.tp_pagamento),
        v_pag: Number(p.vl_pagamento || 0),
      }));
      const { error: ePag } = await db.from('fiscal_nfe_pagamento').insert(pagNfe);
      if (ePag) throw new Error('Erro ao gravar pagamentos NF-e: ' + ePag.message);
    }

    // ──────────────────────────────────────────────────────────────
    // 9. INCREMENTAR SEQUENCIAL
    // ──────────────────────────────────────────────────────────────
    await db
      .from('fiscal_config_item')
      .update({ sequencia: (configItem.sequencia || 1) + 1 })
      .eq('fiscal_config_item_id', configItemId);

    // ──────────────────────────────────────────────────────────────
    // 10. VINCULAR NOTA AO MOVIMENTO
    // ──────────────────────────────────────────────────────────────
    await db
      .from('movimento')
      .update({ nfe_cabecalho_id })
      .eq('movimento_id', movimento_id);

    // ──────────────────────────────────────────────────────────────
    // 11. GERAR INI E DESPACHAR PARA O WORKER
    // ──────────────────────────────────────────────────────────────
    const iniContent = gerarIniNfe({
      cabecalho: { ...cabecalhoData, nfe_cabecalho_id, nr_nota: nr_nf },
      itens: itensNota,
      pagamentos: pagamentos || [],
      empresa,
      cadastro: mov.cadastro,
      fiscalConfig,
      configItem,
    });

    const comandoFiscal = modelo === '65' ? 'EMITIR_NFCE' : 'EMITIR_NFE';

    const { data: evento, error: eEvento } = await db
      .from('fiscal_evento')
      .insert({
        empresa_id,
        comando: comandoFiscal,
        status: 'PENDENTE',
        dados: iniContent,
        config: {
          uf: ufEmitente,
          modelo: Number(modelo),
          ambiente: Number(fiscalConfig.ambiente_nfe || 2),
          certificadoPath: fiscalConfig.certificado,
          certificadoSenha: fiscalConfig.senha_certificado || '',
          tipo_certificado: fiscalConfig.tipo_certificado || 'ARQUIVO',
          csc: configItem.csc || '',
          id_csc: configItem.id_csc || '',
        },
        referencia_id: nfe_cabecalho_id,
        referencia_tabela: 'fiscal_nfe_cabecalho',
      })
      .select('fiscal_evento_id')
      .single();

    if (eEvento) throw new Error('Erro ao criar evento fiscal: ' + eEvento.message);

    return {
      sucesso: true,
      nfe_cabecalho_id,
      fiscal_evento_id: evento.fiscal_evento_id,
    };

  } catch (err: any) {
    console.error('[EmissaoNfe] ERRO:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

function mapearFormaPagamento(tp: string): string {
  const mapa: Record<string, string> = {
    'DINHEIRO': '01',
    'CHEQUE': '02',
    'CARTAO_CREDITO': '03',
    'CARTAO_DEBITO': '04',
    'CREDITO_LOJA': '05',
    'VALE_ALIMENTACAO': '10',
    'VALE_REFEICAO': '11',
    'VALE_PRESENTE': '12',
    'VALE_COMBUSTIVEL': '13',
    'BOLETO': '15',
    'PIX': '17',
    'TRANSFERENCIA': '18',
    'SEM_PAGAMENTO': '90',
    'OUTRO': '99',
  };
  return mapa[tp?.toUpperCase()] || '01';
}

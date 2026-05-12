import { supabase } from "@/integrations/supabase/client";
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
 * Serviço de emissão de NF-e / NF-Ce.
 *
 * Fluxo (refatorado):
 *  1. Lê empresa + fiscal_config + funcionario (config_item / sequência).
 *  2. Chama RPC `fu_calcular_impostos_movimento`, que faz TODO o cálculo fiscal
 *     no banco (cascata fiscal_regra → fiscal_regra_item, arredondamento ABNT)
 *     e popula `fiscal_nfe_cabecalho` + `fiscal_nfe_item` em uma única transação.
 *  3. Relê cabeçalho/itens do banco para montar o INI.
 *  4. Grava pagamentos, incrementa sequencial e despacha evento para o worker.
 */
export async function emitirNfe(params: EmissaoParams): Promise<EmissaoResult> {
  const { movimento_id, modelo, empresa_id, funcionario_id } = params;

  try {
    // 1. Empresa
    const { data: empresa } = await db
      .from('empresa')
      .select('*, cidade:endereco_cidade_id ( uf, estado_id, cd_ibge )')
      .eq('empresa_id', empresa_id)
      .single();
    if (!empresa) throw new Error('Empresa não encontrada.');

    const ufEmitente = empresa.cidade?.uf || empresa.cidade?.estado_id || 'SP';

    // 2. Fiscal config + funcionário
    const { data: fiscalConfig } = await db
      .from('fiscal_config').select('*').eq('empresa_id', empresa_id).single();
    if (!fiscalConfig) throw new Error('Configuração fiscal não encontrada para a empresa.');

    const { data: funcionario } = await db
      .from('funcionario')
      .select('nfe_config_item, nfce_config_item')
      .eq('funcionario_id', funcionario_id)
      .single();

    const configItemId = modelo === '65' ? funcionario?.nfce_config_item : funcionario?.nfe_config_item;
    if (!configItemId) throw new Error(`Funcionário sem fiscal_config_item para modelo ${modelo}.`);

    const { data: configItem } = await db
      .from('fiscal_config_item').select('*').eq('fiscal_config_item_id', configItemId).single();
    if (!configItem) throw new Error('fiscal_config_item não encontrado.');

    const nr_nf = String((configItem.sequencia || 1));

    // 3. CALCULA NO BANCO — popula fiscal_nfe_cabecalho/item via RPC
    const { data: nfeIdRet, error: eCalc } = await db.rpc('fu_calcular_impostos_movimento', {
      p_movimento_id: movimento_id,
      p_modelo: modelo,
      p_serie: String(configItem.serie || '001'),
      p_nr_nota: nr_nf,
    });
    if (eCalc) {
      // Mensagens FISCAL_CALC_ERRORS / FISCAL_CALC: ... vêm da função
      throw new Error(eCalc.message || 'Erro no cálculo fiscal.');
    }
    const nfe_cabecalho_id: number = nfeIdRet as number;

    // 4. Relê cabeçalho + itens já calculados
    const { data: cabecalho, error: eCab } = await db
      .from('fiscal_nfe_cabecalho').select('*').eq('nfe_cabecalho_id', nfe_cabecalho_id).single();
    if (eCab || !cabecalho) throw new Error('Cabeçalho fiscal não localizado após cálculo.');

    const { data: itens, error: eItens } = await db
      .from('fiscal_nfe_item').select('*').eq('nfe_cabecalho_id', nfe_cabecalho_id).order('nr_item');
    if (eItens) throw new Error('Erro ao reler itens fiscais: ' + eItens.message);

    // 5. Cadastro destinatário + pagamentos do movimento
    const { data: mov } = await db
      .from('movimento')
      .select('cadastro_id, observacao')
      .eq('movimento_id', movimento_id).single();

    const { data: cadastro } = mov?.cadastro_id ? await db
      .from('cadastro')
      .select('*, cidade:endereco_cidade_id ( uf, estado_id, cd_ibge, descricao )')
      .eq('cadastro_id', mov.cadastro_id).single() : { data: null };

    const { data: pagamentos } = await db
      .from('movimento_pagamento')
      .select('*').eq('movimento_id', movimento_id).eq('excluido', false);

    // 6. fiscal_nfe_pagamento
    if (pagamentos?.length) {
      const pagNfe = pagamentos.map((p: any) => ({
        nfe_cabecalho_id,
        t_pag: mapearFormaPagamento(p.tp_pagamento),
        v_pag: Number(p.vl_pagamento || 0),
      }));
      const { error: ePag } = await db.from('fiscal_nfe_pagamento').insert(pagNfe);
      if (ePag) throw new Error('Erro ao gravar pagamentos NF-e: ' + ePag.message);
    }

    // 7. Incrementa sequencial
    await db
      .from('fiscal_config_item')
      .update({ sequencia: (configItem.sequencia || 1) + 1 })
      .eq('fiscal_config_item_id', configItemId);

    // 8. Gera INI a partir do que está no banco
    const iniContent = gerarIniNfe({
      cabecalho,
      itens: itens || [],
      pagamentos: pagamentos || [],
      empresa,
      cadastro,
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
          pasta_arquivos: (fiscalConfig as any).pasta_arquivos_fiscais || '',
        },
        referencia_id: nfe_cabecalho_id,
        referencia_tabela: 'fiscal_nfe_cabecalho',
      })
      .select('fiscal_evento_id')
      .single();

    if (eEvento) throw new Error('Erro ao criar evento fiscal: ' + eEvento.message);

    return { sucesso: true, nfe_cabecalho_id, fiscal_evento_id: evento.fiscal_evento_id };
  } catch (err: any) {
    console.error('[EmissaoNfe] ERRO:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

function mapearFormaPagamento(tp: string): string {
  const mapa: Record<string, string> = {
    'DINHEIRO': '01', 'CHEQUE': '02', 'CARTAO_CREDITO': '03', 'CARTAO_DEBITO': '04',
    'CREDITO_LOJA': '05', 'VALE_ALIMENTACAO': '10', 'VALE_REFEICAO': '11',
    'VALE_PRESENTE': '12', 'VALE_COMBUSTIVEL': '13', 'BOLETO': '15',
    'PIX': '17', 'TRANSFERENCIA': '18', 'SEM_PAGAMENTO': '90', 'OUTRO': '99',
  };
  return mapa[tp?.toUpperCase()] || '01';
}

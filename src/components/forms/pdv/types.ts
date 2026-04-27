export interface IPdvCaixa {
  funcionario_id: number;
  nome: string;
  tamanho_fonte_pedidos?: number;
  tamanho_fonte_produtos?: number;
  tempo_refresh_pdv?: number;
  caixa_inf_vend?: string | null;
  caixa_cnc_venda?: string | null;
  caixa_edit_venda?: string | null;
}

export interface IPdvVendedor {
  funcionario_id: number;
  nome: string;
}

export interface IPdvCaixaAbertura {
  caixa_abertura_id: number;
  empresa_id: number;
  funcionario_id: number;
  dt_abertura: string;
  vl_abertura: number | null;
  vl_fechamento: number | null;
  status: string;
}

export interface IPdvParamsEmpresa {
  tp_operacao_caixa: number;
  conta_gerencial_caixa: number;
  centro_custo_caixa: number;
  deposito_estoque_caixa: number;
  imagem_caixa?: string | null;
}

export interface IPdvPedidoFechado {
  movimento_id: number;
  nr_movimento: number | null;
  cadastro_id: number | null;
  cliente_nome: string;
  vendedor_id: number | null;
  vendedor_nome: string;
  vl_movimento: number;
  dt_emissao: string | null;
}

export interface IPdvPagamentoLinha {
  /** id local apenas para react key */
  uid: string;
  condicao_id: number;
  condicao_descricao: string;
  bandeira_id: number | null;
  bandeira_descricao: string;
  operadora_id: number | null;
  operadora_descricao: string;
  numero_autoriza: string;
  qt_parcela: number;
  vl_parcela: number;
  vl_recebido: number;
}

export interface IMovimentoPagamento {
  movimento_pagamento_id: number;
  condicao_id: number | null;
  vl_pagamento: number | null;
  numero_autorizacao: string | null;
  bandeira_id: number | null;
  operadora_id: number | null;
  n_parcelas: number | null;
}

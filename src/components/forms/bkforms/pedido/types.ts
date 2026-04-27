export interface IMovimento {
  movimento_id: number;
  empresa_id: number;
  cadastro_id: number | null;
  funcionario_id: number | null;
  nr_movimento: number | null;
  tp_movimento: string;
  tp_origem: string;
  st_pedido: string;        // O=Orçamento, P=Pedido, V=Venda, C=Cancelado
  faturado: string;         // S/N
  dt_emissao: string | null;
  dt_entrega: string | null;
  numero_nfe: string | null;
  tp_operacao_id: number | null;
  tp_desconto: string;      // N=Sem, I=Item, P=Pedido
  pc_desconto: number;
  vl_desc_rs: number | null;
  vl_produto: number;
  vl_desconto: number;
  vl_movimento: number;
  vl_frete: number;
  vl_despesa: number;
  vl_seguro: number;
  vl_outro: number;
  rota_id: number | null;
  cidade_id: number | null;
  cep_entrega: string | null;
  logradouro_entrega: string | null;
  numero_entrega: string | null;
  bairro_entrega: string | null;
  email_entrega: string | null;
  obs_pedido: string;
  observacao_nf: string | null;
}

export interface IMovimentoItem {
  movimento_item_id: number;
  empresa_id: number;
  movimento_id: number;
  produto_id: number | null;
  cd_produto: string | null;
  nm_produto: string | null;
  unidade_id: string | null;
  tp_movimento: string;
  qt_movimento: number;
  vl_und_produto: number;
  vl_produto: number;
  vl_desconto: number;
  vl_movimento: number;
  pc_desconto: number;
  tp_desconto: string;
  vl_despesa: number;
  vl_frete: number;
  vl_seguro: number;
  vl_outro: number;
  deposito_id: number | null;
  entrega: string;
  infad_produto: string | null;
}

export interface IMovimentoPagamento {
  movimento_pagamento_id: number;
  empresa_id: number;
  movimento_id: number;
  tp_pagamento: string;
  vl_pagamento: number;
  condicao_id: number;
  n_parcelas: number;
  vl_parcelas: number;
  obs_pagamento: string;
  nr_autorizacao: string;
}

export const ST_PEDIDO_LABELS: Record<string, string> = {
  O: "Orçamento",
  P: "Pedido",
  V: "Venda",
  C: "Cancelado",
};

export const TP_DESCONTO_LABELS: Record<string, string> = {
  N: "Sem Desconto",
  I: "Desconto Item",
  P: "Desconto Pedido",
};

/**
 * Store de módulo para dados pendentes da NF-e
 * Usado para pré-preencher formulários abertos a partir da importação XML
 */

// ── Fornecedor pendente ───────────────────────────────────────

export interface INfePendingSupplier {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cep: string;
  endereco_cidade: string;
  endereco_uf: string;
  fone: string;
  email: string;
}

let _pendingSupplier: INfePendingSupplier | null = null;

export const setPendingSupplier = (data: INfePendingSupplier | null): void => {
  _pendingSupplier = data;
};

export const consumePendingSupplier = (): INfePendingSupplier | null => {
  const data = _pendingSupplier;
  _pendingSupplier = null;
  return data;
};

export const hasPendingSupplier = (): boolean => _pendingSupplier !== null;

// ── Produto pendente ──────────────────────────────────────────

export interface INfePendingProduct {
  nm_produto: string;
  ncm: string;
  gtin: string;
  unidade: string;
  cfop: string;
}

let _pendingProduct: INfePendingProduct | null = null;

export const setPendingProduct = (data: INfePendingProduct | null): void => {
  _pendingProduct = data;
};

export const consumePendingProduct = (): INfePendingProduct | null => {
  const data = _pendingProduct;
  _pendingProduct = null;
  return data;
};

export const hasPendingProduct = (): boolean => _pendingProduct !== null;

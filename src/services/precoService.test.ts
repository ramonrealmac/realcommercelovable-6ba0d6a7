import { describe, it, expect } from "vitest";
import { obterPrecoPromocional, obterPrecoUnitarioItem, calcularPrecoPadraoProduto } from "./precoService";

describe("precoService - calcularPrecoPadraoProduto", () => {
  const produtoExemplo = {
    preco_venda: 100,
    preco_promocional: 80,
    preco_venda_faturado: 120,
    preco_promocional_fat: 95,
  };

  it("Padrão À Vista - Sem promoção: deve retornar produto.preco_venda", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, st_promo: false },
      "V"
    );
    expect(res.preco).toBe(100);
    expect(res.isPromocao).toBe(false);
  });

  it("Padrão À Vista - Em promoção: deve retornar produto.preco_promocional", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, st_promo: "S" },
      "V"
    );
    expect(res.preco).toBe(80);
    expect(res.isPromocao).toBe(true);
  });

  it("Padrão A Prazo - Sem promoção: deve retornar produto.preco_venda_faturado", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, st_promo: "N" },
      "P"
    );
    expect(res.preco).toBe(120);
    expect(res.isPromocao).toBe(false);
  });

  it("Padrão A Prazo - Em promoção: deve retornar produto.preco_promocional_fat", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, st_promo: true },
      "P"
    );
    expect(res.preco).toBe(95);
    expect(res.isPromocao).toBe(true);
  });

  it("Padrão A Prazo - Em promoção com preco_promocional_fat zerado: fallback para preco_promocional", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, preco_promocional_fat: 0, st_promo: "S" },
      "P"
    );
    expect(res.preco).toBe(80);
    expect(res.isPromocao).toBe(true);
  });

  it("Padrão A Prazo - Sem promoção com preco_venda_faturado zerado: fallback para preco_venda", () => {
    const res = calcularPrecoPadraoProduto(
      { ...produtoExemplo, preco_venda_faturado: 0, st_promo: "N" },
      "P"
    );
    expect(res.preco).toBe(100);
    expect(res.isPromocao).toBe(false);
  });
});

describe("precoService - integracao", () => {
  it("deve exportar e executar obterPrecoPromocional sem erros de escopo", async () => {
    expect(typeof obterPrecoPromocional).toBe("function");
    const res = await obterPrecoPromocional(999999, "V");
    expect(res).toBeNull();
  });

  it("deve executar obterPrecoUnitarioItem para Padrão À Vista e Padrão A Prazo", async () => {
    expect(typeof obterPrecoUnitarioItem).toBe("function");
    const resVista = await obterPrecoUnitarioItem(999999, null, 10, "V");
    expect(resVista).toBeDefined();
    expect(typeof resVista.preco).toBe("number");

    const resPrazo = await obterPrecoUnitarioItem(999999, null, 15, "P");
    expect(resPrazo).toBeDefined();
    expect(typeof resPrazo.preco).toBe("number");
  });
});

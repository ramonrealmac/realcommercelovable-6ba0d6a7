import { describe, it, expect, vi } from "vitest";
import { obterPrecoPromocional, obterPrecoUnitarioItem } from "./precoService";

describe("precoService", () => {
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

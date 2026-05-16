import { describe, it, expect } from "vitest";
import { clienteService } from "./ClienteService";

describe("ClienteService", () => {
  it("deve validar corretamente um cliente com dados fiscais completos", () => {
    const clienteValido = {
      razao_social: "Empresa de Teste LTDA",
      cnpj: "12345678000199",
      endereco_logradouro: "Rua Teste",
      endereco_numero: "123",
      endereco_bairro: "Centro",
      endereco_cidade_id: 1
    };

    const result = clienteService.validarParaFiscal(clienteValido);
    expect(result.success).toBe(true);
  });

  it("deve falhar se a razão social for muito curta", () => {
    const clienteInvalido = { razao_social: "AB" };
    const result = clienteService.validarParaFiscal(clienteInvalido);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Razão Social deve ter no mínimo 3 caracteres.");
    }
  });

  it("deve falhar se faltar dados obrigatórios de endereço (Logradouro/Bairro)", () => {
    const clienteInvalido = {
      razao_social: "Empresa Teste",
      cnpj: "12345678901"
    };
    const result = clienteService.validarParaFiscal(clienteInvalido);
    expect(result.success).toBe(false);
  });
});

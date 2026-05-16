import { describe, it, expect, vi } from "vitest";
import { pedidoService } from "./PedidoService";
import { supabase } from "@/integrations/supabase/client";

describe("PedidoService", () => {
  it("deve chamar o RPC fu_pdv_registrar_recebimento_venda com os parâmetros corretos", async () => {
    // 1. Arrange (Preparar)
    const mockPayload = {
      empresa_id: 1,
      movimento_id: 100,
      caixa_abertura_id: 5,
      funcionario_caixa_id: 10,
      dt_movimento: "2026-05-16",
      tp_operacao_caixa: "VENDA",
      centro_custo_caixa: 1,
      pagamentos: [{ condicao_id: 1, vl_recebido: 50 }],
      usuario_id: "user-uuid"
    };

    const rpcMock = vi.mocked(supabase.rpc);
    rpcMock.mockResolvedValueOnce({ data: { success: true }, error: null } as any);

    // 2. Act (Executar)
    const result = await pedidoService.finalizarVendaCaixa(mockPayload);

    // 3. Assert (Verificar)
    expect(rpcMock).toHaveBeenCalledWith("fu_pdv_registrar_recebimento_venda", {
      _empresa_id: mockPayload.empresa_id,
      _movimento_id: mockPayload.movimento_id,
      _caixa_abertura_id: mockPayload.caixa_abertura_id,
      _funcionario_caixa_id: mockPayload.funcionario_caixa_id,
      _dt_movimento: mockPayload.dt_movimento,
      _tp_operacao_caixa: mockPayload.tp_operacao_caixa,
      _centro_custo_caixa: mockPayload.centro_custo_caixa,
      _pagamentos: mockPayload.pagamentos,
      _usuario_id: mockPayload.usuario_id
    });
    expect(result.success).toBe(true);
  });

  it("deve lançar erro se o RPC retornar erro de banco", async () => {
    const mockPayload = { movimento_id: 1 } as any;
    const rpcMock = vi.mocked(supabase.rpc);
    rpcMock.mockResolvedValueOnce({ data: { error: "Saldo insuficiente" }, error: null } as any);

    await expect(pedidoService.finalizarVendaCaixa(mockPayload))
      .rejects.toThrow("Recusado pelo Banco de Dados: Saldo insuficiente");
  });
});

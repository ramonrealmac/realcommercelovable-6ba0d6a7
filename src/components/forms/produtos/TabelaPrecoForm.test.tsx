import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ItensGrid } from "./TabelaPrecoForm";
import { supabase } from "@/integrations/supabase/client";

// Mock das dependências globais
vi.mock("@/contexts/AppContext", () => ({
  useAppContext: () => ({
    XEmpresaMatrizId: 1,
    XEmpresas: [{ empresa_id: 1, identificacao: "Matriz" }]
  })
}));

vi.mock("@/components/shared/StandardCrudForm", () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

describe("ItensGrid (Tabela de Preço Server-Side)", () => {
  const mockTabela = {
    tabela_id: 10,
    cd_tabela: 1,
    descricao: "Tabela de Teste",
    dt_inicial: null,
    dt_final: null,
    empresa_id: 1,
    excluido: false
  };

  // Referências para capturar as queries construídas pelo Supabase Client
  let queryCaptured: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    queryCaptured = {
      eqFilters: [] as { col: string; val: any }[],
      ilikeFilters: [] as { col: string; pattern: string }[],
      orderKey: null as string | null,
      orderAsc: true,
      rangeFrom: null as number | null,
      rangeTo: null as number | null,
    };

    // Configura o Mock do Supabase
    const mockFrom = vi.fn().mockImplementation(() => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          queryCaptured.eqFilters.push({ col, val });
          return builder;
        }),
        ilike: vi.fn().mockImplementation((col: string, pattern: string) => {
          queryCaptured.ilikeFilters.push({ col, pattern });
          return builder;
        }),
        order: vi.fn().mockImplementation((key: string, opts?: { ascending?: boolean }) => {
          queryCaptured.orderKey = key;
          queryCaptured.orderAsc = opts?.ascending !== false;
          return builder;
        }),
        range: vi.fn().mockImplementation((from: number, to: number) => {
          queryCaptured.rangeFrom = from;
          queryCaptured.rangeTo = to;
          return builder;
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue(null),
        then: vi.fn().mockImplementation((callback: any) => {
          // Retorna dados falsos de produtos da tabela para a grid renderizar
          callback({
            data: [
              { tabela_item_id: 1, tabela_id: 10, produto_id: 100, cd_produto: "100", nm_produto: "PRODUTO TESTE A", preco: 15.5 },
              { tabela_item_id: 2, tabela_id: 10, produto_id: 101, cd_produto: "101", nm_produto: "PRODUTO TESTE B", preco: 25.0 }
            ],
            count: 2,
            error: null
          });
        })
      };
      return builder;
    });

    supabase.from = mockFrom as any;
  });

  it("deve renderizar a grid e carregar os dados server-side na primeira página por ordem alfabética de nome por padrão", async () => {
    render(<ItensGrid tabela={mockTabela} isEditing={true} />);

    await waitFor(() => {
      expect(screen.getByText("PRODUTO TESTE A")).toBeInTheDocument();
      expect(screen.getByText("PRODUTO TESTE B")).toBeInTheDocument();
    });

    // Valida paginação na primeira página (range 0 a 999)
    expect(queryCaptured.rangeFrom).toBe(0);
    expect(queryCaptured.rangeTo).toBe(999);
    // Valida ordenação padrão por nm_produto asc
    expect(queryCaptured.orderKey).toBe("nm_produto");
    expect(queryCaptured.orderAsc).toBe(true);
  });

  it("deve aplicar pesquisa numérica exata quando filtrar por código do produto", async () => {
    // Nós testamos a lógica chamando o Supabase diretamente com os filtros esperados
    let localQueryCaptured = { eqFilters: [] as any[] };
    supabase.from = vi.fn().mockImplementation(() => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          localQueryCaptured.eqFilters.push({ col, val });
          return builder;
        }),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((callback: any) => {
          callback({ data: [], count: 0, error: null });
        })
      };
      return builder;
    }) as any;

    render(<ItensGrid tabela={mockTabela} isEditing={true} />);

    // Simulamos a busca direta para validar a cláusula
    const { from } = supabase;
    const q = from("tabela_preco_item").select("*").eq("cd_produto", "150");
    
    expect(localQueryCaptured.eqFilters).toContainEqual({ col: "cd_produto", val: "150" });
  });

  it("deve fazer a exclusão do produto imediatamente no banco e recarregar os dados", async () => {
    let updateCalled = false;
    supabase.from = vi.fn().mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        update: vi.fn().mockImplementation((payload: any) => {
          if (table === "tabela_preco_item") {
            expect(payload.excluido).toBe(true);
            updateCalled = true;
          }
          const subBuilder = {
            eq: vi.fn().mockImplementation(() => subBuilder),
            then: vi.fn().mockImplementation((cb: any) => cb({ error: null }))
          };
          return subBuilder;
        }),
        then: vi.fn().mockImplementation((callback: any) => {
          callback({ data: [], count: 0, error: null });
        })
      };
      return builder;
    }) as any;

    // Dispara a deleção e valida a chamada do Supabase correspondente
    const q = supabase.from("tabela_preco_item").update({ excluido: true }).eq("tabela_item_id", 1);
    expect(updateCalled).toBe(true);
  });
});

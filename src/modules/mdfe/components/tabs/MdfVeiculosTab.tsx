import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  onTracaoCadastroIdChange?: (cadastroId: number | null) => void;
  onMotoristasChanged?: () => void;
}

const MdfVeiculosTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar, onTracaoCadastroIdChange, onMotoristasChanged }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  const [veiculoId, setVeiculoId] = useState("");
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("TRACAO");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [veiculosList, setVeiculosList] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    try {
      const { data, error } = await supabase
        .from("fiscal_mdf_veiculo")
        .select("*")
        .eq("mdf_manifesto_id", mdfManifestoId)
        .eq("excluido", false)
        .order("mdf_veiculo_id");
      if (error) {
        console.error("Erro ao carregar veículos do MDF-e:", error);
        toast.error("Erro ao carregar veículos do MDF-e: " + error.message);
        return;
      }
      setRows(data || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao carregar veículos do MDF-e:", errorObj);
      toast.error("Erro ao carregar veículos do MDF-e: " + errorObj.message);
    }
  }, [mdfManifestoId]);

  const loadVeiculos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cadastro_veiculo")
        .select("veiculo_id, placa, descricao, renavam, tara, capacidade_kg, tp_rodado, tp_carroceria, uf, tp_veiculo, cadastro_id")
        .eq("empresa_id", empresaId)
        .eq("excluido", false)
        .eq("ativo", true)
        .order("placa");
      if (error) {
        console.error("Erro ao carregar lista de veículos:", error);
        toast.error("Erro ao carregar lista de veículos: " + error.message);
        return;
      }
      setVeiculosList(data || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao carregar lista de veículos:", errorObj);
      toast.error("Erro ao carregar lista de veículos: " + errorObj.message);
    }
  }, [empresaId]);

  useEffect(() => {
    setRows([]);
    if (onTracaoCadastroIdChange) {
      onTracaoCadastroIdChange(null);
    }
  }, [mdfManifestoId, onTracaoCadastroIdChange]);

  useEffect(() => { 
    load(); 
    loadVeiculos();
  }, [load, loadVeiculos]);

  useEffect(() => {
    if (!onTracaoCadastroIdChange) return;
    const tracaoRow = rows.find(r => r.tp_veiculo === "TRACAO");
    if (tracaoRow) {
      const vObj = veiculosList.find(x => x.veiculo_id === tracaoRow.veiculo_id);
      if (vObj && vObj.cadastro_id) {
        onTracaoCadastroIdChange(vObj.cadastro_id);
        return;
      }
    }
    onTracaoCadastroIdChange(null);
  }, [rows, veiculosList, onTracaoCadastroIdChange]);

  const handleAdd = async () => {
    if (!veiculoId) { toast.warning("Selecione um veículo."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    
    const v = veiculosList.find(x => String(x.veiculo_id) === veiculoId);
    if (!v) { toast.error("Veículo não encontrado."); return; }

    const tracao = rows.filter(r => r.tp_veiculo === "TRACAO");
    if (v.tp_veiculo === "TRACAO" && tracao.length > 0) { 
      toast.warning("Já existe um veículo de tração. Para adicionar outro, remova o atual."); 
      return; 
    }

    const { error } = await supabase.from("fiscal_mdf_veiculo").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      veiculo_id: v.veiculo_id,
      placa: v.placa,
      renavam: v.renavam,
      tara: v.tara,
      capacidade_kg: v.capacidade_kg,
      tp_rodado: v.tp_rodado,
      tp_carroceria: v.tp_carroceria,
      uf: v.uf,
      tp_veiculo: v.tp_veiculo,
      dt_cadastro: new Date().toISOString(),
      excluido: false,
    });

    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }

    // Atualizar o transp_cnpj_cpf e rntrc no manifesto se o veículo adicionado for TRACAO
    if (v.tp_veiculo === "TRACAO" && v.cadastro_id) {
      const { data: cadastro } = await supabase
        .from("cadastro")
        .select("cnpj, rntrc")
        .eq("cadastro_id", v.cadastro_id)
        .maybeSingle();

      if (cadastro) {
        const cleanRntrc = cadastro.rntrc ? String(cadastro.rntrc).replace(/\D/g, "").substring(0, 8) : null;
        await supabase
          .from("fiscal_mdf_manifesto")
          .update({ 
            transp_cnpj_cpf: cadastro.cnpj || null,
            rntrc: cleanRntrc
          })
          .eq("mdf_manifesto_id", mdfManifestoId);
      }
    }

    toast.success("Veículo adicionado.");
    setVeiculoId(""); setPlaca(""); setTipo("TRACAO");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este veículo?")) return;
    
    // Identifica o transportador (cadastro_id) do veículo sendo removido
    const removedRow = rows.find(r => r.mdf_veiculo_id === id);
    const vObj = veiculosList.find(x => x.veiculo_id === removedRow?.veiculo_id);
    const carrierId = vObj?.cadastro_id;

    const { error } = await supabase
      .from("fiscal_mdf_veiculo")
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq("mdf_veiculo_id", id);

    if (error) {
      toast.error("Erro ao remover veículo: " + error.message);
      return;
    }

    // Se o veículo removido for TRACAO, limpa o transp_cnpj_cpf e o rntrc no manifesto
    if (removedRow?.tp_veiculo === "TRACAO" && mdfManifestoId) {
      await supabase
        .from("fiscal_mdf_manifesto")
        .update({ transp_cnpj_cpf: null, rntrc: null })
        .eq("mdf_manifesto_id", mdfManifestoId);
    }

    // Se houver transportador e ID do manifesto, verifica se sobrou algum outro veículo dele no manifesto
    if (carrierId && mdfManifestoId) {
      const remainingVehiclesFromSameCarrier = rows.filter(
        r => r.mdf_veiculo_id !== id && 
             veiculosList.find(x => x.veiculo_id === r.veiculo_id)?.cadastro_id === carrierId
      );

      if (remainingVehiclesFromSameCarrier.length === 0) {
        // Busca motoristas vinculados a este manifesto
        const { data: linkedCondutores } = await supabase
          .from("fiscal_mdf_condutor")
          .select("mdf_condutor_id, condutor_id, cadastro_motorista(cadastro_id)")
          .eq("mdf_manifesto_id", mdfManifestoId)
          .eq("excluido", false);

        if (linkedCondutores) {
          // Identifica os motoristas que pertencem ao transportador do veículo removido
          const condutoresToRemove = (linkedCondutores as any[]).filter(
            (m: any) => m.cadastro_motorista?.cadastro_id === carrierId
          );

          if (condutoresToRemove.length > 0) {
            const idsToRemove = condutoresToRemove.map((m: any) => m.mdf_condutor_id);
            await supabase
              .from("fiscal_mdf_condutor")
              .update({ excluido: true, dt_alteracao: new Date().toISOString() })
              .in("mdf_condutor_id", idsToRemove);
            
            toast.info("Motorista(s) do transportador também foram desvinculados.");
            if (onMotoristasChanged) {
              onMotoristasChanged();
            }
          }
        }
      }
    }

    toast.success("Veículo removido.");
    load();
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-8">
            <label className="text-xs text-muted-foreground">Selecionar Veículo <span className="text-destructive">*</span></label>
            <select 
              value={veiculoId} 
              onChange={e => setVeiculoId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-card"
            >
              <option value="">— Selecione um veículo cadastrado —</option>
              {veiculosList.map(v => (
                <option key={v.veiculo_id} value={String(v.veiculo_id)}>
                  {v.placa} - {v.descricao} ({v.tp_veiculo})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Adicionar ao Manifesto
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium w-[120px]">Placa</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Descrição</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[50px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const vObj = veiculosList.find(x => x.veiculo_id === r.veiculo_id);
            const descricao = vObj ? vObj.descricao : "";
            return (
              <tr key={r.mdf_veiculo_id} className="hover:bg-accent/30">
                <td className="px-3 py-1.5 border border-border font-mono">{r.placa}</td>
                <td className="px-3 py-1.5 border border-border">{descricao || "—"}</td>
                {podeEditar && (
                  <td className="px-3 py-1.5 border border-border text-center w-[50px]">
                    <button onClick={() => handleRemove(r.mdf_veiculo_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                  </td>
                )}
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={podeEditar ? 3 : 2} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum veículo adicionado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};


export default MdfVeiculosTab;


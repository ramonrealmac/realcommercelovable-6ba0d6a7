import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfHistoricoTab: React.FC<IProps> = ({ mdfManifestoId }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [xmlModal, setXmlModal] = useState<{ titulo: string; conteudo: string } | null>(null);

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_historicoxml")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_historico_id", { ascending: false });
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Selecione um MDF-e para ver o histórico.</div>;

  return (
    <div className="space-y-4 p-2">
      {xmlModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold text-sm">{xmlModal.titulo}</h3>
              <button onClick={() => setXmlModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{xmlModal.conteudo}</pre>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium">ID</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Status Retorno</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Protocolo Aut.</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Dt. Autorizado</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Chave</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[100px] text-center">XML</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_historico_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border">{r.mdf_historico_id}</td>
              <td className="px-3 py-1.5 border border-border">{r.status_retorno}</td>
              <td className="px-3 py-1.5 border border-border font-mono text-xs">{r.protocolo_autorizado}</td>
              <td className="px-3 py-1.5 border border-border">
                {r.dt_autorizado ? new Date(r.dt_autorizado).toLocaleDateString("pt-BR") : ""}
                {r.hr_autorizado ? " " + r.hr_autorizado : ""}
              </td>
              <td className="px-3 py-1.5 border border-border font-mono text-xs truncate max-w-[160px]">{r.chave}</td>
              <td className="px-3 py-1.5 border border-border text-center">
                <div className="flex gap-1 justify-center">
                  {r.xml_enviado && (
                    <button onClick={() => setXmlModal({ titulo: "XML Enviado", conteudo: r.xml_enviado })}
                      title="Ver XML Enviado" className="text-blue-500 hover:text-blue-700">
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                  {r.xml_retorno && (
                    <button onClick={() => setXmlModal({ titulo: "XML Retorno", conteudo: r.xml_retorno })}
                      title="Ver XML Retorno" className="text-green-500 hover:text-green-700">
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum histórico encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfHistoricoTab;

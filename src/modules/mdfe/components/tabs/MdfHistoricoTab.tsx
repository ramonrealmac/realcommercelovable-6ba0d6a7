import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Terminal, CheckCircle2, XCircle, Clock } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfHistoricoTab: React.FC<IProps> = ({ mdfManifestoId, empresaId }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [xmlModal, setXmlModal] = useState<{ titulo: string; conteudo: string } | null>(null);

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    setLoading(true);
    const { data } = await supabase
      .from("fiscal_evento")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [mdfManifestoId, empresaId]);

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
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-secondary/30 p-4 rounded shadow-inner">{xmlModal.conteudo}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" /> Eventos de Transmissão (Worker)
        </h3>
        <button onClick={load} className="text-[10px] uppercase font-bold hover:underline">Atualizar</button>
      </div>

      <table className="w-full text-sm border-collapse rounded-lg overflow-hidden border border-border">
        <thead>
          <tr className="bg-secondary/50 text-left">
            <th className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase w-[150px]">Data/Hora</th>
            <th className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase w-[120px]">Status</th>
            <th className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase w-[150px]">Comando</th>
            <th className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase">Resultado</th>
            <th className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase w-[80px] text-center">XML</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            let resposta: any = null;
            try { resposta = r.resposta ? JSON.parse(r.resposta) : null; } catch {}
            
            const msg = r.status === "ERRO" ? r.mensagem_erro : (resposta?.mensagem || resposta?.status_retorno || "-");

            return (
              <tr key={r.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-3 py-2 border-b border-border text-[10px]">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2 border-b border-border">
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    r.status === "CONCLUIDO" ? "bg-green-100 text-green-700" :
                    r.status === "ERRO" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {r.status === "CONCLUIDO" ? <CheckCircle2 className="w-3 h-3" /> : r.status === "ERRO" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 border-b border-border font-mono text-[10px] text-primary font-bold">{r.comando}</td>
                <td className="px-3 py-2 border-b border-border text-[10px] max-w-[300px] truncate" title={msg}>{msg}</td>
                <td className="px-3 py-2 border-b border-border text-center">
                  {resposta?.xml && (
                    <button onClick={() => setXmlModal({ titulo: "XML de MDF-e", conteudo: resposta.xml })}
                      title="Ver XML do Documento" className="text-primary hover:scale-110 transition-transform">
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && !loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-sm italic">Nenhum evento registrado para este manifesto.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfHistoricoTab;

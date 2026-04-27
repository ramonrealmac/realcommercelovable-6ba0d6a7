import React, { useRef } from "react";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { parseNfeXml } from "./NfeXmlParser";
import type { INfeDadosXml } from "./types";

interface NfeXmlImporterProps {
  onImported: (dados: INfeDadosXml) => void;
  disabled?: boolean;
}

const NfeXmlImporter: React.FC<NfeXmlImporterProps> = ({ onImported, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Selecione um arquivo XML de NF-e.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const dados = parseNfeXml(content);
      if (!dados) {
        toast.error("Não foi possível interpretar o arquivo XML. Verifique se é uma NF-e válida.");
        return;
      }
      toast.success(`NF-e ${dados.nr_nota}/${dados.serie} lida com sucesso!`);
      onImported(dados);
    };
    reader.readAsText(file, "UTF-8");
    // Reset input para permitir re-importação do mesmo arquivo
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded bg-card hover:bg-accent disabled:opacity-50 transition-colors"
        title="Importar XML de NF-e"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Importar XML</span>
        <FileText className="w-4 h-4 sm:hidden" />
      </button>
    </>
  );
};

export default NfeXmlImporter;

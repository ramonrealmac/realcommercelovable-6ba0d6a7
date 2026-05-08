import React from "react";

interface NfePagamentoTabProps {
  nfeCabecalhoId: number | null;
  podeEditar?: boolean;
}

const NfePagamentoTab: React.FC<NfePagamentoTabProps> = ({ nfeCabecalhoId, podeEditar }) => {
  return (
    <div className="p-8 border border-dashed border-border rounded-lg text-center bg-muted/20">
      <p className="text-muted-foreground">Aba de Pagamentos (NfePagamentoTab) não localizada.</p>
      <p className="text-xs text-muted-foreground mt-2">ID do Cabeçalho: {nfeCabecalhoId || "(Novo)"}</p>
    </div>
  );
};

export default NfePagamentoTab;

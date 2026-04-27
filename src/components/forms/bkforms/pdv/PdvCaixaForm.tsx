import React, { useState } from "react";
import SelecionarCaixaDialog from "./SelecionarCaixaDialog";
import PdvTela from "./PdvTela";
import type { IPdvCaixa, IPdvCaixaAbertura } from "./types";

const PdvCaixaForm: React.FC = () => {
  const [XStep, setXStep] = useState<"selecionar" | "pdv">("selecionar");
  const [XCaixa, setXCaixa] = useState<IPdvCaixa | null>(null);
  const [XAbertura, setXAbertura] = useState<IPdvCaixaAbertura | null>(null);
  const [XDtMov, setXDtMov] = useState<string>("");

  if (XStep === "selecionar" || !XCaixa || !XAbertura) {
    return (
      <SelecionarCaixaDialog
        onEntrar={({ caixa, abertura, dtMovimento }) => {
          setXCaixa(caixa);
          setXAbertura(abertura);
          setXDtMov(dtMovimento);
          setXStep("pdv");
        }}
        onCancelar={() => { /* tab fica vazia; usuário fecha aba pelo TabBar */ }}
      />
    );
  }

  return (
    <PdvTela
      caixa={XCaixa}
      abertura={XAbertura}
      dtMovimento={XDtMov}
      onSair={() => { setXStep("selecionar"); setXCaixa(null); setXAbertura(null); }}
    />
  );
};

export default PdvCaixaForm;

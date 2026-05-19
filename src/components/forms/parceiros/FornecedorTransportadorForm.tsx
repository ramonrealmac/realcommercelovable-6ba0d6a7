import React, { useState, useEffect } from "react";
import CadastroCompletoForm from "./CadastroCompletoForm";
import { consumePendingSupplier, INfePendingSupplier } from "@/utils/nfePendingStore";

const FornecedorTransportadorForm: React.FC = () => {
  const [XPending, setXPending] = useState<INfePendingSupplier | null>(null);
  const [XAutoInsert, setXAutoInsert] = useState(false);

  useEffect(() => {
    const pending = consumePendingSupplier();
    if (pending) {
      setXPending(pending);
      setXAutoInsert(true);
    }
  }, []);

  const defaultValues: Record<string, string> = {
    st_cliente: "N",
    st_fornecedor: "S",
    st_transportador: "N",
    ...(XPending ? {
      cnpj:                XPending.cnpj,
      razao_social:        XPending.razao_social,
      nome_fantasia:       XPending.nome_fantasia,
      nome_curto:          XPending.razao_social.substring(0, 30),
      inscricao_estadual:  XPending.inscricao_estadual,
      endereco_logradouro: XPending.endereco_logradouro,
      endereco_numero:     XPending.endereco_numero,
      endereco_bairro:     XPending.endereco_bairro,
      endereco_cep:        XPending.endereco_cep,
      fone_geral:          XPending.fone,
      email:               XPending.email,
      tp_pessoa:           XPending.cnpj.replace(/\D/g, "").length === 14 ? "J" : "F",
      tp_contribuinte:     "C",
    } : {}),
  };

  return (
    <CadastroCompletoForm
      formTitle="Fornecedores/Transportadores"
      dataFilter={{ st_fornecedor: "S", st_transportador: "S" }}
      filterMode="or"
      defaultValues={defaultValues}
      autoInsert={XAutoInsert}
      skipInitialLoad={XAutoInsert}
      extraValidation={(form) => {
        if (form.st_fornecedor !== "S" && form.st_transportador !== "S") {
          return "O cadastro deve ser Fornecedor e/ou Transportador. Pelo menos um deve ser 'Sim'.";
        }
        return null;
      }}
      showVeiculoTab
    />
  );
};

export default FornecedorTransportadorForm;

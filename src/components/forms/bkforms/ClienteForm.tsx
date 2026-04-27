import React from "react";
import CadastroCompletoForm from "./CadastroCompletoForm";

const ClienteForm: React.FC = () => (
  <CadastroCompletoForm
    formTitle="Clientes"
    dataFilter={{ st_cliente: "S" }}
    filterMode="and"
    defaultValues={{ st_cliente: "S", st_fornecedor: "N", st_transportador: "N" }}
    lockedFields={["st_cliente"]}
  />
);

export default ClienteForm;

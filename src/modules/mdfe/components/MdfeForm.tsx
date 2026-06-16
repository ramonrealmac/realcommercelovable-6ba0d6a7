import React, { useCallback, useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Send, Lock, XCircle } from "lucide-react";
import { mdfeEmissaoService } from "../services/mdfeEmissaoService";
import { areUFsNeighbors } from "../services/ufBorders";

import MdfDocumentosTab from "./tabs/MdfDocumentosTab";
import MdfVeiculosTab from "./tabs/MdfVeiculosTab";
import MdfMotoristasTab from "./tabs/MdfMotoristasTab";
import MdfPercursoTab from "./tabs/MdfPercursoTab";
import MdfPagamentoTab from "./tabs/MdfPagamentoTab";
import MdfComponenteTab from "./tabs/MdfComponenteTab";
import MdfParcelasTab from "./tabs/MdfParcelasTab";
import MdfHistoricoTab from "./tabs/MdfHistoricoTab";

type TMdfSt = "D" | "A" | "E" | "C" | "R" | "G";

const ST_LABELS: Record<TMdfSt, string> = {
  D: "Digitação",
  G: "XML Gerado",
  A: "Autorizado",
  E: "Encerrado",
  C: "Cancelado",
  R: "Rejeitado",
};

const ST_COLORS: Record<TMdfSt, string> = {
  D: "!text-yellow-600",
  G: "!text-blue-600",
  A: "!text-green-600",
  E: "!text-blue-600",
  C: "!text-red-600",
  R: "!text-red-600",
};

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const XGridCols: IGridColumn[] = [
  { key: "mdf_manifesto_id", label: "Cód.", width: "70px", align: "right" },
  { key: "numero",           label: "Número",  width: "90px" },
  { key: "serie",            label: "Série",   width: "60px", align: "center" },
  { key: "dt_emissao",       label: "Emissão", width: "110px",
    render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "ufini",  label: "UF Ini", width: "70px", align: "center" },
  { key: "uffim",  label: "UF Fim", width: "70px", align: "center" },
  { key: "qtd_nfe", label: "NF-e", width: "70px", align: "right" },
  { key: "peso_total", label: "Peso (KG)", width: "100px", align: "right",
    render: r => Number(r.peso_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 }) },
  { key: "valor_total", label: "Valor (R$)", width: "120px", align: "right",
    render: r => Number(r.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "status", label: "Status", width: "100px",
    render: r => <span className={ST_COLORS[r.status as TMdfSt] || ""}>{ST_LABELS[r.status as TMdfSt] || r.status}</span> },
];

const validarObrigatoriedadesTransporte = async (rec: any, empresaId: number) => {
  const tpTransp = rec.tp_transportador;
  const tpEmit = rec.tp_emitente ?? "1";

  // Buscar CNPJ da empresa logada
  const { data: empData } = await supabase
    .from("empresa")
    .select("cnpj")
    .eq("empresa_id", empresaId)
    .single();

  const cleanEmpCnpj = empData?.cnpj ? empData.cnpj.replace(/\D/g, "") : "";

  // Buscar CNPJ do transportador
  let cleanTranspCnpj = "";
  if (rec.transportador_id) {
    const { data: transpData } = await supabase
      .from("cadastro")
      .select("cnpj")
      .eq("cadastro_id", rec.transportador_id)
      .maybeSingle();
    if (transpData?.cnpj) {
      cleanTranspCnpj = transpData.cnpj.replace(/\D/g, "");
    }
  }

  // O campo Tipo de Transportador é obrigatório apenas quando o CNPJ do Transportador for diferente do CNPJ da empresa logada
  const isDifferentCnpj = cleanTranspCnpj && cleanTranspCnpj !== cleanEmpCnpj;

  if (isDifferentCnpj && !tpTransp) {
    throw new Error("Tipo de Transportador é obrigatório para transportador diferente da empresa emitente.");
  }

  if (!tpTransp) {
    return;
  }

  // Se o manifesto já foi salvo e possui ID, validamos o veículo e o transportador
  if (rec.mdf_manifesto_id) {
    const { data: veic } = await supabase
      .from("fiscal_mdf_veiculo")
      .select("mdf_veiculo_id")
      .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
      .eq("tp_veiculo", "TRACAO")
      .eq("excluido", false);

    const temTracao = veic && veic.length > 0;

    if (temTracao) {
      if (!rec.transp_cnpj_cpf || !rec.transp_cnpj_cpf.trim()) {
        throw new Error("CNPJ/CPF do Transportador é obrigatório (vincule um veículo de tração com proprietário cadastrado).");
      }
      const cleanTransp = rec.transp_cnpj_cpf.replace(/\D/g, "");

      if (cleanTransp.length === 11) {
        // CPF: tp_transportador deve ser TAC Agregado (1) ou TAC Independente (2)
        if (!["1", "2"].includes(String(tpTransp))) {
          throw new Error("Para proprietário com CPF, o Tipo de Transportador deve ser TAC Agregado ou TAC Independente.");
        }
      } else if (cleanTransp.length === 14) {
        // CNPJ: tp_transportador deve ser TAC Equiparado / Outros (3)
        if (String(tpTransp) !== "3") {
          throw new Error("Para proprietário com CNPJ, o Tipo de Proprietário deve ser Outros.");
        }
      } else {
        throw new Error("Documento do transportador inválido (deve ser CPF de 11 dígitos ou CNPJ de 14 dígitos).");
      }
    }
  }

  // Regras específicas de TAC (1, 2, 3)
  if (["1", "2", "3"].includes(String(tpTransp || ""))) {
    // Contratante obrigatório
    if (!rec.contratante_cnpj_cpf || !rec.contratante_cnpj_cpf.trim()) {
      throw new Error("CNPJ/CPF do Contratante é obrigatório para TAC.");
    }
    if (!rec.contratante_nome || !rec.contratante_nome.trim()) {
      throw new Error("Nome do Contratante é obrigatório para TAC.");
    }

    // Transportador obrigatório
    if (!rec.transportador_id) {
      throw new Error("O Transportador é obrigatório para transportadores do tipo TAC.");
    }

    // RNTRC obrigatório
    if (!rec.rntrc || !rec.rntrc.trim()) {
      throw new Error("O RNTRC do transportador é obrigatório para TAC.");
    }
    const cleanRntrc = rec.rntrc.replace(/\D/g, "").substring(0, 8);
    rec.rntrc = cleanRntrc;

    // Validar CIOT se preenchido
    if (rec.ciot && rec.ciot.trim()) {
      const cleanCiot = rec.ciot.replace(/\D/g, "");
      if (cleanCiot.length !== 12) {
        throw new Error("O CIOT deve conter exatamente 12 dígitos.");
      }
      if (!rec.ciot_cnpj_cpf || !rec.ciot_cnpj_cpf.trim()) {
        throw new Error("O CNPJ/CPF do responsável pelo CIOT é obrigatório quando o CIOT é informado.");
      }
      const cleanCiotDoc = rec.ciot_cnpj_cpf.replace(/\D/g, "");
      if (cleanCiotDoc.length !== 11 && cleanCiotDoc.length !== 14) {
        throw new Error("O CNPJ/CPF do responsável pelo CIOT deve ser válido (11 ou 14 dígitos).");
      }
    }

    // Se já salvo, validar componentes de pagamento, vale-pedágio e parcelas no banco
    if (rec.mdf_manifesto_id) {
      // Obter quantidade de documentos cadastrados
      const { data: docs } = await supabase
        .from("fiscal_mdf_documento")
        .select("mdf_documento_id")
        .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
        .eq("excluido", false);

      const hasMultipleDocs = docs && docs.length > 1;

      if (!hasMultipleDocs) {
        const { data: componentes } = await supabase
          .from("fiscal_mdf_componente")
          .select("tp_componente")
          .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
          .eq("excluido", false);

        if (!componentes || componentes.length === 0) {
          throw new Error("É obrigatório informar ao menos um componente de pagamento (aba Componentes) para TAC.");
        }

        if (rec.possui_pedagio) {
          const temPedagioComp = componentes.some((c: any) => c.tp_componente === "01");
          if (!temPedagioComp) {
            throw new Error("A rota/manifesto possui pedágio. É obrigatório adicionar ao menos um componente do tipo '01 - Vale Pedágio' na aba Componentes.");
          }
        }

        // Validar se há informações de pagamento salvas e corretas
        const { data: pag } = await supabase
          .from("fiscal_mdf_pagamento")
          .select("forma_pagto, banco, agencia, cnpjipef")
          .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
          .eq("excluido", false)
          .maybeSingle();

        if (!pag) {
          throw new Error("As informações de pagamento não foram cadastradas na aba Pagamento.");
        }

        const temBanco = pag.banco && String(pag.banco).trim() !== "";
        const temIpef = pag.cnpjipef && String(pag.cnpjipef).trim() !== "";

        if (!temBanco && !temIpef) {
          throw new Error("Informe os dados do Banco/Agência ou o CNPJ da IPEF na aba Pagamento.");
        }

        if (temBanco && (!pag.agencia || String(pag.agencia).trim() === "")) {
          throw new Error("Como o Banco foi informado, a Agência também deve ser preenchida na aba Pagamento.");
        }

        // Validar parcelas se forma de pagamento for a prazo (1)
        if (pag.forma_pagto === "1") {
          const { data: parcelas } = await supabase
            .from("fiscal_mdf_pagtos")
            .select("mdf_pagtos_id")
            .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
            .eq("excluido", false);

          if (!parcelas || parcelas.length === 0) {
            throw new Error("Para Pagamento à Prazo, é obrigatório lançar pelo menos 1 parcela na aba Parcelas.");
          }
        }
      }
    }
  }
};

const XDefault = {
  numero: "", serie: "1", modelo: "58",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_viagem:  new Date().toISOString().substring(0, 10),
  hr_viagem: "00:00:00",
  modalidade: "1", tp_emitente: "1", tp_transportador: "",
  rntrc: "",
  ufini: "", uffim: "", unidade: "KG",
  peso_total: 0, valor_total: 0, qtd_nfe: 0, status: "D",
  ciot: "", ciot_cnpj_cpf: "", contratante_cnpj_cpf: "", contratante_nome: "", transp_cnpj_cpf: "",
  transportador_id: null,
  rota_id: null,
  possui_pedagio: false,
};

const isInfPagMandatory = (record: any) => {
  if (!record) return false;
  const tpTransp = String(record.tp_transportador || "");
  return ["1", "2", "3"].includes(tpTransp);
};

interface IProps {
  initialId?: number;
}

const MdfeForm: React.FC<IProps> = ({ initialId }) => {
  const { XEmpresaId } = useAppContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XRefreshRef = useRef<any>(null);
  const [selectedCadastroId, setSelectedCadastroId] = useState<number | null>(null);
  const [refreshMotoristasTrigger, setRefreshMotoristasTrigger] = useState(0);
  const [transportadores, setTransportadores] = useState<{ cadastro_id: number; razao_social: string; cnpj: string | null; rntrc: string | null; tp_proprietario: string | null }[]>([]);
  const [empresaCnpj, setEmpresaCnpj] = useState<string>("");
  const [selectedManifestoId, setSelectedManifestoId] = useState<number | null>(null);
  const [formaPagto, setFormaPagto] = useState<string>("0");
  const [rotas, setRotas] = useState<{ rota_id: number; descricao: string; possui_pedagio: boolean }[]>([]);

  useEffect(() => {
    if (!XEmpresaId) return;
    const loadEmpresa = async () => {
      const { data } = await supabase
        .from("empresa")
        .select("cnpj")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();
      if (data?.cnpj) {
        setEmpresaCnpj(data.cnpj.replace(/\D/g, ""));
      }
    };
    loadEmpresa();
  }, [XEmpresaId]);

  useEffect(() => {
    const loadFormaPagto = async () => {
      if (!selectedManifestoId) {
        setFormaPagto("0");
        return;
      }
      const { data, error } = await supabase
        .from("fiscal_mdf_pagamento")
        .select("forma_pagto")
        .eq("mdf_manifesto_id", selectedManifestoId)
        .eq("excluido", false)
        .maybeSingle();

      if (!error && data) {
        setFormaPagto(data.forma_pagto || "0");
      } else {
        setFormaPagto("0");
      }
    };
    loadFormaPagto();
  }, [selectedManifestoId]);

  useEffect(() => {
    if (!XEmpresaId) return;
    const loadTransportadores = async () => {
      const { data, error } = await supabase
        .from("cadastro")
        .select("cadastro_id, razao_social, cnpj, rntrc, tp_proprietario")
        .eq("empresa_id", XEmpresaId)
        .eq("st_transportador", "S")
        .eq("excluido", false)
        .order("razao_social");
      
      if (!error && data) {
        setTransportadores(data);
      }
    };
    loadTransportadores();
  }, [XEmpresaId]);

  useEffect(() => {
    if (!XEmpresaId) return;
    const loadRotas = async () => {
      const { data, error } = await supabase
        .from("rota")
        .select("rota_id, descricao, possui_pedagio")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .order("descricao");
      
      if (!error && data) {
        setRotas(data);
      }
    };
    loadRotas();
  }, [XEmpresaId]);

  useEffect(() => {
    if (!XEmpresaId) return;
    const ch = (supabase as any).channel('mdfe_form_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_mdf_manifesto', filter: `empresa_id=eq.${XEmpresaId}` }, () => {
        XRefreshRef.current?.();
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [XEmpresaId]);

  const handleTransmitir = useCallback(async (manifestoId: number) => {
    if (!confirm("Confirma a emissão do MDF-e? O documento será enviado ao SEFAZ via ACBr.")) return;
    toast.loading("Transmitindo MDF-e...", { id: "mdf-tx" });
    try {
      // 1. Validar se o manifesto está pronto para transmissão
      const { data: manifesto, error: errMdf } = await supabase
        .from("fiscal_mdf_manifesto")
        .select("tp_transportador, transp_cnpj_cpf, contratante_cnpj_cpf, contratante_nome, ufini, uffim, transportador_id")
        .eq("mdf_manifesto_id", manifestoId)
        .single();
      
      if (errMdf || !manifesto) throw new Error("Manifesto não localizado.");

      if (["1", "2", "3"].includes(String(manifesto.tp_transportador || ""))) {
        if (!manifesto.transportador_id) {
          throw new Error("O Transportador é obrigatório para transportadores do tipo TAC.");
        }
      }

      if (!manifesto.ufini?.trim()) {
        throw new Error("UF Inicial é obrigatória. Preencha-a na aba Percurso.");
      }
      if (!manifesto.uffim?.trim()) {
        throw new Error("UF Final é obrigatória. Preencha-a na aba Percurso.");
      }

      // Validar percurso se as UFs não fazem divisa
      if (!areUFsNeighbors(manifesto.ufini, manifesto.uffim)) {
        const { data: percursos } = await supabase
          .from("fiscal_mdf_percurso")
          .select("uf")
          .eq("mdf_manifesto_id", manifestoId)
          .or("excluido.is.null,excluido.eq.false");

        if (!percursos || percursos.length === 0) {
          throw new Error(`As UFs de início (${manifesto.ufini}) e fim (${manifesto.uffim}) não fazem divisa. É obrigatório cadastrar pelo menos uma UF de percurso na aba Percurso.`);
        }
      }

      // Verificar se há veículo TRAÇÃO cadastrado (Sempre obrigatório no modal rodoviário)
      const { data: veiculoTracao } = await supabase
        .from("fiscal_mdf_veiculo")
        .select("veiculo_id")
        .eq("mdf_manifesto_id", manifestoId)
        .eq("tp_veiculo", "TRACAO")
        .eq("excluido", false)
        .maybeSingle();

      if (!veiculoTracao) {
        throw new Error("É obrigatório adicionar um Veículo do tipo TRAÇÃO no manifesto antes de transmitir.");
      }

      // Verificar se há motorista (condutor) cadastrado (Sempre obrigatório no modal rodoviário)
      const { data: condutores } = await supabase
        .from("fiscal_mdf_condutor")
        .select("mdf_condutor_id")
        .eq("mdf_manifesto_id", manifestoId)
        .eq("excluido", false);

      if (!condutores || condutores.length === 0) {
        throw new Error("É obrigatório adicionar pelo menos um Motorista (Condutor) no manifesto antes de transmitir.");
      }

      if (manifesto.tp_transportador) {
        if (!manifesto.transp_cnpj_cpf || !manifesto.transp_cnpj_cpf.trim()) {
          throw new Error("O CNPJ/CPF do Transportador é obrigatório. Certifique-se de que o Proprietário do Veículo de Tração possui um documento (CNPJ/CPF) cadastrado.");
        }

        if (["1", "2", "3"].includes(String(manifesto.tp_transportador))) { // TAC
          if (!manifesto.contratante_cnpj_cpf || !manifesto.contratante_nome) {
            throw new Error("CNPJ/CPF e Nome do Contratante são obrigatórios para TAC.");
          }
        }
      }

      const res = await mdfeEmissaoService.emitirMdfe(manifestoId, XEmpresaId);
      if (res.success) {
        toast.success(res.mensagem || "MDF-e transmitido com sucesso!");
        XRefreshRef.current?.();

        // Auto-print DAMDFE
        let pdfBase64 = res.resposta?.pdf_base64;
        if (!pdfBase64 && res.resposta?.impressao?.pdf_base64) {
          pdfBase64 = res.resposta.impressao.pdf_base64;
        }

        if (pdfBase64) {
          try {
            const binaryString = atob(pdfBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
          } catch (e: any) {
            console.error("Falha ao abrir PDF:", e);
            toast.error("MDF-e autorizado, mas falhou ao abrir o visualizador de PDF.");
          }
        }
      } else {
        toast.error(res.mensagem || "Erro na transmissão");
      }
    } catch (e: unknown) {
      const errorObj = e as Error;
      toast.error(errorObj.message || "Erro na transmissão");
    } finally {
      toast.dismiss("mdf-tx");
    }
  }, [XEmpresaId]);

  const handleEncerrar = useCallback(async (manifestoId: number) => {
    toast.info("Para encerrar, utilize o Gerenciador Fiscal de MDF-e.");
  }, []);

  const handleCancelar = useCallback(async (manifestoId: number) => {
    const just = prompt("Informe a justificativa do cancelamento (mín. 15 caracteres):");
    if (!just || just.length < 15) { toast.warning("Justificativa inválida (mín. 15 caracteres)."); return; }
    
    // TODO: Implementar cancelamento via fiscal_evento no service
    const { error } = await supabase.from("fiscal_mdf_manifesto").update({ status: "C" }).eq("mdf_manifesto_id", manifestoId);
    if (error) { toast.error("Erro ao cancelar: " + error.message); return; }
    toast.success("MDF-e cancelado!");
    XRefreshRef.current?.();
  }, []);

  return (
    <StandardCrudForm
      config={{
        XTableName: "fiscal_mdf_manifesto",
        XPrimaryKey: "mdf_manifesto_id",
        XTitle: "MDF-e — Manifesto Eletrônico",
        XEmpresaId,
        XSoftDelete: true,
        XOrderBy: "mdf_manifesto_id",
        XInitialId: initialId,
        XCanEdit: (rec: any) => !["A", "E", "C"].includes(String(rec.status)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
        XOnBeforeSave: async (rec) => {
          if (!rec.dt_emissao)   throw new Error("Data de Emissão é obrigatória.");
          if (!rec.dt_viagem)    throw new Error("Data da Viagem é obrigatória.");
          if (!rec.hr_viagem)    throw new Error("Hora da Viagem é obrigatória.");
          
          // Transportador: Buscar a partir do cadastro do transportador selecionado
          if (rec.transportador_id) {
            const { data: cadastro } = await supabase
              .from("cadastro")
              .select("cnpj, rntrc, tp_proprietario")
              .eq("cadastro_id", rec.transportador_id)
              .maybeSingle();

            if (cadastro) {
              if (cadastro.cnpj) rec.transp_cnpj_cpf = cadastro.cnpj;
              if (cadastro.rntrc) rec.rntrc = cadastro.rntrc.replace(/\D/g, "").substring(0, 8);
              
              // Map tp_proprietario to tp_transportador
              let tpTranspVal = "";
              if (cadastro.tp_proprietario === "0") tpTranspVal = "1";
              else if (cadastro.tp_proprietario === "1") tpTranspVal = "2";
              else if (cadastro.tp_proprietario === "2") tpTranspVal = "3";
              rec.tp_transportador = tpTranspVal || null;
            }
          } else {
            rec.transp_cnpj_cpf = null;
            rec.rntrc = null;
            rec.tp_transportador = null;
          }

          const isTac = ["1", "2", "3"].includes(String(rec.tp_transportador || ""));
          if (isTac) {
            // Contratante: Buscar da tabela 'empresa'
            const { data: empData } = await supabase
              .from("empresa")
              .select("cnpj, razao_social")
              .eq("empresa_id", XEmpresaId)
              .single();

            if (empData) {
              rec.contratante_cnpj_cpf = empData.cnpj;
              rec.contratante_nome = empData.razao_social;
            }
          } else {
            rec.contratante_cnpj_cpf = null;
            rec.contratante_nome = null;
            rec.ciot = null;
            rec.ciot_cnpj_cpf = null;
            rec.rota_id = null;
            rec.possui_pedagio = false;
          }

          await validarObrigatoriedadesTransporte(rec, XEmpresaId);
          
          // Se as UFs forem iguais ou vizinhas, não deve haver UFs de percurso intermediárias no banco.
          if (rec.ufini && rec.uffim && areUFsNeighbors(rec.ufini, rec.uffim)) {
            if (rec.mdf_manifesto_id) {
              await supabase
                .from("fiscal_mdf_percurso")
                .update({ excluido: true, dt_alteracao: new Date().toISOString() })
                .eq("mdf_manifesto_id", rec.mdf_manifesto_id);
            }
          }
          
          // Lógica de Sequencial Automático (apenas na inclusão)
          if (!rec.mdf_manifesto_id) {
            const { data: { user } } = await supabase.auth.getUser();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: func } = await supabase.from("funcionario").select("mdf_config_item").eq("usr_id", (user as any)?.usr_id || 0).maybeSingle();
            
            let configId = func?.mdf_config_item;
            if (!configId) {
              const { data: defCfg } = await supabase.from("fiscal_config_item")
                .select("fiscal_config_item_id")
                .eq("empresa_id", XEmpresaId)
                .eq("modelo", "58")
                .limit(1).maybeSingle();
              configId = defCfg?.fiscal_config_item_id;
            }

            if (!configId) throw new Error("Configuração de série/sequencial de MDF-e não localizada para esta empresa.");

            // Buscar e incrementar o número atomicamente (ou quase)
            const { data: cfg, error: errCfg } = await supabase.from("fiscal_config_item")
              .select("sequencia, serie")
              .eq("fiscal_config_item_id", configId)
              .single();

            if (errCfg || !cfg) throw new Error("Erro ao obter sequencial: " + errCfg?.message);

            rec.numero = cfg.sequencia;
            rec.serie = cfg.serie;
            rec.codigo_numerico = Math.floor(Math.random() * 90000000) + 10000000;

            // Incrementar para o próximo
            await supabase.from("fiscal_config_item")
              .update({ sequencia: Number(cfg.sequencia) + 1 })
              .eq("fiscal_config_item_id", configId);
          }

          return {
            ...rec,
            empresa_id: XEmpresaId,
            excluido: rec.excluido ?? false,
            dt_cadastro: rec.mdf_manifesto_id ? undefined : new Date().toISOString(),
            dt_alteracao: new Date().toISOString(),
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="MDF-e"
      XRefreshRef={XRefreshRef}
      XAfterInsertTab="percurso"
      XCadastroLabel="Dados Gerais"
      XToolbarExtras={({ currentRecord }) => (
        <MdfIdSync currentRecord={currentRecord} onIdChange={setSelectedManifestoId} />
      )}
      XHiddenTabs={(rec) => {
        const mandatory = isInfPagMandatory(rec);
        if (!mandatory) return ["pagamento", "componentes", "parcelas"];
        if (formaPagto === "0") return ["parcelas"];
        return [];
      }}
      XExtraTabs={[
        {
          key: "percurso", label: "Percurso",
          render: ({ currentRecord, record, setField, isEditing }) => (
            <MdfPercursoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
              record={record}
              setField={setField}
              isEditing={isEditing}
            />
          ),
        },
        {
          key: "docs", label: "Documentos",
          render: ({ currentRecord }) => (
            <MdfDocumentosTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
            />
          ),
        },
        {
          key: "veiculos", label: "Veículos / Motoristas",
          render: ({ currentRecord, record }) => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="border border-border rounded p-4 bg-card/20 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">Veículos</h3>
                <MdfVeiculosTab
                  mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
                  empresaId={XEmpresaId}
                  transportadorId={record?.transportador_id ?? currentRecord?.transportador_id ?? null}
                  podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
                  onTracaoCadastroIdChange={setSelectedCadastroId}
                  onMotoristasChanged={() => setRefreshMotoristasTrigger(p => p + 1)}
                />
              </div>
              <div className="border border-border rounded p-4 bg-card/20 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">Motoristas</h3>
                <MdfMotoristasTab
                  mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
                  empresaId={XEmpresaId}
                  podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
                  veiculoCadastroId={selectedCadastroId}
                  refreshTrigger={refreshMotoristasTrigger}
                />
              </div>
            </div>
          ),
        },
        {
          key: "pagamento", label: "Pagamento",
          render: ({ currentRecord }) => (
            <MdfPagamentoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
              onFormaPagtoChange={setFormaPagto}
            />
          ),
        },
        {
          key: "componentes", label: "Componentes",
          render: ({ currentRecord }) => (
            <MdfComponenteTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
            />
          ),
        },
        {
          key: "parcelas", label: "Parcelas",
          render: ({ currentRecord }) => (
            <MdfParcelasTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={!currentRecord?.status || ["D", "R"].includes(String(currentRecord?.status))}
            />
          ),
        },
        {
          key: "historico", label: "Histórico / XML",
          render: ({ currentRecord }) => (
            <MdfHistoricoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={false}
            />
          ),
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => {
        const ro = !isEditing;
        const st = (record.status || "D") as TMdfSt;
        const mdfId = currentRecord?.mdf_manifesto_id ?? null;
        const podeTransmitir = mdfId && (!st || st === "D" || st === "R") && !isEditing;
        const podeEncerrar   = mdfId && st === "A" && !isEditing;
        const podeCancelar   = mdfId && (st === "A" || st === "E") && !isEditing;

        return (
          <div className="space-y-4">

            {/* ── Linha 1: Identificação + Status + Ações ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Cód.</label>
                <input readOnly
                  value={mdfId ?? (mode === "insert" ? "(Novo)" : "")}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                <input readOnly={ro} value={record.modelo ?? "58"}
                  onChange={e => setField("modelo", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Número</label>
                <input readOnly
                  value={record.numero ?? ""}
                  placeholder="Automático"
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary font-bold text-primary" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly
                  value={record.serie ?? ""}
                  placeholder="Auto"
                  className="w-full border border-border rounded px-2 py-1 text-sm text-center bg-secondary" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={String(record.dt_emissao || "").substring(0, 10)}
                  onChange={e => setField("dt_emissao", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Status</label>
                <div className={`w-full border border-border rounded px-2 py-[5px] text-sm font-semibold bg-secondary ${ST_COLORS[st] || ""}`}>
                  {ST_LABELS[st] || st}
                </div>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">&nbsp;</label>
                {podeTransmitir ? (
                  <button
                    type="button"
                    onClick={() => handleTransmitir(record.mdf_manifesto_id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-sm shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Send className="w-3.5 h-3.5" /> Transmitir MDF-e
                  </button>
                ) : (
                  <div className="h-[30px]" />
                )}
              </div>
            </div>

            {/* ── Linha 2: Viagem + Modalidade ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Dt. Viagem <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={String(record.dt_viagem || "").substring(0, 10)}
                  onChange={e => setField("dt_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Hora Viagem <span className="text-destructive">*</span></label>
                <input type="time" readOnly={ro}
                  value={record.hr_viagem ?? "00:00:00"}
                  onChange={e => setField("hr_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Modalidade</label>
                <select disabled={ro} value={record.modalidade ?? "1"}
                  onChange={e => setField("modalidade", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - Rodoviário</option>
                  <option value="2">2 - Aéreo</option>
                  <option value="3">3 - Aquaviário</option>
                  <option value="4">4 - Ferroviário</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Unidade Medida</label>
                <select disabled={ro} value={record.unidade ?? "KG"}
                  onChange={e => setField("unidade", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="KG">KG</option>
                  <option value="TON">TON</option>
                </select>
              </div>
            </div>

            {/* ── Linha 3: Tipo Emitente / Transportador / Tipo Transportador ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Tipo Emitente <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_emitente ?? "1"}
                  onChange={e => setField("tp_emitente", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - Prestador de serviço de transporte</option>
                  <option value="2">2 - Transportador de carga própria</option>
                  <option value="3">3 - Prestador de serviço de transporte (Carga própria)</option>
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">
                  Transportador {(record.tp_emitente !== "2" || (record.transportador_id && record.transp_cnpj_cpf?.replace(/\D/g, "") !== empresaCnpj)) && <span className="text-destructive">*</span>}
                </label>
                <select disabled={ro} value={record.transportador_id ?? ""}
                  onChange={e => {
                    const oldTranspId = record.transportador_id;
                    const val = e.target.value ? Number(e.target.value) : null;
                    if (val !== oldTranspId) {
                      setField("transportador_id", val);
                      if (val) {
                        const t = transportadores.find(x => x.cadastro_id === val);
                        if (t) {
                          setField("transp_cnpj_cpf", t.cnpj || null);
                          const cleanRntrc = t.rntrc ? String(t.rntrc).replace(/\D/g, "").substring(0, 8) : null;
                          setField("rntrc", cleanRntrc);
                          
                          // Map tp_proprietario to tp_transportador
                          // tp_proprietario: 0 -> 1 (TAC Agregado), 1 -> 2 (TAC Independente), 2 -> 3 (TAC Equiparado/Outros)
                          let tpTranspVal = "";
                          if (t.tp_proprietario === "0") tpTranspVal = "1";
                          else if (t.tp_proprietario === "1") tpTranspVal = "2";
                          else if (t.tp_proprietario === "2") tpTranspVal = "3";
                          setField("tp_transportador", tpTranspVal || null);
                        }
                      } else {
                        setField("transp_cnpj_cpf", null);
                        setField("rntrc", null);
                        setField("tp_transportador", null);
                      }

                      // Limpar as grids de veículos e motoristas se o manifesto já estiver salvo
                      if (record.mdf_manifesto_id) {
                        Promise.all([
                          supabase
                            .from("fiscal_mdf_veiculo")
                            .update({ excluido: true, dt_alteracao: new Date().toISOString() })
                            .eq("mdf_manifesto_id", record.mdf_manifesto_id),
                          supabase
                            .from("fiscal_mdf_condutor")
                            .update({ excluido: true, dt_alteracao: new Date().toISOString() })
                            .eq("mdf_manifesto_id", record.mdf_manifesto_id)
                        ]).then(() => {
                          setRefreshMotoristasTrigger(p => p + 1);
                          toast.info("Veículos e motoristas desvinculados devido à mudança de Transportador.");
                        }).catch(err => {
                          console.error("Erro ao limpar veículos e motoristas:", err);
                        });
                      }
                    }
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="">— Selecione o Transportador —</option>
                  {transportadores.map(t => (
                    <option key={t.cadastro_id} value={t.cadastro_id}>{t.razao_social}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Tipo de Transportador (TAC)</label>
                <input 
                  type="text" 
                  disabled 
                  value={
                    record.tp_transportador === "1" ? "0 - TAC Agregado" :
                    record.tp_transportador === "2" ? "1 - TAC Independente" :
                    record.tp_transportador === "3" ? "2 - Outros" :
                    "(Não Informado / Carga Própria)"
                  }
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary"
                />
              </div>
            </div>

            {/* ── Seção do Transportador TAC (exibida e obrigatória para TAC) ── */}
            {["1", "2", "3"].includes(String(record.tp_transportador || "")) && (
              <div className="border border-border rounded p-3 bg-accent/10 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados de TAC (Transportador Autônomo)</p>

                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-8">
                    <label className="text-xs text-muted-foreground font-semibold">Rota do MDF-e</label>
                    <select disabled={ro} value={record.rota_id ?? ""}
                      onChange={e => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setField("rota_id", val);
                        const selectedRoute = rotas.find(r => r.rota_id === val);
                        if (selectedRoute) {
                          setField("possui_pedagio", selectedRoute.possui_pedagio);
                        } else {
                          setField("possui_pedagio", false);
                        }
                      }}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                      <option value="">— Selecione a Rota (Opcional) —</option>
                      {rotas.map(r => (
                        <option key={r.rota_id} value={r.rota_id}>{r.descricao}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 flex items-center gap-2 mt-4">
                    <input type="checkbox" id="possui_pedagio" disabled={ro}
                      checked={!!record.possui_pedagio}
                      onChange={e => setField("possui_pedagio", e.target.checked)}
                      className="rounded border-border" />
                    <label htmlFor="possui_pedagio" className="text-xs font-semibold text-muted-foreground select-none cursor-pointer">Possui Pedágio</label>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-6">
                    <label className="text-xs text-muted-foreground font-semibold">Número do CIOT</label>
                    <input type="text" disabled={ro} value={record.ciot ?? ""}
                      onChange={e => setField("ciot", e.target.value)}
                      placeholder="Ex: 123456789012" maxLength={12}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
                  </div>
                  <div className="col-span-6">
                    <label className="text-xs text-muted-foreground font-semibold">CPF/CNPJ Resp. pelo CIOT</label>
                    <input type="text" disabled={ro} value={record.ciot_cnpj_cpf ?? ""}
                      onChange={e => setField("ciot_cnpj_cpf", e.target.value)}
                      placeholder="Ex: CPF ou CNPJ" maxLength={14}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
                  </div>
                </div>
              </div>
            )}



            {/* ── Totais ── */}
            <div className="border border-border rounded p-3 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Totais do Manifesto</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Qtd. NF-e <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.qtd_nfe ?? 0}
                    onChange={e => setField("qtd_nfe", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Peso Total (KG) <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.peso_total ?? 0}
                    onChange={e => setField("peso_total", e.target.value)}
                    step="0.001"
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor Total (R$) <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.valor_total ?? 0}
                    onChange={e => setField("valor_total", e.target.value)}
                    step="0.01"
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
              </div>
            </div>
            {/* ── Dados Fiscais (SEFAZ) ── */}
            {(record.chave_acesso || record.numero_protocolo) && (
              <div className="border border-green-200 rounded p-3 bg-green-50/30">
                <p className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wide">Dados de Autorização (SEFAZ)</p>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Chave de Acesso</label>
                    <input readOnly value={record.chave_acesso || ""} 
                      className="w-full border border-green-200 rounded px-2 py-1 text-xs font-mono bg-white text-green-800" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Protocolo</label>
                    <input readOnly value={record.numero_protocolo || ""} 
                      className="w-full border border-green-200 rounded px-2 py-1 text-xs font-mono bg-white text-green-800" />
                  </div>
                </div>
              </div>
            )}



          </div>
        );
      }}
    />
  );
};

const MdfIdSync: React.FC<{
  currentRecord: { mdf_manifesto_id?: number } | null | undefined;
  onIdChange: (id: number | null) => void;
}> = ({ currentRecord, onIdChange }) => {
  const id = currentRecord?.mdf_manifesto_id ?? null;
  useEffect(() => {
    onIdChange(id);
  }, [id, onIdChange]);
  return null;
};

export default MdfeForm;

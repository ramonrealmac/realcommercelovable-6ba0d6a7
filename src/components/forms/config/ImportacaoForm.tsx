import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { 
  FileUp, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Download, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

// ── Target Table Definitions & Metadata ─────────────────────────────────────
interface TableColumn {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description: string;
}

interface TableDefinition {
  id: string;
  name: string;
  label: string;
  primaryKey: string;
  description: string;
  columns: TableColumn[];
  defaultValues?: Record<string, any>;
}

const TABLE_DEFINITIONS: TableDefinition[] = [
  {
    id: "produto",
    name: "produto",
    label: "Produtos",
    primaryKey: "produto_id",
    description: "Cadastro de mercadorias e insumos para venda e estoque.",
    columns: [
      { name: "nome", label: "Nome do Produto", type: "string", required: true, description: "Nome comercial do produto." },
      { name: "nome_reduzido", label: "Nome Reduzido", type: "string", required: false, description: "Nome abreviado." },
      { name: "referencia", label: "Referência", type: "string", required: false, description: "Código de referência interna." },
      { name: "gtin", label: "Código de Barras (GTIN)", type: "string", required: false, description: "Código EAN/GTIN." },
      { name: "ncm", label: "NCM", type: "string", required: false, description: "Nomenclatura Comum do Mercosul." },
      { name: "cest", label: "CEST", type: "string", required: false, description: "Código de Especificação Substituição Tributária." },
      { name: "preco_venda", label: "Preço de Venda", type: "number", required: false, description: "Valor final de venda." },
      { name: "vl_custo", label: "Preço de Custo", type: "number", required: false, description: "Custo de aquisição." },
      { name: "unidade_id", label: "ID da Unidade", type: "string", required: false, description: "Sigla da unidade de medida (ex: UN, KG)." },
      { name: "produto_grupo_id", label: "ID do Grupo de Produtos", type: "number", required: false, description: "Vínculo numérico com o grupo." },
      { name: "produto_subgrupo_id", label: "ID do Subgrupo", type: "number", required: false, description: "Vínculo numérico com o subgrupo." },
      { name: "linha_id", label: "ID da Linha de Produtos", type: "number", required: false, description: "Vínculo numérico com a linha." },
      { name: "peso_liquido", label: "Peso Líquido", type: "number", required: false, description: "Peso em KG." },
      { name: "peso_bruto", label: "Peso Bruto", type: "number", required: false, description: "Peso com embalagem." },
      { name: "grupo_icms_id", label: "ID do Grupo de ICMS", type: "number", required: false, description: "Vínculo numérico com o grupo tributário de ICMS." },
      { name: "grupo_ipi_id", label: "ID do Grupo de IPI", type: "number", required: false, description: "Vínculo numérico com o grupo tributário de IPI." },
      { name: "grupo_ibscbs_id", label: "ID do Grupo de IBS/CBS", type: "number", required: false, description: "Vínculo numérico com o grupo tributário de IBS/CBS (Reforma Tributária)." },
      { name: "grupo_pis_cofins_id", label: "ID do Grupo de PIS/COFINS", type: "number", required: false, description: "Vínculo numérico com o grupo tributário de PIS/COFINS." }
    ]
  },
  {
    id: "produto_grupo",
    name: "produto_grupo",
    label: "Grupos de Produtos",
    primaryKey: "produto_grupo_id",
    description: "Estrutura principal de categorização de produtos.",
    columns: [
      { name: "nome", label: "Nome do Grupo", type: "string", required: true, description: "Título descritivo do grupo." }
    ]
  },
  {
    id: "produto_subgrupo",
    name: "produto_subgrupo",
    label: "Subgrupos de Produtos",
    primaryKey: "produto_subgrupo_id",
    description: "Subdivisões ligadas a um grupo específico.",
    columns: [
      { name: "nome", label: "Nome do Subgrupo", type: "string", required: true, description: "Título do subgrupo." },
      { name: "produto_grupo_id", label: "ID do Grupo de Produtos", type: "number", required: true, description: "ID do grupo pai associado." }
    ]
  },
  {
    id: "linha_produto",
    name: "linha_produto",
    label: "Linhas de Produtos",
    primaryKey: "linha_id",
    description: "Classificações adicionais como marcas ou coleções.",
    columns: [
      { name: "nome", label: "Nome da Linha", type: "string", required: true, description: "Título da linha." }
    ]
  },
  {
    id: "unidade",
    name: "unidade",
    label: "Unidades de Medida",
    primaryKey: "unidade_id",
    description: "Siglas das unidades (ex: UN, KG, PC) para venda e estoque.",
    columns: [
      { name: "unidade_id", label: "Sigla/Código", type: "string", required: true, description: "Código curto único (ex: UN, KG, PC)." },
      { name: "descricao", label: "Descrição da Unidade", type: "string", required: false, description: "Nome completo (ex: Unidade, Kilograma)." }
    ]
  },
  {
    id: "cliente",
    name: "cadastro",
    label: "Clientes",
    primaryKey: "cadastro_id",
    description: "Cadastro geral de clientes (Parceiros de negócios).",
    defaultValues: { st_cliente: "S", st_fornecedor: "N", st_transportador: "N" },
    columns: [
      { name: "razao_social", label: "Razão Social / Nome Completo", type: "string", required: true, description: "Nome científico ou civil completo." },
      { name: "nome_fantasia", label: "Nome Fantasia", type: "string", required: false, description: "Nome fantasia / apelido." },
      { name: "cnpj", label: "CNPJ / CPF", type: "string", required: false, description: "Documento nacional de identificação." },
      { name: "rg", label: "RG / Inscrição Estadual", type: "string", required: false, description: "Registro civil ou estadual." },
      { name: "email", label: "E-mail Principal", type: "string", required: false, description: "Endereço de e-mail." },
      { name: "fone_geral", label: "Telefone Geral", type: "string", required: false, description: "Número de telefone padrão." },
      { name: "endereco_cep", label: "CEP", type: "string", required: false, description: "Código postal do endereço." },
      { name: "endereco_logradouro", label: "Logradouro", type: "string", required: false, description: "Rua, avenida, etc." },
      { name: "endereco_numero", label: "Número", type: "string", required: false, description: "Número do endereço residencial." },
      { name: "endereco_bairro", label: "Bairro", type: "string", required: false, description: "Bairro associado." },
      { name: "endereco_compl", label: "Complemento", type: "string", required: false, description: "Informações adicionais do local." },
      { name: "endereco_cidade_id", label: "ID da Cidade", type: "number", required: false, description: "Código numérico IBGE/interno da cidade." },
      { name: "tp_pessoa", label: "Tipo Pessoa (F/J)", type: "string", required: false, description: "'F' para física ou 'J' para jurídica." }
    ]
  },
  {
    id: "fornecedor",
    name: "cadastro",
    label: "Fornecedores",
    primaryKey: "cadastro_id",
    description: "Cadastro de fornecedores de insumos ou mercadorias.",
    defaultValues: { st_cliente: "N", st_fornecedor: "S", st_transportador: "N" },
    columns: [
      { name: "razao_social", label: "Razão Social / Nome", type: "string", required: true, description: "Nome jurídico ou civil completo." },
      { name: "nome_fantasia", label: "Nome Fantasia", type: "string", required: false, description: "Nome fantasia." },
      { name: "cnpj", label: "CNPJ / CPF", type: "string", required: false, description: "Documento de identificação." },
      { name: "email", label: "E-mail", type: "string", required: false, description: "E-mail de contato comercial." },
      { name: "fone_geral", label: "Telefone Comercial", type: "string", required: false, description: "Telefone principal." }
    ]
  },
  {
    id: "transportador",
    name: "cadastro",
    label: "Transportadoras",
    primaryKey: "cadastro_id",
    description: "Cadastro de transportadores credenciados.",
    defaultValues: { st_cliente: "N", st_fornecedor: "N", st_transportador: "S" },
    columns: [
      { name: "razao_social", label: "Razão Social", type: "string", required: true, description: "Nome da transportadora." },
      { name: "nome_fantasia", label: "Nome Fantasia", type: "string", required: false, description: "Nome comercial." },
      { name: "cnpj", label: "CNPJ", type: "string", required: false, description: "CNPJ da transportadora." },
      { name: "inscricao_estadual", label: "Inscrição Estadual", type: "string", required: false, description: "Inscrição estadual." },
      { name: "email", label: "E-mail Comercial", type: "string", required: false, description: "E-mail." }
    ]
  },
  {
    id: "cadastro_veiculo",
    name: "cadastro_veiculo",
    label: "Veículos",
    primaryKey: "veiculo_id",
    description: "Frotas associadas a parceiros ou transporte próprio.",
    columns: [
      { name: "placa", label: "Placa", type: "string", required: true, description: "Placa única do veículo (ex: ABC1234)." },
      { name: "cadastro_id", label: "ID do Proprietário", type: "number", required: true, description: "ID de cadastro associado (proprietário/motorista)." },
      { name: "marca", label: "Marca", type: "string", required: false, description: "Fabricante do veículo (ex: Volvo, Ford)." },
      { name: "modelo", label: "Modelo", type: "string", required: false, description: "Modelo específico." },
      { name: "uf", label: "UF da Placa", type: "string", required: false, description: "Estado da licença do veículo (ex: SP, RJ)." },
      { name: "renavam", label: "RENAVAM", type: "string", required: false, description: "Código de registro nacional do veículo." }
    ]
  },
  {
    id: "movimento",
    name: "movimento",
    label: "Movimentos",
    primaryKey: "movimento_id",
    description: "Cabeçalho de ordens, notas fiscais, entradas e saídas de estoque.",
    columns: [
      { name: "tp_movimento", label: "Tipo do Movimento (E/S)", type: "string", required: false, description: "'E' para Entradas ou 'S' para Saídas." },
      { name: "nr_movimento", label: "Número do Movimento", type: "number", required: false, description: "Número sequencial ou fiscal." },
      { name: "cadastro_id", label: "ID do Parceiro", type: "number", required: false, description: "ID do cliente ou fornecedor associado." },
      { name: "dt_emissao", label: "Data de Emissão", type: "string", required: false, description: "Data de emissão (AAAA-MM-DD)." },
      { name: "vl_movimento", label: "Valor Total", type: "number", required: false, description: "Valor monetário total do movimento." },
      { name: "status", label: "Status", type: "string", required: false, description: "Situação do movimento (ex: ABERTO, FATURADO)." },
      { name: "obs_pedido", label: "Observações", type: "string", required: false, description: "Comentários ou anotações." }
    ]
  },
  {
    id: "movimento_item",
    name: "movimento_item",
    label: "Itens de Movimento",
    primaryKey: "movimento_item_id",
    description: "Itens que compõem cada movimento de estoque/vendas.",
    columns: [
      { name: "movimento_id", label: "ID do Movimento", type: "number", required: true, description: "ID do cabeçalho de movimento associado." },
      { name: "produto_id", label: "ID do Produto", type: "number", required: true, description: "ID do produto associado." },
      { name: "qt_movimento", label: "Quantidade", type: "number", required: false, description: "Quantidade movimentada." },
      { name: "vl_und_produto", label: "Valor Unitário", type: "number", required: false, description: "Preço unitário do item." },
      { name: "vl_movimento", label: "Valor Total do Item", type: "number", required: false, description: "Valor final calculado do item." }
    ]
  },
  {
    id: "financeiro",
    name: "financeiro",
    label: "Títulos Financeiros",
    primaryKey: "financeiro_id",
    description: "Lançamentos de Contas a Pagar e a Receber.",
    columns: [
      { name: "documento", label: "Número do Documento", type: "string", required: false, description: "Número identificador da fatura." },
      { name: "tp_conta", label: "Tipo da Conta (P/R)", type: "string", required: false, description: "'P' para Pagar ou 'R' para Receber." },
      { name: "vl_titulo", label: "Valor do Título", type: "number", required: false, description: "Valor monetário bruto emitido." },
      { name: "dt_emissao", label: "Data de Emissão", type: "string", required: false, description: "Data do lançamento (AAAA-MM-DD)." },
      { name: "dt_vencto", label: "Data de Vencimento", type: "string", required: false, description: "Data limite de liquidação." },
      { name: "cadastro_id", label: "ID do Parceiro", type: "number", required: false, description: "Código do cliente/fornecedor vinculado." },
      { name: "observacao1", label: "Observações", type: "string", required: false, description: "Comentários adicionais." }
    ]
  },
  {
    id: "financeiro_baixa",
    name: "financeiro_baixa",
    label: "Baixas Financeiras",
    primaryKey: "financeiro_baixa_id",
    description: "Registro de pagamentos e liquidações de títulos.",
    columns: [
      { name: "financeiro_id", label: "ID do Título Financeiro", type: "number", required: true, description: "Código do título sendo liquidado." },
      { name: "vl_pago", label: "Valor Pago", type: "number", required: false, description: "Valor monetário efetivado na transação." },
      { name: "dt_pagamento", label: "Data de Pagamento", type: "string", required: false, description: "Data em que ocorreu a baixa." },
      { name: "observacao", label: "Observações da Baixa", type: "string", required: false, description: "Notas do caixa." }
    ]
  },
  {
    id: "estoque",
    name: "estoque",
    label: "Estoque",
    primaryKey: "estoque_id",
    description: "Saldo de estoque por depósito e endereçamento físico.",
    columns: [
      { name: "produto_id", label: "ID do Produto", type: "number", required: true, description: "ID numérico do produto associado." },
      { name: "deposito_id", label: "ID do Depósito", type: "number", required: false, description: "ID numérico do depósito de estoque." },
      { name: "estoque_fisico", label: "Estoque Físico", type: "number", required: false, description: "Saldo físico atual." },
      { name: "estoque_reservado", label: "Estoque Reservado", type: "number", required: false, description: "Saldo reservado por pedidos de venda." },
      { name: "estoque_disponivel", label: "Estoque Disponível", type: "number", required: false, description: "Saldo livre disponível para novas vendas." },
      { name: "estoque_minimo", label: "Estoque Mínimo", type: "number", required: false, description: "Estoque mínimo de segurança." },
      { name: "estoque_padrao", label: "Estoque Padrão", type: "number", required: false, description: "Quantidade padrão sugerida." },
      { name: "estoque_inventario", label: "Estoque Inventariado", type: "number", required: false, description: "Contagem de estoque no inventário." },
      { name: "endereco", label: "Endereço Físico", type: "string", required: false, description: "Localização/rua/prateleira no depósito." }
    ]
  }
];

// Delimiter/quotes aware high-performance CSV parser
function parseCSV(text: string, selectedDelimiter: string = "auto"): string[][] {
  let cleanText = text;
  if (cleanText.startsWith("\uFEFF")) {
    cleanText = cleanText.substring(1);
  }
  const lines = cleanText.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return [];

  let separator = ",";
  if (selectedDelimiter !== "auto") {
    separator = selectedDelimiter;
  } else {
    const candidates = [";", ",", "\t"];
    const counts = { ";": 0, ",": 0, "\t": 0 };
    
    const sampleLines = lines.slice(0, Math.min(3, lines.length));
    sampleLines.forEach(line => {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === ";" || char === "," || char === "\t") {
          counts[char]++;
        }
      }
    });
    
    let maxFreq = 0;
    candidates.forEach(c => {
      const count = counts[c as ";" | "," | "\t"];
      if (count > maxFreq) {
        maxFreq = count;
        separator = c;
      }
    });
  }

  const results: string[][] = [];
  
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].trim();
    if (!line) continue;

    const row: string[] = [];
    let cell = "";
    let insideQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      const nextChar = line[c + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          cell += '"';
          c++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === separator && !insideQuotes) {
        row.push(cell.trim());
        cell = "";
      } else {
        cell += char;
      }
    }
    
    row.push(cell.trim());
    if (row.length > 0 && row.some(x => x !== "")) {
      results.push(row);
    }
  }

  return results;
}

const ImportacaoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  
  // ── Wizard State ──────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedTableId, setSelectedTableId] = useState<string>("produto");
  const [overridePK, setOverridePK] = useState<boolean>(false);
  const [delimiter, setDelimiter] = useState<string>("auto");
  const [abortOnError, setAbortOnError] = useState<boolean>(true);
  const [avoidDuplicates, setAvoidDuplicates] = useState<boolean>(false);
  const [importStats, setImportStats] = useState<{ totalSeconds: number; avgPerThousand: number } | null>(null);
  
  // File parsing states
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  
  // Mapping state: key is DB Column Name, value is CSV Header Column index
  const [mappings, setMappings] = useState<Record<string, number>>({});
  
  // Import Execution state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [failedRowsList, setFailedRowsList] = useState<{ row: number; data: Record<string, any>; error: string }[]>([]);
  const [showFailedModal, setShowFailedModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retrieve current active table definition
  const activeTable = TABLE_DEFINITIONS.find(t => t.id === selectedTableId) || TABLE_DEFINITIONS[0];

  // Auto-set override requirement based on PK nature (e.g. unidade always requires input)
  const isStringPK = activeTable.primaryKey === "unidade_id";
  const finalOverridePK = isStringPK ? true : overridePK;

  // Compile active columns list based on PK preference
  const getActiveColumns = () => {
    const cols = [...activeTable.columns];
    if (finalOverridePK && !isStringPK) {
      cols.unshift({
        name: activeTable.primaryKey,
        label: `ID da Tabela (${activeTable.primaryKey})`,
        type: "number",
        required: true,
        description: "Chave primária exclusiva fornecida pelo seu arquivo."
      });
    }
    return cols;
  };

  const activeColumns = getActiveColumns();

  // Re-parse and auto-map dynamically whenever file content, delimiter, or mapping options change
  useEffect(() => {
    if (!csvContent) {
      setMappings({});
      setParsedRows([]);
      setCsvHeaders([]);
      return;
    }
    
    const rows = parseCSV(csvContent, delimiter);
    if (rows.length < 2) {
      toast.error("O arquivo CSV precisa conter pelo menos um cabeçalho e uma linha de dados.");
      return;
    }
    
    const headers = rows[0];
    setParsedRows(rows.slice(1));
    setCsvHeaders(headers);
    
    // Auto mapping fuzzy logic matching
    const autoMappings: Record<string, number> = {};
    const cols = getActiveColumns();
    
    cols.forEach(col => {
      const index = headers.findIndex(h => {
        const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normName = col.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normLabel = col.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normH.includes(normName) || normName.includes(normH) || normH.includes(normLabel) || normLabel.includes(normH);
      });
      if (index !== -1) {
        autoMappings[col.name] = index;
      }
    });
    
    setMappings(autoMappings);
  }, [csvContent, delimiter, selectedTableId, overridePK]);

  // ── Drag & Drop & Upload Handling ─────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadCSVFile(file);
  };

  const loadCSVFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Formato de arquivo inválido. Envie apenas arquivos CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setFileName(file.name);
      toast.success(`Arquivo carregado com sucesso!`);
      setCurrentStep(2);
    };
    reader.readAsText(file, "UTF-8");
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // ── Step Navigation & Mapping validations ────────────────────────────────
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!fileName) {
        toast.error("Selecione um arquivo CSV antes de continuar.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate mapping required columns
      const missingRequired = activeColumns.filter(c => c.required && mappings[c.name] === undefined);
      if (missingRequired.length > 0) {
        toast.error(`Mapeie todas as colunas obrigatórias: ${missingRequired.map(c => c.label).join(", ")}`);
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ── Import Execution (Chunked Inserts) ───────────────────────────────────
  const executeImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    setImportResults(null);
    setFailedRowsList([]);
    setImportStats(null);

    const startTime = performance.now();
    const batchSize = 250;
    const concurrencyLimit = 4;
    const totalRows = parsedRows.length;
    let successCount = 0;
    let failedCount = 0;
    const localFailedList: typeof failedRowsList = [];
    let isAborted = false;

    // Parse and prepare data rows
    const payloadRows = parsedRows.map((row, rowIndex) => {
      const record: Record<string, any> = {};
      
      record.empresa_id = XEmpresaId || 1;

      if (activeTable.defaultValues) {
        Object.entries(activeTable.defaultValues).forEach(([key, val]) => {
          record[key] = val;
        });
      }

      Object.entries(mappings).forEach(([colName, headerIdx]) => {
        let rawValue = row[headerIdx];
        if (typeof rawValue === "string") {
          rawValue = rawValue.trim();
        }
        if (rawValue === undefined || rawValue === "") {
          record[colName] = null;
          return;
        }

        const colDef = activeColumns.find(c => c.name === colName);
        if (!colDef) return;

        if (colDef.type === "number") {
          const cleanNum = rawValue.replace(/\./g, "").replace(/,/g, ".");
          const num = parseFloat(cleanNum);
          record[colName] = isNaN(num) ? null : num;
        } else if (colDef.type === "boolean") {
          const valLower = rawValue.toLowerCase();
          record[colName] = valLower === "sim" || valLower === "s" || valLower === "1" || valLower === "true";
        } else {
          record[colName] = rawValue;
        }
      });

      return { record, rowIndex: rowIndex + 2 };
    });

    // Split payloadRows into chunks of batchSize
    const chunks: typeof payloadRows[] = [];
    for (let i = 0; i < payloadRows.length; i += batchSize) {
      chunks.push(payloadRows.slice(i, i + batchSize));
    }

    let rowsProcessed = 0;

    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
      if (isAborted) break;

      const group = chunks.slice(i, i + concurrencyLimit);
      
      await Promise.all(group.map(async (chunk) => {
        if (isAborted) return;

        const recordsToInsert = chunk.map(c => c.record);
        
        try {
          const query = avoidDuplicates
            ? supabase.from(activeTable.name).upsert(recordsToInsert)
            : supabase.from(activeTable.name).insert(recordsToInsert);

          const { error } = await query;

          if (error) {
            if (abortOnError) {
              isAborted = true;
              failedCount += chunk.length;
              chunk.forEach(item => {
                localFailedList.push({
                  row: item.rowIndex,
                  data: item.record,
                  error: `Importação abortada devido a erro no lote: ${error.message}`
                });
              });
              return;
            }

            // Fallback row-by-row if continue is selected
            for (const item of chunk) {
              const singleQuery = avoidDuplicates
                ? supabase.from(activeTable.name).upsert(item.record)
                : supabase.from(activeTable.name).insert(item.record);
              const { error: singleError } = await singleQuery;

              if (singleError) {
                failedCount++;
                localFailedList.push({
                  row: item.rowIndex,
                  data: item.record,
                  error: singleError.message || JSON.stringify(singleError)
                });
              } else {
                successCount++;
              }
            }
          } else {
            successCount += chunk.length;
          }
        } catch (err: any) {
          if (abortOnError) {
            isAborted = true;
            failedCount += chunk.length;
            chunk.forEach(item => {
              localFailedList.push({
                row: item.rowIndex,
                data: item.record,
                error: `Importação abortada: ${err.message}`
              });
            });
            return;
          }

          chunk.forEach(item => {
            failedCount++;
            localFailedList.push({
              row: item.rowIndex,
              data: item.record,
              error: err.message || "Erro inesperado"
            });
          });
        } finally {
          rowsProcessed += chunk.length;
          const progress = Math.min(100, Math.round((rowsProcessed / totalRows) * 100));
          setImportProgress(progress);
        }
      }));
    }

    const endTime = performance.now();
    const totalSeconds = (endTime - startTime) / 1000;
    const avgPerThousand = successCount > 0 ? (totalSeconds / successCount) * 1000 : 0;
    
    setImportStats({
      totalSeconds: parseFloat(totalSeconds.toFixed(2)),
      avgPerThousand: parseFloat(avgPerThousand.toFixed(2))
    });

    setIsImporting(false);
    setImportResults({ success: successCount, failed: failedCount });
    setFailedRowsList(localFailedList);
    
    if (isAborted) {
      toast.error(`Importação abortada sob erro! ${successCount} salvos, ${failedCount} abortados/falhos.`);
    } else if (failedCount === 0) {
      toast.success(`Importação concluída! ${successCount} registros adicionados.`);
    } else {
      toast.warning(`Importação concluída com avisos. ${successCount} sucessos, ${failedCount} falhas.`);
    }
  };

  const downloadErrorsCSV = () => {
    if (failedRowsList.length === 0) return;
    
    const headers = ["Linha CSV Original", "Erro de Importacao", ...activeColumns.map(c => c.name)];
    const rows = failedRowsList.map(f => {
      const dataCols = activeColumns.map(c => {
        const val = f.data[c.name];
        if (val === null || val === undefined) return "";
        return typeof val === "object" ? JSON.stringify(val) : String(val);
      });
      return [String(f.row), f.error, ...dataCols];
    });

    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `erros_importacao_${activeTable.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getMappedPreviewValue = (csvRow: string[], colName: string) => {
    const headerIdx = mappings[colName];
    if (headerIdx === undefined) return "-";
    return csvRow[headerIdx] || "";
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden p-6 gap-6">
      
      {/* ── Header Area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-destructive uppercase">Módulo Administrativo</span>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Assistente de Importação</h1>
          <p className="text-sm text-muted-foreground mt-1">Insira e sobreponha dados fiscais de tabelas base usando arquivos estruturados CSV.</p>
        </div>
        
        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide uppercase">
          {[1, 2, 3, 4].map(idx => (
            <React.Fragment key={idx}>
              <div 
                className={`w-7 h-7 flex items-center justify-center border rounded-full transition-all duration-300 ${
                  currentStep === idx 
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm" 
                    : currentStep > idx 
                      ? "border-emerald-500 text-emerald-500 bg-emerald-50/10"
                      : "border-input text-muted-foreground"
                }`}
              >
                {idx}
              </div>
              {idx < 4 && <div className={`w-6 h-[1px] ${currentStep > idx ? "bg-emerald-500" : "bg-border"}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        
        {/* ── STEP 1: UPLOAD & SETUP ───────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-2 max-w-7xl mx-auto w-full">
            
            {/* Options Panel (Left) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              <Card>
                <CardContent className="pt-6 flex flex-col gap-4">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Tabela de Importação</Label>
                    <Select 
                      value={selectedTableId}
                      onValueChange={setSelectedTableId}
                    >
                      <SelectTrigger className="w-full h-11 uppercase font-semibold">
                        <SelectValue placeholder="Selecione a Tabela" />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_DEFINITIONS.map(def => (
                          <SelectItem key={def.id} value={def.id} className="uppercase font-semibold">{def.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{activeTable.description}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-4">Sequência de IDs</Label>

                  <div className="flex flex-col gap-4">
                    {isStringPK ? (
                      <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 p-4 rounded-md">
                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-destructive uppercase tracking-wider block">ID de Texto Obrigatório</span>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            A tabela de Unidades utiliza chaves primárias em texto (ex: KG, UN). A sobreposição é habilitada obrigatoriamente para esta tabela.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="pkOption"
                            checked={!overridePK}
                            onChange={() => setOverridePK(false)}
                            className="mt-1 accent-primary" 
                          />
                          <div>
                            <span className="text-xs font-semibold tracking-wide block text-foreground group-hover:text-primary transition-colors">
                              Manter sequencial do sistema
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                              O banco de dados gerará códigos incrementais numéricos automaticamente para cada linha.
                            </p>
                          </div>
                        </label>

                        <div className="h-[1px] bg-border my-1" />

                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="pkOption"
                            checked={overridePK}
                            onChange={() => setOverridePK(true)}
                            className="mt-1 accent-primary" 
                          />
                          <div>
                            <span className="text-xs font-semibold tracking-wide block text-foreground group-hover:text-primary transition-colors">
                              Sobrepor IDs originais do arquivo
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                              Força o banco a usar as chaves primárias presentes no arquivo de origem. Útil para manter vínculos existentes.
                            </p>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Delimitador de Colunas</Label>
                  <Select 
                    value={delimiter}
                    onValueChange={setDelimiter}
                  >
                    <SelectTrigger className="w-full h-11 font-semibold uppercase">
                      <SelectValue placeholder="Selecione o delimitador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" className="font-semibold uppercase text-xs">Auto-detectar (Padrão)</SelectItem>
                      <SelectItem value=";" className="font-semibold uppercase text-xs">Ponto e vírgula (;)</SelectItem>
                      <SelectItem value="," className="font-semibold uppercase text-xs">Vírgula (,)</SelectItem>
                      <SelectItem value="\t" className="font-semibold uppercase text-xs">Tabulação (Tab)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    Altere se as colunas do arquivo parecerem unificadas ou mescladas no próximo passo. O assistente re-processa o arquivo instantaneamente.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">Estratégia sob Erro</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div 
                      onClick={() => setAbortOnError(true)}
                      className={`p-3 border rounded-md cursor-pointer transition-all flex items-start gap-3 hover:border-primary/50 ${abortOnError ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${abortOnError ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {abortOnError && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-semibold block text-foreground">Abortar sob Erro</span>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Para a importação no primeiro erro, evitando o envio de lotes subsequentes.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setAbortOnError(false)}
                      className={`p-3 border rounded-md cursor-pointer transition-all flex items-start gap-3 hover:border-primary/50 ${!abortOnError ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${!abortOnError ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {!abortOnError && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-semibold block text-foreground">Prosseguir com Erro</span>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Registra a falha no log e continua inserindo as demais linhas.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">Prevenção de Duplicidade</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div 
                      onClick={() => setAvoidDuplicates(false)}
                      className={`p-3 border rounded-md cursor-pointer transition-all flex items-start gap-3 hover:border-primary/50 ${!avoidDuplicates ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${!avoidDuplicates ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {!avoidDuplicates && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-semibold block text-foreground">Inserir (Insert)</span>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Tenta inserir todos os registros como novos, podendo dar erro de chave única.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setAvoidDuplicates(true)}
                      className={`p-3 border rounded-md cursor-pointer transition-all flex items-start gap-3 hover:border-primary/50 ${avoidDuplicates ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${avoidDuplicates ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {avoidDuplicates && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-semibold block text-foreground">Mesclar (Upsert)</span>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Atualiza registros existentes que coincidam em chaves primárias ou índices.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Drop Zone Area (Right) */}
            <div className="lg:col-span-7 flex">
              <div 
                onClick={triggerFileSelect}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) loadCSVFile(file);
                }}
                className="w-full border-2 border-dashed border-border hover:border-primary hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center p-12 text-center transition-all duration-300 group min-h-[300px] rounded-lg relative"
              >
                <div className="w-16 h-16 bg-card border border-border group-hover:border-primary flex items-center justify-center text-muted-foreground group-hover:text-primary mb-4 transition-all duration-300 rounded-md">
                  <FileUp className="w-8 h-8 transition-transform group-hover:-translate-y-1" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  Carregar arquivo de importação
                </span>
                <span className="text-xs text-muted-foreground block mt-1">
                  Arraste seu arquivo .csv aqui ou clique para buscar
                </span>

                <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-semibold text-muted-foreground border-t border-border pt-3">
                  <span>Delimitador: Vírgula (,) ou Ponto e Vírgula (;)</span>
                  <span>UTF-8 Requerido</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: FIELD MAPPING GRID ───────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="max-w-6xl mx-auto w-full py-2 flex flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">
                  Associação de Colunas (CSV ➜ Banco de Dados)
                </span>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 w-1/3">Coluna no Banco</th>
                        <th className="py-3 px-4 w-1/2">Coluna Correspondente no CSV</th>
                        <th className="py-3 px-4 text-right">Obrigatoriedade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeColumns.map(col => {
                        const isMapped = mappings[col.name] !== undefined;
                        return (
                          <tr key={col.name} className="hover:bg-muted/30 transition-colors">
                            <td className="py-4 px-4">
                              <div className="font-semibold text-sm text-foreground">{col.label}</div>
                              <code className="text-[10px] text-muted-foreground font-mono mt-0.5 block">{col.name} ({col.type})</code>
                              <p className="text-xs text-muted-foreground mt-1 font-normal">{col.description}</p>
                            </td>
                            <td className="py-4 px-4">
                              <select 
                                value={mappings[col.name] !== undefined ? mappings[col.name] : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMappings(prev => {
                                    const updated = { ...prev };
                                    if (val === "") {
                                      delete updated[col.name];
                                    } else {
                                      updated[col.name] = parseInt(val);
                                    }
                                    return updated;
                                  });
                                }}
                                className={`w-full max-w-md h-10 px-3 bg-background text-xs font-medium border rounded-md transition-colors ${
                                  isMapped 
                                    ? "border-emerald-500/50 text-emerald-600 focus:border-emerald-500" 
                                    : col.required 
                                      ? "border-destructive/40 focus:border-destructive text-destructive" 
                                      : "border-input focus:border-primary text-foreground"
                                } outline-none`}
                              >
                                <option value="">-- Ignorar ou Não Mapeado --</option>
                                {csvHeaders.map((header, idx) => (
                                  <option key={idx} value={idx}>{header} (Exemplo: "{parsedRows[0]?.[idx] || ""}")</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {col.required ? (
                                <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[9px] tracking-wide font-bold uppercase rounded">
                                  Obrigatório
                                </span>
                              ) : (
                                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px]">
                                  Opcional
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 3: PREVIEW & CONSTRAINT CHECK ───────────────────────────── */}
        {currentStep === 3 && (
          <div className="max-w-7xl mx-auto w-full py-2 flex flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">
                  Pré-visualização da Carga (Primeiros 5 Registros)
                </span>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Linha</th>
                        {activeColumns.map(col => (
                          <th key={col.name} className="py-3 px-4">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.slice(0, 5).map((row, rowIdx) => {
                        const rowErrors = activeColumns.filter(c => c.required && !getMappedPreviewValue(row, c.name));
                        const hasError = rowErrors.length > 0;

                        return (
                          <tr 
                            key={rowIdx} 
                            className={`hover:bg-muted/30 transition-colors ${
                              hasError ? "bg-destructive/5 text-destructive" : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-bold font-mono">#{rowIdx + 2}</td>
                            {activeColumns.map(col => {
                              const val = getMappedPreviewValue(row, col.name);
                              return (
                                <td key={col.name} className="py-3 px-4 font-mono font-medium max-w-[200px] truncate">
                                  {val === "" ? (
                                    col.required ? (
                                      <span className="text-destructive font-bold uppercase text-[9px]">⚠️ FALTANDO</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between border-t border-border mt-6 pt-4 gap-4">
                  <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                    <span>Total de Registros no Arquivo: <strong className="text-foreground">{parsedRows.length}</strong></span>
                    <div className="w-[1px] h-4 bg-border" />
                    <span>Campos Mapeados: <strong className="text-foreground">{Object.keys(mappings).length} de {activeColumns.length}</strong></span>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-2 rounded-md">
                      <div className="w-2 h-2 bg-emerald-500 animate-pulse rounded-full" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Estrutura Pronta</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STEP 4: IMPORT EXECUTION & RESULTS ───────────────────────────── */}
        {currentStep === 4 && (
          <div className="max-w-xl mx-auto w-full py-6 flex flex-col gap-6">
            
            <Card>
              <CardContent className="pt-8 text-center flex flex-col items-center justify-center gap-6">
                
                {isImporting ? (
                  <>
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <Loader2 className="w-16 h-16 text-primary animate-spin absolute" />
                      <span className="text-lg font-bold font-mono">{importProgress}%</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Processando Carga...</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inserindo registros na tabela de destino '{activeTable.name}' em lotes paralelos de 250. Não feche esta aba.
                      </p>
                    </div>
                  </>
                ) : importResults ? (
                  <>
                    <div className="w-16 h-16 bg-accent border border-border flex items-center justify-center rounded-full mb-1">
                      {importResults.failed === 0 ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-base font-bold uppercase tracking-wider text-foreground">Importação Concluída</h3>
                      <p className="text-xs text-muted-foreground mt-1">Carga finalizada para a tabela de destino '{activeTable.name}'.</p>
                    </div>

                    <div className="grid grid-cols-2 w-full gap-4 max-w-sm mt-2">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-md">
                        <span className="text-3xl font-bold font-mono tracking-tight text-emerald-600 leading-none">
                          {importResults.success}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider block mt-2">Sucessos</span>
                      </div>

                      <div className={`p-4 rounded-md ${importResults.failed > 0 ? "bg-destructive/5 border border-destructive/20" : "bg-accent border border-border opacity-40"}`}>
                        <span className={`text-3xl font-bold font-mono tracking-tight leading-none ${importResults.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {importResults.failed}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider block mt-2 ${importResults.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>Falhas</span>
                      </div>
                    </div>

                    {importStats && (
                      <div className="grid grid-cols-2 w-full gap-4 max-w-sm mt-4 border-t border-border pt-4 text-center">
                        <div className="bg-card border border-border p-3 rounded-md">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Tempo Total</span>
                          <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                            {importStats.totalSeconds}s
                          </span>
                        </div>
                        <div className="bg-card border border-border p-3 rounded-md">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Média / 1.000 Regs</span>
                          <span className="text-xl font-bold font-mono text-primary mt-1 block">
                            {importStats.avgPerThousand}s
                          </span>
                        </div>
                      </div>
                    )}

                    {importResults.failed > 0 && (
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowFailedModal(true)}
                          className="flex-1 text-xs font-bold uppercase"
                        >
                          Visualizar Erros
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={downloadErrorsCSV}
                          className="flex-1 text-xs font-bold uppercase"
                        >
                          <Download className="w-4 h-4 mr-2" /> Baixar Planilha de Erros
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-accent border border-border flex items-center justify-center text-primary rounded-full">
                      <Play className="w-8 h-8 fill-current translate-x-0.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Pronto para Inserir</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto mt-2">
                        Você está prestes a carregar <strong>{parsedRows.length} registros</strong> na tabela <strong>'{activeTable.name}'</strong>. 
                      </p>
                    </div>
                    <Button
                      onClick={executeImport}
                      className="w-full max-w-sm h-11 text-xs font-bold uppercase tracking-wider"
                    >
                      Confirmar e Iniciar Carga
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Footer Navigation Buttons ──────────────────────────────────────── */}
      <div className="flex justify-between border-t border-border pt-6 gap-4">
        {currentStep > 1 && !isImporting ? (
          <Button 
            variant="outline"
            onClick={handlePrevStep}
            className="text-xs font-semibold uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        ) : <div />}

        {currentStep < 4 && (
          <Button 
            onClick={handleNextStep}
            className="text-xs font-bold uppercase tracking-wider"
          >
            Avançar <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        
        {currentStep === 4 && importResults && (
          <Button
            onClick={() => {
              setCurrentStep(1);
              setFileName("");
              setCsvContent("");
              setParsedRows([]);
              setCsvHeaders([]);
              setMappings({});
              setImportResults(null);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase"
          >
            Nova Importação <RefreshCw className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* ── Dynamic Error Detail Dialog Modal ───────────────────────────────── */}
      <Dialog open={showFailedModal} onOpenChange={setShowFailedModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold uppercase text-destructive">
              Erros de Importação Isolados
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto mt-4 border border-border rounded-md">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="bg-muted border-b border-border text-muted-foreground font-bold">
                  <th className="py-2 px-3 w-20">Linha CSV</th>
                  <th className="py-2 px-3">Valores Inseridos</th>
                  <th className="py-2 px-3">Mensagem de Falha do Banco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {failedRowsList.map((err, idx) => (
                  <tr key={idx} className="hover:bg-destructive/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-destructive">#{err.row}</td>
                    <td className="py-2.5 px-3 max-w-[250px] truncate text-muted-foreground">
                      {JSON.stringify(err.data)}
                    </td>
                    <td className="py-2.5 px-3 text-destructive font-semibold">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowFailedModal(false)}
              className="text-xs font-semibold uppercase"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportacaoForm;

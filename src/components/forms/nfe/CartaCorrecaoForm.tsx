import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { 
  Search, 
  Send, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  X, 
  AlertTriangle,
  Copy,
  Info,
  Check,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Building2,
  Calendar,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import NfeSearchDialog, { buscarNfePorNumero, INfeRow } from "./NfeSearchDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";

const db = supabase as any;

export interface INfeFullInfo {
  nr: string | number;
  serie: string | number;
  chave_nfe?: string;
  dt_emissao?: string;
  vl_total_nf?: number;
  modelo?: string;
  razao_social?: string;
  cnpj?: string;
}

interface ICartaCorrecaoContentProps {
  record: any;
  setField: (k: string, v: any) => void;
  isEditing: boolean;
  handleIncluir?: () => void;
  XEmpresaId: number;
  XLoading: boolean;
  XNfeInfo: Record<number, INfeFullInfo>;
  setXNfeInfo: React.Dispatch<React.SetStateAction<Record<number, INfeFullInfo>>>;
  ensureNfeInfo: (ids: number[]) => Promise<void>;
  handleImprimir: (r: any) => void;
  handleTransmitir: (r: any) => void;
}

const CartaCorrecaoContent: React.FC<ICartaCorrecaoContentProps> = ({
  record,
  setField,
  isEditing,
  handleIncluir,
  XEmpresaId,
  XLoading,
  XNfeInfo,
  setXNfeInfo,
  ensureNfeInfo,
  handleImprimir,
  handleTransmitir
}) => {
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XOpenNfeSearch, setXOpenNfeSearch] = useState(false);
  const [XCopiado, setXCopiado] = useState(false);
  const nfeSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (record?.nfe_cabecalho_id) {
      ensureNfeInfo([record.nfe_cabecalho_id]);
    }
  }, [record?.nfe_cabecalho_id, ensureNfeInfo]);

  const handleBuscarNfe = async () => {
    const t = XSearchTerm.trim();
    if (!t) { setXOpenNfeSearch(true); return; }
    const nfe = await buscarNfePorNumero(t, XEmpresaId);
    if (nfe) {
      setXNfeInfo(prev => ({
        ...prev,
        [nfe.nfe_cabecalho_id]: {
          nr: nfe.nr_nota,
          serie: nfe.serie,
          chave_nfe: nfe.chave_nfe,
          dt_emissao: nfe.dt_emissao,
          vl_total_nf: nfe.vl_total_nf,
          modelo: nfe.modelo,
          razao_social: nfe.razao_social,
        }
      }));
      if (!isEditing && handleIncluir) {
        handleIncluir();
      }
      setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
      setXSearchTerm("");
    } else {
      toast.info("Nota emitida e autorizada não localizada por este número/chave. Abrindo pesquisa avançada...");
      setXOpenNfeSearch(true);
    }
  };

  const onSelectNfe = (nfe: INfeRow) => {
    setXNfeInfo(prev => ({
      ...prev,
      [nfe.nfe_cabecalho_id]: {
        nr: nfe.nr_nota,
        serie: nfe.serie,
        chave_nfe: nfe.chave_nfe,
        dt_emissao: nfe.dt_emissao,
        vl_total_nf: nfe.vl_total_nf,
        modelo: nfe.modelo,
        razao_social: nfe.razao_social,
      }
    }));
    if (!isEditing && handleIncluir) {
      handleIncluir();
    }
    setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
    setXSearchTerm("");
  };

  const info = record?.nfe_cabecalho_id ? XNfeInfo[record.nfe_cabecalho_id] : null;
  const fmtMoney = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const copiarChave = (chave?: string) => {
    if (!chave) return;
    navigator.clipboard.writeText(chave);
    setXCopiado(true);
    toast.success("Chave de acesso copiada para a área de transferência!");
    setTimeout(() => setXCopiado(false), 2000);
  };

  const xCorrecao = record.x_correcao || "";
  const charCount = xCorrecao.length;
  const isTextoValido = charCount >= 15 && charCount <= 1000;

  return (
    <div className="space-y-4 max-w-6xl mx-auto py-1">
      {/* CARD 1: NOTA FISCAL DE ORIGEM */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden transition-all">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Documento Fiscal Eletrônico de Origem
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Selecione a NF-e ou NFC-e autorizada que receberá a retificação
              </p>
            </div>
          </div>

          {record.nfe_cabecalho_id && isEditing && (
            <button
              type="button"
              onClick={() => { setField("nfe_cabecalho_id", null); setXSearchTerm(""); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Trocar nota fiscal vinculada"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Trocar Nota
            </button>
          )}
        </div>

        <div className="p-4">
          {record.nfe_cabecalho_id ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Documento */}
              <div className="md:col-span-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Documento Fiscal
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-foreground">
                    {info?.modelo === "65" ? "NFC-e" : "NF-e"} nº{" "}
                    <span className="text-lg font-black text-primary">
                      {info?.nr ?? record.nfe_cabecalho_id}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px] font-medium text-foreground bg-secondary/80">
                      Série {info?.serie ?? "1"}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground bg-muted/30">
                      Modelo {info?.modelo || "55"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Destinatário */}
              <div className="md:col-span-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Destinatário / Cliente
                </span>
                <p className="text-sm font-semibold text-foreground truncate" title={info?.razao_social || "Não identificado"}>
                  {info?.razao_social || "Carregando destinatário..."}
                </p>
              </div>

              {/* Emissão */}
              <div className="md:col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Data de Emissão
                </span>
                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {info?.dt_emissao ? new Date(info.dt_emissao).toLocaleDateString("pt-BR") : "-"}
                </div>
              </div>

              {/* Valor Total */}
              <div className="md:col-span-3 text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Valor Total da Nota
                </span>
                <span className="text-base font-extrabold text-foreground">
                  {fmtMoney(info?.vl_total_nf)}
                </span>
              </div>

              {/* Chave de Acesso */}
              {info?.chave_nfe && (
                <div className="md:col-span-12 pt-3 mt-1 border-t border-border/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Chave de Acesso:
                    </span>
                    <span className="font-mono text-xs text-foreground tracking-wider select-all truncate">
                      {info.chave_nfe}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copiarChave(info.chave_nfe)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md border border-border shadow-2xs transition-colors shrink-0"
                  >
                    {XCopiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    {XCopiado ? "Copiado!" : "Copiar Chave"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={nfeSearchRef}
                    readOnly={!isEditing}
                    value={XSearchTerm}
                    onChange={e => setXSearchTerm(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBuscarNfe(); }}
                    className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-all"
                    placeholder={isEditing ? "Digite o número da nota fiscal ou bipe a chave de acesso (Enter)..." : "Pesquisar nota fiscal..."}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setXOpenNfeSearch(true)}
                  className="h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors shadow-2xs"
                >
                  <Search className="w-4 h-4 text-primary" />
                  Pesquisar Documentos
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                * Você pode digitar apenas o número da nota (ex: <strong>51</strong>) ou a chave completa de 44 dígitos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2: CONFIGURAÇÃO DO EVENTO E STATUS */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Parâmetros do Evento Fiscal
          </h3>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Sequencial */}
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Sequencial do Evento (Seq.)
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                min={1}
                max={20}
                readOnly={!isEditing}
                value={record.nr_sequencial ?? 1}
                onChange={e => setField("nr_sequencial", parseInt(e.target.value) || 1)}
                className="w-full h-9 pl-9 pr-3 text-sm font-semibold bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Inicia em 1. Caso a mesma nota já tenha outra CC-e autorizada, incremente (2, 3, etc.).
            </p>
          </div>

          {/* Status do Evento */}
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Situação na SEFAZ
            </label>
            <div className="h-9 px-3 flex items-center justify-between rounded-md border border-border bg-muted/30">
              <div className="flex items-center gap-2">
                {record.st_evento === "E" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : record.st_evento === "F" ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-xs font-bold uppercase tracking-wide">
                  {record.st_evento === "E" ? "Autorizada (Homologada)" : (record.st_evento === "F" ? "Rejeitada / Falha" : "Pendente de Envio")}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-border bg-background">
                {record.st_evento === "E" ? "cStat 135" : (record.c_stat || "A")}
              </Badge>
            </div>
          </div>

          {/* Protocolo */}
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Protocolo de Homologação
            </label>
            <input
              type="text"
              readOnly
              value={record.nr_protocolo || "Aguardando transmissão..."}
              className="w-full h-9 px-3 text-xs font-mono bg-muted/30 text-muted-foreground border border-border rounded-md select-all"
            />
          </div>
        </div>
      </div>

      {/* CARD 3: TEXTO DA CARTA DE CORREÇÃO */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Texto da Correção (xCorrecao)
            </h3>
            <span className="text-xs text-muted-foreground">
              — Descrição formal das alterações
            </span>
          </div>
          <span className={`text-xs font-mono font-bold ${charCount < 15 ? "text-rose-500" : charCount > 1000 ? "text-rose-500" : "text-emerald-600"}`}>
            {charCount} / 1000 caracteres {charCount < 15 ? "(Mínimo 15)" : ""}
          </span>
        </div>

        <div className="p-4 space-y-4">
          <textarea
            readOnly={!isEditing}
            value={record.x_correcao ?? ""}
            onChange={e => setField("x_correcao", e.target.value)}
            rows={5}
            maxLength={1000}
            className="w-full p-3.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs leading-relaxed resize-y transition-all font-sans"
            placeholder="Descreva as correções de forma objetiva e inequívoca. Exemplo: Retificação da Natureza da Operação para 'DEVOLUÇÃO DE MERCADORIA ADQUIRIDA DE TERCEIROS' e inclusão da observação referente ao frete CIF..."
          />

          {/* Guia / Recomendações da Legislação Fiscal */}
          <div className="p-3.5 bg-muted/40 border border-border/80 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Orientações Fiscais da Legislação (Ajuste SINIEF 01/07 e Art. 58-B Convênio S/N 1970)</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs text-muted-foreground">
              <div className="flex items-start gap-2 bg-background/60 p-2.5 rounded-md border border-border/40">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground font-semibold">O que PODE ser corrigido:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>CFOP (desde que não altere natureza dos impostos);</li>
                    <li>Endereço, Razão Social (sem alterar a pessoa física/jurídica);</li>
                    <li>Dados adicionais, transportadora, peso e volumes.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-background/60 p-2.5 rounded-md border border-border/40">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground font-semibold">O que NÃO PODE ser corrigido:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Valores que determinem o cálculo de impostos;</li>
                    <li>Mudança completa de emitente ou destinatário;</li>
                    <li>Data de emissão ou data de saída da mercadoria.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* BARRA DE AÇÕES DO EVENTO (TRANSMISSÃO E IMPRESSÃO) */}
      {!isEditing && record.nfe_cce_id && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl shadow-xs">
          <div className="text-xs text-muted-foreground">
            {record.st_evento === "E" ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Evento fiscal transmitido e homologado pela SEFAZ.
              </span>
            ) : (
              <span>Documento gravado no sistema. Clique em transmitir para enviar à SEFAZ.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {record.st_evento === "E" && (
              <button
                type="button"
                onClick={() => handleImprimir(record)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-2xs transition-all active:scale-95"
              >
                <Printer className="w-4 h-4 text-foreground" />
                Imprimir CC-e
              </button>
            )}

            <button
              type="button"
              onClick={() => handleTransmitir(record)}
              disabled={XLoading || record.st_evento === "E" || !isTextoValido}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-xs transition-all active:scale-95"
            >
              {XLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {XLoading ? "Transmitindo à SEFAZ..." : "Transmitir CC-e à SEFAZ"}
            </button>
          </div>
        </div>
      )}

      {/* DIALOG DE PESQUISA AVANÇADA DE NOTAS */}
      <NfeSearchDialog
        open={XOpenNfeSearch}
        onClose={() => setXOpenNfeSearch(false)}
        onSelect={onSelectNfe}
      />
    </div>
  );
};

const CartaCorrecaoForm: React.FC<{ initialNfeId?: number }> = ({ initialNfeId }) => {
  const { XEmpresaId } = useAppContext();
  const [XNfeInfo, setXNfeInfo] = useState<Record<number, INfeFullInfo>>({});
  const [XLoading, setXLoading] = useState(false);
  const [XProg, setXProg] = useState({ open: false, titulo: "Transmitindo Carta de Correção...", total: 60, restante: 60 });
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const XGridCols: IGridColumn[] = [
    { key: "nfe_cce_id", label: "Cód.", width: "80px", align: "right" },
    { 
      key: "nr_nota", 
      label: "Documento Fiscal", 
      width: "140px", 
      align: "center",
      getValue: r => String(r.fiscal_nfe_cabecalho?.nr_nota ?? XNfeInfo[r.nfe_cabecalho_id]?.nr ?? r.nfe_cabecalho_id ?? ""),
      render: r => {
        const nr = r.fiscal_nfe_cabecalho?.nr_nota ?? XNfeInfo[r.nfe_cabecalho_id]?.nr ?? r.nfe_cabecalho_id;
        return nr ? <span className="font-bold text-foreground">{nr}</span> : "-";
      }
    },
    { 
      key: "serie", 
      label: "Série", 
      width: "80px", 
      align: "center",
      getValue: r => String(r.fiscal_nfe_cabecalho?.serie ?? XNfeInfo[r.nfe_cabecalho_id]?.serie ?? "1"),
      render: r => {
        const serie = r.fiscal_nfe_cabecalho?.serie ?? XNfeInfo[r.nfe_cabecalho_id]?.serie ?? "1";
        return <span className="font-mono text-xs">{serie}</span>;
      }
    },
    { key: "nr_sequencial", label: "Seq.", width: "65px", align: "center" },
    { key: "x_correcao", label: "Descrição da Correção", width: "2fr" },
    { 
      key: "st_evento", 
      label: "Situação", 
      width: "140px",
      render: r => {
        const isAuth = r.st_evento === "E";
        const isFail = r.st_evento === "F";
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isAuth 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
              : isFail 
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          }`}>
            {isAuth ? <CheckCircle2 size={12} /> : isFail ? <AlertCircle size={12} /> : <Clock size={12} />}
            {isAuth ? "Autorizada" : isFail ? "Rejeitada" : "Pendente"}
          </span>
        );
      }
    },
    { 
      key: "nr_protocolo", 
      label: "Protocolo", 
      width: "160px",
      render: r => r.nr_protocolo ? <span className="font-mono text-xs">{r.nr_protocolo}</span> : "-"
    }
  ];

  const ensureNfeInfo = useCallback(async (ids: number[]) => {
    const missing = ids.filter(id => id && !XNfeInfo[id]);
    if (missing.length === 0) return;
    const { data } = await db
      .from("fiscal_nfe_cabecalho")
      .select("nfe_cabecalho_id, nr_nota, serie, chave_nfe, dt_emissao, vl_total_nf, modelo, cadastro_id, cadastro:cadastro_id(razao_social)")
      .in("nfe_cabecalho_id", missing);

    if (data) {
      setXNfeInfo(prev => {
        const next = { ...prev };
        data.forEach((d: any) => {
          next[d.nfe_cabecalho_id] = {
            nr: d.nr_nota,
            serie: d.serie,
            chave_nfe: d.chave_nfe,
            dt_emissao: d.dt_emissao,
            vl_total_nf: d.vl_total_nf,
            modelo: d.modelo,
            razao_social: d.cadastro?.razao_social,
          };
        });
        return next;
      });
    }
  }, [XNfeInfo]);

  const handleTransmitir = async (row: any) => {
    if (!row.nfe_cce_id || !row.nfe_cabecalho_id) {
      toast.error("Salve a Carta de Correção antes de transmitir à SEFAZ.");
      return;
    }
    if (!row.x_correcao || row.x_correcao.length < 15) {
      toast.error("O texto da correção deve conter no mínimo 15 caracteres.");
      return;
    }

    setXLoading(true);
    setXProg({ open: true, titulo: "Transmitindo Carta de Correção...", total: 45, restante: 45 });
    const timer = setInterval(() => {
      setXProg(p => ({ ...p, restante: Math.max(0, p.restante - 1) }));
    }, 1000);

    try {
      const event = {
        empresa_id: XEmpresaId,
        tipo: "NFE",
        comando: "CCE",
        nfe_cabecalho_id: row.nfe_cabecalho_id,
        payload: {
          nfe_cce_id: row.nfe_cce_id,
          x_correcao: row.x_correcao.trim(),
          nr_sequencial: row.nr_sequencial || 1
        },
        status: "PENDENTE"
      };
      
      const { data: insertedEv, error } = await db.from("fiscal_evento").insert(event).select("id").single();
      if (error) throw error;

      let finalEv: any = null;
      for (let i = 0; i < 75; i++) {
        await new Promise(r => setTimeout(r, 600));
        const { data: checkEv } = await db.from("fiscal_evento").select("status, resposta, mensagem_erro").eq("id", insertedEv.id).maybeSingle();
        if (checkEv && checkEv.status !== "PENDENTE") {
          finalEv = checkEv;
          break;
        }
      }

      if (XRefreshRef.current) await XRefreshRef.current();

      clearInterval(timer);
      setXProg(p => ({ ...p, open: false }));

      if (finalEv) {
        let resp: any = null;
        try {
          resp = typeof finalEv.resposta === "string" ? JSON.parse(finalEv.resposta) : finalEv.resposta;
        } catch {}

        let cStat = resp?.c_stat || resp?.cStat || resp?.c_stat_evento;
        let xMotivo = resp?.x_motivo || resp?.xMotivo;

        // Tenta extrair dados específicos do Evento001 caso venha aninhado
        if (!cStat || String(cStat) === "128" || !xMotivo) {
          const rawText = typeof finalEv.resposta === "string" ? finalEv.resposta : JSON.stringify(finalEv.resposta || "");
          try {
            const p = JSON.parse(rawText);
            const ev = p?.Evento?.Evento001 || p?.Evento;
            if (ev) {
              cStat = ev.CStat || ev.cStat || cStat;
              xMotivo = ev.XMotivo || ev.xMotivo || xMotivo;
            }
          } catch {}
        }

        if (!xMotivo) {
          xMotivo = typeof finalEv.mensagem_erro === "string" ? finalEv.mensagem_erro : "Falha na comunicação com a SEFAZ.";
        }

        const eSucesso = resp?.sucesso === true || ["135", "136"].includes(String(cStat));

        if (eSucesso) {
          toast.success(xMotivo || "Carta de Correção autorizada com sucesso pela SEFAZ!");
        } else {
          toast.error(`Rejeição SEFAZ: ${xMotivo}`, {
            duration: 9000
          });

          await db.from("fiscal_nfe_cce").update({ 
            st_evento: "F", 
            x_motivo: xMotivo || "Rejeição SEFAZ", 
            c_stat: cStat ? parseInt(String(cStat)) : null 
          }).eq("nfe_cce_id", row.nfe_cce_id);
          
          if (XRefreshRef.current) await XRefreshRef.current();
        }
      } else {
        toast.info("Solicitação enviada ao Worker Fiscal. O status será atualizado assim que concluído.");
      }
    } catch (e: any) {
      clearInterval(timer);
      setXProg(p => ({ ...p, open: false }));
      toast.error("Erro: " + e.message, { duration: 8000 });
    } finally {
      setXLoading(false);
    }
  };

  const handleImprimir = (row: any) => {
    toast.info("Geração do DANFE da CC-e " + row.nfe_cce_id + " em andamento...");
  };

  return (
    <>
      <StandardCrudForm
        config={{
          XTableName: "fiscal_nfe_cce",
          XPrimaryKey: "nfe_cce_id",
          XTitle: "Cartas de Correção Eletrônica (CC-e)",
          XEmpresaId,
          XSoftDelete: false,
          XSelectCols: "*, fiscal_nfe_cabecalho(nr_nota, serie, modelo)",
          XCanEdit: (rec: any) => rec.st_evento !== "E",
          XDefaultRecord: { 
            empresa_id: XEmpresaId, 
            st_evento: "A", 
            nr_sequencial: 1,
            nfe_cabecalho_id: initialNfeId || null
          },
          XOnAfterLoad: (rows) => {
            const ids = [...new Set(rows.map(r => r.nfe_cabecalho_id).filter(Boolean))] as number[];
            if (ids.length > 0) ensureNfeInfo(ids);
          },
          XOnBeforeSave: (rec) => {
            if (!rec.nfe_cabecalho_id) throw new Error("Vincule uma Nota Fiscal autorizada.");
            if (!rec.x_correcao || rec.x_correcao.trim().length < 15) {
              throw new Error("O texto da correção deve conter no mínimo 15 caracteres.");
            }
            return {
              ...rec,
              x_correcao: rec.x_correcao.trim()
            };
          }
        }}
        XGridCols={XGridCols}
        XRefreshRef={XRefreshRef}
        renderCadastro={({ record, setField, isEditing, handleIncluir }) => (
          <CartaCorrecaoContent 
            record={record}
            setField={setField}
            isEditing={isEditing}
            handleIncluir={handleIncluir}
            XEmpresaId={XEmpresaId}
            XLoading={XLoading}
            XNfeInfo={XNfeInfo}
            setXNfeInfo={setXNfeInfo}
            ensureNfeInfo={ensureNfeInfo}
            handleImprimir={handleImprimir}
            handleTransmitir={handleTransmitir}
          />
        )}
      />

      <FiscalProgressDialog
        open={XProg.open}
        titulo={XProg.titulo}
        descricao="Aguardando assinatura digital, transmissão e autorização da SEFAZ via Fiscal Worker."
        segundosTotais={XProg.total}
        segundosRestantes={XProg.restante}
      />
    </>
  );
};

export default CartaCorrecaoForm;

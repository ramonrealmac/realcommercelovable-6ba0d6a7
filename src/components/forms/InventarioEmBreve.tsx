import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Calendar, 
  ArrowRight,
  TrendingUp
} from "lucide-react";

export default function InventarioEmBreve() {
  const { openTab } = useAppContext();

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex items-center justify-center p-6 bg-background/30 overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: "2s" }} />

      <Card className="relative max-w-2xl w-full border-border/40 bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        {/* Visual Header Banner */}
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
        
        <CardContent className="pt-10 pb-8 px-6 sm:px-10 flex flex-col items-center text-center gap-6">
          {/* Animated Module Icon */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 text-cyan-600 shadow-inner">
            <ClipboardList className="w-10 h-10 animate-bounce" style={{ animationDuration: "3s" }} />
            <div className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
          </div>

          {/* Title & Badge */}
          <div className="flex flex-col items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/15 transition-all text-xs font-semibold uppercase tracking-wider">
              Fase 2 do Módulo de Ajustes
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text">
              Inventário Geral
            </h1>
            <p className="text-sm text-cyan-600/90 font-medium">Controle e Conciliação de Saldos</p>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            O módulo de contagem de inventário físico com conciliação automática, relatórios de divergências e acertos automáticos de saldos globais está sendo projetado para a próxima etapa do desenvolvimento.
          </p>

          {/* Interactive Roadmap / Timeline */}
          <div className="w-full bg-background/40 border border-border/40 rounded-xl p-6 text-left flex flex-col gap-4 mt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-500" />
              Cronograma de Desenvolvimento
            </h3>
            
            <div className="flex flex-col gap-3 relative pl-3 border-l border-border/80">
              {/* Item 1 */}
              <div className="relative flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 bg-background rounded-full -ml-[23px] z-10" />
                <div>
                  <h4 className="text-xs font-bold text-foreground/80 leading-none">Mapeamento & Estrutura de Banco</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">Criação das triggers, colunas e auditorias de estoque log.</p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="relative flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 bg-background rounded-full -ml-[23px] z-10" />
                <div>
                  <h4 className="text-xs font-bold text-foreground/80 leading-none">Ajuste de Estoque Físico</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">Lançamento de acertos individuais por quantidade, tipo e depósito.</p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="relative flex items-start gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-cyan-500 bg-background shrink-0 -ml-[23px] z-10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-cyan-600 leading-none flex items-center gap-1.5">
                    Inventário e Conciliação em Lote
                    <Badge className="text-[9px] h-4 px-1.5 bg-cyan-500/20 text-cyan-700 border-none font-semibold">FASE ATUAL</Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">Contagem por coletores de dados, importações e fechamento de inventário periódico.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-4">
            <Button 
              onClick={() => openTab("ajuste-estoque")}
              className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 gap-2 px-6"
            >
              Ir para Ajuste de Estoque
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

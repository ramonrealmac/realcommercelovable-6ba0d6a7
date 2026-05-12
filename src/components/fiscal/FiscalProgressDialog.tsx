import React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface IProps {
  open: boolean;
  /** Título da operação em andamento. Ex: "Emitindo NFC-e..." */
  titulo: string;
  /** Descrição opcional logo abaixo do título. */
  descricao?: string;
  /** Tempo total (segundos) configurado para a operação. */
  segundosTotais: number;
  /**
   * Tempo restante (segundos). Quando informado pelo caller (via onTick do
   * `aguardarEvento`), tem prioridade. Se omitido e `selfTick=true`, o dialog
   * decrementa internamente a cada 1s.
   */
  segundosRestantes?: number;
  /** Quando true, decrementa internamente a cada 1s a partir de `segundosTotais`. */
  selfTick?: boolean;
}

/**
 * Modal não-fechável que mostra contagem regressiva enquanto o sistema
 * aguarda a resposta do Fiscal Worker em operações de NFe/NFCe (emissão,
 * cancelamento, inutilização e envio de e-mail).
 *
 * O caller é responsável por:
 *  - definir `open=true` antes de chamar o serviço;
 *  - atualizar `segundosRestantes` via `onTick` do `aguardarEvento`;
 *  - definir `open=false` quando a operação retornar (sucesso, erro ou timeout).
 *
 * O usuário NÃO pode cancelar a espera — o dialog só fecha pelo caller.
 */
const FiscalProgressDialog: React.FC<IProps> = ({
  open,
  titulo,
  descricao,
  segundosTotais,
  segundosRestantes,
  selfTick,
}) => {
  const total = Math.max(1, segundosTotais);
  const [internalRest, setInternalRest] = React.useState<number>(total);

  // Reinicia o contador interno toda vez que o dialog abre.
  React.useEffect(() => {
    if (open) setInternalRest(total);
  }, [open, total]);

  // Decremento interno (somente se selfTick e nenhum valor externo controlado).
  React.useEffect(() => {
    if (!open || !selfTick || typeof segundosRestantes === "number") return;
    const id = setInterval(() => {
      setInternalRest((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [open, selfTick, segundosRestantes]);

  const restanteRaw = typeof segundosRestantes === "number" ? segundosRestantes : internalRest;
  const restante = Math.max(0, Math.min(restanteRaw, total));
  const decorrido = total - restante;
  const pct = Math.round((decorrido / total) * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={() => { /* não permite fechar pelo usuário */ }}
    >
      <DialogContent
        className="sm:max-w-[420px] [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            {titulo}
          </DialogTitle>
          {descricao && (
            <DialogDescription>{descricao}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4 flex flex-col items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold tabular-nums text-foreground">
              {restante}s
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Liberando em até {restante} segundo{restante === 1 ? "" : "s"}
              {" "}
              <span className="opacity-60">(timeout: {total}s)</span>
            </div>
          </div>

          <Progress value={pct} className="w-full h-2" />

          <p className="text-xs text-muted-foreground text-center max-w-[320px]">
            Aguardando resposta do Fiscal Worker. Não feche esta janela
            nem o Worker durante a operação.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FiscalProgressDialog;

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { supabase } from "@/integrations/supabase/client";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";

interface FiscalEmailDialogProps {
  open: boolean;
  onClose: () => void;
  nfeCabecalhoId: number | null;
  empresaId: number;
  clienteId?: number | null;
}

const FiscalEmailDialog: React.FC<FiscalEmailDialogProps> = ({ open, onClose, nfeCabecalhoId, empresaId, clienteId }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open && clienteId) {
      const fetchClienteEmail = async () => {
        setFetching(true);
        try {
          const { data, error } = await supabase
            .from("cadastro")
            .select("email")
            .eq("cadastro_id", clienteId)
            .maybeSingle();
          
          if (data?.email) {
            setEmail(data.email);
          } else {
            setEmail("");
          }
        } catch (err) {
          console.error("Erro ao buscar e-mail do cliente:", err);
        } finally {
          setFetching(false);
        }
      };
      fetchClienteEmail();
    } else if (open) {
      setEmail("");
    }
  }, [open, clienteId]);

  const handleSend = async () => {
    if (!nfeCabecalhoId) return;
    if (!email || !email.includes("@")) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fiscalEmissaoService.enviarEmail(nfeCabecalhoId, empresaId, email);
      if (res.success) {
        toast.success("E-mail enfileirado para envio!");
        onClose();
      } else {
        toast.error("Erro ao enviar e-mail: " + res.message);
      }
    } catch (err: any) {
      toast.error("Falha na comunicação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Enviar Documento por E-mail
          </DialogTitle>
          <DialogDescription>
            O XML e o DANFE serão enviados para o endereço informado abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail do Destinatário</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="cliente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || fetching}
                className="pl-9"
                autoFocus
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              {fetching && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={loading || fetching || !email} className="flex-1">
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FiscalEmailDialog;

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users, User } from "lucide-react";
import { listarProfiles, criarSala, Profile } from "./chatInternoService";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  empresaId: number | null;
  onCriada: (salaId: number) => void;
}

const NovaConversaDialog: React.FC<Props> = ({ open, onOpenChange, userId, empresaId, onCriada }) => {
  const [XTipo, setXTipo] = useState<"D" | "G">("D");
  const [XNome, setXNome] = useState("");
  const [XBusca, setXBusca] = useState("");
  const [XProfiles, setXProfiles] = useState<Profile[]>([]);
  const [XSelecionados, setXSelecionados] = useState<string[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSaving, setXSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setXTipo("D");
    setXNome("");
    setXBusca("");
    setXSelecionados([]);
    setXLoading(true);
    listarProfiles(userId)
      .then(setXProfiles)
      .catch((e) => toast.error("Erro ao carregar usuários: " + e.message))
      .finally(() => setXLoading(false));
  }, [open, userId]);

  const filtrados = useMemo(() => {
    const q = XBusca.trim().toLowerCase();
    if (!q) return XProfiles;
    return XProfiles.filter((p) =>
      [p.nm_usuario, p.ds_login, p.email].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [XBusca, XProfiles]);

  const toggle = (id: string) => {
    if (XTipo === "D") {
      setXSelecionados([id]);
    } else {
      setXSelecionados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    }
  };

  const handleCriar = async () => {
    if (XSelecionados.length === 0) {
      toast.error("Selecione ao menos um participante");
      return;
    }
    if (XTipo === "G" && !XNome.trim()) {
      toast.error("Informe um nome para o grupo");
      return;
    }
    setXSaving(true);
    try {
      const id = await criarSala(userId, empresaId, XTipo, XTipo === "G" ? XNome.trim() : null, XSelecionados);
      onCriada(id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao criar conversa: " + (e?.message || ""));
    } finally {
      setXSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setXTipo("D"); setXSelecionados([]); }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded text-sm border ${XTipo === "D" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
          >
            <User size={14} /> Direta
          </button>
          <button
            onClick={() => { setXTipo("G"); }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded text-sm border ${XTipo === "G" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
          >
            <Users size={14} /> Grupo
          </button>
        </div>

        {XTipo === "G" && (
          <Input
            placeholder="Nome do grupo"
            value={XNome}
            onChange={(e) => setXNome(e.target.value)}
            className="mb-2"
          />
        )}

        <div className="relative mb-2">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={XBusca}
            onChange={(e) => setXBusca(e.target.value)}
            className="pl-7"
          />
        </div>

        <div className="border border-border rounded max-h-64 overflow-y-auto">
          {XLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Nenhum usuário</div>
          ) : (
            filtrados.map((p) => {
              const sel = XSelecionados.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent ${sel ? "bg-accent" : ""}`}
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {p.ds_foto ? <img src={p.ds_foto} alt="" className="w-full h-full object-cover" /> : (p.nm_usuario || p.ds_login || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{p.nm_usuario || p.ds_login || p.email}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{p.email}</div>
                  </div>
                  {XTipo === "G" && (
                    <input type="checkbox" checked={sel} onChange={() => {}} />
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={XSaving}>
            {XSaving && <Loader2 size={14} className="animate-spin mr-1" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaConversaDialog;

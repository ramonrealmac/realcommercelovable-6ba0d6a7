import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Mic, MicOff, Paperclip, Plus, Send, Square, Users, User as UserIcon, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

import {
  ChatMembro,
  ChatMensagem,
  ChatSala,
  Profile,
  contarNaoLidas,
  enviarMensagem,
  getProfilesByIds,
  listarMensagens,
  listarMinhasSalas,
  marcarComoLido,
  sairDaSala,
  uploadChatAnexo,
} from "./chatInternoService";
import NovaConversaDialog from "./NovaConversaDialog";
import ChatInternoMessage from "./ChatInternoMessage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUnreadChange?: (n: number) => void;
}

const POLL_MS = 5000;

const ChatInternoPanel: React.FC<Props> = ({ open, onOpenChange, onUnreadChange }) => {
  const { XEmpresaId } = useAppContext();
  const [XUserId, setXUserId] = useState<string>("");

  const [XSalas, setXSalas] = useState<ChatSala[]>([]);
  const [XMembrosPorSala, setXMembrosPorSala] = useState<Record<number, ChatMembro[]>>({});
  const [XLeituraPorSala, setXLeituraPorSala] = useState<Record<number, string>>({});
  const [XNaoLidasPorSala, setXNaoLidasPorSala] = useState<Record<number, number>>({});
  const [XProfilesMap, setXProfilesMap] = useState<Record<string, Profile>>({});

  const [XSalaAtivaId, setXSalaAtivaId] = useState<number | null>(null);
  const [XMensagens, setXMensagens] = useState<ChatMensagem[]>([]);

  const [XInput, setXInput] = useState("");
  const [XSending, setXSending] = useState(false);
  const [XRecording, setXRecording] = useState(false);
  const [XNovoOpen, setXNovoOpen] = useState(false);

  const XScrollRef = useRef<HTMLDivElement>(null);
  const XFileInputRef = useRef<HTMLInputElement>(null);
  const XMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const XAudioChunksRef = useRef<Blob[]>([]);
  const XPollRef = useRef<number | null>(null);

  const { isListening, isSupported: micSupported, toggle: toggleMic } = useSpeechRecognition({
    onResult: (t) => setXInput((p) => (p ? p + " " + t : t)),
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setXUserId(session.user.id);
    });
  }, []);

  const carregarSalas = async (uid: string) => {
    const { salas, membrosPorSala, ultimaLeituraPorSala } = await listarMinhasSalas(uid);
    setXSalas(salas);
    setXMembrosPorSala(membrosPorSala);
    setXLeituraPorSala(ultimaLeituraPorSala);
    // Carrega profiles dos membros
    const ids = new Set<string>();
    Object.values(membrosPorSala).forEach((arr) => arr.forEach((m) => ids.add(m.user_id)));
    if (ids.size) {
      const map = await getProfilesByIds(Array.from(ids));
      setXProfilesMap((p) => ({ ...p, ...map }));
    }
    // Conta não lidas
    const counts: Record<number, number> = {};
    await Promise.all(
      salas.map(async (s) => {
        counts[s.chat_sala_id] = await contarNaoLidas(s.chat_sala_id, uid, ultimaLeituraPorSala[s.chat_sala_id]);
      }),
    );
    setXNaoLidasPorSala(counts);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    onUnreadChange?.(total);
  };

  const carregarMensagens = async (salaId: number) => {
    const msgs = await listarMensagens(salaId);
    setXMensagens(msgs);
    if (XUserId) await marcarComoLido(salaId, XUserId);
  };

  // Poll loop
  useEffect(() => {
    if (!XUserId) return;
    const tick = async () => {
      try {
        await carregarSalas(XUserId);
        if (XSalaAtivaId) {
          const msgs = await listarMensagens(XSalaAtivaId);
          setXMensagens(msgs);
          if (open) await marcarComoLido(XSalaAtivaId, XUserId);
        }
      } catch (e) {
        // silencioso
      }
    };
    tick();
    XPollRef.current = window.setInterval(tick, POLL_MS);
    return () => { if (XPollRef.current) window.clearInterval(XPollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [XUserId, XSalaAtivaId, open]);

  useEffect(() => {
    XScrollRef.current?.scrollTo({ top: XScrollRef.current.scrollHeight });
  }, [XMensagens]);

  const abrirSala = async (salaId: number) => {
    setXSalaAtivaId(salaId);
    await carregarMensagens(salaId);
  };

  const tituloDaSala = (s: ChatSala): string => {
    if (s.tp_sala === "G") return s.ds_nome || "Grupo";
    const membros = XMembrosPorSala[s.chat_sala_id] || [];
    const outro = membros.find((m) => m.user_id !== XUserId);
    if (!outro) return "Conversa";
    const p = XProfilesMap[outro.user_id];
    return p?.nm_usuario || p?.ds_login || p?.email || "Usuário";
  };

  const handleSend = async () => {
    const text = XInput.trim();
    if (!text || !XSalaAtivaId || XSending) return;
    setXInput("");
    setXSending(true);
    try {
      const m = await enviarMensagem({
        chat_sala_id: XSalaAtivaId,
        user_id: XUserId,
        ds_conteudo: text,
        ds_anexo_url: null,
        ds_anexo_tipo: null,
        ds_audio_url: null,
      });
      setXMensagens((p) => [...p, m]);
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || ""));
    } finally {
      setXSending(false);
    }
  };

  const handleAttachment = async (file: File) => {
    if (!XSalaAtivaId) return;
    setXSending(true);
    try {
      const { signedUrl } = await uploadChatAnexo(XUserId, file, file.name);
      const m = await enviarMensagem({
        chat_sala_id: XSalaAtivaId,
        user_id: XUserId,
        ds_conteudo: file.name,
        ds_anexo_url: signedUrl,
        ds_anexo_tipo: file.type,
        ds_audio_url: null,
      });
      setXMensagens((p) => [...p, m]);
    } catch (e: any) {
      toast.error("Erro no anexo: " + (e?.message || ""));
    } finally {
      setXSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      XAudioChunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && XAudioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(XAudioChunksRef.current, { type: "audio/webm" });
        await sendAudio(blob);
      };
      mr.start();
      XMediaRecorderRef.current = mr;
      setXRecording(true);
    } catch {
      toast.error("Sem acesso ao microfone");
    }
  };

  const stopRecording = () => {
    XMediaRecorderRef.current?.stop();
    setXRecording(false);
  };

  const sendAudio = async (blob: Blob) => {
    if (!XSalaAtivaId) return;
    setXSending(true);
    try {
      const { signedUrl } = await uploadChatAnexo(XUserId, blob, "audio.webm");
      const m = await enviarMensagem({
        chat_sala_id: XSalaAtivaId,
        user_id: XUserId,
        ds_conteudo: "(áudio)",
        ds_anexo_url: null,
        ds_anexo_tipo: null,
        ds_audio_url: signedUrl,
      });
      setXMensagens((p) => [...p, m]);
    } catch (e: any) {
      toast.error("Erro com áudio: " + (e?.message || ""));
    } finally {
      setXSending(false);
    }
  };

  const handleSair = async () => {
    if (!XSalaAtivaId) return;
    if (!confirm("Sair desta conversa?")) return;
    await sairDaSala(XSalaAtivaId, XUserId);
    setXSalaAtivaId(null);
    setXMensagens([]);
    await carregarSalas(XUserId);
  };

  const salaAtiva = useMemo(
    () => XSalas.find((s) => s.chat_sala_id === XSalaAtivaId) || null,
    [XSalas, XSalaAtivaId],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-3 py-2 border-b border-border bg-muted/40">
            <SheetTitle className="flex items-center gap-2 text-sm">
              {XSalaAtivaId && (
                <button onClick={() => { setXSalaAtivaId(null); setXMensagens([]); }} className="p-1 hover:bg-accent rounded">
                  <ArrowLeft size={16} />
                </button>
              )}
              {XSalaAtivaId && salaAtiva ? (
                <>
                  {salaAtiva.tp_sala === "G" ? <Users size={16} /> : <UserIcon size={16} />}
                  <span className="truncate">{tituloDaSala(salaAtiva)}</span>
                  <button onClick={handleSair} className="ml-auto p-1 hover:bg-accent rounded text-destructive" title="Sair da conversa">
                    <LogOut size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span>Conversas</span>
                  <button onClick={() => setXNovoOpen(true)} className="ml-auto p-1 hover:bg-accent rounded" title="Nova conversa">
                    <Plus size={16} />
                  </button>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {!XSalaAtivaId ? (
            <div className="flex-1 overflow-y-auto">
              {XSalas.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda.
                  <br />
                  Clique em <Plus size={12} className="inline" /> para iniciar.
                </div>
              ) : (
                XSalas.map((s) => {
                  const naoLidas = XNaoLidasPorSala[s.chat_sala_id] || 0;
                  return (
                    <button
                      key={s.chat_sala_id}
                      onClick={() => abrirSala(s.chat_sala_id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent border-b border-border text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        {s.tp_sala === "G" ? <Users size={14} /> : <UserIcon size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{tituloDaSala(s)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(s.dt_atualizacao).toLocaleString()}
                        </div>
                      </div>
                      {naoLidas > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                          {naoLidas}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <div ref={XScrollRef} className="flex-1 overflow-y-auto px-3 py-2">
                {XMensagens.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground mt-8">
                    Nenhuma mensagem ainda.
                  </div>
                )}
                {XMensagens.map((m) => (
                  <ChatInternoMessage
                    key={m.chat_sala_mensagem_id}
                    msg={m}
                    autor={XProfilesMap[m.user_id]}
                    isMe={m.user_id === XUserId}
                  />
                ))}
              </div>

              <div className="border-t border-border p-2 flex items-end gap-1 bg-card">
                <input
                  ref={XFileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAttachment(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => XFileInputRef.current?.click()}
                  disabled={XSending}
                  className="p-2 rounded hover:bg-accent text-muted-foreground"
                  title="Anexar"
                >
                  <Paperclip size={16} />
                </button>
                {micSupported && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={XSending || XRecording}
                    className={`p-2 rounded hover:bg-accent ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
                    title="Ditar"
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={XRecording ? stopRecording : startRecording}
                  disabled={XSending}
                  className={`p-2 rounded hover:bg-accent ${XRecording ? "text-destructive" : "text-muted-foreground"}`}
                  title={XRecording ? "Parar" : "Gravar áudio"}
                >
                  {XRecording ? <Square size={16} /> : <Mic size={16} className="opacity-60" />}
                </button>

                <textarea
                  value={XInput}
                  onChange={(e) => setXInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Mensagem..."
                  disabled={XSending || XRecording}
                  rows={1}
                  className="flex-1 resize-none border border-border rounded px-2 py-1.5 text-sm bg-background focus:ring-2 focus:ring-ring outline-none max-h-32"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!XInput.trim() || XSending}
                  className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  title="Enviar"
                >
                  {XSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NovaConversaDialog
        open={XNovoOpen}
        onOpenChange={setXNovoOpen}
        userId={XUserId}
        empresaId={XEmpresaId}
        onCriada={async (id) => {
          await carregarSalas(XUserId);
          await abrirSala(id);
        }}
      />
    </>
  );
};

export default ChatInternoPanel;

import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Mic, MicOff, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import realsysBot from "@/assets/realsys-bot.png";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

import ChatMessage from "./ChatMessage";
import {
  ChatMsgRow,
  callRealsys,
  ensureConversa,
  extrairAnexo,
  insertMessage,
  listMessages,
  transcreverAudio,
  uploadAttachment,
} from "./chatService";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ChatPanel: React.FC<Props> = ({ open, onOpenChange }) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XUserId, setXUserId] = useState<string>("");
  const [XConversaId, setXConversaId] = useState<number | null>(null);
  const [XMessages, setXMessages] = useState<ChatMsgRow[]>([]);
  const [XInput, setXInput] = useState("");
  const [XSending, setXSending] = useState(false);
  const [XRecording, setXRecording] = useState(false);
  const XMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const XAudioChunksRef = useRef<Blob[]>([]);
  const XScrollRef = useRef<HTMLDivElement>(null);
  const XFileInputRef = useRef<HTMLInputElement>(null);

  // Voice-to-text (mic button)
  const { isListening, isSupported: micSupported, toggle: toggleMic } = useSpeechRecognition({
    onResult: (t) => setXInput((p) => (p ? p + " " + t : t)),
  });

  // Auth + load
  useEffect(() => {
    if (!open) return;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setXUserId(session.user.id);
      try {
        const cId = await ensureConversa(session.user.id, XEmpresaId);
        setXConversaId(cId);
        const msgs = await listMessages(cId);
        setXMessages(msgs);
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao carregar conversa: " + (e?.message || ""));
      }
    };
    init();
  }, [open, XEmpresaId]);

  // Auto-scroll
  useEffect(() => {
    XScrollRef.current?.scrollTo({ top: XScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [XMessages, XSending]);

  const runActions = (actions: any[]) => {
    for (const a of actions || []) {
      if (a?.type === "open_tab" && a.component) {
        openTab({ title: a.titulo || a.component, component: a.component });
      }
    }
  };

  const sendToAssistant = async (extraSystemNote?: string) => {
    if (!XConversaId || !XUserId) return;
    setXSending(true);
    try {
      const fresh = await listMessages(XConversaId);
      const history = fresh
        .filter((m) => m.tp_remetente === "user" || m.tp_remetente === "assistant")
        .map((m) => ({ role: m.tp_remetente, content: m.ds_conteudo || "" }));
      if (extraSystemNote) {
        history.push({ role: "user", content: `(Contexto extraído de anexo)\n${extraSystemNote}` });
      }
      const resp = await callRealsys({ messages: history, empresaId: XEmpresaId });
      if ((resp as any)?.error) {
        toast.error((resp as any).error);
        return;
      }
      const assistantMsg = await insertMessage({
        chat_conversa_id: XConversaId,
        user_id: XUserId,
        tp_remetente: "assistant",
        ds_conteudo: resp.content || "",
        ds_anexo_url: null,
        ds_anexo_tipo: null,
        ds_audio_url: null,
        tp_acao: resp.tool_results?.length ? resp.tool_results.map((t: any) => t.name).join(", ") : null,
        dados_acao: resp.tool_results || null,
      });
      setXMessages((p) => [...p, assistantMsg]);
      runActions(resp.ui_actions || []);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setXSending(false);
    }
  };

  const handleSend = async () => {
    const text = XInput.trim();
    if (!text || !XConversaId || !XUserId || XSending) return;
    setXInput("");
    try {
      const userMsg = await insertMessage({
        chat_conversa_id: XConversaId,
        user_id: XUserId,
        tp_remetente: "user",
        ds_conteudo: text,
        ds_anexo_url: null,
        ds_anexo_tipo: null,
        ds_audio_url: null,
        tp_acao: null,
        dados_acao: null,
      });
      setXMessages((p) => [...p, userMsg]);
      await sendToAssistant();
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || ""));
    }
  };

  const handleAttachment = async (file: File) => {
    if (!XConversaId || !XUserId) return;
    setXSending(true);
    try {
      const { signedUrl } = await uploadAttachment(XUserId, file, file.name);
      const userMsg = await insertMessage({
        chat_conversa_id: XConversaId,
        user_id: XUserId,
        tp_remetente: "user",
        ds_conteudo: `Enviei um anexo: ${file.name}`,
        ds_anexo_url: signedUrl,
        ds_anexo_tipo: file.type,
        ds_audio_url: null,
        tp_acao: null,
        dados_acao: null,
      });
      setXMessages((p) => [...p, userMsg]);

      // Try extraction (image/pdf only)
      let extracted = "";
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        try {
          extracted = await extrairAnexo(file, file.type);
        } catch (e) {
          console.warn("extração falhou", e);
        }
      }
      await sendToAssistant(extracted || undefined);
    } catch (e: any) {
      toast.error("Erro no anexo: " + (e?.message || ""));
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
    } catch (e: any) {
      toast.error("Sem acesso ao microfone");
    }
  };

  const stopRecording = () => {
    XMediaRecorderRef.current?.stop();
    setXRecording(false);
  };

  const sendAudio = async (blob: Blob) => {
    if (!XConversaId || !XUserId) return;
    setXSending(true);
    try {
      const { signedUrl } = await uploadAttachment(XUserId, blob, "audio.webm");
      const texto = await transcreverAudio(blob);
      const userMsg = await insertMessage({
        chat_conversa_id: XConversaId,
        user_id: XUserId,
        tp_remetente: "user",
        ds_conteudo: texto || "(áudio)",
        ds_anexo_url: null,
        ds_anexo_tipo: null,
        ds_audio_url: signedUrl,
        tp_acao: null,
        dados_acao: null,
      });
      setXMessages((p) => [...p, userMsg]);
      await sendToAssistant();
    } catch (e: any) {
      toast.error("Erro com áudio: " + (e?.message || ""));
      setXSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-muted/40">
          <SheetTitle className="flex items-center gap-2">
            <img src={realsysBot} alt="RealSys" className="w-8 h-8 object-contain" />
            <div>
              <div className="text-sm font-semibold">RealSys</div>
              <div className="text-[10px] font-normal text-muted-foreground">Assistente do sistema</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div ref={XScrollRef} className="flex-1 overflow-y-auto px-3 py-2">
          {XMessages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-8 px-4">
              Olá! Sou o RealSys 🤖<br />
              Posso abrir formulários, cadastrar clientes, criar pedidos, ler documentos e mais.
              Manda uma mensagem, áudio ou anexo!
            </div>
          )}
          {XMessages.map((m) => <ChatMessage key={m.chat_mensagem_id} msg={m} />)}
          {XSending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
              <Loader2 size={12} className="animate-spin" /> RealSys está pensando...
            </div>
          )}
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
            title="Anexar arquivo"
          >
            <Paperclip size={16} />
          </button>
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={XSending || XRecording}
              className={`p-2 rounded hover:bg-accent ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
              title="Ditar (voz para texto)"
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={XRecording ? stopRecording : startRecording}
            disabled={XSending}
            className={`p-2 rounded hover:bg-accent ${XRecording ? "text-destructive" : "text-muted-foreground"}`}
            title={XRecording ? "Parar gravação" : "Gravar áudio"}
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
            placeholder="Mensagem para o RealSys..."
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
            <Send size={16} />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatPanel;

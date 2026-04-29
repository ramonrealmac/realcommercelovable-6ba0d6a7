import React from "react";
import ReactMarkdown from "react-markdown";
import realsysBot from "@/assets/realsys-bot.png";
import { cn } from "@/lib/utils";
import type { ChatMsgRow } from "./chatService";
import { Paperclip } from "lucide-react";

interface Props {
  msg: ChatMsgRow;
}

const ChatMessage: React.FC<Props> = ({ msg }) => {
  const isUser = msg.tp_remetente === "user";
  const isAssistant = msg.tp_remetente === "assistant";
  if (msg.tp_remetente === "system" || msg.tp_remetente === "tool") return null;

  return (
    <div className={cn("flex gap-2 my-3", isUser ? "justify-end" : "justify-start")}>
      {isAssistant && (
        <img
          src={realsysBot}
          alt="RealSys"
          className="w-8 h-8 rounded-full bg-primary/10 shrink-0 object-contain"
        />
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted text-foreground rounded-bl-none"
        )}
      >
        {!isUser && <div className="text-[10px] font-semibold opacity-70 mb-0.5">RealSys</div>}
        {msg.ds_conteudo && (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 dark:prose-invert">
            <ReactMarkdown>{msg.ds_conteudo}</ReactMarkdown>
          </div>
        )}
        {msg.ds_anexo_url && (
          <div className="mt-2">
            {msg.ds_anexo_tipo?.startsWith("image/") ? (
              <img src={msg.ds_anexo_url} alt="anexo" className="max-w-full rounded border border-border" />
            ) : (
              <a
                href={msg.ds_anexo_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline text-xs"
              >
                <Paperclip size={12} /> Anexo ({msg.ds_anexo_tipo})
              </a>
            )}
          </div>
        )}
        {msg.ds_audio_url && (
          <audio controls src={msg.ds_audio_url} className="mt-2 max-w-full" />
        )}
        {msg.tp_acao && (
          <div className="mt-2 text-[11px] bg-background/40 border border-border rounded px-2 py-1">
            ✓ Ação: <strong>{msg.tp_acao}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

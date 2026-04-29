import React from "react";
import { ChatMensagem, Profile } from "./chatInternoService";

interface Props {
  msg: ChatMensagem;
  autor?: Profile;
  isMe: boolean;
}

const ChatInternoMessage: React.FC<Props> = ({ msg, autor, isMe }) => {
  const nome = autor?.nm_usuario || autor?.ds_login || autor?.email || "Usuário";
  const inicial = (nome || "?").charAt(0).toUpperCase();
  const hora = new Date(msg.dt_criacao).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex gap-2 my-2 ${isMe ? "flex-row-reverse" : ""}`}>
      <div className="w-7 h-7 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {autor?.ds_foto ? <img src={autor.ds_foto} alt="" className="w-full h-full object-cover" /> : inicial}
      </div>
      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : ""}`}>
          {nome} • {hora}
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
            isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {msg.ds_conteudo}
          {msg.ds_anexo_url && (
            <div className="mt-1">
              {msg.ds_anexo_tipo?.startsWith("image/") ? (
                <a href={msg.ds_anexo_url} target="_blank" rel="noopener noreferrer">
                  <img src={msg.ds_anexo_url} alt="anexo" className="max-h-48 rounded" />
                </a>
              ) : (
                <a
                  href={msg.ds_anexo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-xs"
                >
                  📎 Abrir anexo
                </a>
              )}
            </div>
          )}
          {msg.ds_audio_url && (
            <audio controls src={msg.ds_audio_url} className="mt-1 max-w-full" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInternoMessage;

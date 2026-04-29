import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarMinhasSalas, contarNaoLidas } from "./chatInternoService";
import ChatInternoPanel from "./ChatInternoPanel";

const POLL_MS = 15000;

/**
 * Ícone para a TopBar com badge de mensagens não lidas.
 * Mantém um contador independente do painel para que o badge atualize
 * mesmo quando o chat está fechado.
 */
const ChatInternoTopBarButton: React.FC = () => {
  const [XOpen, setXOpen] = useState(false);
  const [XUnread, setXUnread] = useState(0);
  const [XUserId, setXUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setXUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!XUserId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { salas, ultimaLeituraPorSala } = await listarMinhasSalas(XUserId);
        let total = 0;
        for (const s of salas) {
          total += await contarNaoLidas(s.chat_sala_id, XUserId, ultimaLeituraPorSala[s.chat_sala_id]);
        }
        if (!cancelled) setXUnread(total);
      } catch {
        // silencioso
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [XUserId, XOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setXOpen(true)}
        className="relative p-1.5 hover:bg-foreground/10 rounded"
        title="Chat interno"
      >
        <MessageCircle size={18} />
        {XUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {XUnread > 99 ? "99+" : XUnread}
          </span>
        )}
      </button>
      <ChatInternoPanel open={XOpen} onOpenChange={setXOpen} onUnreadChange={setXUnread} />
    </>
  );
};

export default ChatInternoTopBarButton;

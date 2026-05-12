import React, { useState } from "react";
import ChatPanel from "./ChatPanel";
import botStatic from "@/assets/realsys-bot.png";
import { useAppContext } from "@/contexts/AppContext";

const ChatLauncher: React.FC = () => {
  const [XOpen, setXOpen] = useState(false);
  const { XChatBotVisible } = useAppContext();

  if (!XChatBotVisible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setXOpen(true)}
        title="Falar com o RealSys"
        className="fixed bottom-4 right-4 z-40 w-[72px] h-[72px] rounded-full bg-primary shadow-lg hover:scale-105 transition-transform flex items-center justify-center border-2 border-primary-foreground/20"
      >
        <img src={botStatic} alt="RealSys" className="w-[62px] h-[62px] object-contain" />
      </button>
      <ChatPanel open={XOpen} onOpenChange={setXOpen} />
    </>
  );
};

export default ChatLauncher;

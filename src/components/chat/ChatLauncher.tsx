import React, { useState } from "react";
import ChatPanel from "./ChatPanel";
import botStatic from "@/assets/realsys-bot.png";

const ChatLauncher: React.FC = () => {
  const [XOpen, setXOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setXOpen(true)}
        title="Falar com o RealSys"
        className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-primary shadow-lg hover:scale-105 transition-transform flex items-center justify-center border-2 border-primary-foreground/20"
      >
        <img src={botStatic} alt="RealSys" className="w-12 h-12 object-contain" />
      </button>
      <ChatPanel open={XOpen} onOpenChange={setXOpen} />
    </>
  );
};

export default ChatLauncher;

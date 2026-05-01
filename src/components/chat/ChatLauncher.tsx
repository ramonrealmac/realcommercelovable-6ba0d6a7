import React, { useState } from "react";
import RealsysBotAvatar from "./RealsysBotAvatar";
import ChatPanel from "./ChatPanel";

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
        <RealsysBotAvatar XSize={48} />
      </button>
      <ChatPanel open={XOpen} onOpenChange={setXOpen} />
    </>
  );
};

export default ChatLauncher;

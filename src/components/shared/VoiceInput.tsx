import React, { useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** If true, appends recognized text instead of replacing */
  append?: boolean;
  type?: string;
  autoFocus?: boolean;
  textAlign?: "left" | "right";
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  append = false,
  type = "text",
  autoFocus,
  textAlign = "left",
}) => {
  const handleResult = useCallback(
    (transcript: string) => {
      if (append && value) {
        onChange(value + " " + transcript);
      } else {
        onChange(transcript);
      }
    },
    [value, onChange, append]
  );

  const { isListening, isSupported, toggle } = useSpeechRecognition({
    onResult: handleResult,
  });

  if (readOnly) {
    return (
      <input
        type="text"
        value={value}
        readOnly
        className={cn(
          "w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary",
          textAlign === "right" && "text-right",
          className
        )}
      />
    );
  }

  return (
    <div className="flex gap-1">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "flex-1 border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none",
          textAlign === "right" && "text-right",
          isListening && "ring-2 ring-destructive",
          className
        )}
      />
      {isSupported && (
        <button
          type="button"
          onClick={toggle}
          title={isListening ? "Parar gravação" : "Preencher por voz"}
          className={cn(
            "shrink-0 h-[34px] w-[34px] flex items-center justify-center rounded border transition-colors",
            isListening
              ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
      )}
    </div>
  );
};

export default VoiceInput;

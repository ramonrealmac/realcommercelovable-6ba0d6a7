import { useState, useCallback, useRef, useEffect } from "react";

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  autoRestart?: boolean;
  onResult?: (transcript: string) => void;
  onEnd?: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = "pt-BR", continuous = true, autoRestart = false, onResult, onEnd } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      onResult?.(transcript);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && autoRestart) {
        try { recognition.start(); } catch (e) { setIsListening(false); shouldRestartRef.current = false; }
      } else {
        setIsListening(false);
        onEnd?.();
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" && shouldRestartRef.current && autoRestart) {
        try { recognition.start(); } catch (err) { setIsListening(false); shouldRestartRef.current = false; }
      } else {
        shouldRestartRef.current = false;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    recognition.start();
    setIsListening(true);
  }, [lang, continuous, autoRestart, onResult, onEnd]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else startRecognition();
  }, [isListening, stop, startRecognition]);

  return { isListening, isSupported, start: startRecognition, stop, toggle };
}

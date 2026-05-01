import React, { useEffect, useRef, useState } from "react";
import botStatic from "@/assets/realsys-bot.png";
import botAnimado from "@/assets/realsys-bot-animado.gif";
import { useEmpresaParam } from "@/hooks/useEmpresaParam";

interface IRealsysBotAvatarProps {
  /** Tamanho em px (largura = altura). Default 48. */
  XSize?: number;
  /** Sobrescreve o intervalo (em segundos) lido de empresa.tempo_animacao. */
  XIntervalSec?: number;
  /** Duracao da animacao em ms (default 1300, casado com o GIF). */
  XAnimDurationMs?: number;
  XClassName?: string;
  XAlt?: string;
}

/**
 * Avatar do bot RealSys.
 * - Renderiza o PNG estatico por padrao.
 * - A cada `empresa.tempo_animacao` segundos troca para o GIF (com cache-buster
 *   para forcar replay, ja que o GIF tem loop=1) e volta ao estatico ao fim.
 * - Pausa quando a aba esta oculta para nao consumir CPU.
 * - Se o intervalo for 0, fica sempre parado.
 *
 * Componente isolado e reutilizavel: pode ser usado em qualquer ponto do
 * sistema (header, dialog, splash, etc).
 */
const RealsysBotAvatar: React.FC<IRealsysBotAvatarProps> = ({
  XSize = 48,
  XIntervalSec,
  XAnimDurationMs = 1300,
  XClassName = "",
  XAlt = "RealSys",
}) => {
  const XEmpresaTempo = useEmpresaParam<number>("tempo_animacao", 5);
  const XIntervalo = (XIntervalSec ?? XEmpresaTempo) || 0;

  const [XPlaying, setXPlaying] = useState(false);
  const [XGifKey, setXGifKey] = useState<number>(0);
  const XStopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!XIntervalo || XIntervalo <= 0) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      setXGifKey(Date.now()); // forca recarga do GIF para reproduzir novamente
      setXPlaying(true);
      if (XStopRef.current) window.clearTimeout(XStopRef.current);
      XStopRef.current = window.setTimeout(() => {
        setXPlaying(false);
      }, XAnimDurationMs);
    };

    const id = window.setInterval(tick, XIntervalo * 1000);
    return () => {
      window.clearInterval(id);
      if (XStopRef.current) window.clearTimeout(XStopRef.current);
    };
  }, [XIntervalo, XAnimDurationMs]);

  const XSrc = XPlaying ? `${botAnimado}?t=${XGifKey}` : botStatic;

  return (
    <img
      key={XPlaying ? `anim-${XGifKey}` : "static"}
      src={XSrc}
      alt={XAlt}
      width={XSize}
      height={XSize}
      className={`object-contain ${XClassName}`}
      style={{ width: XSize, height: XSize }}
      draggable={false}
    />
  );
};

export default RealsysBotAvatar;

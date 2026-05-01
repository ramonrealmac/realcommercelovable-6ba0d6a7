import React, { useEffect, useRef, useState } from "react";
import botStatic from "@/assets/realsys-bot.png";
import { useEmpresaParam } from "@/hooks/useEmpresaParam";

interface IRealsysBotAvatarProps {
  XSize?: number;
  XIntervalSec?: number;
  XAnimDurationMs?: number;
  XClassName?: string;
  XAlt?: string;
}

/**
 * Avatar do bot RealSys.
 * - Mostra o PNG estatico, sempre centralizado e visivel.
 * - A cada `empresa.tempo_animacao` segundos aplica uma classe CSS de animacao
 *   ("acena + pisca") por XAnimDurationMs e remove em seguida.
 * - Animacao 100% CSS (sem GIF): bounce vertical + balanco lateral leve +
 *   uma "piscada" via mascara escura sobre a faixa dos olhos.
 * - Se o intervalo for 0, fica sempre parado.
 *
 * Componente isolado e reutilizavel.
 */
const RealsysBotAvatar: React.FC<IRealsysBotAvatarProps> = ({
  XSize = 48,
  XIntervalSec,
  XAnimDurationMs = 1400,
  XClassName = "",
  XAlt = "RealSys",
}) => {
  const XEmpresaTempo = useEmpresaParam<number>("tempo_animacao", 5);
  const XIntervalo = (XIntervalSec ?? XEmpresaTempo) || 0;

  const [XPlaying, setXPlaying] = useState(false);
  const XStopRef = useRef<number | null>(null);
  const XCycleRef = useRef(0);

  useEffect(() => {
    if (!XIntervalo || XIntervalo <= 0) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      XCycleRef.current += 1;
      setXPlaying(true);
      if (XStopRef.current) window.clearTimeout(XStopRef.current);
      XStopRef.current = window.setTimeout(() => setXPlaying(false), XAnimDurationMs);
    };
    const id = window.setInterval(tick, XIntervalo * 1000);
    return () => {
      window.clearInterval(id);
      if (XStopRef.current) window.clearTimeout(XStopRef.current);
    };
  }, [XIntervalo, XAnimDurationMs]);

  return (
    <span
      className={`relative inline-block overflow-visible ${XClassName}`}
      style={{ width: XSize, height: XSize }}
    >
      <img
        // re-monta a cada ciclo para reiniciar a animacao do zero
        key={XPlaying ? `p-${XCycleRef.current}` : "s"}
        src={botStatic}
        alt={XAlt}
        width={XSize}
        height={XSize}
        draggable={false}
        className={`block object-contain ${XPlaying ? "rb-bot-wave" : ""}`}
        style={{
          width: XSize,
          height: XSize,
          transformOrigin: "50% 100%", // pivot nos pés
        }}
      />
      {/* Faixa de "pálpebra" para simular piscada */}
      {XPlaying && (
        <span
          aria-hidden
          className="rb-bot-blink absolute left-0 right-0 pointer-events-none"
          style={{
            top: `${XSize * 0.34}px`,
            height: `${XSize * 0.12}px`,
          }}
        />
      )}
    </span>
  );
};

export default RealsysBotAvatar;

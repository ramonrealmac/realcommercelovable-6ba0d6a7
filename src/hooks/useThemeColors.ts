import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Converts a hex color (#RRGGBB) to HSL values string "H S% L%"
 */
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const COLOR_MAP: Record<string, string> = {
  cor_primaria: "--primary",
  cor_header: "--topbar",
  cor_fundo: "--background",
  cor_fundo_card: "--card",
  cor_texto_principal: "--foreground",
  cor_texto_secundario: "--muted-foreground",
  cor_botao: "--ring",
  cor_botao_negativo: "--destructive",
  cor_destaque: "--warning",
  cor_menu: "--sidebar-primary",
  cor_link: "--accent",
};

export function useThemeColors(empresaId: number) {
  const [XLoaded, setXLoaded] = useState(false);
  const [XLogomarca, setXLogomarca] = useState<string>("");

  useEffect(() => {
    if (!empresaId) return;

    const load = async () => {
      const db = supabase as any;
      const { data } = await db
        .from("empresa")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("excluido", false)
        .single();

      if (!data) { setXLoaded(true); return; }

      const root = document.documentElement;
      for (const [dbKey, cssVar] of Object.entries(COLOR_MAP)) {
        const hex = data[dbKey];
        if (hex) {
          const hsl = hexToHsl(hex);
          if (hsl) root.style.setProperty(cssVar, hsl);
        }
      }

      // Primary foreground stays white for contrast
      if (data.cor_primaria) {
        const hsl = hexToHsl(data.cor_primaria);
        if (hsl) {
          root.style.setProperty("--primary", hsl);
          root.style.setProperty("--sidebar-primary", hexToHsl(data.cor_menu || data.cor_primaria));
          root.style.setProperty("--grid-header", hsl);
          root.style.setProperty("--grid-selected", hsl);
        }
      }

      if (data.cor_header) {
        root.style.setProperty("--topbar", hexToHsl(data.cor_header));
      }

      // Custom CSS
      if (data.css_customizado) {
        let style = document.getElementById("custom-theme-css");
        if (!style) {
          style = document.createElement("style");
          style.id = "custom-theme-css";
          document.head.appendChild(style);
        }
        style.textContent = data.css_customizado;
      }

      // Logomarca
      setXLogomarca(data.logomarca || "");

      setXLoaded(true);
    };

    load();
  }, [empresaId]);

  return { XLoaded, XLogomarca };
}

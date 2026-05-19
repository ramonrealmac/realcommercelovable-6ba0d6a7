import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
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

const COLOR_MAP: Record<string, string[]> = {
  xcor_primaria: ['--primary', '--ring', '--sidebar-primary'],
  xcor_secundaria: ['--secondary'],
  xcor_destaque: ['--accent'],
  xcor_fundo: ['--background'],
  xcor_fundo_card: ['--card'],
  xcor_texto_principal: ['--foreground', '--card-foreground', '--popover-foreground'],
  xcor_texto_secundario: ['--muted-foreground'],
  xcor_botao_negativo: ['--destructive'],
  xcor_header: ['--sidebar-background'],
};

export function useThemeColors() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Use secure RPC that excludes sensitive fields (API keys)
      const { data: rpcData } = await (supabase as any).rpc('fu_get_parametro_publico');
      const data = rpcData?.[0] || null;
      
      if (!data) { setLoaded(true); return; }

      const root = document.documentElement;
      Object.entries(COLOR_MAP).forEach(([dbKey, cssVars]) => {
        const hex = data[dbKey];
        if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
          const hsl = hexToHSL(hex);
          cssVars.forEach(v => root.style.setProperty(v, hsl));
        }
      });
      setLoaded(true);
    };
    load();
  }, []);

  return loaded;
}

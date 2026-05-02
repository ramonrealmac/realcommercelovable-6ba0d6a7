// ============================================================
// Report Builder Pro — Paleta de Componentes (sidebar esquerda)
// ============================================================
import React from 'react';
import { Type, Table2, Hash, Image, Minus, GripVertical, Square } from 'lucide-react';
import type { RpbBandName } from '../../types';

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  defaultW: number;
  defaultH: number;
}

const ITEMS: PaletteItem[] = [
  { type: 'text',       label: 'Caixa de Texto',    icon: <Type  className="w-4 h-4" />, defaultW: 60,  defaultH: 8   },
  { type: 'table',      label: 'Tabela de Dados',    icon: <Table2 className="w-4 h-4" />, defaultW: 190, defaultH: 60  },
  { type: 'totalizer',  label: 'Totalizador',        icon: <Hash  className="w-4 h-4" />, defaultW: 50,  defaultH: 8   },
  { type: 'image',      label: 'Imagem / Logo',      icon: <Image className="w-4 h-4" />, defaultW: 40,  defaultH: 20  },
  { type: 'line',       label: 'Linha Horizontal',   icon: <Minus className="w-4 h-4" />, defaultW: 190, defaultH: 1   },
  { type: 'line-v',     label: 'Linha Vertical',     icon: <GripVertical className="w-4 h-4" />, defaultW: 1, defaultH: 20 },
  { type: 'box',        label: 'Box / Retângulo',    icon: <Square className="w-4 h-4" />, defaultW: 80,  defaultH: 20  },
];

interface Props {
  activeBand: RpbBandName | null;
  onAddComponent: (type: string, defaultW: number, defaultH: number) => void;
}

const RpbPalette: React.FC<Props> = ({ activeBand, onAddComponent }) => {
  return (
    <div className="w-48 flex-shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Componentes</p>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {ITEMS.map(item => (
          <button
            key={item.type}
            disabled={!activeBand}
            onClick={() => onAddComponent(item.type, item.defaultW, item.defaultH)}
            title={activeBand ? `Adicionar ${item.label} na banda selecionada` : 'Selecione uma banda primeiro'}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
              border border-border transition-all
              ${activeBand
                ? 'hover:bg-primary/10 hover:border-primary/40 cursor-pointer text-foreground'
                : 'opacity-40 cursor-not-allowed text-muted-foreground'}
            `}
          >
            <span className="text-primary">{item.icon}</span>
            <span className="text-xs leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {!activeBand && (
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Clique em uma banda para ativar e adicionar componentes
          </p>
        </div>
      )}
    </div>
  );
};

export default RpbPalette;

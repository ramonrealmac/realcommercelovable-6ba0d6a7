import React, { useEffect, useState } from 'react';
import { rpbGetRelatorio, rpbListConexoes } from '../../services/rpbService';
import { IRpbRelatorio, IRpbConexao } from '../../types';
import RpbExecutor from './RpbExecutor';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface Props {
  rpbRelatorioId: number;
  initialParams?: Record<string, any>;
}

const RpbStandaloneExecutor: React.FC<Props> = ({ rpbRelatorioId, initialParams }) => {
  const { XEmpresaId } = useAppContext();
  const [relatorio, setRelatorio] = useState<IRpbRelatorio | null>(null);
  const [conexoes, setConexoes]   = useState<IRpbConexao[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (rpbRelatorioId && XEmpresaId) {
      setLoading(true);
      Promise.all([
        rpbGetRelatorio(rpbRelatorioId),
        rpbListConexoes(XEmpresaId)
      ]).then(([rel, con]) => {
        setRelatorio(rel);
        setConexoes(con);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [rpbRelatorioId, XEmpresaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" /> Carregando relatório...
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Relatório não encontrado.
      </div>
    );
  }

  return <RpbExecutor relatorio={relatorio} conexoes={conexoes} initialValues={initialParams} />;
};

export default RpbStandaloneExecutor;

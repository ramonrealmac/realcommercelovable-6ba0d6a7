import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldOff, Users as UsersIcon } from 'lucide-react';

type UserRow = {
  id: string;
  xnm_usuario: string;
  xemail: string;
  xlg_aprovado: boolean;
  role: 'ADM' | 'CAIXA' | null;
  created_at: string;
};

export default function Usuarios() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('fu_list_users_admin');
    if (error) {
      toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Acesso restrito a administradores.
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleApproval = async (u: UserRow, value: boolean) => {
    setBusyId(u.id);
    const { error } = await (supabase as any).rpc('fu_set_user_approval', {
      _user_id: u.id,
      _aprovado: value,
    });
    setBusyId(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: value ? 'Usuário liberado' : 'Acesso bloqueado' });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, xlg_aprovado: value } : x)));
    }
  };

  const changeRole = async (u: UserRow, role: 'ADM' | 'CAIXA') => {
    setBusyId(u.id);
    const { error } = await (supabase as any).rpc('fu_set_user_role', {
      _user_id: u.id,
      _role: role,
    });
    setBusyId(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Papel atualizado' });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <UsersIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Aprove novos cadastros e gerencie papéis de acesso
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${users.length} usuário(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aprovado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.xnm_usuario || '—'}
                        {isSelf && <Badge variant="outline" className="ml-2">você</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.xemail}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role || 'CAIXA'}
                          onValueChange={(v) => changeRole(u, v as 'ADM' | 'CAIXA')}
                          disabled={busyId === u.id || isSelf}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADM">ADM</SelectItem>
                            <SelectItem value="CAIXA">CAIXA</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.xlg_aprovado ? (
                          <Badge className="gap-1"><ShieldCheck className="w-3 h-3" /> Liberado</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><ShieldOff className="w-3 h-3" /> Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={u.xlg_aprovado}
                          onCheckedChange={(v) => toggleApproval(u, v)}
                          disabled={busyId === u.id || isSelf}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuário cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

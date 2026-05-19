import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type AppRole = 'ADM' | 'CAIXA';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  approved: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, name: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [approved, setApproved] = useState<boolean>(false);

  const setupUser = async (currentUser: User) => {
    try {
      // Ensure profile exists
      await (supabase as any).rpc('fu_ensure_profile', {
        _user_id: currentUser.id,
        _name: currentUser.user_metadata?.name || currentUser.email || '',
        _email: currentUser.email || '',
      });

      // Bootstrap role
      await (supabase as any).rpc('fu_bootstrap_role', {
        _user_id: currentUser.id,
      });

      // Fetch role
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);

      if (roles && roles.length > 0) {
        const hasAdmin = roles.some((r: any) => r.role === 'ADM');
        setRole(hasAdmin ? 'ADM' : (roles[0].role as AppRole));
      }

      // Check approval
      const { data: aprovado } = await (supabase as any).rpc('fu_is_aprovado', {
        _user_id: currentUser.id,
      });
      const isApproved = !!aprovado;
      setApproved(isApproved);
      if (!isApproved) {
        await supabase.auth.signOut();
        setRole(null);
        if (typeof window !== 'undefined') {
          const { toast } = await import('@/hooks/use-toast');
          toast({
            title: 'Acesso pendente de aprovação',
            description: 'Aguarde o administrador liberar seu acesso.',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('Error setting up user:', err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(() => setupUser(newSession.user), 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setupUser(s.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email: string, password: string, name: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, role, isAdmin: role === 'ADM', approved, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

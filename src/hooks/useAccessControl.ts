import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IPerfil {
  perfil_id: number;
  empresa_id: number;
  nm_perfil: string;
  fl_administrador: boolean;
  fl_excluido: boolean;
}

export interface IPerfilUsuario {
  perfil_usuario_id: number;
  empresa_id: number;
  user_id: string;
  perfil_id: number;
  fl_excluido: boolean;
}

export interface IEmpresaUsuario {
  empresa_usuario_id: number;
  empresa_id: number;
  user_id: string;
  fl_excluido: boolean;
}

export interface IAcessoMenu {
  perfil_acesso_menu_id: number;
  empresa_id: number;
  perfil_id: number;
  nm_menu: string;
  nm_menu_pai: string | null;
  fl_visivel: boolean;
  fl_excluido: boolean;
}

export interface IAcessoFormulario {
  perfil_acesso_formulario_id: number;
  empresa_id: number;
  perfil_id: number;
  nm_formulario: string;
  fl_visualizar: boolean;
  fl_incluir: boolean;
  fl_alterar: boolean;
  fl_excluir_registro: boolean;
  fl_excluido: boolean;
}

export interface IAcessoBotao {
  perfil_acesso_botao_id: number;
  empresa_id: number;
  perfil_id: number;
  nm_formulario: string;
  nm_botao: string;
  fl_editavel: boolean;
  fl_excluido: boolean;
}

export interface IAcessoCampo {
  perfil_acesso_campo_id: number;
  empresa_id: number;
  perfil_id: number;
  nm_formulario: string;
  nm_campo: string;
  tp_editavel: string;
  fl_excluido: boolean;
}

// Hook to load perfis
export function usePerfis(XEmpresaId: number) {
  const [XPerfis, setXPerfis] = useState<IPerfil[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const load = useCallback(async () => {
    setXLoading(true);
    const { data } = await supabase
      .from("perfil")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("fl_excluido", false)
      .order("nm_perfil");
    setXPerfis((data as IPerfil[]) || []);
    setXLoading(false);
  }, [XEmpresaId]);

  useEffect(() => { load(); }, [load]);

  return { XPerfis, XLoading, reload: load };
}

// Hook for menu access
export function useAcessoMenus(XEmpresaId: number, XPerfilId: number | null) {
  const [XMenus, setXMenus] = useState<IAcessoMenu[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const load = useCallback(async () => {
    if (!XPerfilId) { setXMenus([]); return; }
    setXLoading(true);
    const { data } = await supabase
      .from("perfil_acesso_menu")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("perfil_id", XPerfilId)
      .eq("fl_excluido", false)
      .order("nm_menu");
    setXMenus((data as IAcessoMenu[]) || []);
    setXLoading(false);
  }, [XEmpresaId, XPerfilId]);

  useEffect(() => { load(); }, [load]);

  return { XMenus, XLoading, reload: load };
}

// Hook for form access
export function useAcessoFormularios(XEmpresaId: number, XPerfilId: number | null) {
  const [XForms, setXForms] = useState<IAcessoFormulario[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const load = useCallback(async () => {
    if (!XPerfilId) { setXForms([]); return; }
    setXLoading(true);
    const { data } = await supabase
      .from("perfil_acesso_formulario")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("perfil_id", XPerfilId)
      .eq("fl_excluido", false)
      .order("nm_formulario");
    setXForms((data as IAcessoFormulario[]) || []);
    setXLoading(false);
  }, [XEmpresaId, XPerfilId]);

  useEffect(() => { load(); }, [load]);

  return { XForms, XLoading, reload: load };
}

// Hook for button access
export function useAcessoBotoes(XEmpresaId: number, XPerfilId: number | null) {
  const [XBotoes, setXBotoes] = useState<IAcessoBotao[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const load = useCallback(async () => {
    if (!XPerfilId) { setXBotoes([]); return; }
    setXLoading(true);
    const { data } = await supabase
      .from("perfil_acesso_botao")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("perfil_id", XPerfilId)
      .eq("fl_excluido", false)
      .order("nm_formulario");
    setXBotoes((data as IAcessoBotao[]) || []);
    setXLoading(false);
  }, [XEmpresaId, XPerfilId]);

  useEffect(() => { load(); }, [load]);

  return { XBotoes, XLoading, reload: load };
}

// Hook for field access
export function useAcessoCampos(XEmpresaId: number, XPerfilId: number | null) {
  const [XCampos, setXCampos] = useState<IAcessoCampo[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const load = useCallback(async () => {
    if (!XPerfilId) { setXCampos([]); return; }
    setXLoading(true);
    const { data } = await supabase
      .from("perfil_acesso_campo")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("perfil_id", XPerfilId)
      .eq("fl_excluido", false)
      .order("nm_formulario");
    setXCampos((data as IAcessoCampo[]) || []);
    setXLoading(false);
  }, [XEmpresaId, XPerfilId]);

  useEffect(() => { load(); }, [load]);

  return { XCampos, XLoading, reload: load };
}

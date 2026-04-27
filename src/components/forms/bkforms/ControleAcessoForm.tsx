import React, { useState, useCallback, useEffect } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePerfis, useAcessoMenus, useAcessoFormularios, useAcessoBotoes, useAcessoCampos,
  IAcessoMenu, IAcessoFormulario, IAcessoBotao, IAcessoCampo,
} from "@/hooks/useAccessControl";
import { toast } from "sonner";
import { MENU_CONFIG, MenuItem, getLeafItems } from "@/config/menuConfig";

/** Build flat menu tree with parent references from MENU_CONFIG */
function buildSystemMenus(items: MenuItem[], parentTitle: string | null = null): { nm_menu: string; nm_menu_pai: string | null }[] {
  const result: { nm_menu: string; nm_menu_pai: string | null }[] = [];
  for (const item of items) {
    result.push({ nm_menu: item.title, nm_menu_pai: parentTitle });
    if (item.children) {
      result.push(...buildSystemMenus(item.children, item.title));
    }
  }
  return result;
}

/** Build list of form IDs from leaf items in MENU_CONFIG */
function buildSystemForms(items: MenuItem[]): string[] {
  return getLeafItems(items).map(i => i.id);
}

const ControleAcessoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const { XPerfis } = usePerfis(XEmpresaId);
  const [XSelectedPerfilId, setXSelectedPerfilId] = useState<number | null>(null);
  const [XActiveSection, setXActiveSection] = useState<"menus" | "formularios" | "botoes" | "campos">("menus");

  const XSystemMenus = buildSystemMenus(MENU_CONFIG);
  const XSystemForms = buildSystemForms(MENU_CONFIG);

  const { XMenus, reload: reloadMenus } = useAcessoMenus(XEmpresaId, XSelectedPerfilId);
  const { XForms, reload: reloadForms } = useAcessoFormularios(XEmpresaId, XSelectedPerfilId);
  const { XBotoes, reload: reloadBotoes } = useAcessoBotoes(XEmpresaId, XSelectedPerfilId);
  const { XCampos, reload: reloadCampos } = useAcessoCampos(XEmpresaId, XSelectedPerfilId);

  useEffect(() => {
    if (XPerfis.length > 0 && !XSelectedPerfilId) {
      setXSelectedPerfilId(XPerfis[0].perfil_id);
    }
  }, [XPerfis, XSelectedPerfilId]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadMenus(), reloadForms(), reloadBotoes(), reloadCampos()]);
  }, [reloadMenus, reloadForms, reloadBotoes, reloadCampos]);

  // --- MENUS ---
  const handleToggleMenuVisivel = useCallback(async (XMenu: IAcessoMenu) => {
    const { error } = await supabase.from("perfil_acesso_menu")
      .update({ fl_visivel: !XMenu.fl_visivel })
      .eq("perfil_acesso_menu_id", XMenu.perfil_acesso_menu_id);
    if (error) { toast.error(error.message); return; }
    await reloadMenus();
  }, [reloadMenus]);

  const handleAddMenu = useCallback(async (XNmMenu: string, XNmMenuPai: string | null) => {
    if (!XSelectedPerfilId) return;
    const XExists = XMenus.find(m => m.nm_menu === XNmMenu);
    if (XExists) { toast.info("Menu já cadastrado"); return; }
    const { error } = await supabase.from("perfil_acesso_menu").insert({
      empresa_id: XEmpresaId,
      perfil_id: XSelectedPerfilId,
      nm_menu: XNmMenu,
      nm_menu_pai: XNmMenuPai,
      fl_visivel: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Menu adicionado");
    await reloadMenus();
  }, [XSelectedPerfilId, XEmpresaId, XMenus, reloadMenus]);

  const handleCascadeMenu = useCallback(async (XNmMenuPai: string, XFlVisivel: boolean) => {
    if (!XSelectedPerfilId) return;
    if (!confirm(`Deseja processar em cascata? Todos os submenus de "${XNmMenuPai}" ficarão ${XFlVisivel ? "VISÍVEIS" : "INVISÍVEIS"}.`)) return;

    const XChildren = XSystemMenus.filter(m => m.nm_menu_pai === XNmMenuPai);
    for (const XChild of XChildren) {
      const XExisting = XMenus.find(m => m.nm_menu === XChild.nm_menu);
      if (XExisting) {
        await supabase.from("perfil_acesso_menu")
          .update({ fl_visivel: XFlVisivel })
          .eq("perfil_acesso_menu_id", XExisting.perfil_acesso_menu_id);
      } else {
        await supabase.from("perfil_acesso_menu").insert({
          empresa_id: XEmpresaId,
          perfil_id: XSelectedPerfilId,
          nm_menu: XChild.nm_menu,
          nm_menu_pai: XChild.nm_menu_pai,
          fl_visivel: XFlVisivel,
        });
      }
    }
    // Also update the parent
    const XParentExisting = XMenus.find(m => m.nm_menu === XNmMenuPai);
    if (XParentExisting) {
      await supabase.from("perfil_acesso_menu")
        .update({ fl_visivel: XFlVisivel })
        .eq("perfil_acesso_menu_id", XParentExisting.perfil_acesso_menu_id);
    }

    toast.success("Processado em cascata");
    await reloadMenus();
  }, [XSelectedPerfilId, XEmpresaId, XMenus, reloadMenus]);

  // --- FORMULARIOS ---
  const handleAddForm = useCallback(async (XNmForm: string) => {
    if (!XSelectedPerfilId) return;
    const XExists = XForms.find(f => f.nm_formulario === XNmForm);
    if (XExists) { toast.info("Formulário já cadastrado"); return; }
    const { error } = await supabase.from("perfil_acesso_formulario").insert({
      empresa_id: XEmpresaId,
      perfil_id: XSelectedPerfilId,
      nm_formulario: XNmForm,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário adicionado");
    await reloadForms();
  }, [XSelectedPerfilId, XEmpresaId, XForms, reloadForms]);

  const handleToggleFormPerm = useCallback(async (XForm: IAcessoFormulario, XField: string, XValue: boolean) => {
    const { error } = await (supabase as any).from("perfil_acesso_formulario")
      .update({ [XField]: XValue } as any)
      .eq("perfil_acesso_formulario_id", XForm.perfil_acesso_formulario_id);
    if (error) { toast.error(error.message); return; }
    await reloadForms();
  }, [reloadForms]);

  // --- BOTOES ---
  const [XNewBotaoForm, setXNewBotaoForm] = useState("");
  const [XNewBotaoNome, setXNewBotaoNome] = useState("");

  const handleAddBotao = useCallback(async () => {
    if (!XSelectedPerfilId || !XNewBotaoForm || !XNewBotaoNome) return;
    const { error } = await supabase.from("perfil_acesso_botao").insert({
      empresa_id: XEmpresaId,
      perfil_id: XSelectedPerfilId,
      nm_formulario: XNewBotaoForm,
      nm_botao: XNewBotaoNome.trim().toUpperCase(),
      fl_editavel: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Botão adicionado");
    setXNewBotaoNome("");
    await reloadBotoes();
  }, [XSelectedPerfilId, XEmpresaId, XNewBotaoForm, XNewBotaoNome, reloadBotoes]);

  const handleToggleBotao = useCallback(async (XBotao: IAcessoBotao) => {
    const { error } = await supabase.from("perfil_acesso_botao")
      .update({ fl_editavel: !XBotao.fl_editavel })
      .eq("perfil_acesso_botao_id", XBotao.perfil_acesso_botao_id);
    if (error) { toast.error(error.message); return; }
    await reloadBotoes();
  }, [reloadBotoes]);

  // --- CAMPOS ---
  const [XNewCampoForm, setXNewCampoForm] = useState("");
  const [XNewCampoNome, setXNewCampoNome] = useState("");
  const [XNewCampoTipo, setXNewCampoTipo] = useState("EDITAVEL");

  const handleAddCampo = useCallback(async () => {
    if (!XSelectedPerfilId || !XNewCampoForm || !XNewCampoNome) return;
    const { error } = await supabase.from("perfil_acesso_campo").insert({
      empresa_id: XEmpresaId,
      perfil_id: XSelectedPerfilId,
      nm_formulario: XNewCampoForm,
      nm_campo: XNewCampoNome.trim().toUpperCase(),
      tp_editavel: XNewCampoTipo,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Campo adicionado");
    setXNewCampoNome("");
    await reloadCampos();
  }, [XSelectedPerfilId, XEmpresaId, XNewCampoForm, XNewCampoNome, XNewCampoTipo, reloadCampos]);

  const handleUpdateCampoTipo = useCallback(async (XCampo: IAcessoCampo, XTipo: string) => {
    const { error } = await supabase.from("perfil_acesso_campo")
      .update({ tp_editavel: XTipo })
      .eq("perfil_acesso_campo_id", XCampo.perfil_acesso_campo_id);
    if (error) { toast.error(error.message); return; }
    await reloadCampos();
  }, [reloadCampos]);

  const XSelectedPerfil = XPerfis.find(p => p.perfil_id === XSelectedPerfilId);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-toolbar-bg shrink-0 flex-wrap">
        <button onClick={reloadAll} className="p-1.5 rounded hover:bg-accent" title="Atualizar"><RefreshCw size={16} /></button>
        <div className="w-px h-5 bg-border" />
        <label className="text-sm font-medium">Perfil:</label>
        <select
          className="border border-input rounded px-2 py-1 text-sm bg-background"
          value={XSelectedPerfilId || ""}
          onChange={e => setXSelectedPerfilId(Number(e.target.value))}
        >
          <option value="">Selecione...</option>
          {XPerfis.map(p => (
            <option key={p.perfil_id} value={p.perfil_id}>{p.nm_perfil}{p.fl_administrador ? " (ADMIN)" : ""}</option>
          ))}
        </select>
        {XSelectedPerfil?.fl_administrador && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">ADMIN - Acesso Total</span>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["menus", "formularios", "botoes", "campos"] as const).map(s => (
          <button
            key={s}
            className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XActiveSection === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setXActiveSection(s)}
          >
            {s === "menus" ? "Menus" : s === "formularios" ? "Formulários" : s === "botoes" ? "Botões" : "Campos"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {!XSelectedPerfilId ? (
          <div className="text-center text-muted-foreground text-sm py-8">Selecione um perfil para configurar os acessos.</div>
        ) : XSelectedPerfil?.fl_administrador ? (
          <div className="text-center text-muted-foreground text-sm py-8">Perfil administrador tem acesso total. Não é necessário configurar permissões.</div>
        ) : (
          <>
            {/* MENUS SECTION */}
            {XActiveSection === "menus" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Por padrão, menus ficam <strong>invisíveis</strong>. Marque para tornar visível. Use cascata para aplicar a todos os submenus.</p>
                {XSystemMenus.filter(m => !m.nm_menu_pai).map(XParent => (
                  <div key={XParent.nm_menu} className="border border-border rounded">
                    <div className="flex items-center gap-2 p-2 bg-muted">
                      {(() => {
                        const XExisting = XMenus.find(m => m.nm_menu === XParent.nm_menu);
                        return (
                          <>
                            <input
                              type="checkbox"
                              checked={XExisting?.fl_visivel || false}
                              onChange={() => XExisting ? handleToggleMenuVisivel(XExisting) : handleAddMenu(XParent.nm_menu, null).then(() => {})}
                              className="rounded"
                            />
                            <span className="text-sm font-medium flex-1">{XParent.nm_menu}</span>
                            <button
                              className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-80"
                              onClick={() => handleCascadeMenu(XParent.nm_menu, !(XExisting?.fl_visivel || false))}
                              title="Processar em cascata"
                            >
                              Cascata
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    <div className="pl-6 py-1">
                      {XSystemMenus.filter(m => m.nm_menu_pai === XParent.nm_menu).map(XChild => {
                        const XExisting = XMenus.find(m => m.nm_menu === XChild.nm_menu);
                        return (
                          <div key={XChild.nm_menu} className="flex items-center gap-2 py-1 px-2">
                            <input
                              type="checkbox"
                              checked={XExisting?.fl_visivel || false}
                              onChange={() => XExisting ? handleToggleMenuVisivel(XExisting) : handleAddMenu(XChild.nm_menu, XChild.nm_menu_pai)}
                              className="rounded"
                            />
                            <span className="text-sm">{XChild.nm_menu}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FORMULARIOS SECTION */}
            {XActiveSection === "formularios" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">Por padrão, formulários só permitem <strong>visualizar</strong>. Marque para liberar operações.</p>
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-grid-header text-grid-header-foreground">
                      <th className="text-left p-2">Formulário</th>
                      <th className="text-center p-2 w-20">Visualizar</th>
                      <th className="text-center p-2 w-20">Incluir</th>
                      <th className="text-center p-2 w-20">Alterar</th>
                      <th className="text-center p-2 w-20">Excluir</th>
                      <th className="text-center p-2 w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XSystemForms.map(XNm => {
                      const XExisting = XForms.find(f => f.nm_formulario === XNm);
                      return (
                        <tr key={XNm} className="border-t border-border hover:bg-accent/50">
                          <td className="p-2">{XNm}</td>
                          <td className="text-center p-2">
                            <input type="checkbox" checked={XExisting?.fl_visualizar ?? true} onChange={() => XExisting && handleToggleFormPerm(XExisting, "fl_visualizar", !XExisting.fl_visualizar)} disabled={!XExisting} className="rounded" />
                          </td>
                          <td className="text-center p-2">
                            <input type="checkbox" checked={XExisting?.fl_incluir ?? false} onChange={() => XExisting && handleToggleFormPerm(XExisting, "fl_incluir", !XExisting.fl_incluir)} disabled={!XExisting} className="rounded" />
                          </td>
                          <td className="text-center p-2">
                            <input type="checkbox" checked={XExisting?.fl_alterar ?? false} onChange={() => XExisting && handleToggleFormPerm(XExisting, "fl_alterar", !XExisting.fl_alterar)} disabled={!XExisting} className="rounded" />
                          </td>
                          <td className="text-center p-2">
                            <input type="checkbox" checked={XExisting?.fl_excluir_registro ?? false} onChange={() => XExisting && handleToggleFormPerm(XExisting, "fl_excluir_registro", !XExisting.fl_excluir_registro)} disabled={!XExisting} className="rounded" />
                          </td>
                          <td className="text-center p-2">
                            {!XExisting && (
                              <button onClick={() => handleAddForm(XNm)} className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground">Add</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* BOTOES SECTION */}
            {XActiveSection === "botoes" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">Por padrão, botões são <strong>editáveis</strong>. Desmarque para desabilitar.</p>
                <div className="flex items-center gap-2 mb-3">
                  <select className="border border-input rounded px-2 py-1 text-sm bg-background" value={XNewBotaoForm} onChange={e => setXNewBotaoForm(e.target.value)}>
                    <option value="">Formulário...</option>
                    {XSystemForms.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input className="border border-input rounded px-2 py-1 text-sm bg-background" placeholder="Nome do botão" value={XNewBotaoNome} onChange={e => setXNewBotaoNome(e.target.value)} />
                  <button onClick={handleAddBotao} disabled={!XNewBotaoForm || !XNewBotaoNome} className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40"><Plus size={14} /></button>
                </div>
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-grid-header text-grid-header-foreground">
                      <th className="text-left p-2">Formulário</th>
                      <th className="text-left p-2">Botão</th>
                      <th className="text-center p-2 w-24">Editável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XBotoes.map(b => (
                      <tr key={b.perfil_acesso_botao_id} className="border-t border-border hover:bg-accent/50">
                        <td className="p-2">{b.nm_formulario}</td>
                        <td className="p-2">{b.nm_botao}</td>
                        <td className="text-center p-2">
                          <input type="checkbox" checked={b.fl_editavel} onChange={() => handleToggleBotao(b)} className="rounded" />
                        </td>
                      </tr>
                    ))}
                    {XBotoes.length === 0 && <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">Nenhum botão cadastrado</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* CAMPOS SECTION */}
            {XActiveSection === "campos" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">Sem configuração = campo <strong>editável</strong>. Configure restrições conforme necessário.</p>
                <div className="flex items-center gap-2 mb-3">
                  <select className="border border-input rounded px-2 py-1 text-sm bg-background" value={XNewCampoForm} onChange={e => setXNewCampoForm(e.target.value)}>
                    <option value="">Formulário...</option>
                    {XSystemForms.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input className="border border-input rounded px-2 py-1 text-sm bg-background" placeholder="Nome do campo" value={XNewCampoNome} onChange={e => setXNewCampoNome(e.target.value)} />
                  <select className="border border-input rounded px-2 py-1 text-sm bg-background" value={XNewCampoTipo} onChange={e => setXNewCampoTipo(e.target.value)}>
                    <option value="EDITAVEL">Editável</option>
                    <option value="NAO_EDITAVEL">Não Editável</option>
                    <option value="EDITAVEL_INCLUSAO">Editável na Inclusão</option>
                    <option value="EDITAVEL_ALTERACAO">Editável na Alteração</option>
                  </select>
                  <button onClick={handleAddCampo} disabled={!XNewCampoForm || !XNewCampoNome} className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40"><Plus size={14} /></button>
                </div>
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-grid-header text-grid-header-foreground">
                      <th className="text-left p-2">Formulário</th>
                      <th className="text-left p-2">Campo</th>
                      <th className="text-left p-2 w-48">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XCampos.map(c => (
                      <tr key={c.perfil_acesso_campo_id} className="border-t border-border hover:bg-accent/50">
                        <td className="p-2">{c.nm_formulario}</td>
                        <td className="p-2">{c.nm_campo}</td>
                        <td className="p-2">
                          <select
                            className="border border-input rounded px-2 py-0.5 text-sm bg-background w-full"
                            value={c.tp_editavel}
                            onChange={e => handleUpdateCampoTipo(c, e.target.value)}
                          >
                            <option value="EDITAVEL">Editável</option>
                            <option value="NAO_EDITAVEL">Não Editável</option>
                            <option value="EDITAVEL_INCLUSAO">Editável na Inclusão</option>
                            <option value="EDITAVEL_ALTERACAO">Editável na Alteração</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {XCampos.length === 0 && <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">Nenhum campo cadastrado</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ControleAcessoForm;

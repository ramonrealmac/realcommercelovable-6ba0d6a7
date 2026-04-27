// Data types and mock store for the application

export interface IEmpresa {
  EMPRESA_ID: number;
  NM_RAZAO_SOCIAL: string;
}

export interface IGrupo {
  EMPRESA_ID: number;
  GRUPO_ID: number;
  NM_GRUPO: string;
  FL_EXCLUIDO: boolean;
}

export interface ISubgrupo {
  EMPRESA_ID: number;
  GRUPO_ID: number;
  SUBGRUPO_ID: number;
  NM_SUBGRUPO: string;
  FL_EXCLUIDO: boolean;
}

// Initial mock data
const XEmpresas: IEmpresa[] = [
  { EMPRESA_ID: 1, NM_RAZAO_SOCIAL: "FERPARSA" },
  { EMPRESA_ID: 2, NM_RAZAO_SOCIAL: "EMPRESA TESTE" },
];

const XGrupos: IGrupo[] = [
  { EMPRESA_ID: 1, GRUPO_ID: 1, NM_GRUPO: "TESTE 1", FL_EXCLUIDO: false },
  { EMPRESA_ID: 1, GRUPO_ID: 2, NM_GRUPO: "TESTE 2", FL_EXCLUIDO: false },
  { EMPRESA_ID: 1, GRUPO_ID: 3, NM_GRUPO: "TESTE 3", FL_EXCLUIDO: true },
  { EMPRESA_ID: 2, GRUPO_ID: 1, NM_GRUPO: "GRUPO A", FL_EXCLUIDO: false },
];

const XSubgrupos: ISubgrupo[] = [
  { EMPRESA_ID: 1, GRUPO_ID: 2, SUBGRUPO_ID: 1, NM_SUBGRUPO: "SUBGRUPO1", FL_EXCLUIDO: false },
  { EMPRESA_ID: 1, GRUPO_ID: 2, SUBGRUPO_ID: 2, NM_SUBGRUPO: "SUBGRUPO2", FL_EXCLUIDO: false },
  { EMPRESA_ID: 1, GRUPO_ID: 1, SUBGRUPO_ID: 1, NM_SUBGRUPO: "SUB A", FL_EXCLUIDO: false },
];

// Simple in-memory store
class DataStore {
  empresas: IEmpresa[] = [...XEmpresas];
  grupos: IGrupo[] = [...XGrupos];
  subgrupos: ISubgrupo[] = [...XSubgrupos];

  private _nextGrupoId(XEmpresaId: number): number {
    const XGruposEmpresa = this.grupos.filter(g => g.EMPRESA_ID === XEmpresaId);
    return XGruposEmpresa.length > 0 ? Math.max(...XGruposEmpresa.map(g => g.GRUPO_ID)) + 1 : 1;
  }

  private _nextSubgrupoId(XEmpresaId: number, XGrupoId: number): number {
    const XSubs = this.subgrupos.filter(s => s.EMPRESA_ID === XEmpresaId && s.GRUPO_ID === XGrupoId);
    return XSubs.length > 0 ? Math.max(...XSubs.map(s => s.SUBGRUPO_ID)) + 1 : 1;
  }

  getEmpresas(): IEmpresa[] {
    return this.empresas;
  }

  getGrupos(XEmpresaId: number, XExcluidoVisivel: boolean = false): IGrupo[] {
    return this.grupos.filter(g =>
      g.EMPRESA_ID === XEmpresaId && (XExcluidoVisivel || !g.FL_EXCLUIDO)
    );
  }

  getSubgrupos(XEmpresaId: number, XGrupoId: number, XExcluidoVisivel: boolean = false): ISubgrupo[] {
    return this.subgrupos.filter(s =>
      s.EMPRESA_ID === XEmpresaId && s.GRUPO_ID === XGrupoId && (XExcluidoVisivel || !s.FL_EXCLUIDO)
    );
  }

  addGrupo(XEmpresaId: number, XNmGrupo: string): IGrupo {
    const XNew: IGrupo = {
      EMPRESA_ID: XEmpresaId,
      GRUPO_ID: this._nextGrupoId(XEmpresaId),
      NM_GRUPO: XNmGrupo,
      FL_EXCLUIDO: false,
    };
    this.grupos.push(XNew);
    return XNew;
  }

  updateGrupo(XEmpresaId: number, XGrupoId: number, XNmGrupo: string): void {
    const XIdx = this.grupos.findIndex(g => g.EMPRESA_ID === XEmpresaId && g.GRUPO_ID === XGrupoId);
    if (XIdx >= 0) this.grupos[XIdx].NM_GRUPO = XNmGrupo;
  }

  deleteGrupo(XEmpresaId: number, XGrupoId: number): void {
    const XIdx = this.grupos.findIndex(g => g.EMPRESA_ID === XEmpresaId && g.GRUPO_ID === XGrupoId);
    if (XIdx >= 0) this.grupos[XIdx].FL_EXCLUIDO = true;
  }

  addSubgrupo(XEmpresaId: number, XGrupoId: number, XNmSubgrupo: string): ISubgrupo {
    const XNew: ISubgrupo = {
      EMPRESA_ID: XEmpresaId,
      GRUPO_ID: XGrupoId,
      SUBGRUPO_ID: this._nextSubgrupoId(XEmpresaId, XGrupoId),
      NM_SUBGRUPO: XNmSubgrupo,
      FL_EXCLUIDO: false,
    };
    this.subgrupos.push(XNew);
    return XNew;
  }

  updateSubgrupo(XEmpresaId: number, XGrupoId: number, XSubgrupoId: number, XNmSubgrupo: string): void {
    const XIdx = this.subgrupos.findIndex(s =>
      s.EMPRESA_ID === XEmpresaId && s.GRUPO_ID === XGrupoId && s.SUBGRUPO_ID === XSubgrupoId
    );
    if (XIdx >= 0) this.subgrupos[XIdx].NM_SUBGRUPO = XNmSubgrupo;
  }

  deleteSubgrupo(XEmpresaId: number, XGrupoId: number, XSubgrupoId: number): void {
    const XIdx = this.subgrupos.findIndex(s =>
      s.EMPRESA_ID === XEmpresaId && s.GRUPO_ID === XGrupoId && s.SUBGRUPO_ID === XSubgrupoId
    );
    if (XIdx >= 0) this.subgrupos[XIdx].FL_EXCLUIDO = true;
  }
}

export const dataStore = new DataStore();

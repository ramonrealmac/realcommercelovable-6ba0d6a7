import React from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";

export const MdfCondutorTab: React.FC<{ mdfManifestoId: number; empresaId: number; podeEditar: boolean }> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho primeiro.</div>;

  return (
    <div className="h-[400px]">
      <StandardCrudForm
        config={{
          XTableName: "fiscal_mdf_motorista",
          XPrimaryKey: "mdf_motorista_id",
          XTitle: "CondutorTab",
          XEmpresaId: empresaId,
          XSoftDelete: true,
          XParentField: "mdf_manifesto_id",
          XParentId: mdfManifestoId,
          XDefaultRecord: {condutor_id: 0},
          XOnBeforeSave: (rec) => ({ ...rec, mdf_manifesto_id: mdfManifestoId, empresa_id: empresaId })
        }}
        XGridCols={[{key:"condutor_id", label:"ID Condutor", width:"100px"}]}
        renderCadastro={({ record, setField, mode, isEditing }) => {
          const ro = !isEditing || !podeEditar;
          return (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Preencha os dados abaixo.</p>
              {/* Dynamic rendering based on default keys */}
              {Object.keys({condutor_id: 0}).map(k => (
                <div key={k}>
                  <label className="text-xs font-medium">{k}</label>
                  <input readOnly={ro} className="w-full border p-1 rounded text-sm" value={record[k] ?? ""} onChange={e => setField(k, e.target.value)} />
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
};


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abate: {
        Row: {
          abate_id: number
          cadastro_id: number
          data: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_fim_realizado: string | null
          dt_inicio: string | null
          empresa_id: number
          excluido: boolean | null
          lote_id: number
          peso_mortalidade: number | null
          peso_prod: number | null
          ps_previsto: number | null
          ps_realizado: number | null
          qt_faltas: number | null
          qt_funcionarios: number | null
          qt_mortalidade: number | null
          qt_prevista: number | null
          qt_problema: number | null
          qt_realizada: number | null
          tempo_parado: number | null
          tempo_realizado: number | null
          tempo_redvel: number | null
          turno: string | null
        }
        Insert: {
          abate_id: number
          cadastro_id: number
          data: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_fim_realizado?: string | null
          dt_inicio?: string | null
          empresa_id: number
          excluido?: boolean | null
          lote_id: number
          peso_mortalidade?: number | null
          peso_prod?: number | null
          ps_previsto?: number | null
          ps_realizado?: number | null
          qt_faltas?: number | null
          qt_funcionarios?: number | null
          qt_mortalidade?: number | null
          qt_prevista?: number | null
          qt_problema?: number | null
          qt_realizada?: number | null
          tempo_parado?: number | null
          tempo_realizado?: number | null
          tempo_redvel?: number | null
          turno?: string | null
        }
        Update: {
          abate_id?: number
          cadastro_id?: number
          data?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_fim_realizado?: string | null
          dt_inicio?: string | null
          empresa_id?: number
          excluido?: boolean | null
          lote_id?: number
          peso_mortalidade?: number | null
          peso_prod?: number | null
          ps_previsto?: number | null
          ps_realizado?: number | null
          qt_faltas?: number | null
          qt_funcionarios?: number | null
          qt_mortalidade?: number | null
          qt_prevista?: number | null
          qt_problema?: number | null
          qt_realizada?: number | null
          tempo_parado?: number | null
          tempo_realizado?: number | null
          tempo_redvel?: number | null
          turno?: string | null
        }
        Relationships: []
      }
      abate_entrada: {
        Row: {
          abate_entrada_id: number
          abate_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: string
          excluido: boolean | null
          placa: string | null
          ps_previsto: number | null
          ps_realizado: number | null
          qt_prevista: number | null
          qt_realizada: number | null
        }
        Insert: {
          abate_entrada_id: number
          abate_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: string
          excluido?: boolean | null
          placa?: string | null
          ps_previsto?: number | null
          ps_realizado?: number | null
          qt_prevista?: number | null
          qt_realizada?: number | null
        }
        Update: {
          abate_entrada_id?: number
          abate_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: string
          excluido?: boolean | null
          placa?: string | null
          ps_previsto?: number | null
          ps_realizado?: number | null
          qt_prevista?: number | null
          qt_realizada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_abate_entrada"
            columns: ["abate_id"]
            isOneToOne: false
            referencedRelation: "abate"
            referencedColumns: ["abate_id"]
          },
        ]
      }
      abate_mortalidade: {
        Row: {
          abate_id: number
          data: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mortalidade_id: number
          motivo_id: number | null
          peso: number | null
          quantidade: number | null
        }
        Insert: {
          abate_id: number
          data?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mortalidade_id: number
          motivo_id?: number | null
          peso?: number | null
          quantidade?: number | null
        }
        Update: {
          abate_id?: number
          data?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mortalidade_id?: number
          motivo_id?: number | null
          peso?: number | null
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_abate_mortalidade"
            columns: ["abate_id"]
            isOneToOne: false
            referencedRelation: "abate"
            referencedColumns: ["abate_id"]
          },
        ]
      }
      abate_mortalidade_motivo: {
        Row: {
          descricao_id: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          excluido: boolean | null
          motivo_id: number
          setor: string | null
        }
        Insert: {
          descricao_id?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          motivo_id?: number
          setor?: string | null
        }
        Update: {
          descricao_id?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          motivo_id?: number
          setor?: string | null
        }
        Relationships: []
      }
      abate_problema: {
        Row: {
          abate_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          inicio: string | null
          pc_reducao: number | null
          problema_id: number
          qt_reducao: number | null
          tempo: number | null
          termino: string | null
          tp_problema: string | null
        }
        Insert: {
          abate_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          inicio?: string | null
          pc_reducao?: number | null
          problema_id: number
          qt_reducao?: number | null
          tempo?: number | null
          termino?: string | null
          tp_problema?: string | null
        }
        Update: {
          abate_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          inicio?: string | null
          pc_reducao?: number | null
          problema_id?: number
          qt_reducao?: number | null
          tempo?: number | null
          termino?: string | null
          tp_problema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_abate_problema"
            columns: ["empresa_id", "abate_id"]
            isOneToOne: false
            referencedRelation: "abate"
            referencedColumns: ["empresa_id", "abate_id"]
          },
        ]
      }
      abate_producao: {
        Row: {
          abate_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          pc_chile: number
          producao_id: number
          produto_id: number
          ps_producao: number
        }
        Insert: {
          abate_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          pc_chile: number
          producao_id: number
          produto_id: number
          ps_producao: number
        }
        Update: {
          abate_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          pc_chile?: number
          producao_id?: number
          produto_id?: number
          ps_producao?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_abate_producao"
            columns: ["abate_id"]
            isOneToOne: false
            referencedRelation: "abate"
            referencedColumns: ["abate_id"]
          },
        ]
      }
      agendamento: {
        Row: {
          agendamento_id: number
          convenio_id: number | null
          dt_agendamento: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_inclusao: string
          empresa_id: number | null
          excluido: boolean | null
          funcionario_id: number | null
          hs_agendamento: string
          hs_inclusao: string | null
          ob_agendamento: string | null
          origem: string | null
          paciente_id: number
          procedimento_id: number
          profissional_id: number
          vl_agendamento: number
        }
        Insert: {
          agendamento_id: number
          convenio_id?: number | null
          dt_agendamento: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_inclusao: string
          empresa_id?: number | null
          excluido?: boolean | null
          funcionario_id?: number | null
          hs_agendamento: string
          hs_inclusao?: string | null
          ob_agendamento?: string | null
          origem?: string | null
          paciente_id: number
          procedimento_id: number
          profissional_id: number
          vl_agendamento: number
        }
        Update: {
          agendamento_id?: number
          convenio_id?: number | null
          dt_agendamento?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_inclusao?: string
          empresa_id?: number | null
          excluido?: boolean | null
          funcionario_id?: number | null
          hs_agendamento?: string
          hs_inclusao?: string | null
          ob_agendamento?: string | null
          origem?: string | null
          paciente_id?: number
          procedimento_id?: number
          profissional_id?: number
          vl_agendamento?: number
        }
        Relationships: []
      }
      agendamento_financeiro: {
        Row: {
          agendamento_financeiro_id: number
          agendamento_id: number
          condicao_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nr_autorizacao: string
          portador_id: number
          vl_agendamento: number
        }
        Insert: {
          agendamento_financeiro_id: number
          agendamento_id: number
          condicao_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          nr_autorizacao: string
          portador_id: number
          vl_agendamento: number
        }
        Update: {
          agendamento_financeiro_id?: number
          agendamento_id?: number
          condicao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nr_autorizacao?: string
          portador_id?: number
          vl_agendamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_agendamento_financeiro"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamento"
            referencedColumns: ["agendamento_id"]
          },
        ]
      }
      agendamento_proc_split: {
        Row: {
          agendamento_proc_split_id: number
          agendamento_split_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          especialidade_id: number
          excluido: boolean | null
          plano_id: number
          profissional_id: number
          vl_split: number
        }
        Insert: {
          agendamento_proc_split_id: number
          agendamento_split_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          especialidade_id: number
          excluido?: boolean | null
          plano_id: number
          profissional_id: number
          vl_split: number
        }
        Update: {
          agendamento_proc_split_id?: number
          agendamento_split_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          especialidade_id?: number
          excluido?: boolean | null
          plano_id?: number
          profissional_id?: number
          vl_split?: number
        }
        Relationships: []
      }
      agendamento_procedimento: {
        Row: {
          agendamento_id: number | null
          agendamento_procedimento_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number | null
          excluido: boolean | null
          procedimento_id: number | null
          vl_procedimento: number | null
          vl_split: number | null
        }
        Insert: {
          agendamento_id?: number | null
          agendamento_procedimento_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
          excluido?: boolean | null
          procedimento_id?: number | null
          vl_procedimento?: number | null
          vl_split?: number | null
        }
        Update: {
          agendamento_id?: number | null
          agendamento_procedimento_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
          excluido?: boolean | null
          procedimento_id?: number | null
          vl_procedimento?: number | null
          vl_split?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_agendamento_procedimento"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamento"
            referencedColumns: ["agendamento_id"]
          },
        ]
      }
      auditoria: {
        Row: {
          id: number
          xacao: string
          xdados_anteriores: Json | null
          xdados_novos: Json | null
          xdt_auditoria: string | null
          xip: string
          xobs: string
          xregistro_id: string
          xtabela: string
          xusuario_id: string | null
        }
        Insert: {
          id?: number
          xacao: string
          xdados_anteriores?: Json | null
          xdados_novos?: Json | null
          xdt_auditoria?: string | null
          xip?: string
          xobs?: string
          xregistro_id: string
          xtabela: string
          xusuario_id?: string | null
        }
        Update: {
          id?: number
          xacao?: string
          xdados_anteriores?: Json | null
          xdados_novos?: Json | null
          xdt_auditoria?: string | null
          xip?: string
          xobs?: string
          xregistro_id?: string
          xtabela?: string
          xusuario_id?: string | null
        }
        Relationships: []
      }
      balanca: {
        Row: {
          baubrate: string | null
          co2_max: number | null
          co2_min: number | null
          comm: string | null
          databits: string | null
          delayemerro: number | null
          delaynormal: number | null
          parity: string | null
          stopbits: string | null
          temp_max: number | null
          temp_min: number | null
          tempo_granja: number | null
          tempo_refresh: number | null
          umid_max: number | null
          umid_min: number | null
        }
        Insert: {
          baubrate?: string | null
          co2_max?: number | null
          co2_min?: number | null
          comm?: string | null
          databits?: string | null
          delayemerro?: number | null
          delaynormal?: number | null
          parity?: string | null
          stopbits?: string | null
          temp_max?: number | null
          temp_min?: number | null
          tempo_granja?: number | null
          tempo_refresh?: number | null
          umid_max?: number | null
          umid_min?: number | null
        }
        Update: {
          baubrate?: string | null
          co2_max?: number | null
          co2_min?: number | null
          comm?: string | null
          databits?: string | null
          delayemerro?: number | null
          delaynormal?: number | null
          parity?: string | null
          stopbits?: string | null
          temp_max?: number | null
          temp_min?: number | null
          tempo_granja?: number | null
          tempo_refresh?: number | null
          umid_max?: number | null
          umid_min?: number | null
        }
        Relationships: []
      }
      banco: {
        Row: {
          banco_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          razao_social: string
        }
        Insert: {
          banco_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          razao_social?: string
        }
        Update: {
          banco_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          razao_social?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      bandeira: {
        Row: {
          bandeira_id: number
          descricao: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          excluido: boolean | null
        }
        Insert: {
          bandeira_id: number
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
        }
        Update: {
          bandeira_id?: number
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
        }
        Relationships: []
      }
      boleto: {
        Row: {
          agencia_dv: string | null
          agencia_numero: string | null
          banco: string | null
          beneficiario_bairro: string | null
          beneficiario_cep: string | null
          beneficiario_cod_cliente: string | null
          beneficiario_documento: string | null
          beneficiario_email: string | null
          beneficiario_logomarca: string | null
          beneficiario_logradouro: string | null
          beneficiario_municipio: string | null
          beneficiario_nome: string | null
          beneficiario_telefone: string | null
          beneficiario_uf: string | null
          bol_id: number
          carteira: string | null
          carteira_modalidade: string | null
          carteira_tipo: string | null
          conta_corrente_dv: string | null
          conta_corrente_numero: string | null
          desconto_data_limite: string | null
          desconto_valor: number | null
          documento_data: string | null
          documento_especie: string | null
          documento_numero: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_processamento: string | null
          dt_vencimento: string | null
          empresa_id: number
          excluido: boolean | null
          financeiro_id: string | null
          instrucoes: string | null
          local_pagamento1: string | null
          local_pagamento2: string | null
          nosso_numero: string | null
          nosso_numero_dv: string | null
          pagador_bairro: string | null
          pagador_cep: string | null
          pagador_documento: string | null
          pagador_logradouro: string | null
          pagador_municipio: string | null
          pagador_nome: string | null
          pagador_uf: string | null
          valor_boleto: number | null
        }
        Insert: {
          agencia_dv?: string | null
          agencia_numero?: string | null
          banco?: string | null
          beneficiario_bairro?: string | null
          beneficiario_cep?: string | null
          beneficiario_cod_cliente?: string | null
          beneficiario_documento?: string | null
          beneficiario_email?: string | null
          beneficiario_logomarca?: string | null
          beneficiario_logradouro?: string | null
          beneficiario_municipio?: string | null
          beneficiario_nome?: string | null
          beneficiario_telefone?: string | null
          beneficiario_uf?: string | null
          bol_id?: number
          carteira?: string | null
          carteira_modalidade?: string | null
          carteira_tipo?: string | null
          conta_corrente_dv?: string | null
          conta_corrente_numero?: string | null
          desconto_data_limite?: string | null
          desconto_valor?: number | null
          documento_data?: string | null
          documento_especie?: string | null
          documento_numero?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_processamento?: string | null
          dt_vencimento?: string | null
          empresa_id: number
          excluido?: boolean | null
          financeiro_id?: string | null
          instrucoes?: string | null
          local_pagamento1?: string | null
          local_pagamento2?: string | null
          nosso_numero?: string | null
          nosso_numero_dv?: string | null
          pagador_bairro?: string | null
          pagador_cep?: string | null
          pagador_documento?: string | null
          pagador_logradouro?: string | null
          pagador_municipio?: string | null
          pagador_nome?: string | null
          pagador_uf?: string | null
          valor_boleto?: number | null
        }
        Update: {
          agencia_dv?: string | null
          agencia_numero?: string | null
          banco?: string | null
          beneficiario_bairro?: string | null
          beneficiario_cep?: string | null
          beneficiario_cod_cliente?: string | null
          beneficiario_documento?: string | null
          beneficiario_email?: string | null
          beneficiario_logomarca?: string | null
          beneficiario_logradouro?: string | null
          beneficiario_municipio?: string | null
          beneficiario_nome?: string | null
          beneficiario_telefone?: string | null
          beneficiario_uf?: string | null
          bol_id?: number
          carteira?: string | null
          carteira_modalidade?: string | null
          carteira_tipo?: string | null
          conta_corrente_dv?: string | null
          conta_corrente_numero?: string | null
          desconto_data_limite?: string | null
          desconto_valor?: number | null
          documento_data?: string | null
          documento_especie?: string | null
          documento_numero?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_processamento?: string | null
          dt_vencimento?: string | null
          empresa_id?: number
          excluido?: boolean | null
          financeiro_id?: string | null
          instrucoes?: string | null
          local_pagamento1?: string | null
          local_pagamento2?: string | null
          nosso_numero?: string | null
          nosso_numero_dv?: string | null
          pagador_bairro?: string | null
          pagador_cep?: string | null
          pagador_documento?: string | null
          pagador_logradouro?: string | null
          pagador_municipio?: string | null
          pagador_nome?: string | null
          pagador_uf?: string | null
          valor_boleto?: number | null
        }
        Relationships: []
      }
      cadastro: {
        Row: {
          cadastro_id: number
          cnpj: string
          condicao_id: number | null
          conj_cpf: string
          conj_dt_nasc: string | null
          conj_nome: string
          conj_telefone: string
          dep_cpf1: string
          dep_cpf2: string
          dep_cpf3: string
          dep_dt_nasc1: string | null
          dep_dt_nasc2: string | null
          dep_dt_nasc3: string | null
          dep_email1: string
          dep_email2: string
          dep_email3: string
          dep_grau_parent1: string
          dep_grau_parent2: string
          dep_nome1: string
          dep_nome2: string
          dep_nome3: string
          dep_st1: string | null
          dep_st2: string | null
          dep_st3: string | null
          dep_telefone1: string
          dep_telefone2: string
          dep_telefone3: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_nasc: string | null
          email: string
          empresa_id: number
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade_id: number | null
          endereco_compl: string
          endereco_logradouro: string
          endereco_numero: string
          endereco_ptoref: string
          estado_civil: string
          excluido: boolean | null
          fone_comercial: string
          fone_faturamento: string
          fone_financeiro: string
          fone_geral: string
          funcionario_id: number | null
          grupo_cadastro_id: number | null
          identificacao: string
          inscricao_estadual: string
          inscricao_municipal: string
          latitude: number | null
          longitude: number | null
          nacionalidade: string | null
          nome_curto: string
          nome_fantasia: string
          portador_id: number | null
          razao_social: string
          rg: string
          rota_id: number | null
          rota_seq: number
          st_cadastro: string | null
          st_cliente: string | null
          st_fornecedor: string | null
          st_transportador: string | null
          st_vendedor: string | null
          tabela_preco_id: number | null
          tipo_cadastro: string | null
          tp_cadastro_id: number | null
          tp_contribuinte: string | null
          tp_pessoa: string | null
        }
        Insert: {
          cadastro_id?: number
          cnpj?: string
          condicao_id?: number | null
          conj_cpf?: string
          conj_dt_nasc?: string | null
          conj_nome?: string
          conj_telefone?: string
          dep_cpf1?: string
          dep_cpf2?: string
          dep_cpf3?: string
          dep_dt_nasc1?: string | null
          dep_dt_nasc2?: string | null
          dep_dt_nasc3?: string | null
          dep_email1?: string
          dep_email2?: string
          dep_email3?: string
          dep_grau_parent1?: string
          dep_grau_parent2?: string
          dep_nome1?: string
          dep_nome2?: string
          dep_nome3?: string
          dep_st1?: string | null
          dep_st2?: string | null
          dep_st3?: string | null
          dep_telefone1?: string
          dep_telefone2?: string
          dep_telefone3?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_nasc?: string | null
          email?: string
          empresa_id?: number
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade_id?: number | null
          endereco_compl?: string
          endereco_logradouro?: string
          endereco_numero?: string
          endereco_ptoref?: string
          estado_civil?: string
          excluido?: boolean | null
          fone_comercial?: string
          fone_faturamento?: string
          fone_financeiro?: string
          fone_geral?: string
          funcionario_id?: number | null
          grupo_cadastro_id?: number | null
          identificacao?: string
          inscricao_estadual?: string
          inscricao_municipal?: string
          latitude?: number | null
          longitude?: number | null
          nacionalidade?: string | null
          nome_curto?: string
          nome_fantasia?: string
          portador_id?: number | null
          razao_social: string
          rg?: string
          rota_id?: number | null
          rota_seq?: number
          st_cadastro?: string | null
          st_cliente?: string | null
          st_fornecedor?: string | null
          st_transportador?: string | null
          st_vendedor?: string | null
          tabela_preco_id?: number | null
          tipo_cadastro?: string | null
          tp_cadastro_id?: number | null
          tp_contribuinte?: string | null
          tp_pessoa?: string | null
        }
        Update: {
          cadastro_id?: number
          cnpj?: string
          condicao_id?: number | null
          conj_cpf?: string
          conj_dt_nasc?: string | null
          conj_nome?: string
          conj_telefone?: string
          dep_cpf1?: string
          dep_cpf2?: string
          dep_cpf3?: string
          dep_dt_nasc1?: string | null
          dep_dt_nasc2?: string | null
          dep_dt_nasc3?: string | null
          dep_email1?: string
          dep_email2?: string
          dep_email3?: string
          dep_grau_parent1?: string
          dep_grau_parent2?: string
          dep_nome1?: string
          dep_nome2?: string
          dep_nome3?: string
          dep_st1?: string | null
          dep_st2?: string | null
          dep_st3?: string | null
          dep_telefone1?: string
          dep_telefone2?: string
          dep_telefone3?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_nasc?: string | null
          email?: string
          empresa_id?: number
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade_id?: number | null
          endereco_compl?: string
          endereco_logradouro?: string
          endereco_numero?: string
          endereco_ptoref?: string
          estado_civil?: string
          excluido?: boolean | null
          fone_comercial?: string
          fone_faturamento?: string
          fone_financeiro?: string
          fone_geral?: string
          funcionario_id?: number | null
          grupo_cadastro_id?: number | null
          identificacao?: string
          inscricao_estadual?: string
          inscricao_municipal?: string
          latitude?: number | null
          longitude?: number | null
          nacionalidade?: string | null
          nome_curto?: string
          nome_fantasia?: string
          portador_id?: number | null
          razao_social?: string
          rg?: string
          rota_id?: number | null
          rota_seq?: number
          st_cadastro?: string | null
          st_cliente?: string | null
          st_fornecedor?: string | null
          st_transportador?: string | null
          st_vendedor?: string | null
          tabela_preco_id?: number | null
          tipo_cadastro?: string | null
          tp_cadastro_id?: number | null
          tp_contribuinte?: string | null
          tp_pessoa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadastro_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      cadastro_grupo: {
        Row: {
          cadastro_grupo_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
        }
        Insert: {
          cadastro_grupo_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
        }
        Update: {
          cadastro_grupo_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadastro_grupo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      cadastro_preco: {
        Row: {
          cadastro_preco_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          pr_produto: number | null
          produto_id: number
        }
        Insert: {
          cadastro_preco_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          pr_produto?: number | null
          produto_id: number
        }
        Update: {
          cadastro_preco_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          pr_produto?: number | null
          produto_id?: number
        }
        Relationships: []
      }
      caixa_abertura: {
        Row: {
          caixa_abertura_id: number
          dt_abertura: string
          empresa_id: number
          funcionario_id: number
          status: string | null
          vl_abertura: number | null
          vl_fechamento: number | null
        }
        Insert: {
          caixa_abertura_id?: number
          dt_abertura: string
          empresa_id: number
          funcionario_id: number
          status?: string | null
          vl_abertura?: number | null
          vl_fechamento?: number | null
        }
        Update: {
          caixa_abertura_id?: number
          dt_abertura?: string
          empresa_id?: number
          funcionario_id?: number
          status?: string | null
          vl_abertura?: number | null
          vl_fechamento?: number | null
        }
        Relationships: []
      }
      caixa_movimento: {
        Row: {
          caixa_movimento_id: number
          centro_custo_id: number | null
          colaborador_id: number
          conta_gerencial_id: number | null
          documento: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_movimento: string | null
          empresa_id: number
          excluido: boolean | null
          funcionario_id: number
          historico: string | null
          movimento_id: number | null
          tp_movimento: string | null
          tp_operacao: string | null
          vlr_movimento: number | null
        }
        Insert: {
          caixa_movimento_id?: number
          centro_custo_id?: number | null
          colaborador_id: number
          conta_gerencial_id?: number | null
          documento?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_movimento?: string | null
          empresa_id: number
          excluido?: boolean | null
          funcionario_id: number
          historico?: string | null
          movimento_id?: number | null
          tp_movimento?: string | null
          tp_operacao?: string | null
          vlr_movimento?: number | null
        }
        Update: {
          caixa_movimento_id?: number
          centro_custo_id?: number | null
          colaborador_id?: number
          conta_gerencial_id?: number | null
          documento?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_movimento?: string | null
          empresa_id?: number
          excluido?: boolean | null
          funcionario_id?: number
          historico?: string | null
          movimento_id?: number | null
          tp_movimento?: string | null
          tp_operacao?: string | null
          vlr_movimento?: number | null
        }
        Relationships: []
      }
      caixa_movimento_item: {
        Row: {
          bandeira_id: number
          caixa_movimento_id: number
          caixa_movimento_item_id: number
          condicao_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          numero_autoriza: string | null
          operadora_id: number
          prazo_pagamento_id: number
          qt_parcela: number
          vl_parcela: number | null
          vl_recebido: number | null
        }
        Insert: {
          bandeira_id: number
          caixa_movimento_id?: number
          caixa_movimento_item_id: number
          condicao_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          numero_autoriza?: string | null
          operadora_id: number
          prazo_pagamento_id: number
          qt_parcela: number
          vl_parcela?: number | null
          vl_recebido?: number | null
        }
        Update: {
          bandeira_id?: number
          caixa_movimento_id?: number
          caixa_movimento_item_id?: number
          condicao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          numero_autoriza?: string | null
          operadora_id?: number
          prazo_pagamento_id?: number
          qt_parcela?: number
          vl_parcela?: number | null
          vl_recebido?: number | null
        }
        Relationships: []
      }
      cfop: {
        Row: {
          cd_cfop: string
          cfop_id: number
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          obs_produto: string | null
          obs_rodape: string | null
        }
        Insert: {
          cd_cfop: string
          cfop_id?: number
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          obs_produto?: string | null
          obs_rodape?: string | null
        }
        Update: {
          cd_cfop?: string
          cfop_id?: number
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          obs_produto?: string | null
          obs_rodape?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfop_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      cidade: {
        Row: {
          cd_ibge: string | null
          cidade_id: number
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          excluido: boolean | null
          uf: string | null
        }
        Insert: {
          cd_ibge?: string | null
          cidade_id?: number
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          uf?: string | null
        }
        Update: {
          cd_ibge?: string | null
          cidade_id?: number
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          uf?: string | null
        }
        Relationships: []
      }
      cidades: {
        Row: {
          cidade_id: string
          column_10: string | null
          column_4: string | null
          column_5: string | null
          column_6: string | null
          column_7: string | null
          column_8: string | null
          column_9: string | null
          descricao: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          excluido: boolean | null
          ibge: string | null
          uf: string | null
        }
        Insert: {
          cidade_id: string
          column_10?: string | null
          column_4?: string | null
          column_5?: string | null
          column_6?: string | null
          column_7?: string | null
          column_8?: string | null
          column_9?: string | null
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          ibge?: string | null
          uf?: string | null
        }
        Update: {
          cidade_id?: string
          column_10?: string | null
          column_4?: string | null
          column_5?: string | null
          column_6?: string | null
          column_7?: string | null
          column_8?: string | null
          column_9?: string | null
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          excluido?: boolean | null
          ibge?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      clas_trib: {
        Row: {
          ativo: boolean | null
          bc_legal: string | null
          clas_trib_id: string
          created_at: string | null
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          grupo_ibscbs_id: number | null
        }
        Insert: {
          ativo?: boolean | null
          bc_legal?: string | null
          clas_trib_id: string
          created_at?: string | null
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          grupo_ibscbs_id?: number | null
        }
        Update: {
          ativo?: boolean | null
          bc_legal?: string | null
          clas_trib_id?: string
          created_at?: string | null
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          grupo_ibscbs_id?: number | null
        }
        Relationships: []
      }
      comissao: {
        Row: {
          cadastro_id: number | null
          comissao_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          pc_comis_av: number | null
          pc_comis_pr: number | null
          tp_comissao: string | null
        }
        Insert: {
          cadastro_id?: number | null
          comissao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          pc_comis_av?: number | null
          pc_comis_pr?: number | null
          tp_comissao?: string | null
        }
        Update: {
          cadastro_id?: number | null
          comissao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          pc_comis_av?: number | null
          pc_comis_pr?: number | null
          tp_comissao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comissao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      condicao: {
        Row: {
          ativo_entrada: string | null
          ativo_parcelado: string | null
          concede_desconto: string | null
          condicao_id: number
          conta_id: string | null
          descricao: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          exibicao: string | null
          pc_acrescimo: number | null
          pc_juros: number | null
          pc_multa: number | null
          prazo_01: number | null
          prazo_02: number | null
          prazo_03: number | null
          prazo_04: number | null
          prazo_05: number | null
          prazo_06: number | null
          prazo_07: number | null
          prazo_08: number | null
          prazo_09: number | null
          prazo_10: number | null
          prazo_11: number | null
          prazo_12: number | null
          prazo_13: number | null
          prazo_14: number | null
          prazo_15: number | null
          prazo_16: number | null
          prazo_17: number | null
          prazo_18: number | null
          prazo_19: number | null
          prazo_20: number | null
          prazo_21: number | null
          prazo_22: number | null
          prazo_23: number | null
          prazo_24: number | null
          qt_parcelas: number | null
          tp_documento: number
        }
        Insert: {
          ativo_entrada?: string | null
          ativo_parcelado?: string | null
          concede_desconto?: string | null
          condicao_id?: number
          conta_id?: string | null
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          exibicao?: string | null
          pc_acrescimo?: number | null
          pc_juros?: number | null
          pc_multa?: number | null
          prazo_01?: number | null
          prazo_02?: number | null
          prazo_03?: number | null
          prazo_04?: number | null
          prazo_05?: number | null
          prazo_06?: number | null
          prazo_07?: number | null
          prazo_08?: number | null
          prazo_09?: number | null
          prazo_10?: number | null
          prazo_11?: number | null
          prazo_12?: number | null
          prazo_13?: number | null
          prazo_14?: number | null
          prazo_15?: number | null
          prazo_16?: number | null
          prazo_17?: number | null
          prazo_18?: number | null
          prazo_19?: number | null
          prazo_20?: number | null
          prazo_21?: number | null
          prazo_22?: number | null
          prazo_23?: number | null
          prazo_24?: number | null
          qt_parcelas?: number | null
          tp_documento: number
        }
        Update: {
          ativo_entrada?: string | null
          ativo_parcelado?: string | null
          concede_desconto?: string | null
          condicao_id?: number
          conta_id?: string | null
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          exibicao?: string | null
          pc_acrescimo?: number | null
          pc_juros?: number | null
          pc_multa?: number | null
          prazo_01?: number | null
          prazo_02?: number | null
          prazo_03?: number | null
          prazo_04?: number | null
          prazo_05?: number | null
          prazo_06?: number | null
          prazo_07?: number | null
          prazo_08?: number | null
          prazo_09?: number | null
          prazo_10?: number | null
          prazo_11?: number | null
          prazo_12?: number | null
          prazo_13?: number | null
          prazo_14?: number | null
          prazo_15?: number | null
          prazo_16?: number | null
          prazo_17?: number | null
          prazo_18?: number | null
          prazo_19?: number | null
          prazo_20?: number | null
          prazo_21?: number | null
          prazo_22?: number | null
          prazo_23?: number | null
          prazo_24?: number | null
          qt_parcelas?: number | null
          tp_documento?: number
        }
        Relationships: []
      }
      condicao_pagamento: {
        Row: {
          condicao_id: number
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          intervalo: number | null
          prazo_1: number | null
          prazo_10: number
          prazo_11: number
          prazo_12: number
          prazo_2: number
          prazo_3: number
          prazo_4: number
          prazo_5: number
          prazo_6: number
          prazo_7: number
          prazo_8: number
          prazo_9: number
          qtd_parcelas: number | null
          tipo_prazo: string | null
        }
        Insert: {
          condicao_id?: number
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          intervalo?: number | null
          prazo_1?: number | null
          prazo_10?: number
          prazo_11?: number
          prazo_12?: number
          prazo_2?: number
          prazo_3?: number
          prazo_4?: number
          prazo_5?: number
          prazo_6?: number
          prazo_7?: number
          prazo_8?: number
          prazo_9?: number
          qtd_parcelas?: number | null
          tipo_prazo?: string | null
        }
        Update: {
          condicao_id?: number
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          intervalo?: number | null
          prazo_1?: number | null
          prazo_10?: number
          prazo_11?: number
          prazo_12?: number
          prazo_2?: number
          prazo_3?: number
          prazo_4?: number
          prazo_5?: number
          prazo_6?: number
          prazo_7?: number
          prazo_8?: number
          prazo_9?: number
          qtd_parcelas?: number | null
          tipo_prazo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condicao_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      configura_nf: {
        Row: {
          ambiente_mdf: string | null
          ambiente_nfce: string | null
          ambiente_nfe: string | null
          certificado: string | null
          contingencia_mdf: string | null
          contingencia_nfce: string | null
          contingencia_nfe: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          licenca: string | null
          licenca_mdf: string | null
          modelo_mdf: string | null
          modelo_nfce: string | null
          modelo_nfe: string | null
          serie_mdf: string | null
          serie_nfce: string | null
          serie_nfe: string | null
          ti_emitente_mdf: number | null
          ultima_nfce: number | null
          ultima_nfe: number | null
          ultimo_mdf: number | null
          url_chave: string | null
          url_chaveh: string | null
          url_consulta: string | null
          url_consultah: string | null
          versao_mdf: string | null
          versao_nf: string | null
          webser_mdf: string | null
          webser_nfce: string | null
          webser_nfe: string | null
        }
        Insert: {
          ambiente_mdf?: string | null
          ambiente_nfce?: string | null
          ambiente_nfe?: string | null
          certificado?: string | null
          contingencia_mdf?: string | null
          contingencia_nfce?: string | null
          contingencia_nfe?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          licenca?: string | null
          licenca_mdf?: string | null
          modelo_mdf?: string | null
          modelo_nfce?: string | null
          modelo_nfe?: string | null
          serie_mdf?: string | null
          serie_nfce?: string | null
          serie_nfe?: string | null
          ti_emitente_mdf?: number | null
          ultima_nfce?: number | null
          ultima_nfe?: number | null
          ultimo_mdf?: number | null
          url_chave?: string | null
          url_chaveh?: string | null
          url_consulta?: string | null
          url_consultah?: string | null
          versao_mdf?: string | null
          versao_nf?: string | null
          webser_mdf?: string | null
          webser_nfce?: string | null
          webser_nfe?: string | null
        }
        Update: {
          ambiente_mdf?: string | null
          ambiente_nfce?: string | null
          ambiente_nfe?: string | null
          certificado?: string | null
          contingencia_mdf?: string | null
          contingencia_nfce?: string | null
          contingencia_nfe?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          licenca?: string | null
          licenca_mdf?: string | null
          modelo_mdf?: string | null
          modelo_nfce?: string | null
          modelo_nfe?: string | null
          serie_mdf?: string | null
          serie_nfce?: string | null
          serie_nfe?: string | null
          ti_emitente_mdf?: number | null
          ultima_nfce?: number | null
          ultima_nfe?: number | null
          ultimo_mdf?: number | null
          url_chave?: string | null
          url_chaveh?: string | null
          url_consulta?: string | null
          url_consultah?: string | null
          versao_mdf?: string | null
          versao_nf?: string | null
          webser_mdf?: string | null
          webser_nfce?: string | null
          webser_nfe?: string | null
        }
        Relationships: []
      }
      conta: {
        Row: {
          agencia_dv: string | null
          agencia_numero: string | null
          ambiente: string | null
          ativo: string | null
          banco_id: string
          beneficiario: string | null
          beneficiario_bairro: string | null
          beneficiario_cep: string | null
          beneficiario_cnpj: string | null
          beneficiario_cod_cliente: string | null
          beneficiario_documento: string | null
          beneficiario_email: string | null
          beneficiario_logadouro: string | null
          beneficiario_logo: string | null
          beneficiario_municipio: string | null
          beneficiario_nome: string | null
          beneficiario_telefone: string | null
          beneficiario_uf: string | null
          caminho_remessa: string | null
          carteira: string | null
          carteira_modalidade: string | null
          carteira_tipo: string | null
          cod_cedente: string | null
          conta_cobranca: string | null
          conta_corrente: string | null
          conta_dv: string | null
          conta_id: string
          convenio: string | null
          documento_especie: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          instrucoes: string | null
          local_pagamento1: string | null
          local_pagamento2: string | null
          nome_conta: string | null
          portador_id: number | null
          prx_nosso_numero: number | null
          prx_seq_remessa: number | null
          saldo: number | null
          token: string | null
        }
        Insert: {
          agencia_dv?: string | null
          agencia_numero?: string | null
          ambiente?: string | null
          ativo?: string | null
          banco_id: string
          beneficiario?: string | null
          beneficiario_bairro?: string | null
          beneficiario_cep?: string | null
          beneficiario_cnpj?: string | null
          beneficiario_cod_cliente?: string | null
          beneficiario_documento?: string | null
          beneficiario_email?: string | null
          beneficiario_logadouro?: string | null
          beneficiario_logo?: string | null
          beneficiario_municipio?: string | null
          beneficiario_nome?: string | null
          beneficiario_telefone?: string | null
          beneficiario_uf?: string | null
          caminho_remessa?: string | null
          carteira?: string | null
          carteira_modalidade?: string | null
          carteira_tipo?: string | null
          cod_cedente?: string | null
          conta_cobranca?: string | null
          conta_corrente?: string | null
          conta_dv?: string | null
          conta_id: string
          convenio?: string | null
          documento_especie?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          instrucoes?: string | null
          local_pagamento1?: string | null
          local_pagamento2?: string | null
          nome_conta?: string | null
          portador_id?: number | null
          prx_nosso_numero?: number | null
          prx_seq_remessa?: number | null
          saldo?: number | null
          token?: string | null
        }
        Update: {
          agencia_dv?: string | null
          agencia_numero?: string | null
          ambiente?: string | null
          ativo?: string | null
          banco_id?: string
          beneficiario?: string | null
          beneficiario_bairro?: string | null
          beneficiario_cep?: string | null
          beneficiario_cnpj?: string | null
          beneficiario_cod_cliente?: string | null
          beneficiario_documento?: string | null
          beneficiario_email?: string | null
          beneficiario_logadouro?: string | null
          beneficiario_logo?: string | null
          beneficiario_municipio?: string | null
          beneficiario_nome?: string | null
          beneficiario_telefone?: string | null
          beneficiario_uf?: string | null
          caminho_remessa?: string | null
          carteira?: string | null
          carteira_modalidade?: string | null
          carteira_tipo?: string | null
          cod_cedente?: string | null
          conta_cobranca?: string | null
          conta_corrente?: string | null
          conta_dv?: string | null
          conta_id?: string
          convenio?: string | null
          documento_especie?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          instrucoes?: string | null
          local_pagamento1?: string | null
          local_pagamento2?: string | null
          nome_conta?: string | null
          portador_id?: number | null
          prx_nosso_numero?: number | null
          prx_seq_remessa?: number | null
          saldo?: number | null
          token?: string | null
        }
        Relationships: []
      }
      convenio: {
        Row: {
          convenio_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number | null
          excluido: boolean | null
          nome: string
          plano_id: number | null
        }
        Insert: {
          convenio_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
          excluido?: boolean | null
          nome: string
          plano_id?: number | null
        }
        Update: {
          convenio_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
          excluido?: boolean | null
          nome?: string
          plano_id?: number | null
        }
        Relationships: []
      }
      corretora: {
        Row: {
          corretora_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
        }
        Insert: {
          corretora_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
        }
        Update: {
          corretora_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretora_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      deposito: {
        Row: {
          deposito_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          endereco: string
          excluido: boolean | null
          nome: string
          st_privado: boolean
        }
        Insert: {
          deposito_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          endereco?: string
          excluido?: boolean | null
          nome: string
          st_privado?: boolean
        }
        Update: {
          deposito_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          endereco?: string
          excluido?: boolean | null
          nome?: string
          st_privado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "deposito_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      empresa: {
        Row: {
          abacatepay_api_key: string | null
          abacatepay_webhook_secret: string | null
          abacatepay_webhook_url: string | null
          centro_custo_caixa: number
          cnpj: string
          conta_gerencial_caixa: number | null
          cor_botao: string | null
          cor_botao_negativo: string | null
          cor_destaque: string | null
          cor_fundo: string | null
          cor_fundo_card: string | null
          cor_header: string | null
          cor_link: string | null
          cor_menu: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_texto_principal: string | null
          cor_texto_secundario: string | null
          css_customizado: string | null
          deposito_estoque_caixa: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          email_remetente: string | null
          empresa_deposito_caixa: number | null
          empresa_id: number
          empresa_matriz_id: number | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade_id: number | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          excluido: boolean | null
          fone_comercial: string | null
          fone_faturamento: string | null
          fone_financeiro: string | null
          fone_geral: string | null
          identificacao: string | null
          ie: string | null
          imagem_caixa: string
          lg_valida_estoque_link: boolean | null
          lg_valida_estoque_pdv: boolean | null
          logomarca: string | null
          msg_pos_pagamento: string | null
          nm_escola: string | null
          nome_fantasia: string
          qt_saida_qt_decimais: number | null
          qt_venda_qt_decimais: number | null
          razao_social: string
          regime_trib: string | null
          tp_operacao_caixa: number
          url_banner_vendas: string | null
          url_favicon: string | null
          url_link_vendas: string | null
          url_logo: string | null
          valida_estoque: string | null
          vl_saida_qt_decimais: number | null
          vl_venda_qt_decimais: number | null
        }
        Insert: {
          abacatepay_api_key?: string | null
          abacatepay_webhook_secret?: string | null
          abacatepay_webhook_url?: string | null
          centro_custo_caixa?: number
          cnpj?: string
          conta_gerencial_caixa?: number | null
          cor_botao?: string | null
          cor_botao_negativo?: string | null
          cor_destaque?: string | null
          cor_fundo?: string | null
          cor_fundo_card?: string | null
          cor_header?: string | null
          cor_link?: string | null
          cor_menu?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto_principal?: string | null
          cor_texto_secundario?: string | null
          css_customizado?: string | null
          deposito_estoque_caixa?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          email_remetente?: string | null
          empresa_deposito_caixa?: number | null
          empresa_id?: number
          empresa_matriz_id?: number | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade_id?: number | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          excluido?: boolean | null
          fone_comercial?: string | null
          fone_faturamento?: string | null
          fone_financeiro?: string | null
          fone_geral?: string | null
          identificacao?: string | null
          ie?: string | null
          imagem_caixa?: string
          lg_valida_estoque_link?: boolean | null
          lg_valida_estoque_pdv?: boolean | null
          logomarca?: string | null
          msg_pos_pagamento?: string | null
          nm_escola?: string | null
          nome_fantasia?: string
          qt_saida_qt_decimais?: number | null
          qt_venda_qt_decimais?: number | null
          razao_social?: string
          regime_trib?: string | null
          tp_operacao_caixa?: number
          url_banner_vendas?: string | null
          url_favicon?: string | null
          url_link_vendas?: string | null
          url_logo?: string | null
          valida_estoque?: string | null
          vl_saida_qt_decimais?: number | null
          vl_venda_qt_decimais?: number | null
        }
        Update: {
          abacatepay_api_key?: string | null
          abacatepay_webhook_secret?: string | null
          abacatepay_webhook_url?: string | null
          centro_custo_caixa?: number
          cnpj?: string
          conta_gerencial_caixa?: number | null
          cor_botao?: string | null
          cor_botao_negativo?: string | null
          cor_destaque?: string | null
          cor_fundo?: string | null
          cor_fundo_card?: string | null
          cor_header?: string | null
          cor_link?: string | null
          cor_menu?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto_principal?: string | null
          cor_texto_secundario?: string | null
          css_customizado?: string | null
          deposito_estoque_caixa?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          email_remetente?: string | null
          empresa_deposito_caixa?: number | null
          empresa_id?: number
          empresa_matriz_id?: number | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade_id?: number | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          excluido?: boolean | null
          fone_comercial?: string | null
          fone_faturamento?: string | null
          fone_financeiro?: string | null
          fone_geral?: string | null
          identificacao?: string | null
          ie?: string | null
          imagem_caixa?: string
          lg_valida_estoque_link?: boolean | null
          lg_valida_estoque_pdv?: boolean | null
          logomarca?: string | null
          msg_pos_pagamento?: string | null
          nm_escola?: string | null
          nome_fantasia?: string
          qt_saida_qt_decimais?: number | null
          qt_venda_qt_decimais?: number | null
          razao_social?: string
          regime_trib?: string | null
          tp_operacao_caixa?: number
          url_banner_vendas?: string | null
          url_favicon?: string | null
          url_link_vendas?: string | null
          url_logo?: string | null
          valida_estoque?: string | null
          vl_saida_qt_decimais?: number | null
          vl_venda_qt_decimais?: number | null
        }
        Relationships: []
      }
      empresa_hs_lojavirtual: {
        Row: {
          dia_semana: number
          empresa_id: number | null
          excluido: boolean | null
          hr_fim_matutino: string | null
          hr_fim_noturno: string | null
          hr_fim_vespertino: string | null
          hr_inicio_matutino: string | null
          hr_inicio_noturno: string | null
          hr_inicio_vespertino: string | null
          id: number
          lg_dia_ativo: boolean | null
        }
        Insert: {
          dia_semana: number
          empresa_id?: number | null
          excluido?: boolean | null
          hr_fim_matutino?: string | null
          hr_fim_noturno?: string | null
          hr_fim_vespertino?: string | null
          hr_inicio_matutino?: string | null
          hr_inicio_noturno?: string | null
          hr_inicio_vespertino?: string | null
          id?: number
          lg_dia_ativo?: boolean | null
        }
        Update: {
          dia_semana?: number
          empresa_id?: number | null
          excluido?: boolean | null
          hr_fim_matutino?: string | null
          hr_fim_noturno?: string | null
          hr_fim_vespertino?: string | null
          hr_inicio_matutino?: string | null
          hr_inicio_noturno?: string | null
          hr_inicio_vespertino?: string | null
          id?: number
          lg_dia_ativo?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_empresa_hs_lojavirtual_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      empresa_usuario: {
        Row: {
          created_at: string
          empresa_id: number
          empresa_usuario_id: number
          fl_excluido: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          empresa_usuario_id?: number
          fl_excluido?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          empresa_usuario_id?: number
          fl_excluido?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estados: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          estado_id: string
          excluido: boolean | null
          icms_externo: number | null
          icms_interno: number | null
          pc_fcp: number | null
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id: string
          excluido?: boolean | null
          icms_externo?: number | null
          icms_interno?: number | null
          pc_fcp?: number | null
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id?: string
          excluido?: boolean | null
          icms_externo?: number | null
          icms_interno?: number | null
          pc_fcp?: number | null
        }
        Relationships: []
      }
      estoque: {
        Row: {
          deposito_id: number
          dt_alteracao: string | null
          dt_ult_entrada: string | null
          dt_ult_saida: string | null
          empresa_id: number
          endereco: string
          estoque_disponivel: number | null
          estoque_fisico: number | null
          estoque_id: number
          estoque_inventario: number | null
          estoque_minimo: number | null
          estoque_padrao: number | null
          estoque_reservado: number | null
          excluido: boolean | null
          produto_id: number
        }
        Insert: {
          deposito_id?: number
          dt_alteracao?: string | null
          dt_ult_entrada?: string | null
          dt_ult_saida?: string | null
          empresa_id?: number
          endereco?: string
          estoque_disponivel?: number | null
          estoque_fisico?: number | null
          estoque_id?: number
          estoque_inventario?: number | null
          estoque_minimo?: number | null
          estoque_padrao?: number | null
          estoque_reservado?: number | null
          excluido?: boolean | null
          produto_id: number
        }
        Update: {
          deposito_id?: number
          dt_alteracao?: string | null
          dt_ult_entrada?: string | null
          dt_ult_saida?: string | null
          empresa_id?: number
          endereco?: string
          estoque_disponivel?: number | null
          estoque_fisico?: number | null
          estoque_id?: number
          estoque_inventario?: number | null
          estoque_minimo?: number | null
          estoque_padrao?: number | null
          estoque_reservado?: number | null
          excluido?: boolean | null
          produto_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      fator_conversao: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          fator: number
          fator_conversao_id: number
          produto_id: number
          tp_movimento: string
          unidade_id: string
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          fator: number
          fator_conversao_id?: number
          produto_id: number
          tp_movimento: string
          unidade_id: string
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fator?: number
          fator_conversao_id?: number
          produto_id?: number
          tp_movimento?: string
          unidade_id?: string
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          cadastro_id: number | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_cancelamento: string | null
          dt_emissao: string | null
          dt_pagamento: string | null
          dt_vencimento: string
          empresa_id: number
          excluido: boolean | null
          financeiro_id: number
          movimento_id: number | null
          nr_documento: string
          nr_parcela: number | null
          observacao: string
          plano_conta_id: number | null
          portador_id: number | null
          st_financeiro: string | null
          tp_financeiro: string
          tp_pagamento: string
          vl_desconto: number | null
          vl_documento: number
          vl_juros: number | null
          vl_multa: number | null
          vl_pago: number | null
          vl_saldo: number | null
        }
        Insert: {
          cadastro_id?: number | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_pagamento?: string | null
          dt_vencimento: string
          empresa_id?: number
          excluido?: boolean | null
          financeiro_id?: number
          movimento_id?: number | null
          nr_documento?: string
          nr_parcela?: number | null
          observacao?: string
          plano_conta_id?: number | null
          portador_id?: number | null
          st_financeiro?: string | null
          tp_financeiro?: string
          tp_pagamento?: string
          vl_desconto?: number | null
          vl_documento?: number
          vl_juros?: number | null
          vl_multa?: number | null
          vl_pago?: number | null
          vl_saldo?: number | null
        }
        Update: {
          cadastro_id?: number | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_pagamento?: string | null
          dt_vencimento?: string
          empresa_id?: number
          excluido?: boolean | null
          financeiro_id?: number
          movimento_id?: number | null
          nr_documento?: string
          nr_parcela?: number | null
          observacao?: string
          plano_conta_id?: number | null
          portador_id?: number | null
          st_financeiro?: string | null
          tp_financeiro?: string
          tp_pagamento?: string
          vl_desconto?: number | null
          vl_documento?: number
          vl_juros?: number | null
          vl_multa?: number | null
          vl_pago?: number | null
          vl_saldo?: number | null
        }
        Relationships: []
      }
      financeiro_baixa: {
        Row: {
          dt_baixa: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          financeiro_baixa_id: number
          financeiro_id: number
          nr_autorizacao: string
          observacao: string
          tp_pagamento: string
          usuario_id: string | null
          vl_baixa: number
          vl_desconto: number | null
          vl_juros: number | null
          vl_multa: number | null
        }
        Insert: {
          dt_baixa?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          financeiro_baixa_id?: number
          financeiro_id: number
          nr_autorizacao?: string
          observacao?: string
          tp_pagamento?: string
          usuario_id?: string | null
          vl_baixa?: number
          vl_desconto?: number | null
          vl_juros?: number | null
          vl_multa?: number | null
        }
        Update: {
          dt_baixa?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          financeiro_baixa_id?: number
          financeiro_id?: number
          nr_autorizacao?: string
          observacao?: string
          tp_pagamento?: string
          usuario_id?: string | null
          vl_baixa?: number
          vl_desconto?: number | null
          vl_juros?: number | null
          vl_multa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_baixa_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["financeiro_id"]
          },
        ]
      }
      funcionario: {
        Row: {
          caixa: string | null
          caixa_cnc_venda: string | null
          caixa_edit_venda: string
          caixa_inf_vend: string | null
          corretora_id: number | null
          empresa_id: number | null
          entregador: string | null
          funcionario_id: number
          gerente: string | null
          motorista: string | null
          nome: string | null
          pc_comissao_av: number | null
          pc_comissao_prz: number | null
          tamanho_fonte_pedidos: number
          tamanho_fonte_produtos: number
          tempo_refresh_pdv: number
          tp_comissao: string | null
          usr_id: number | null
          vendedor: string | null
        }
        Insert: {
          caixa?: string | null
          caixa_cnc_venda?: string | null
          caixa_edit_venda?: string
          caixa_inf_vend?: string | null
          corretora_id?: number | null
          empresa_id?: number | null
          entregador?: string | null
          funcionario_id?: number
          gerente?: string | null
          motorista?: string | null
          nome?: string | null
          pc_comissao_av?: number | null
          pc_comissao_prz?: number | null
          tamanho_fonte_pedidos?: number
          tamanho_fonte_produtos?: number
          tempo_refresh_pdv?: number
          tp_comissao?: string | null
          usr_id?: number | null
          vendedor?: string | null
        }
        Update: {
          caixa?: string | null
          caixa_cnc_venda?: string | null
          caixa_edit_venda?: string
          caixa_inf_vend?: string | null
          corretora_id?: number | null
          empresa_id?: number | null
          entregador?: string | null
          funcionario_id?: number
          gerente?: string | null
          motorista?: string | null
          nome?: string | null
          pc_comissao_av?: number | null
          pc_comissao_prz?: number | null
          tamanho_fonte_pedidos?: number
          tamanho_fonte_produtos?: number
          tempo_refresh_pdv?: number
          tp_comissao?: string | null
          usr_id?: number | null
          vendedor?: string | null
        }
        Relationships: []
      }
      galpao_ambiencia: {
        Row: {
          abc_mq: string | null
          data_evento: string | null
          granja: string | null
          id: number
          origem: string | null
          pressao_bmp: number | null
          temperatura: number | null
          temperatura_bmp: number | null
          tensao_mq: number | null
          umidade: number | null
        }
        Insert: {
          abc_mq?: string | null
          data_evento?: string | null
          granja?: string | null
          id?: number
          origem?: string | null
          pressao_bmp?: number | null
          temperatura?: number | null
          temperatura_bmp?: number | null
          tensao_mq?: number | null
          umidade?: number | null
        }
        Update: {
          abc_mq?: string | null
          data_evento?: string | null
          granja?: string | null
          id?: number
          origem?: string | null
          pressao_bmp?: number | null
          temperatura?: number | null
          temperatura_bmp?: number | null
          tensao_mq?: number | null
          umidade?: number | null
        }
        Relationships: []
      }
      grupo_ibscbs: {
        Row: {
          cst_ibscbs: string | null
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_ibscbs_id: number
        }
        Insert: {
          cst_ibscbs?: string | null
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ibscbs_id?: number
        }
        Update: {
          cst_ibscbs?: string | null
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ibscbs_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_ibscbs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      grupo_icms: {
        Row: {
          crt: string | null
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_icms_id: number
        }
        Insert: {
          crt?: string | null
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_icms_id?: number
        }
        Update: {
          crt?: string | null
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_icms_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_icms_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      grupo_icms_item: {
        Row: {
          cfop: string | null
          cst: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_icms_id: number
          grupo_icms_item_id: number
          iva: number | null
          mob_bc_st: string | null
          ncm: string | null
          pc_fcp: number | null
          pc_fcpst: number | null
          pc_icms: number | null
          pc_icms_st: number | null
          pc_red_icmsst: number | null
          pc_reducao: number | null
          pc_st_debito: number | null
          regime_tributario: string | null
          ti_red_icms: string | null
          tp_contribuinte: string
          tp_movimento: string
          tp_operacao_id: number
          tp_saida: string
          uf_destino: string
        }
        Insert: {
          cfop?: string | null
          cst?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          grupo_icms_id: number
          grupo_icms_item_id: number
          iva?: number | null
          mob_bc_st?: string | null
          ncm?: string | null
          pc_fcp?: number | null
          pc_fcpst?: number | null
          pc_icms?: number | null
          pc_icms_st?: number | null
          pc_red_icmsst?: number | null
          pc_reducao?: number | null
          pc_st_debito?: number | null
          regime_tributario?: string | null
          ti_red_icms?: string | null
          tp_contribuinte: string
          tp_movimento: string
          tp_operacao_id: number
          tp_saida: string
          uf_destino: string
        }
        Update: {
          cfop?: string | null
          cst?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_icms_id?: number
          grupo_icms_item_id?: number
          iva?: number | null
          mob_bc_st?: string | null
          ncm?: string | null
          pc_fcp?: number | null
          pc_fcpst?: number | null
          pc_icms?: number | null
          pc_icms_st?: number | null
          pc_red_icmsst?: number | null
          pc_reducao?: number | null
          pc_st_debito?: number | null
          regime_tributario?: string | null
          ti_red_icms?: string | null
          tp_contribuinte?: string
          tp_movimento?: string
          tp_operacao_id?: number
          tp_saida?: string
          uf_destino?: string
        }
        Relationships: []
      }
      grupo_ipi: {
        Row: {
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_ipi_id: number
        }
        Insert: {
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ipi_id?: number
        }
        Update: {
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ipi_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_ipi_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      grupo_pis_cofins: {
        Row: {
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_pis_cofins_id: number
        }
        Insert: {
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_pis_cofins_id?: number
        }
        Update: {
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_pis_cofins_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_pis_cofins_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      linha_produto: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          linha_id: number
          nome: string
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          linha_id?: number
          nome: string
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          linha_id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "linha_produto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      meio_pagamento: {
        Row: {
          codigo: string | null
          descricao: string | null
          meio_pagamento_id: number
        }
        Insert: {
          codigo?: string | null
          descricao?: string | null
          meio_pagamento_id: number
        }
        Update: {
          codigo?: string | null
          descricao?: string | null
          meio_pagamento_id?: number
        }
        Relationships: []
      }
      meios_pagamento: {
        Row: {
          codigo: string | null
          descricao: string | null
          meios_pagamento_id: number
        }
        Insert: {
          codigo?: string | null
          descricao?: string | null
          meios_pagamento_id?: number
        }
        Update: {
          codigo?: string | null
          descricao?: string | null
          meios_pagamento_id?: number
        }
        Relationships: []
      }
      movimento: {
        Row: {
          aliq_icms: number | null
          altera_custo: string | null
          autenticacao: string | null
          bairro_entrega: string | null
          bc_icmsst: number | null
          cadastro_id: number | null
          cep_entrega: string | null
          cidade_id: number | null
          cnpj: string | null
          condicao_id: number | null
          condicao_unica: string | null
          deposito_id: number | null
          dt_cancelamento: string | null
          dt_emissao: string | null
          dt_entrega: string | null
          dt_faturamento: string | null
          dt_finalizacao: string | null
          dt_pagamento: string | null
          dt_validade: string | null
          email_entrega: string | null
          email_responsavel: string
          empresa_id: number
          excluido: boolean | null
          faturado: string | null
          funcionario_id: number | null
          gerou_financeiro: string
          hr_movimento: string
          id_transacao_abacatepay: string
          ind_pres: string | null
          lg_pagamento_online: boolean | null
          lg_pedido_link: boolean | null
          lg_pedido_pdv: boolean | null
          logradouro_entrega: string | null
          mensagem_contr_id: number | null
          mensagem_fisco_id: number | null
          minuta_id: number | null
          mod_frete: string | null
          modelo_nf: number | null
          mot_cancelamento: string
          motivo_cancelamento: string | null
          movimento_id: number
          nm_crianca: string
          nm_responsavel: string
          nota_fiscal_id: number | null
          nr_movimento: number | null
          nr_telefone_responsavel: string
          numero_entrega: string | null
          numero_nfe: string | null
          obs_pedido: string
          observacao: string
          observacao_nf: string | null
          pag_entrada: string | null
          pc_desconto: number | null
          pedido_origem_id: number | null
          peso_bruto: number | null
          peso_liquido: number | null
          produto_id: number | null
          qr_code_pagamento: string
          rota_id: number | null
          serie: number | null
          st_pedido: string | null
          status: string | null
          supervisor_id: number | null
          termo_adesao: string | null
          tp_comissao_id: number | null
          tp_desconto: string | null
          tp_documento_id: number | null
          tp_movimento: string | null
          tp_operacao_id: number | null
          tp_origem: string | null
          transportadora_id: number | null
          url_pagamento: string
          usuario_id: string | null
          veiculo_id: number | null
          vl_bc_cofins: number | null
          vl_bc_icms: number | null
          vl_bc_ipi: number | null
          vl_bc_iss: number | null
          vl_bc_pis: number | null
          vl_cofins: number | null
          vl_comissao: number | null
          vl_desc_rs: number | null
          vl_desconto: number | null
          vl_despesa: number | null
          vl_frete: number | null
          vl_icms: number | null
          vl_icmsst: number | null
          vl_ipi: number | null
          vl_iss: number | null
          vl_movimento: number | null
          vl_outro: number | null
          vl_pago: number | null
          vl_pis: number | null
          vl_produto: number | null
          vl_seguro: number | null
          vl_total_nota: number | null
        }
        Insert: {
          aliq_icms?: number | null
          altera_custo?: string | null
          autenticacao?: string | null
          bairro_entrega?: string | null
          bc_icmsst?: number | null
          cadastro_id?: number | null
          cep_entrega?: string | null
          cidade_id?: number | null
          cnpj?: string | null
          condicao_id?: number | null
          condicao_unica?: string | null
          deposito_id?: number | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_entrega?: string | null
          dt_faturamento?: string | null
          dt_finalizacao?: string | null
          dt_pagamento?: string | null
          dt_validade?: string | null
          email_entrega?: string | null
          email_responsavel?: string
          empresa_id?: number
          excluido?: boolean | null
          faturado?: string | null
          funcionario_id?: number | null
          gerou_financeiro?: string
          hr_movimento?: string
          id_transacao_abacatepay?: string
          ind_pres?: string | null
          lg_pagamento_online?: boolean | null
          lg_pedido_link?: boolean | null
          lg_pedido_pdv?: boolean | null
          logradouro_entrega?: string | null
          mensagem_contr_id?: number | null
          mensagem_fisco_id?: number | null
          minuta_id?: number | null
          mod_frete?: string | null
          modelo_nf?: number | null
          mot_cancelamento?: string
          motivo_cancelamento?: string | null
          movimento_id?: number
          nm_crianca?: string
          nm_responsavel?: string
          nota_fiscal_id?: number | null
          nr_movimento?: number | null
          nr_telefone_responsavel?: string
          numero_entrega?: string | null
          numero_nfe?: string | null
          obs_pedido?: string
          observacao?: string
          observacao_nf?: string | null
          pag_entrada?: string | null
          pc_desconto?: number | null
          pedido_origem_id?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          produto_id?: number | null
          qr_code_pagamento?: string
          rota_id?: number | null
          serie?: number | null
          st_pedido?: string | null
          status?: string | null
          supervisor_id?: number | null
          termo_adesao?: string | null
          tp_comissao_id?: number | null
          tp_desconto?: string | null
          tp_documento_id?: number | null
          tp_movimento?: string | null
          tp_operacao_id?: number | null
          tp_origem?: string | null
          transportadora_id?: number | null
          url_pagamento?: string
          usuario_id?: string | null
          veiculo_id?: number | null
          vl_bc_cofins?: number | null
          vl_bc_icms?: number | null
          vl_bc_ipi?: number | null
          vl_bc_iss?: number | null
          vl_bc_pis?: number | null
          vl_cofins?: number | null
          vl_comissao?: number | null
          vl_desc_rs?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_frete?: number | null
          vl_icms?: number | null
          vl_icmsst?: number | null
          vl_ipi?: number | null
          vl_iss?: number | null
          vl_movimento?: number | null
          vl_outro?: number | null
          vl_pago?: number | null
          vl_pis?: number | null
          vl_produto?: number | null
          vl_seguro?: number | null
          vl_total_nota?: number | null
        }
        Update: {
          aliq_icms?: number | null
          altera_custo?: string | null
          autenticacao?: string | null
          bairro_entrega?: string | null
          bc_icmsst?: number | null
          cadastro_id?: number | null
          cep_entrega?: string | null
          cidade_id?: number | null
          cnpj?: string | null
          condicao_id?: number | null
          condicao_unica?: string | null
          deposito_id?: number | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_entrega?: string | null
          dt_faturamento?: string | null
          dt_finalizacao?: string | null
          dt_pagamento?: string | null
          dt_validade?: string | null
          email_entrega?: string | null
          email_responsavel?: string
          empresa_id?: number
          excluido?: boolean | null
          faturado?: string | null
          funcionario_id?: number | null
          gerou_financeiro?: string
          hr_movimento?: string
          id_transacao_abacatepay?: string
          ind_pres?: string | null
          lg_pagamento_online?: boolean | null
          lg_pedido_link?: boolean | null
          lg_pedido_pdv?: boolean | null
          logradouro_entrega?: string | null
          mensagem_contr_id?: number | null
          mensagem_fisco_id?: number | null
          minuta_id?: number | null
          mod_frete?: string | null
          modelo_nf?: number | null
          mot_cancelamento?: string
          motivo_cancelamento?: string | null
          movimento_id?: number
          nm_crianca?: string
          nm_responsavel?: string
          nota_fiscal_id?: number | null
          nr_movimento?: number | null
          nr_telefone_responsavel?: string
          numero_entrega?: string | null
          numero_nfe?: string | null
          obs_pedido?: string
          observacao?: string
          observacao_nf?: string | null
          pag_entrada?: string | null
          pc_desconto?: number | null
          pedido_origem_id?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          produto_id?: number | null
          qr_code_pagamento?: string
          rota_id?: number | null
          serie?: number | null
          st_pedido?: string | null
          status?: string | null
          supervisor_id?: number | null
          termo_adesao?: string | null
          tp_comissao_id?: number | null
          tp_desconto?: string | null
          tp_documento_id?: number | null
          tp_movimento?: string | null
          tp_operacao_id?: number | null
          tp_origem?: string | null
          transportadora_id?: number | null
          url_pagamento?: string
          usuario_id?: string | null
          veiculo_id?: number | null
          vl_bc_cofins?: number | null
          vl_bc_icms?: number | null
          vl_bc_ipi?: number | null
          vl_bc_iss?: number | null
          vl_bc_pis?: number | null
          vl_cofins?: number | null
          vl_comissao?: number | null
          vl_desc_rs?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_frete?: number | null
          vl_icms?: number | null
          vl_icmsst?: number | null
          vl_ipi?: number | null
          vl_iss?: number | null
          vl_movimento?: number | null
          vl_outro?: number | null
          vl_pago?: number | null
          vl_pis?: number | null
          vl_produto?: number | null
          vl_seguro?: number | null
          vl_total_nota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimento_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastro"
            referencedColumns: ["cadastro_id"]
          },
          {
            foreignKeyName: "movimento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      movimento_item: {
        Row: {
          bc_icmsst: number | null
          cd_produto: string
          cest: string | null
          cfop_id: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          deposito_id: number | null
          empresa_id: number
          entrega: string | null
          excluido: boolean | null
          infad_produto: string | null
          lote: number | null
          movimento_id: number
          movimento_item_id: number
          nm_produto: string
          pc_aliq_icms: number | null
          pc_cofins: number | null
          pc_desconto: number | null
          pc_fcp: number | null
          pc_fcpst: number | null
          pc_icms: number | null
          pc_icmsst: number | null
          pc_ipi: number | null
          pc_iss: number | null
          pc_pis: number | null
          pc_red_icms: number | null
          pc_red_icmsst: number | null
          pedido_origem_id: number | null
          produto_id: number | null
          qt_movimento: number | null
          tp_desconto: string | null
          tp_movimento: string | null
          unidade_id: string | null
          vl_bc_cofins: number | null
          vl_bc_fcp: number | null
          vl_bc_fcpst: number | null
          vl_bc_icms: number | null
          vl_bc_ipi: number | null
          vl_bc_iss: number | null
          vl_bc_pis: number | null
          vl_cofins: number | null
          vl_custo: number | null
          vl_desc_rs: number | null
          vl_desconto: number | null
          vl_despesa: number | null
          vl_fcp: number | null
          vl_fcpst: number | null
          vl_frete: number | null
          vl_icms: number | null
          vl_icmsst: number | null
          vl_ipi: number | null
          vl_iss: number | null
          vl_movimento: number | null
          vl_outro: number | null
          vl_pis: number | null
          vl_produto: number | null
          vl_seguro: number | null
          vl_und_produto: number | null
        }
        Insert: {
          bc_icmsst?: number | null
          cd_produto?: string
          cest?: string | null
          cfop_id?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          deposito_id?: number | null
          empresa_id?: number
          entrega?: string | null
          excluido?: boolean | null
          infad_produto?: string | null
          lote?: number | null
          movimento_id: number
          movimento_item_id?: number
          nm_produto?: string
          pc_aliq_icms?: number | null
          pc_cofins?: number | null
          pc_desconto?: number | null
          pc_fcp?: number | null
          pc_fcpst?: number | null
          pc_icms?: number | null
          pc_icmsst?: number | null
          pc_ipi?: number | null
          pc_iss?: number | null
          pc_pis?: number | null
          pc_red_icms?: number | null
          pc_red_icmsst?: number | null
          pedido_origem_id?: number | null
          produto_id?: number | null
          qt_movimento?: number | null
          tp_desconto?: string | null
          tp_movimento?: string | null
          unidade_id?: string | null
          vl_bc_cofins?: number | null
          vl_bc_fcp?: number | null
          vl_bc_fcpst?: number | null
          vl_bc_icms?: number | null
          vl_bc_ipi?: number | null
          vl_bc_iss?: number | null
          vl_bc_pis?: number | null
          vl_cofins?: number | null
          vl_custo?: number | null
          vl_desc_rs?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_fcp?: number | null
          vl_fcpst?: number | null
          vl_frete?: number | null
          vl_icms?: number | null
          vl_icmsst?: number | null
          vl_ipi?: number | null
          vl_iss?: number | null
          vl_movimento?: number | null
          vl_outro?: number | null
          vl_pis?: number | null
          vl_produto?: number | null
          vl_seguro?: number | null
          vl_und_produto?: number | null
        }
        Update: {
          bc_icmsst?: number | null
          cd_produto?: string
          cest?: string | null
          cfop_id?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          deposito_id?: number | null
          empresa_id?: number
          entrega?: string | null
          excluido?: boolean | null
          infad_produto?: string | null
          lote?: number | null
          movimento_id?: number
          movimento_item_id?: number
          nm_produto?: string
          pc_aliq_icms?: number | null
          pc_cofins?: number | null
          pc_desconto?: number | null
          pc_fcp?: number | null
          pc_fcpst?: number | null
          pc_icms?: number | null
          pc_icmsst?: number | null
          pc_ipi?: number | null
          pc_iss?: number | null
          pc_pis?: number | null
          pc_red_icms?: number | null
          pc_red_icmsst?: number | null
          pedido_origem_id?: number | null
          produto_id?: number | null
          qt_movimento?: number | null
          tp_desconto?: string | null
          tp_movimento?: string | null
          unidade_id?: string | null
          vl_bc_cofins?: number | null
          vl_bc_fcp?: number | null
          vl_bc_fcpst?: number | null
          vl_bc_icms?: number | null
          vl_bc_ipi?: number | null
          vl_bc_iss?: number | null
          vl_bc_pis?: number | null
          vl_cofins?: number | null
          vl_custo?: number | null
          vl_desc_rs?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_fcp?: number | null
          vl_fcpst?: number | null
          vl_frete?: number | null
          vl_icms?: number | null
          vl_icmsst?: number | null
          vl_ipi?: number | null
          vl_iss?: number | null
          vl_movimento?: number | null
          vl_outro?: number | null
          vl_pis?: number | null
          vl_produto?: number | null
          vl_seguro?: number | null
          vl_und_produto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimento_item_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "movimento_item_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimento"
            referencedColumns: ["movimento_id"]
          },
        ]
      }
      movimento_pagamento: {
        Row: {
          bandeira_id: number | null
          condicao_id: number
          dt_fim: string | null
          dt_inicio: string | null
          dt_pagamento: string | null
          empresa_id: number
          excluido: boolean | null
          movimento_id: number
          movimento_pagamento_id: number
          n_parcelas: number | null
          nr_autorizacao: string
          numero_autorizacao: string | null
          obs_pagamento: string
          operadora_id: number | null
          tipo_recebimento: string | null
          tp_pagamento: string
          vl_pagamento: number | null
          vl_parcelas: number | null
          vl_total: number | null
        }
        Insert: {
          bandeira_id?: number | null
          condicao_id?: number
          dt_fim?: string | null
          dt_inicio?: string | null
          dt_pagamento?: string | null
          empresa_id?: number
          excluido?: boolean | null
          movimento_id: number
          movimento_pagamento_id?: number
          n_parcelas?: number | null
          nr_autorizacao?: string
          numero_autorizacao?: string | null
          obs_pagamento?: string
          operadora_id?: number | null
          tipo_recebimento?: string | null
          tp_pagamento: string
          vl_pagamento?: number | null
          vl_parcelas?: number | null
          vl_total?: number | null
        }
        Update: {
          bandeira_id?: number | null
          condicao_id?: number
          dt_fim?: string | null
          dt_inicio?: string | null
          dt_pagamento?: string | null
          empresa_id?: number
          excluido?: boolean | null
          movimento_id?: number
          movimento_pagamento_id?: number
          n_parcelas?: number | null
          nr_autorizacao?: string
          numero_autorizacao?: string | null
          obs_pagamento?: string
          operadora_id?: number | null
          tipo_recebimento?: string | null
          tp_pagamento?: string
          vl_pagamento?: number | null
          vl_parcelas?: number | null
          vl_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimento_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "movimento_pagamento_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimento"
            referencedColumns: ["movimento_id"]
          },
        ]
      }
      operadora: {
        Row: {
          cnpj: string | null
          empresa_id: number
          operadora_id: number
          razao: string | null
        }
        Insert: {
          cnpj?: string | null
          empresa_id: number
          operadora_id?: number
          razao?: string | null
        }
        Update: {
          cnpj?: string | null
          empresa_id?: number
          operadora_id?: number
          razao?: string | null
        }
        Relationships: []
      }
      parametro: {
        Row: {
          excluido: boolean | null
          id: number
          xabacatepay_api_key: string
          xabacatepay_webhook_secret: string
          xabacatepay_webhook_url: string
          xcor_botao: string | null
          xcor_botao_negativo: string | null
          xcor_destaque: string | null
          xcor_fundo: string | null
          xcor_fundo_card: string | null
          xcor_header: string | null
          xcor_link: string | null
          xcor_menu: string | null
          xcor_primaria: string | null
          xcor_secundaria: string | null
          xcor_texto_principal: string | null
          xcor_texto_secundario: string | null
          xcss_customizado: string
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xemail_remetente: string
          xlg_valida_estoque_link: boolean | null
          xlg_valida_estoque_pdv: boolean | null
          xmsg_pos_pagamento: string | null
          xnm_escola: string | null
          xurl_banner_vendas: string
          xurl_favicon: string
          xurl_link_vendas: string
          xurl_logo: string
        }
        Insert: {
          excluido?: boolean | null
          id?: number
          xabacatepay_api_key?: string
          xabacatepay_webhook_secret?: string
          xabacatepay_webhook_url?: string
          xcor_botao?: string | null
          xcor_botao_negativo?: string | null
          xcor_destaque?: string | null
          xcor_fundo?: string | null
          xcor_fundo_card?: string | null
          xcor_header?: string | null
          xcor_link?: string | null
          xcor_menu?: string | null
          xcor_primaria?: string | null
          xcor_secundaria?: string | null
          xcor_texto_principal?: string | null
          xcor_texto_secundario?: string | null
          xcss_customizado?: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xemail_remetente?: string
          xlg_valida_estoque_link?: boolean | null
          xlg_valida_estoque_pdv?: boolean | null
          xmsg_pos_pagamento?: string | null
          xnm_escola?: string | null
          xurl_banner_vendas?: string
          xurl_favicon?: string
          xurl_link_vendas?: string
          xurl_logo?: string
        }
        Update: {
          excluido?: boolean | null
          id?: number
          xabacatepay_api_key?: string
          xabacatepay_webhook_secret?: string
          xabacatepay_webhook_url?: string
          xcor_botao?: string | null
          xcor_botao_negativo?: string | null
          xcor_destaque?: string | null
          xcor_fundo?: string | null
          xcor_fundo_card?: string | null
          xcor_header?: string | null
          xcor_link?: string | null
          xcor_menu?: string | null
          xcor_primaria?: string | null
          xcor_secundaria?: string | null
          xcor_texto_principal?: string | null
          xcor_texto_secundario?: string | null
          xcss_customizado?: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xemail_remetente?: string
          xlg_valida_estoque_link?: boolean | null
          xlg_valida_estoque_pdv?: boolean | null
          xmsg_pos_pagamento?: string | null
          xnm_escola?: string | null
          xurl_banner_vendas?: string
          xurl_favicon?: string
          xurl_link_vendas?: string
          xurl_logo?: string
        }
        Relationships: []
      }
      perfil: {
        Row: {
          created_at: string
          empresa_id: number
          fl_administrador: boolean
          fl_excluido: boolean
          nm_perfil: string
          perfil_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_administrador?: boolean
          fl_excluido?: boolean
          nm_perfil: string
          perfil_id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_administrador?: boolean
          fl_excluido?: boolean
          nm_perfil?: string
          perfil_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      perfil_acesso_botao: {
        Row: {
          created_at: string
          empresa_id: number
          fl_editavel: boolean
          fl_excluido: boolean
          nm_botao: string
          nm_formulario: string
          perfil_acesso_botao_id: number
          perfil_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_editavel?: boolean
          fl_excluido?: boolean
          nm_botao: string
          nm_formulario: string
          perfil_acesso_botao_id?: number
          perfil_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_editavel?: boolean
          fl_excluido?: boolean
          nm_botao?: string
          nm_formulario?: string
          perfil_acesso_botao_id?: number
          perfil_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_botao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      perfil_acesso_campo: {
        Row: {
          created_at: string
          empresa_id: number
          fl_excluido: boolean
          nm_campo: string
          nm_formulario: string
          perfil_acesso_campo_id: number
          perfil_id: number
          tp_editavel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_excluido?: boolean
          nm_campo: string
          nm_formulario: string
          perfil_acesso_campo_id?: number
          perfil_id: number
          tp_editavel?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_excluido?: boolean
          nm_campo?: string
          nm_formulario?: string
          perfil_acesso_campo_id?: number
          perfil_id?: number
          tp_editavel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_campo_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      perfil_acesso_formulario: {
        Row: {
          created_at: string
          empresa_id: number
          fl_alterar: boolean
          fl_excluido: boolean
          fl_excluir_registro: boolean
          fl_incluir: boolean
          fl_visualizar: boolean
          nm_formulario: string
          perfil_acesso_formulario_id: number
          perfil_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_alterar?: boolean
          fl_excluido?: boolean
          fl_excluir_registro?: boolean
          fl_incluir?: boolean
          fl_visualizar?: boolean
          nm_formulario: string
          perfil_acesso_formulario_id?: number
          perfil_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_alterar?: boolean
          fl_excluido?: boolean
          fl_excluir_registro?: boolean
          fl_incluir?: boolean
          fl_visualizar?: boolean
          nm_formulario?: string
          perfil_acesso_formulario_id?: number
          perfil_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_formulario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      perfil_acesso_menu: {
        Row: {
          created_at: string
          empresa_id: number
          fl_excluido: boolean
          fl_visivel: boolean
          nm_menu: string
          nm_menu_pai: string | null
          perfil_acesso_menu_id: number
          perfil_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_excluido?: boolean
          fl_visivel?: boolean
          nm_menu: string
          nm_menu_pai?: string | null
          perfil_acesso_menu_id?: number
          perfil_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_excluido?: boolean
          fl_visivel?: boolean
          nm_menu?: string
          nm_menu_pai?: string | null
          perfil_acesso_menu_id?: number
          perfil_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_menu_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      perfil_horario: {
        Row: {
          created_at: string
          empresa_id: number
          fl_excluido: boolean
          fl_matutino: boolean
          fl_noturno: boolean
          fl_vespertino: boolean
          hr_matutino_fim: string | null
          hr_matutino_inicio: string | null
          hr_noturno_fim: string | null
          hr_noturno_inicio: string | null
          hr_vespertino_fim: string | null
          hr_vespertino_inicio: string | null
          nr_dia_semana: number
          perfil_horario_id: number
          perfil_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_excluido?: boolean
          fl_matutino?: boolean
          fl_noturno?: boolean
          fl_vespertino?: boolean
          hr_matutino_fim?: string | null
          hr_matutino_inicio?: string | null
          hr_noturno_fim?: string | null
          hr_noturno_inicio?: string | null
          hr_vespertino_fim?: string | null
          hr_vespertino_inicio?: string | null
          nr_dia_semana: number
          perfil_horario_id?: number
          perfil_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_excluido?: boolean
          fl_matutino?: boolean
          fl_noturno?: boolean
          fl_vespertino?: boolean
          hr_matutino_fim?: string | null
          hr_matutino_inicio?: string | null
          hr_noturno_fim?: string | null
          hr_noturno_inicio?: string | null
          hr_vespertino_fim?: string | null
          hr_vespertino_inicio?: string | null
          nr_dia_semana?: number
          perfil_horario_id?: number
          perfil_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_horario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      perfil_usuario: {
        Row: {
          created_at: string
          empresa_id: number
          fl_excluido: boolean
          perfil_id: number
          perfil_usuario_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          fl_excluido?: boolean
          perfil_id: number
          perfil_usuario_id?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          fl_excluido?: boolean
          perfil_id?: number
          perfil_usuario_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_usuario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
      plano_conta: {
        Row: {
          conta: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          plano_id: number
          tp_conta: string | null
          tp_natureza: string | null
        }
        Insert: {
          conta: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          plano_id?: number
          tp_conta?: string | null
          tp_natureza?: string | null
        }
        Update: {
          conta?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          plano_id?: number
          tp_conta?: string | null
          tp_natureza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_conta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      portador: {
        Row: {
          banco_id: number | null
          caminho_remessa: string
          conta_id: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          portador_id: number
        }
        Insert: {
          banco_id?: number | null
          caminho_remessa?: string
          conta_id?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          portador_id?: number
        }
        Update: {
          banco_id?: number | null
          caminho_remessa?: string
          conta_id?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          portador_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "portador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      produto: {
        Row: {
          altura: number
          area: number
          ativo: string | null
          cest: string
          comprimento: number
          controla_estoque: string | null
          descricao: string
          dias_venda_online: string | null
          ds_ecommerce: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          grupo_ibscbs_id: number | null
          grupo_icms_id: number | null
          grupo_ipi_id: number | null
          grupo_pis_cofins_id: number | null
          gtin: string
          largura: number
          linha_id: number | null
          mva: number
          ncm: string
          nm_ecommerce: string
          nome: string
          nome_reduzido: string
          pc_cofins: number
          pc_desconto: number
          pc_difal_sn: number
          pc_emb: number
          pc_fcp_st: number
          pc_frete: number
          pc_icms_cred: number
          pc_ipi: number
          pc_ipi_cred: number
          pc_markup: number | null
          pc_multiplicador: number
          pc_outras_desp: number
          pc_pis: number
          pc_seguro: number
          pc_st_trib: number
          peso_bruto: number
          peso_liquido: number
          preco_promocional: number | null
          preco_promocional_fat: number
          preco_sugerido: number | null
          preco_venda: number | null
          preco_venda_faturado: number
          produto_grupo_id: number | null
          produto_id: number
          produto_subgrupo_id: number | null
          referencia: string
          st_promo: string
          tb_a_origem: string
          tp_produto: string | null
          unidade_id: string | null
          url_foto: string
          venda_online: boolean | null
          vl_cofins: number
          vl_compra: number | null
          vl_custo: number
          vl_custo_medio: number
          vl_desconto: number
          vl_difal_sn: number
          vl_emb: number
          vl_fcp_st: number
          vl_frete: number
          vl_icms_cred: number
          vl_ipi: number
          vl_ipi_cred: number
          vl_multiplicador: number
          vl_outras_desp: number
          vl_outro: number
          vl_pis: number
          vl_seguro: number
          vl_st: number
        }
        Insert: {
          altura?: number
          area?: number
          ativo?: string | null
          cest?: string
          comprimento?: number
          controla_estoque?: string | null
          descricao?: string
          dias_venda_online?: string | null
          ds_ecommerce?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ibscbs_id?: number | null
          grupo_icms_id?: number | null
          grupo_ipi_id?: number | null
          grupo_pis_cofins_id?: number | null
          gtin?: string
          largura?: number
          linha_id?: number | null
          mva?: number
          ncm?: string
          nm_ecommerce?: string
          nome: string
          nome_reduzido?: string
          pc_cofins?: number
          pc_desconto?: number
          pc_difal_sn?: number
          pc_emb?: number
          pc_fcp_st?: number
          pc_frete?: number
          pc_icms_cred?: number
          pc_ipi?: number
          pc_ipi_cred?: number
          pc_markup?: number | null
          pc_multiplicador?: number
          pc_outras_desp?: number
          pc_pis?: number
          pc_seguro?: number
          pc_st_trib?: number
          peso_bruto?: number
          peso_liquido?: number
          preco_promocional?: number | null
          preco_promocional_fat?: number
          preco_sugerido?: number | null
          preco_venda?: number | null
          preco_venda_faturado?: number
          produto_grupo_id?: number | null
          produto_id?: number
          produto_subgrupo_id?: number | null
          referencia?: string
          st_promo?: string
          tb_a_origem?: string
          tp_produto?: string | null
          unidade_id?: string | null
          url_foto?: string
          venda_online?: boolean | null
          vl_cofins?: number
          vl_compra?: number | null
          vl_custo?: number
          vl_custo_medio?: number
          vl_desconto?: number
          vl_difal_sn?: number
          vl_emb?: number
          vl_fcp_st?: number
          vl_frete?: number
          vl_icms_cred?: number
          vl_ipi?: number
          vl_ipi_cred?: number
          vl_multiplicador?: number
          vl_outras_desp?: number
          vl_outro?: number
          vl_pis?: number
          vl_seguro?: number
          vl_st?: number
        }
        Update: {
          altura?: number
          area?: number
          ativo?: string | null
          cest?: string
          comprimento?: number
          controla_estoque?: string | null
          descricao?: string
          dias_venda_online?: string | null
          ds_ecommerce?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          grupo_ibscbs_id?: number | null
          grupo_icms_id?: number | null
          grupo_ipi_id?: number | null
          grupo_pis_cofins_id?: number | null
          gtin?: string
          largura?: number
          linha_id?: number | null
          mva?: number
          ncm?: string
          nm_ecommerce?: string
          nome?: string
          nome_reduzido?: string
          pc_cofins?: number
          pc_desconto?: number
          pc_difal_sn?: number
          pc_emb?: number
          pc_fcp_st?: number
          pc_frete?: number
          pc_icms_cred?: number
          pc_ipi?: number
          pc_ipi_cred?: number
          pc_markup?: number | null
          pc_multiplicador?: number
          pc_outras_desp?: number
          pc_pis?: number
          pc_seguro?: number
          pc_st_trib?: number
          peso_bruto?: number
          peso_liquido?: number
          preco_promocional?: number | null
          preco_promocional_fat?: number
          preco_sugerido?: number | null
          preco_venda?: number | null
          preco_venda_faturado?: number
          produto_grupo_id?: number | null
          produto_id?: number
          produto_subgrupo_id?: number | null
          referencia?: string
          st_promo?: string
          tb_a_origem?: string
          tp_produto?: string | null
          unidade_id?: string | null
          url_foto?: string
          venda_online?: boolean | null
          vl_cofins?: number
          vl_compra?: number | null
          vl_custo?: number
          vl_custo_medio?: number
          vl_desconto?: number
          vl_difal_sn?: number
          vl_emb?: number
          vl_fcp_st?: number
          vl_frete?: number
          vl_icms_cred?: number
          vl_ipi?: number
          vl_ipi_cred?: number
          vl_multiplicador?: number
          vl_outras_desp?: number
          vl_outro?: number
          vl_pis?: number
          vl_seguro?: number
          vl_st?: number
        }
        Relationships: []
      }
      produto_codbarra: {
        Row: {
          cod_barra: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          produto_codbarra_id: number
          produto_id: number
        }
        Insert: {
          cod_barra?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          produto_codbarra_id?: number
          produto_id: number
        }
        Update: {
          cod_barra?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          produto_codbarra_id?: number
          produto_id?: number
        }
        Relationships: []
      }
      produto_conversao: {
        Row: {
          conversao_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          fator_mult: number
          produto_id: number
          unidade_id: string
        }
        Insert: {
          conversao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fator_mult?: number
          produto_id: number
          unidade_id?: string
        }
        Update: {
          conversao_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fator_mult?: number
          produto_id?: number
          unidade_id?: string
        }
        Relationships: []
      }
      produto_grupo: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          produto_grupo_id: number
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          produto_grupo_id?: number
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          produto_grupo_id?: number
        }
        Relationships: []
      }
      produto_subgrupo: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          produto_grupo_id: number
          produto_subgrupo_id: number
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          produto_grupo_id: number
          produto_subgrupo_id?: number
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          produto_grupo_id?: number
          produto_subgrupo_id?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          ds_foto: string | null
          ds_login: string | null
          email: string | null
          id: string
          nm_usuario: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ds_foto?: string | null
          ds_login?: string | null
          email?: string | null
          id: string
          nm_usuario?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ds_foto?: string | null
          ds_login?: string | null
          email?: string | null
          id?: string
          nm_usuario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rb_conexao: {
        Row: {
          api_key: string
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
          rb_conexao_id: number
          url: string
        }
        Insert: {
          api_key?: string
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome: string
          rb_conexao_id?: number
          url?: string
        }
        Update: {
          api_key?: string
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
          rb_conexao_id?: number
          url?: string
        }
        Relationships: []
      }
      rb_relatorio: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          menu: string
          nome: string
          ordem: number | null
          query_sql: string
          rb_conexao_id: number | null
          rb_relatorio_id: number
          report_json: Json | null
          submenu: string
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          menu?: string
          nome: string
          ordem?: number | null
          query_sql?: string
          rb_conexao_id?: number | null
          rb_relatorio_id?: number
          report_json?: Json | null
          submenu?: string
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          menu?: string
          nome?: string
          ordem?: number | null
          query_sql?: string
          rb_conexao_id?: number | null
          rb_relatorio_id?: number
          report_json?: Json | null
          submenu?: string
        }
        Relationships: [
          {
            foreignKeyName: "rb_relatorio_rb_conexao_id_fkey"
            columns: ["rb_conexao_id"]
            isOneToOne: false
            referencedRelation: "rb_conexao"
            referencedColumns: ["rb_conexao_id"]
          },
        ]
      }
      rb_relatorio_variavel: {
        Row: {
          excluido: boolean | null
          operador: string
          rb_relatorio_id: number
          rb_relatorio_variavel_id: number
          rb_templatepesquisa_id: number
        }
        Insert: {
          excluido?: boolean | null
          operador?: string
          rb_relatorio_id: number
          rb_relatorio_variavel_id?: number
          rb_templatepesquisa_id: number
        }
        Update: {
          excluido?: boolean | null
          operador?: string
          rb_relatorio_id?: number
          rb_relatorio_variavel_id?: number
          rb_templatepesquisa_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rb_relatorio_variavel_rb_relatorio_id_fkey"
            columns: ["rb_relatorio_id"]
            isOneToOne: false
            referencedRelation: "rb_relatorio"
            referencedColumns: ["rb_relatorio_id"]
          },
          {
            foreignKeyName: "rb_relatorio_variavel_rb_templatepesquisa_id_fkey"
            columns: ["rb_templatepesquisa_id"]
            isOneToOne: false
            referencedRelation: "rb_templatepesquisa"
            referencedColumns: ["rb_templatepesquisa_id"]
          },
        ]
      }
      rb_templatepesquisa: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          label: string
          nome: string
          obrigatorio: boolean | null
          opcoes_fixas: string | null
          query: string | null
          rb_conexao_id: number | null
          rb_templatepesquisa_id: number
          tipo: string
          valor_padrao: string | null
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          label?: string
          nome: string
          obrigatorio?: boolean | null
          opcoes_fixas?: string | null
          query?: string | null
          rb_conexao_id?: number | null
          rb_templatepesquisa_id?: number
          tipo?: string
          valor_padrao?: string | null
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          label?: string
          nome?: string
          obrigatorio?: boolean | null
          opcoes_fixas?: string | null
          query?: string | null
          rb_conexao_id?: number | null
          rb_templatepesquisa_id?: number
          tipo?: string
          valor_padrao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rb_templatepesquisa_rb_conexao_id_fkey"
            columns: ["rb_conexao_id"]
            isOneToOne: false
            referencedRelation: "rb_conexao"
            referencedColumns: ["rb_conexao_id"]
          },
        ]
      }
      tp_operacao: {
        Row: {
          altera_estoque: string | null
          descricao: string
          empresa_id: number
          gera_boleto: string | null
          gera_financeiro: string | null
          gera_nf: string | null
          plano_id: number | null
          tp_movimento: string
          tp_operacao_id: number
          valida_preco: string | null
        }
        Insert: {
          altera_estoque?: string | null
          descricao?: string
          empresa_id?: number
          gera_boleto?: string | null
          gera_financeiro?: string | null
          gera_nf?: string | null
          plano_id?: number | null
          tp_movimento?: string
          tp_operacao_id?: number
          valida_preco?: string | null
        }
        Update: {
          altera_estoque?: string | null
          descricao?: string
          empresa_id?: number
          gera_boleto?: string | null
          gera_financeiro?: string | null
          gera_nf?: string | null
          plano_id?: number | null
          tp_movimento?: string
          tp_operacao_id?: number
          valida_preco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tp_operacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      unidade: {
        Row: {
          descricao: string | null
          empresa_id: number
          excluido: boolean | null
          unidade_id: string
        }
        Insert: {
          descricao?: string | null
          empresa_id?: number
          excluido?: boolean | null
          unidade_id?: string
        }
        Update: {
          descricao?: string | null
          empresa_id?: number
          excluido?: boolean | null
          unidade_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fu_form_permissao: {
        Args: { _empresa_id: number; _nm_formulario: string; _user_id: string }
        Returns: {
          fl_alterar: boolean
          fl_excluir_registro: boolean
          fl_incluir: boolean
          fl_visualizar: boolean
        }[]
      }
      fu_get_cliente_public: {
        Args: { _cpf: string }
        Returns: {
          dep_nome1: string
          fone_geral: string
          id: number
          razao_social: string
        }[]
      }
      fu_get_parametro_publico: {
        Args: never
        Returns: {
          id: number
          xcor_botao: string
          xcor_botao_negativo: string
          xcor_destaque: string
          xcor_fundo: string
          xcor_fundo_card: string
          xcor_header: string
          xcor_link: string
          xcor_menu: string
          xcor_primaria: string
          xcor_secundaria: string
          xcor_texto_principal: string
          xcor_texto_secundario: string
          xcss_customizado: string
          xlg_valida_estoque_link: boolean
          xlg_valida_estoque_pdv: boolean
          xmsg_pos_pagamento: string
          xnm_escola: string
          xurl_banner_vendas: string
          xurl_favicon: string
          xurl_link_vendas: string
          xurl_logo: string
        }[]
      }
      fu_get_pedido_status_public: {
        Args: { _cpf: string; _movimento_id: number }
        Returns: {
          dt_emissao: string
          id: number
          nr_movimento: number
          st_pedido: string
          url_pagamento: string
          vl_movimento: number
        }[]
      }
      fu_is_admin: {
        Args: { _empresa_id: number; _user_id: string }
        Returns: boolean
      }
      fu_list_pedidos_public: {
        Args: { _cpf: string }
        Returns: {
          dt_emissao: string
          id: number
          items: Json
          nr_movimento: number
          st_pedido: string
          vl_movimento: number
        }[]
      }
      fu_menu_visivel: {
        Args: { _empresa_id: number; _nm_menu: string; _user_id: string }
        Returns: boolean
      }
      fu_recalcular_pedido: {
        Args: { _movimento_id: number }
        Returns: undefined
      }
      fu_transition_pedido_status: {
        Args: {
          _movimento_id: number
          _novo_status: string
          _usuario_id?: string
        }
        Returns: Json
      }
      fu_upsert_cliente_public: {
        Args: {
          _cpf: string
          _filhos: string
          _nome: string
          _telefone: string
        }
        Returns: number
      }
      fu_user_in_empresa: {
        Args: { _empresa_id: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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
      aaaproduto_fornecedor: {
        Row: {
          cadastro_id: number
          cd_prod_fornec: string | null
          empresa_id: number
          fator_conv: number | null
          produto_fornecedor_id: number
          produto_id: number
          unidade_id: string | null
        }
        Insert: {
          cadastro_id?: number
          cd_prod_fornec?: string | null
          empresa_id?: number
          fator_conv?: number | null
          produto_fornecedor_id?: number
          produto_id?: number
          unidade_id?: string | null
        }
        Update: {
          cadastro_id?: number
          cd_prod_fornec?: string | null
          empresa_id?: number
          fator_conv?: number | null
          produto_fornecedor_id?: number
          produto_id?: number
          unidade_id?: string | null
        }
        Relationships: []
      }
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
          cd_banco: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nome: string
        }
        Insert: {
          banco_id?: number
          cd_banco?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
        }
        Update: {
          banco_id?: number
          cd_banco?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nome?: string
        }
        Relationships: []
      }
      bandeira: {
        Row: {
          bandeira_id: number
          descricao: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number | null
          excluido: boolean | null
        }
        Insert: {
          bandeira_id: number
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
          excluido?: boolean | null
        }
        Update: {
          bandeira_id?: number
          descricao?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number | null
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
          financeiro_id: number | null
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
          financeiro_id?: number | null
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
          financeiro_id?: number | null
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
          caixa_abertura_id: number | null
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
          vl_movimento: number | null
          vl_troco: number | null
        }
        Insert: {
          caixa_abertura_id?: number | null
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
          vl_movimento?: number | null
          vl_troco?: number | null
        }
        Update: {
          caixa_abertura_id?: number | null
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
          vl_movimento?: number | null
          vl_troco?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_caixa_movimento_abertura"
            columns: ["caixa_abertura_id"]
            isOneToOne: false
            referencedRelation: "caixa_abertura"
            referencedColumns: ["caixa_abertura_id"]
          },
        ]
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
          meio_pagamento_id: number | null
          numero_autoriza: string | null
          operadora_id: number
          plano_conta_id: number | null
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
          meio_pagamento_id?: number | null
          numero_autoriza?: string | null
          operadora_id: number
          plano_conta_id?: number | null
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
          meio_pagamento_id?: number | null
          numero_autoriza?: string | null
          operadora_id?: number
          plano_conta_id?: number | null
          prazo_pagamento_id?: number
          qt_parcela?: number
          vl_parcela?: number | null
          vl_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_caixa_movimento_item_movimento"
            columns: ["caixa_movimento_id"]
            isOneToOne: false
            referencedRelation: "caixa_movimento"
            referencedColumns: ["caixa_movimento_id"]
          },
        ]
      }
      centro_custo: {
        Row: {
          centro_custo_id: number
          empresa_id: number | null
          nome: string | null
        }
        Insert: {
          centro_custo_id?: never
          empresa_id?: number | null
          nome?: string | null
        }
        Update: {
          centro_custo_id?: never
          empresa_id?: number | null
          nome?: string | null
        }
        Relationships: []
      }
      cfop: {
        Row: {
          aplicacao: string | null
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
          aplicacao?: string | null
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
          aplicacao?: string | null
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
      chat_conversa: {
        Row: {
          chat_conversa_id: number
          ds_titulo: string
          dt_atualizacao: string
          dt_criacao: string
          empresa_id: number | null
          user_id: string
        }
        Insert: {
          chat_conversa_id?: number
          ds_titulo?: string
          dt_atualizacao?: string
          dt_criacao?: string
          empresa_id?: number | null
          user_id: string
        }
        Update: {
          chat_conversa_id?: number
          ds_titulo?: string
          dt_atualizacao?: string
          dt_criacao?: string
          empresa_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_mensagem: {
        Row: {
          chat_conversa_id: number
          chat_mensagem_id: number
          dados_acao: Json | null
          ds_anexo_tipo: string | null
          ds_anexo_url: string | null
          ds_audio_url: string | null
          ds_conteudo: string | null
          dt_criacao: string
          tp_acao: string | null
          tp_remetente: string
          user_id: string
        }
        Insert: {
          chat_conversa_id: number
          chat_mensagem_id?: number
          dados_acao?: Json | null
          ds_anexo_tipo?: string | null
          ds_anexo_url?: string | null
          ds_audio_url?: string | null
          ds_conteudo?: string | null
          dt_criacao?: string
          tp_acao?: string | null
          tp_remetente: string
          user_id: string
        }
        Update: {
          chat_conversa_id?: number
          chat_mensagem_id?: number
          dados_acao?: Json | null
          ds_anexo_tipo?: string | null
          ds_anexo_url?: string | null
          ds_audio_url?: string | null
          ds_conteudo?: string | null
          dt_criacao?: string
          tp_acao?: string | null
          tp_remetente?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagem_chat_conversa_id_fkey"
            columns: ["chat_conversa_id"]
            isOneToOne: false
            referencedRelation: "chat_conversa"
            referencedColumns: ["chat_conversa_id"]
          },
        ]
      }
      chat_sala: {
        Row: {
          chat_sala_id: number
          criado_por: string
          ds_nome: string | null
          dt_atualizacao: string
          dt_criacao: string
          empresa_id: number | null
          tp_sala: string
        }
        Insert: {
          chat_sala_id?: number
          criado_por: string
          ds_nome?: string | null
          dt_atualizacao?: string
          dt_criacao?: string
          empresa_id?: number | null
          tp_sala: string
        }
        Update: {
          chat_sala_id?: number
          criado_por?: string
          ds_nome?: string | null
          dt_atualizacao?: string
          dt_criacao?: string
          empresa_id?: number | null
          tp_sala?: string
        }
        Relationships: []
      }
      chat_sala_membro: {
        Row: {
          chat_sala_id: number
          chat_sala_membro_id: number
          dt_entrada: string
          dt_ultima_leitura: string
          user_id: string
        }
        Insert: {
          chat_sala_id: number
          chat_sala_membro_id?: number
          dt_entrada?: string
          dt_ultima_leitura?: string
          user_id: string
        }
        Update: {
          chat_sala_id?: number
          chat_sala_membro_id?: number
          dt_entrada?: string
          dt_ultima_leitura?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sala_membro_chat_sala_id_fkey"
            columns: ["chat_sala_id"]
            isOneToOne: false
            referencedRelation: "chat_sala"
            referencedColumns: ["chat_sala_id"]
          },
        ]
      }
      chat_sala_mensagem: {
        Row: {
          chat_sala_id: number
          chat_sala_mensagem_id: number
          ds_anexo_tipo: string | null
          ds_anexo_url: string | null
          ds_audio_url: string | null
          ds_conteudo: string | null
          dt_criacao: string
          user_id: string
        }
        Insert: {
          chat_sala_id: number
          chat_sala_mensagem_id?: number
          ds_anexo_tipo?: string | null
          ds_anexo_url?: string | null
          ds_audio_url?: string | null
          ds_conteudo?: string | null
          dt_criacao?: string
          user_id: string
        }
        Update: {
          chat_sala_id?: number
          chat_sala_mensagem_id?: number
          ds_anexo_tipo?: string | null
          ds_anexo_url?: string | null
          ds_audio_url?: string | null
          ds_conteudo?: string | null
          dt_criacao?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sala_mensagem_chat_sala_id_fkey"
            columns: ["chat_sala_id"]
            isOneToOne: false
            referencedRelation: "chat_sala"
            referencedColumns: ["chat_sala_id"]
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
          estado_id: string | null
          excluido: boolean | null
        }
        Insert: {
          cd_ibge?: string | null
          cidade_id?: number
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id?: string | null
          excluido?: boolean | null
        }
        Update: {
          cd_ibge?: string | null
          cidade_id?: number
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id?: string | null
          excluido?: boolean | null
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
      condicao_pagamento: {
        Row: {
          condicao_id: number
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          intervalo: number | null
          meio_pagamento_id: number | null
          plano_conta_id: number | null
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
          meio_pagamento_id?: number | null
          plano_conta_id?: number | null
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
          meio_pagamento_id?: number | null
          plano_conta_id?: number | null
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
          cor_input_borda: string | null
          cor_input_fundo: string | null
          cor_input_label: string | null
          cor_input_readonly: string | null
          cor_link: string | null
          cor_menu: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_texto_principal: string | null
          cor_texto_secundario: string | null
          css_customizado: string | null
          deposito_estoque_caixa: number
          dfe_maxnsu_busca: number | null
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
          pc_fcp_empresa: number | null
          pc_icms_interestadual: number | null
          qt_saida_qt_decimais: number | null
          qt_venda_qt_decimais: number | null
          razao_social: string
          regime_trib: string | null
          tempo_animacao: number
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
          cor_input_borda?: string | null
          cor_input_fundo?: string | null
          cor_input_label?: string | null
          cor_input_readonly?: string | null
          cor_link?: string | null
          cor_menu?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto_principal?: string | null
          cor_texto_secundario?: string | null
          css_customizado?: string | null
          deposito_estoque_caixa?: number
          dfe_maxnsu_busca?: number | null
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
          pc_fcp_empresa?: number | null
          pc_icms_interestadual?: number | null
          qt_saida_qt_decimais?: number | null
          qt_venda_qt_decimais?: number | null
          razao_social?: string
          regime_trib?: string | null
          tempo_animacao?: number
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
          cor_input_borda?: string | null
          cor_input_fundo?: string | null
          cor_input_label?: string | null
          cor_input_readonly?: string | null
          cor_link?: string | null
          cor_menu?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto_principal?: string | null
          cor_texto_secundario?: string | null
          css_customizado?: string | null
          deposito_estoque_caixa?: number
          dfe_maxnsu_busca?: number | null
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
          pc_fcp_empresa?: number | null
          pc_icms_interestadual?: number | null
          qt_saida_qt_decimais?: number | null
          qt_venda_qt_decimais?: number | null
          razao_social?: string
          regime_trib?: string | null
          tempo_animacao?: number
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
      estado: {
        Row: {
          cd_ibge: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          estado_id: string
          excluido: boolean | null
          icms_externo: number | null
          icms_interno: number | null
          nm_estado: string | null
          pc_fcp: number | null
          pc_fcp_st: number | null
          reducao_bc_interna: number | null
        }
        Insert: {
          cd_ibge?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id: string
          excluido?: boolean | null
          icms_externo?: number | null
          icms_interno?: number | null
          nm_estado?: string | null
          pc_fcp?: number | null
          pc_fcp_st?: number | null
          reducao_bc_interna?: number | null
        }
        Update: {
          cd_ibge?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          estado_id?: string
          excluido?: boolean | null
          icms_externo?: number | null
          icms_interno?: number | null
          nm_estado?: string | null
          pc_fcp?: number | null
          pc_fcp_st?: number | null
          reducao_bc_interna?: number | null
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
          aplica_juros: string | null
          aplica_multa: string | null
          ativo: string | null
          autenticacao: string | null
          aviario: string | null
          cadastro_id: number | null
          cadastro_id_dest: number | null
          cobranca_asaas: string | null
          cod_barras: string | null
          documento: string
          dt_emissao: string | null
          dt_vencto: string | null
          emitido_bol: string | null
          empresa_id: number
          enviado_remissa: string | null
          financeiro_id: number
          funcionario_id: number | null
          gerou_cobranca: string | null
          linha_digitavel: string | null
          modelo: string | null
          movimento_id: number | null
          nosso_numero: string | null
          observacao1: string | null
          observacao2: string | null
          parcela: number | null
          pct_juros: number | null
          pct_multa: number | null
          plano_id: number | null
          planoconta_id: number | null
          portador_id: number | null
          quantidade: number | null
          serie: string | null
          st_execucao: string | null
          st_programacao: string | null
          status: string | null
          tp_conta: string | null
          tp_documento_id: string | null
          vl_adicional: number | null
          vl_desconto: number | null
          vl_despesa: number | null
          vl_pago: number | null
          vl_titulo: number | null
        }
        Insert: {
          aplica_juros?: string | null
          aplica_multa?: string | null
          ativo?: string | null
          autenticacao?: string | null
          aviario?: string | null
          cadastro_id?: number | null
          cadastro_id_dest?: number | null
          cobranca_asaas?: string | null
          cod_barras?: string | null
          documento?: string
          dt_emissao?: string | null
          dt_vencto?: string | null
          emitido_bol?: string | null
          empresa_id?: number
          enviado_remissa?: string | null
          financeiro_id?: number
          funcionario_id?: number | null
          gerou_cobranca?: string | null
          linha_digitavel?: string | null
          modelo?: string | null
          movimento_id?: number | null
          nosso_numero?: string | null
          observacao1?: string | null
          observacao2?: string | null
          parcela?: number | null
          pct_juros?: number | null
          pct_multa?: number | null
          plano_id?: number | null
          planoconta_id?: number | null
          portador_id?: number | null
          quantidade?: number | null
          serie?: string | null
          st_execucao?: string | null
          st_programacao?: string | null
          status?: string | null
          tp_conta?: string | null
          tp_documento_id?: string | null
          vl_adicional?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_pago?: number | null
          vl_titulo?: number | null
        }
        Update: {
          aplica_juros?: string | null
          aplica_multa?: string | null
          ativo?: string | null
          autenticacao?: string | null
          aviario?: string | null
          cadastro_id?: number | null
          cadastro_id_dest?: number | null
          cobranca_asaas?: string | null
          cod_barras?: string | null
          documento?: string
          dt_emissao?: string | null
          dt_vencto?: string | null
          emitido_bol?: string | null
          empresa_id?: number
          enviado_remissa?: string | null
          financeiro_id?: number
          funcionario_id?: number | null
          gerou_cobranca?: string | null
          linha_digitavel?: string | null
          modelo?: string | null
          movimento_id?: number | null
          nosso_numero?: string | null
          observacao1?: string | null
          observacao2?: string | null
          parcela?: number | null
          pct_juros?: number | null
          pct_multa?: number | null
          plano_id?: number | null
          planoconta_id?: number | null
          portador_id?: number | null
          quantidade?: number | null
          serie?: string | null
          st_execucao?: string | null
          st_programacao?: string | null
          status?: string | null
          tp_conta?: string | null
          tp_documento_id?: string | null
          vl_adicional?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_pago?: number | null
          vl_titulo?: number | null
        }
        Relationships: []
      }
      financeiro_baixa: {
        Row: {
          cadastro_id: number | null
          conta_id: string | null
          documento: string | null
          dt_operacao: string | null
          dt_pagamento: string | null
          empresa_id: number
          financeiro_baixa_id: number
          financeiro_id: number
          funcionario_id: number | null
          observacao: string | null
          plano_id: number | null
          planoconta_id: number | null
          recibo: string | null
          tipo_pag_rec_id: number | null
          tp_conta: string | null
          vl_desconto: number | null
          vl_despesa: number | null
          vl_juros: number | null
          vl_pago: number | null
        }
        Insert: {
          cadastro_id?: number | null
          conta_id?: string | null
          documento?: string | null
          dt_operacao?: string | null
          dt_pagamento?: string | null
          empresa_id?: number
          financeiro_baixa_id?: number
          financeiro_id: number
          funcionario_id?: number | null
          observacao?: string | null
          plano_id?: number | null
          planoconta_id?: number | null
          recibo?: string | null
          tipo_pag_rec_id?: number | null
          tp_conta?: string | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_juros?: number | null
          vl_pago?: number | null
        }
        Update: {
          cadastro_id?: number | null
          conta_id?: string | null
          documento?: string | null
          dt_operacao?: string | null
          dt_pagamento?: string | null
          empresa_id?: number
          financeiro_baixa_id?: number
          financeiro_id?: number
          funcionario_id?: number | null
          observacao?: string | null
          plano_id?: number | null
          planoconta_id?: number | null
          recibo?: string | null
          tipo_pag_rec_id?: number | null
          tp_conta?: string | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_juros?: number | null
          vl_pago?: number | null
        }
        Relationships: []
      }
      fiscal_config: {
        Row: {
          ambiente_mdf: string | null
          ambiente_nfce: string | null
          ambiente_nfe: string | null
          certificado: string | null
          cliente_padrao_id: number | null
          contingencia_mdf: string | null
          contingencia_nfce: string | null
          contingencia_nfe: string | null
          dfe_maxnsu_busca: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          email_assunto_nfe: string | null
          email_corpo_nfe: string | null
          email_smtp_host: string | null
          email_smtp_pass: string | null
          email_smtp_port: number | null
          email_smtp_ssl: boolean | null
          email_smtp_tls: boolean | null
          email_smtp_user: string | null
          empresa_id: number
          excluido: boolean | null
          licenca: string | null
          licenca_mdf: string | null
          modelo_mdf: string | null
          modelo_nfce: string | null
          modelo_nfe: string | null
          nr_timeout_nfe: number
          pasta_arquivos_fiscais: string | null
          senha_certificado: string | null
          serie_mdf: string | null
          serie_nfce: string | null
          serie_nfe: string | null
          ti_emitente_mdf: number | null
          tipo_certificado: string | null
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
          cliente_padrao_id?: number | null
          contingencia_mdf?: string | null
          contingencia_nfce?: string | null
          contingencia_nfe?: string | null
          dfe_maxnsu_busca?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          email_assunto_nfe?: string | null
          email_corpo_nfe?: string | null
          email_smtp_host?: string | null
          email_smtp_pass?: string | null
          email_smtp_port?: number | null
          email_smtp_ssl?: boolean | null
          email_smtp_tls?: boolean | null
          email_smtp_user?: string | null
          empresa_id: number
          excluido?: boolean | null
          licenca?: string | null
          licenca_mdf?: string | null
          modelo_mdf?: string | null
          modelo_nfce?: string | null
          modelo_nfe?: string | null
          nr_timeout_nfe?: number
          pasta_arquivos_fiscais?: string | null
          senha_certificado?: string | null
          serie_mdf?: string | null
          serie_nfce?: string | null
          serie_nfe?: string | null
          ti_emitente_mdf?: number | null
          tipo_certificado?: string | null
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
          cliente_padrao_id?: number | null
          contingencia_mdf?: string | null
          contingencia_nfce?: string | null
          contingencia_nfe?: string | null
          dfe_maxnsu_busca?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          email_assunto_nfe?: string | null
          email_corpo_nfe?: string | null
          email_smtp_host?: string | null
          email_smtp_pass?: string | null
          email_smtp_port?: number | null
          email_smtp_ssl?: boolean | null
          email_smtp_tls?: boolean | null
          email_smtp_user?: string | null
          empresa_id?: number
          excluido?: boolean | null
          licenca?: string | null
          licenca_mdf?: string | null
          modelo_mdf?: string | null
          modelo_nfce?: string | null
          modelo_nfe?: string | null
          nr_timeout_nfe?: number
          pasta_arquivos_fiscais?: string | null
          senha_certificado?: string | null
          serie_mdf?: string | null
          serie_nfce?: string | null
          serie_nfe?: string | null
          ti_emitente_mdf?: number | null
          tipo_certificado?: string | null
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
      fiscal_config_item: {
        Row: {
          csc: string | null
          empresa_id: number
          enviar_email: string | null
          fiscal_config_item_id: number
          id_csc: string | null
          modelo: string
          nm_impressora: string | null
          nome: string | null
          sequencia: number
          serie: string
          tp_imp: string | null
        }
        Insert: {
          csc?: string | null
          empresa_id: number
          enviar_email?: string | null
          fiscal_config_item_id?: number
          id_csc?: string | null
          modelo?: string
          nm_impressora?: string | null
          nome?: string | null
          sequencia?: number
          serie?: string
          tp_imp?: string | null
        }
        Update: {
          csc?: string | null
          empresa_id?: number
          enviar_email?: string | null
          fiscal_config_item_id?: number
          id_csc?: string | null
          modelo?: string
          nm_impressora?: string | null
          nome?: string | null
          sequencia?: number
          serie?: string
          tp_imp?: string | null
        }
        Relationships: []
      }
      fiscal_evento: {
        Row: {
          ambiente: number | null
          comando: string
          created_at: string
          empresa_id: number
          id: number
          mensagem_erro: string | null
          nfe_cabecalho_id: number | null
          payload: Json | null
          resposta: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string | null
          xml_retorno: string | null
        }
        Insert: {
          ambiente?: number | null
          comando: string
          created_at?: string
          empresa_id: number
          id?: never
          mensagem_erro?: string | null
          nfe_cabecalho_id?: number | null
          payload?: Json | null
          resposta?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id?: string | null
          xml_retorno?: string | null
        }
        Update: {
          ambiente?: number | null
          comando?: string
          created_at?: string
          empresa_id?: number
          id?: never
          mensagem_erro?: string | null
          nfe_cabecalho_id?: number | null
          payload?: Json | null
          resposta?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
          xml_retorno?: string | null
        }
        Relationships: []
      }
      fiscal_grupo_produto: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          fiscal_grupo_produto_id: number
          nome: string
          tp_imposto: string
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fiscal_grupo_produto_id?: number
          nome: string
          tp_imposto: string
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fiscal_grupo_produto_id?: number
          nome?: string
          tp_imposto?: string
        }
        Relationships: []
      }
      fiscal_mdf_carrega: {
        Row: {
          cidade_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_carrega_id: number
          mdf_manifesto_id: number
        }
        Insert: {
          cidade_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_carrega_id?: number
          mdf_manifesto_id: number
        }
        Update: {
          cidade_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_carrega_id?: number
          mdf_manifesto_id?: number
        }
        Relationships: []
      }
      fiscal_mdf_componente: {
        Row: {
          ds_componente: string | null
          empresa_id: string
          mdf_componente_id: number
          mdf_manifesto_id: number
          tp_componente: string | null
          vl_componente: number | null
        }
        Insert: {
          ds_componente?: string | null
          empresa_id: string
          mdf_componente_id?: number
          mdf_manifesto_id: number
          tp_componente?: string | null
          vl_componente?: number | null
        }
        Update: {
          ds_componente?: string | null
          empresa_id?: string
          mdf_componente_id?: number
          mdf_manifesto_id?: number
          tp_componente?: string | null
          vl_componente?: number | null
        }
        Relationships: []
      }
      fiscal_mdf_condutor: {
        Row: {
          agencia: string | null
          banco: string | null
          condutor_id: number
          conta: string | null
          cpf: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_condutor_id: number
          nome: string
          pix: string | null
          telefone: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          condutor_id: number
          conta?: string | null
          cpf: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_condutor_id?: number
          nome: string
          pix?: string | null
          telefone?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          condutor_id?: number
          conta?: string | null
          cpf?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_condutor_id?: number
          nome?: string
          pix?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      fiscal_mdf_descarrega: {
        Row: {
          cidade_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_descarrega_id: number
          mdf_manifesto_id: number
        }
        Insert: {
          cidade_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_descarrega_id?: number
          mdf_manifesto_id: number
        }
        Update: {
          cidade_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_descarrega_id?: number
          mdf_manifesto_id?: number
        }
        Relationships: []
      }
      fiscal_mdf_documento: {
        Row: {
          chave: string
          cidade_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_documento_id: number
          mdf_manifesto_id: number
        }
        Insert: {
          chave: string
          cidade_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_documento_id?: number
          mdf_manifesto_id: number
        }
        Update: {
          chave?: string
          cidade_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_documento_id?: number
          mdf_manifesto_id?: number
        }
        Relationships: []
      }
      fiscal_mdf_historicoxml: {
        Row: {
          chave: string | null
          dt_alteracao: string | null
          dt_autorizado: string | null
          dt_cadastro: string | null
          dt_cancelado: string | null
          dt_encerrado: string | null
          empresa_id: number
          excluido: boolean | null
          hr_autorizado: string | null
          hr_cancelado: string | null
          hr_encerrado: string | null
          mdf_historico_id: number
          mdf_historicoxml_id: number
          mdf_manifesto_id: number
          protocolo_autorizado: string | null
          protocolo_cancelado: string | null
          protocolo_encerrado: string | null
          status_retorno: number | null
          xml_enviado: string | null
          xml_retorno: string | null
        }
        Insert: {
          chave?: string | null
          dt_alteracao?: string | null
          dt_autorizado?: string | null
          dt_cadastro?: string | null
          dt_cancelado?: string | null
          dt_encerrado?: string | null
          empresa_id: number
          excluido?: boolean | null
          hr_autorizado?: string | null
          hr_cancelado?: string | null
          hr_encerrado?: string | null
          mdf_historico_id: number
          mdf_historicoxml_id?: number
          mdf_manifesto_id: number
          protocolo_autorizado?: string | null
          protocolo_cancelado?: string | null
          protocolo_encerrado?: string | null
          status_retorno?: number | null
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Update: {
          chave?: string | null
          dt_alteracao?: string | null
          dt_autorizado?: string | null
          dt_cadastro?: string | null
          dt_cancelado?: string | null
          dt_encerrado?: string | null
          empresa_id?: number
          excluido?: boolean | null
          hr_autorizado?: string | null
          hr_cancelado?: string | null
          hr_encerrado?: string | null
          mdf_historico_id?: number
          mdf_historicoxml_id?: number
          mdf_manifesto_id?: number
          protocolo_autorizado?: string | null
          protocolo_cancelado?: string | null
          protocolo_encerrado?: string | null
          status_retorno?: number | null
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Relationships: []
      }
      fiscal_mdf_manifesto: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          dt_emissao: string | null
          dt_viagem: string | null
          empresa_id: number
          excluido: boolean | null
          hr_viagem: string | null
          mdf_manifesto_id: number
          modalidade: string | null
          modelo: string
          numero: number
          peso_total: number | null
          qtd_nfe: number | null
          serie: string
          status: string | null
          tp_emitente: string | null
          tp_transportador: string | null
          uffim: string | null
          ufini: string | null
          unidade: string | null
          valor_total: number | null
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_emissao?: string | null
          dt_viagem?: string | null
          empresa_id: number
          excluido?: boolean | null
          hr_viagem?: string | null
          mdf_manifesto_id?: number
          modalidade?: string | null
          modelo: string
          numero: number
          peso_total?: number | null
          qtd_nfe?: number | null
          serie: string
          status?: string | null
          tp_emitente?: string | null
          tp_transportador?: string | null
          uffim?: string | null
          ufini?: string | null
          unidade?: string | null
          valor_total?: number | null
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          dt_emissao?: string | null
          dt_viagem?: string | null
          empresa_id?: number
          excluido?: boolean | null
          hr_viagem?: string | null
          mdf_manifesto_id?: number
          modalidade?: string | null
          modelo?: string
          numero?: number
          peso_total?: number | null
          qtd_nfe?: number | null
          serie?: string
          status?: string | null
          tp_emitente?: string | null
          tp_transportador?: string | null
          uffim?: string | null
          ufini?: string | null
          unidade?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      fiscal_mdf_motorista: {
        Row: {
          condutor_id: number
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_manifesto_id: number
          mdf_motorista_id: number
        }
        Insert: {
          condutor_id: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_manifesto_id: number
          mdf_motorista_id?: number
        }
        Update: {
          condutor_id?: number
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_manifesto_id?: number
          mdf_motorista_id?: number
        }
        Relationships: []
      }
      fiscal_mdf_pagamento: {
        Row: {
          adiantamento: number | null
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          cnpjipef: string | null
          empresa_id: string
          forma_pagto: string | null
          mdf_manifesto_id: number
          mdf_pagamento_id: number
          vl_contrato: number | null
        }
        Insert: {
          adiantamento?: number | null
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cnpjipef?: string | null
          empresa_id: string
          forma_pagto?: string | null
          mdf_manifesto_id: number
          mdf_pagamento_id?: number
          vl_contrato?: number | null
        }
        Update: {
          adiantamento?: number | null
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cnpjipef?: string | null
          empresa_id?: string
          forma_pagto?: string | null
          mdf_manifesto_id?: number
          mdf_pagamento_id?: number
          vl_contrato?: number | null
        }
        Relationships: []
      }
      fiscal_mdf_pagtos: {
        Row: {
          dt_vencimento: string | null
          empresa_id: string
          mdf_manifesto_id: number
          mdf_pagtos_id: number
          nr_parcela: string
          vl_parcela: number | null
        }
        Insert: {
          dt_vencimento?: string | null
          empresa_id: string
          mdf_manifesto_id: number
          mdf_pagtos_id?: number
          nr_parcela: string
          vl_parcela?: number | null
        }
        Update: {
          dt_vencimento?: string | null
          empresa_id?: string
          mdf_manifesto_id?: number
          mdf_pagtos_id?: number
          nr_parcela?: string
          vl_parcela?: number | null
        }
        Relationships: []
      }
      fiscal_mdf_percurso: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_manifesto_id: number
          mdf_percurso_id: number
          uf: string
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_manifesto_id: number
          mdf_percurso_id?: number
          uf: string
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_manifesto_id?: number
          mdf_percurso_id?: number
          uf?: string
        }
        Relationships: []
      }
      fiscal_mdf_veiculo: {
        Row: {
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          mdf_manifesto_id: number
          mdf_veiculo_id: number
          veiculo_id: number
        }
        Insert: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id: number
          excluido?: boolean | null
          mdf_manifesto_id: number
          mdf_veiculo_id?: number
          veiculo_id: number
        }
        Update: {
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          mdf_manifesto_id?: number
          mdf_veiculo_id?: number
          veiculo_id?: number
        }
        Relationships: []
      }
      fiscal_nfe_cabecalho: {
        Row: {
          c_stat: number | null
          cadastro_id: number | null
          chave_nfe: string
          created_at: string
          deposito_id: number | null
          dt_alteracao: string | null
          dt_cancelamento: string | null
          dt_emissao: string | null
          dt_entrada: string | null
          dt_saida: string | null
          empresa_id: number
          excluido: boolean
          fin_nfe: number
          modelo: string
          motivo_cancelamento: string | null
          movimento_id: number | null
          nat_op: string
          nfe_cabecalho_id: number
          nr_nota: string
          nr_protocolo: string
          obs_nf: string
          origem_inclusao: string
          pedido_id: number | null
          protocolo_cancelamento: string | null
          recibo_sefaz: string | null
          serie: string
          st_nf: string
          tp_emis: number
          tp_nf: number
          updated_at: string
          vl_bc: number
          vl_cbs: number
          vl_cofins: number
          vl_desconto: number
          vl_despesa: number
          vl_fcp: number
          vl_fcp_st: number
          vl_fcp_st_ret: number
          vl_frete: number
          vl_ibs: number
          vl_icms: number
          vl_icms_deson: number
          vl_icms_st: number
          vl_ii: number
          vl_ipi: number
          vl_ipi_devol: number
          vl_is: number
          vl_outro: number
          vl_pis: number
          vl_produto: number
          vl_seguro: number
          vl_total_nf: number
          x_motivo: string | null
          xml_nf: string | null
        }
        Insert: {
          c_stat?: number | null
          cadastro_id?: number | null
          chave_nfe?: string
          created_at?: string
          deposito_id?: number | null
          dt_alteracao?: string | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_entrada?: string | null
          dt_saida?: string | null
          empresa_id: number
          excluido?: boolean
          fin_nfe?: number
          modelo?: string
          motivo_cancelamento?: string | null
          movimento_id?: number | null
          nat_op?: string
          nfe_cabecalho_id?: never
          nr_nota?: string
          nr_protocolo?: string
          obs_nf?: string
          origem_inclusao?: string
          pedido_id?: number | null
          protocolo_cancelamento?: string | null
          recibo_sefaz?: string | null
          serie?: string
          st_nf?: string
          tp_emis?: number
          tp_nf?: number
          updated_at?: string
          vl_bc?: number
          vl_cbs?: number
          vl_cofins?: number
          vl_desconto?: number
          vl_despesa?: number
          vl_fcp?: number
          vl_fcp_st?: number
          vl_fcp_st_ret?: number
          vl_frete?: number
          vl_ibs?: number
          vl_icms?: number
          vl_icms_deson?: number
          vl_icms_st?: number
          vl_ii?: number
          vl_ipi?: number
          vl_ipi_devol?: number
          vl_is?: number
          vl_outro?: number
          vl_pis?: number
          vl_produto?: number
          vl_seguro?: number
          vl_total_nf?: number
          x_motivo?: string | null
          xml_nf?: string | null
        }
        Update: {
          c_stat?: number | null
          cadastro_id?: number | null
          chave_nfe?: string
          created_at?: string
          deposito_id?: number | null
          dt_alteracao?: string | null
          dt_cancelamento?: string | null
          dt_emissao?: string | null
          dt_entrada?: string | null
          dt_saida?: string | null
          empresa_id?: number
          excluido?: boolean
          fin_nfe?: number
          modelo?: string
          motivo_cancelamento?: string | null
          movimento_id?: number | null
          nat_op?: string
          nfe_cabecalho_id?: never
          nr_nota?: string
          nr_protocolo?: string
          obs_nf?: string
          origem_inclusao?: string
          pedido_id?: number | null
          protocolo_cancelamento?: string | null
          recibo_sefaz?: string | null
          serie?: string
          st_nf?: string
          tp_emis?: number
          tp_nf?: number
          updated_at?: string
          vl_bc?: number
          vl_cbs?: number
          vl_cofins?: number
          vl_desconto?: number
          vl_despesa?: number
          vl_fcp?: number
          vl_fcp_st?: number
          vl_fcp_st_ret?: number
          vl_frete?: number
          vl_ibs?: number
          vl_icms?: number
          vl_icms_deson?: number
          vl_icms_st?: number
          vl_ii?: number
          vl_ipi?: number
          vl_ipi_devol?: number
          vl_is?: number
          vl_outro?: number
          vl_pis?: number
          vl_produto?: number
          vl_seguro?: number
          vl_total_nf?: number
          x_motivo?: string | null
          xml_nf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_cabecalho_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastro"
            referencedColumns: ["cadastro_id"]
          },
          {
            foreignKeyName: "nfe_cabecalho_deposito_id_fkey"
            columns: ["deposito_id"]
            isOneToOne: false
            referencedRelation: "deposito"
            referencedColumns: ["deposito_id"]
          },
        ]
      }
      fiscal_nfe_cce: {
        Row: {
          c_stat: number | null
          created_at: string
          dt_evento: string
          empresa_id: number
          nfe_cabecalho_id: number
          nfe_cce_id: number
          nr_protocolo: string | null
          nr_sequencial: number
          st_evento: string
          tp_evento: string
          updated_at: string
          x_correcao: string
          x_motivo: string | null
          xml_evento: string | null
          xml_retorno: string | null
        }
        Insert: {
          c_stat?: number | null
          created_at?: string
          dt_evento?: string
          empresa_id: number
          nfe_cabecalho_id: number
          nfe_cce_id?: never
          nr_protocolo?: string | null
          nr_sequencial?: number
          st_evento?: string
          tp_evento?: string
          updated_at?: string
          x_correcao: string
          x_motivo?: string | null
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Update: {
          c_stat?: number | null
          created_at?: string
          dt_evento?: string
          empresa_id?: number
          nfe_cabecalho_id?: number
          nfe_cce_id?: never
          nr_protocolo?: string | null
          nr_sequencial?: number
          st_evento?: string
          tp_evento?: string
          updated_at?: string
          x_correcao?: string
          x_motivo?: string | null
          xml_evento?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_nfe_cce_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "fiscal_nfe_cce_nfe_cabecalho_id_fkey"
            columns: ["nfe_cabecalho_id"]
            isOneToOne: false
            referencedRelation: "fiscal_nfe_cabecalho"
            referencedColumns: ["nfe_cabecalho_id"]
          },
        ]
      }
      fiscal_nfe_item: {
        Row: {
          c_enq: string
          cd_prod_fornec: string
          cest: string
          cfop: string
          created_at: string
          csosn: string
          cst_cbs: string
          cst_cofins: string
          cst_ibs: string
          cst_icms: string
          cst_ipi: string
          cst_is: string
          cst_pis: string
          empresa_id: number
          excluido: boolean
          gtin: string
          mod_bc: number | null
          mod_bc_st: number | null
          ncm: string
          nfe_cabecalho_id: number
          nfe_item_id: number
          nm_produto: string
          nr_item: number
          origem: number
          pc_cbs: number
          pc_cofins: number
          pc_cred_sn: number
          pc_fcp: number
          pc_fcp_st: number
          pc_ibs: number
          pc_icms: number
          pc_icms_st: number
          pc_ipi: number
          pc_is: number
          pc_mva: number
          pc_pis: number
          pc_red_bc: number
          pc_red_bc_st: number
          produto_id: number | null
          qt_entrada: number
          qt_tributavel: number
          unidade: string
          updated_at: string
          vl_bc: number
          vl_bc_cofins: number
          vl_bc_ipi: number
          vl_bc_pis: number
          vl_bc_st: number
          vl_cbs: number
          vl_cofins: number
          vl_cred_sn: number
          vl_desconto: number
          vl_fcp: number
          vl_fcp_st: number
          vl_frete: number
          vl_ibs: number
          vl_icms: number
          vl_icms_deson: number
          vl_icms_st: number
          vl_ipi: number
          vl_is: number
          vl_outro: number
          vl_pis: number
          vl_seguro: number
          vl_total: number
          vl_unit: number
          vl_unit_tributavel: number
        }
        Insert: {
          c_enq?: string
          cd_prod_fornec?: string
          cest?: string
          cfop?: string
          created_at?: string
          csosn?: string
          cst_cbs?: string
          cst_cofins?: string
          cst_ibs?: string
          cst_icms?: string
          cst_ipi?: string
          cst_is?: string
          cst_pis?: string
          empresa_id: number
          excluido?: boolean
          gtin?: string
          mod_bc?: number | null
          mod_bc_st?: number | null
          ncm?: string
          nfe_cabecalho_id: number
          nfe_item_id?: never
          nm_produto?: string
          nr_item?: number
          origem?: number
          pc_cbs?: number
          pc_cofins?: number
          pc_cred_sn?: number
          pc_fcp?: number
          pc_fcp_st?: number
          pc_ibs?: number
          pc_icms?: number
          pc_icms_st?: number
          pc_ipi?: number
          pc_is?: number
          pc_mva?: number
          pc_pis?: number
          pc_red_bc?: number
          pc_red_bc_st?: number
          produto_id?: number | null
          qt_entrada?: number
          qt_tributavel?: number
          unidade?: string
          updated_at?: string
          vl_bc?: number
          vl_bc_cofins?: number
          vl_bc_ipi?: number
          vl_bc_pis?: number
          vl_bc_st?: number
          vl_cbs?: number
          vl_cofins?: number
          vl_cred_sn?: number
          vl_desconto?: number
          vl_fcp?: number
          vl_fcp_st?: number
          vl_frete?: number
          vl_ibs?: number
          vl_icms?: number
          vl_icms_deson?: number
          vl_icms_st?: number
          vl_ipi?: number
          vl_is?: number
          vl_outro?: number
          vl_pis?: number
          vl_seguro?: number
          vl_total?: number
          vl_unit?: number
          vl_unit_tributavel?: number
        }
        Update: {
          c_enq?: string
          cd_prod_fornec?: string
          cest?: string
          cfop?: string
          created_at?: string
          csosn?: string
          cst_cbs?: string
          cst_cofins?: string
          cst_ibs?: string
          cst_icms?: string
          cst_ipi?: string
          cst_is?: string
          cst_pis?: string
          empresa_id?: number
          excluido?: boolean
          gtin?: string
          mod_bc?: number | null
          mod_bc_st?: number | null
          ncm?: string
          nfe_cabecalho_id?: number
          nfe_item_id?: never
          nm_produto?: string
          nr_item?: number
          origem?: number
          pc_cbs?: number
          pc_cofins?: number
          pc_cred_sn?: number
          pc_fcp?: number
          pc_fcp_st?: number
          pc_ibs?: number
          pc_icms?: number
          pc_icms_st?: number
          pc_ipi?: number
          pc_is?: number
          pc_mva?: number
          pc_pis?: number
          pc_red_bc?: number
          pc_red_bc_st?: number
          produto_id?: number | null
          qt_entrada?: number
          qt_tributavel?: number
          unidade?: string
          updated_at?: string
          vl_bc?: number
          vl_bc_cofins?: number
          vl_bc_ipi?: number
          vl_bc_pis?: number
          vl_bc_st?: number
          vl_cbs?: number
          vl_cofins?: number
          vl_cred_sn?: number
          vl_desconto?: number
          vl_fcp?: number
          vl_fcp_st?: number
          vl_frete?: number
          vl_ibs?: number
          vl_icms?: number
          vl_icms_deson?: number
          vl_icms_st?: number
          vl_ipi?: number
          vl_is?: number
          vl_outro?: number
          vl_pis?: number
          vl_seguro?: number
          vl_total?: number
          vl_unit?: number
          vl_unit_tributavel?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_item_nfe_cabecalho_id_fkey"
            columns: ["nfe_cabecalho_id"]
            isOneToOne: false
            referencedRelation: "fiscal_nfe_cabecalho"
            referencedColumns: ["nfe_cabecalho_id"]
          },
          {
            foreignKeyName: "nfe_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      fiscal_nfe_pagamento: {
        Row: {
          c_aut: string | null
          cnpj_credenciadora: string | null
          created_at: string
          nfe_cabecalho_id: number
          nfe_pagamento_id: number
          t_pag: string
          tp_integra: number | null
          v_pag: number
        }
        Insert: {
          c_aut?: string | null
          cnpj_credenciadora?: string | null
          created_at?: string
          nfe_cabecalho_id: number
          nfe_pagamento_id?: never
          t_pag: string
          tp_integra?: number | null
          v_pag?: number
        }
        Update: {
          c_aut?: string | null
          cnpj_credenciadora?: string | null
          created_at?: string
          nfe_cabecalho_id?: number
          nfe_pagamento_id?: never
          t_pag?: string
          tp_integra?: number | null
          v_pag?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_nfe_pagamento_nfe_cabecalho_id_fkey"
            columns: ["nfe_cabecalho_id"]
            isOneToOne: false
            referencedRelation: "fiscal_nfe_cabecalho"
            referencedColumns: ["nfe_cabecalho_id"]
          },
        ]
      }
      fiscal_nfe_recebida: {
        Row: {
          chave_nfe: string
          cnpj_emitente: string
          created_at: string
          dt_emissao: string | null
          empresa_id: number
          nfe_recebida_id: number
          nm_emitente: string
          nr_nota: string | null
          nsu: number | null
          serie: string | null
          st_download: boolean
          st_manifesto: string
          updated_at: string
          vl_total: number | null
          xml_completo: string | null
          xml_resumo: string | null
        }
        Insert: {
          chave_nfe: string
          cnpj_emitente: string
          created_at?: string
          dt_emissao?: string | null
          empresa_id: number
          nfe_recebida_id?: never
          nm_emitente: string
          nr_nota?: string | null
          nsu?: number | null
          serie?: string | null
          st_download?: boolean
          st_manifesto?: string
          updated_at?: string
          vl_total?: number | null
          xml_completo?: string | null
          xml_resumo?: string | null
        }
        Update: {
          chave_nfe?: string
          cnpj_emitente?: string
          created_at?: string
          dt_emissao?: string | null
          empresa_id?: number
          nfe_recebida_id?: never
          nm_emitente?: string
          nr_nota?: string | null
          nsu?: number | null
          serie?: string | null
          st_download?: boolean
          st_manifesto?: string
          updated_at?: string
          vl_total?: number | null
          xml_completo?: string | null
          xml_resumo?: string | null
        }
        Relationships: []
      }
      fiscal_nfe_referenciada: {
        Row: {
          chave_ref: string
          created_at: string
          nfe_cabecalho_id: number
          nfe_referenciada_id: number
        }
        Insert: {
          chave_ref: string
          created_at?: string
          nfe_cabecalho_id: number
          nfe_referenciada_id?: never
        }
        Update: {
          chave_ref?: string
          created_at?: string
          nfe_cabecalho_id?: number
          nfe_referenciada_id?: never
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_nfe_referenciada_nfe_cabecalho_id_fkey"
            columns: ["nfe_cabecalho_id"]
            isOneToOne: false
            referencedRelation: "fiscal_nfe_cabecalho"
            referencedColumns: ["nfe_cabecalho_id"]
          },
        ]
      }
      fiscal_regra: {
        Row: {
          cfop_id: number | null
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          fiscal_regra_id: number
          observacao: string | null
          prioridade: number | null
          regime_trib: string | null
          tp_operacao_id: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          cfop_id?: number | null
          descricao: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fiscal_regra_id?: number
          observacao?: string | null
          prioridade?: number | null
          regime_trib?: string | null
          tp_operacao_id?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          cfop_id?: number | null
          descricao?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          fiscal_regra_id?: number
          observacao?: string | null
          prioridade?: number | null
          regime_trib?: string | null
          tp_operacao_id?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_regra_cfop_id_fkey"
            columns: ["cfop_id"]
            isOneToOne: false
            referencedRelation: "cfop"
            referencedColumns: ["cfop_id"]
          },
        ]
      }
      fiscal_regra_cfop: {
        Row: {
          cest_filtro: string | null
          cfop_id: number
          cliente_consumidor_final: boolean | null
          cliente_contribuinte: boolean | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          fiscal_grupo_produto_id: number | null
          fiscal_regra_cfop_id: number
          fiscal_regra_id: number
          ncm_filtro: string | null
          origem_produto: string | null
          uf_destino: string | null
        }
        Insert: {
          cest_filtro?: string | null
          cfop_id: number
          cliente_consumidor_final?: boolean | null
          cliente_contribuinte?: boolean | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          fiscal_grupo_produto_id?: number | null
          fiscal_regra_cfop_id?: number
          fiscal_regra_id: number
          ncm_filtro?: string | null
          origem_produto?: string | null
          uf_destino?: string | null
        }
        Update: {
          cest_filtro?: string | null
          cfop_id?: number
          cliente_consumidor_final?: boolean | null
          cliente_contribuinte?: boolean | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          fiscal_grupo_produto_id?: number | null
          fiscal_regra_cfop_id?: number
          fiscal_regra_id?: number
          ncm_filtro?: string | null
          origem_produto?: string | null
          uf_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_regra_cfop_cfop_id_fkey"
            columns: ["cfop_id"]
            isOneToOne: false
            referencedRelation: "cfop"
            referencedColumns: ["cfop_id"]
          },
          {
            foreignKeyName: "fiscal_regra_cfop_fiscal_regra_id_fkey"
            columns: ["fiscal_regra_id"]
            isOneToOne: false
            referencedRelation: "fiscal_regra"
            referencedColumns: ["fiscal_regra_id"]
          },
          {
            foreignKeyName: "fk_fiscal_regra_cfop_grupo"
            columns: ["fiscal_grupo_produto_id"]
            isOneToOne: false
            referencedRelation: "fiscal_grupo_produto"
            referencedColumns: ["fiscal_grupo_produto_id"]
          },
        ]
      }
      fiscal_regra_item: {
        Row: {
          aliquota: number | null
          base_reducao: number | null
          cbs_aliquota: number | null
          cest_filtro: string | null
          cliente_consumidor_final: boolean | null
          cliente_contribuinte: boolean | null
          cst_csosn: string | null
          cst_pis_cofins: string | null
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          fiscal_grupo_produto_id: number | null
          fiscal_regra_id: number
          fiscal_regra_item_id: number
          ibs_aliquota: number | null
          icms_st_aliquota: number | null
          icms_st_base_reducao: number | null
          icms_st_mva: number | null
          ipi_c_enq: string | null
          is_aliquota: number | null
          mod_bc: number | null
          mod_bc_st: number | null
          motivo_desoneracao: number | null
          nat_receita_pis_cofins: string | null
          ncm_filtro: string | null
          origem_produto: string | null
          p_cre_sn: number | null
          tipo_imposto: string
          uf_destino: string | null
        }
        Insert: {
          aliquota?: number | null
          base_reducao?: number | null
          cbs_aliquota?: number | null
          cest_filtro?: string | null
          cliente_consumidor_final?: boolean | null
          cliente_contribuinte?: boolean | null
          cst_csosn?: string | null
          cst_pis_cofins?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          fiscal_grupo_produto_id?: number | null
          fiscal_regra_id: number
          fiscal_regra_item_id?: number
          ibs_aliquota?: number | null
          icms_st_aliquota?: number | null
          icms_st_base_reducao?: number | null
          icms_st_mva?: number | null
          ipi_c_enq?: string | null
          is_aliquota?: number | null
          mod_bc?: number | null
          mod_bc_st?: number | null
          motivo_desoneracao?: number | null
          nat_receita_pis_cofins?: string | null
          ncm_filtro?: string | null
          origem_produto?: string | null
          p_cre_sn?: number | null
          tipo_imposto: string
          uf_destino?: string | null
        }
        Update: {
          aliquota?: number | null
          base_reducao?: number | null
          cbs_aliquota?: number | null
          cest_filtro?: string | null
          cliente_consumidor_final?: boolean | null
          cliente_contribuinte?: boolean | null
          cst_csosn?: string | null
          cst_pis_cofins?: string | null
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          fiscal_grupo_produto_id?: number | null
          fiscal_regra_id?: number
          fiscal_regra_item_id?: number
          ibs_aliquota?: number | null
          icms_st_aliquota?: number | null
          icms_st_base_reducao?: number | null
          icms_st_mva?: number | null
          ipi_c_enq?: string | null
          is_aliquota?: number | null
          mod_bc?: number | null
          mod_bc_st?: number | null
          motivo_desoneracao?: number | null
          nat_receita_pis_cofins?: string | null
          ncm_filtro?: string | null
          origem_produto?: string | null
          p_cre_sn?: number | null
          tipo_imposto?: string
          uf_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_regra_item_fiscal_regra_id_fkey"
            columns: ["fiscal_regra_id"]
            isOneToOne: false
            referencedRelation: "fiscal_regra"
            referencedColumns: ["fiscal_regra_id"]
          },
          {
            foreignKeyName: "fk_fiscal_regra_item_grupo"
            columns: ["fiscal_grupo_produto_id"]
            isOneToOne: false
            referencedRelation: "fiscal_grupo_produto"
            referencedColumns: ["fiscal_grupo_produto_id"]
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
          nfce_config_item: number | null
          nfe_config_item: number | null
          nome: string | null
          pc_comissao_av: number | null
          pc_comissao_prz: number | null
          tamanho_fonte_pedidos: number
          tamanho_fonte_produtos: number
          tamanho_fonte_totais: number | null
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
          nfce_config_item?: number | null
          nfe_config_item?: number | null
          nome?: string | null
          pc_comissao_av?: number | null
          pc_comissao_prz?: number | null
          tamanho_fonte_pedidos?: number
          tamanho_fonte_produtos?: number
          tamanho_fonte_totais?: number | null
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
          nfce_config_item?: number | null
          nfe_config_item?: number | null
          nome?: string | null
          pc_comissao_av?: number | null
          pc_comissao_prz?: number | null
          tamanho_fonte_pedidos?: number
          tamanho_fonte_produtos?: number
          tamanho_fonte_totais?: number | null
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
          soma_vl_caixa: string | null
        }
        Insert: {
          codigo?: string | null
          descricao?: string | null
          meio_pagamento_id?: number
          soma_vl_caixa?: string | null
        }
        Update: {
          codigo?: string | null
          descricao?: string | null
          meio_pagamento_id?: number
          soma_vl_caixa?: string | null
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
          dt_alteracao: string | null
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
          vl_bc_desconto: number | null
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
          dt_alteracao?: string | null
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
          vl_bc_desconto?: number | null
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
          dt_alteracao?: string | null
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
          vl_bc_desconto?: number | null
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
          vl_comissao: number | null
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
          vl_comissao?: number | null
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
          vl_comissao?: number | null
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
      plano: {
        Row: {
          conta: string | null
          empresa_id: number
          natureza: string | null
          nome: string | null
          plano_id: number
          plano_id_pai: number | null
          tp_conta: string | null
        }
        Insert: {
          conta?: string | null
          empresa_id: number
          natureza?: string | null
          nome?: string | null
          plano_id: number
          plano_id_pai?: number | null
          tp_conta?: string | null
        }
        Update: {
          conta?: string | null
          empresa_id?: number
          natureza?: string | null
          nome?: string | null
          plano_id?: number
          plano_id_pai?: number | null
          tp_conta?: string | null
        }
        Relationships: []
      }
      plano_conta: {
        Row: {
          conta: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
          nivel: number | null
          nome: string
          plano_conta_id: number
          tp_conta: string | null
          tp_natureza: string | null
        }
        Insert: {
          conta: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nivel?: number | null
          nome: string
          plano_conta_id?: number
          tp_conta?: string | null
          tp_natureza?: string | null
        }
        Update: {
          conta?: string
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
          nivel?: number | null
          nome?: string
          plano_conta_id?: number
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
      produto_fornecedor: {
        Row: {
          cadastro_id: number
          cd_prod_fornec: string
          created_at: string
          empresa_id: number
          excluido: boolean
          fator_conversao: number
          nm_prod_fornec: string
          produto_fornecedor_id: number
          produto_id: number
          updated_at: string
        }
        Insert: {
          cadastro_id: number
          cd_prod_fornec?: string
          created_at?: string
          empresa_id: number
          excluido?: boolean
          fator_conversao?: number
          nm_prod_fornec?: string
          produto_fornecedor_id?: never
          produto_id: number
          updated_at?: string
        }
        Update: {
          cadastro_id?: number
          cd_prod_fornec?: string
          created_at?: string
          empresa_id?: number
          excluido?: boolean
          fator_conversao?: number
          nm_prod_fornec?: string
          produto_fornecedor_id?: never
          produto_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_fornecedor_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastro"
            referencedColumns: ["cadastro_id"]
          },
          {
            foreignKeyName: "produto_fornecedor_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
        ]
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
      rpb_conexao: {
        Row: {
          api_key: string
          created_at: string
          descricao: string
          empresa_id: number
          excluido: boolean
          nome: string
          rpb_conexao_id: number
          updated_at: string
          url: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          descricao?: string
          empresa_id: number
          excluido?: boolean
          nome: string
          rpb_conexao_id?: never
          updated_at?: string
          url?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          descricao?: string
          empresa_id?: number
          excluido?: boolean
          nome?: string
          rpb_conexao_id?: never
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      rpb_filtro: {
        Row: {
          created_at: string
          empresa_id: number
          excluido: boolean
          label: string
          nome: string
          obrigatorio: boolean
          opcoes_fixas: string
          ordem: number
          query_opcoes: string
          rpb_filtro_id: number
          rpb_relatorio_id: number
          tipo: string
          valor_padrao: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          excluido?: boolean
          label: string
          nome: string
          obrigatorio?: boolean
          opcoes_fixas?: string
          ordem?: number
          query_opcoes?: string
          rpb_filtro_id?: never
          rpb_relatorio_id: number
          tipo?: string
          valor_padrao?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          excluido?: boolean
          label?: string
          nome?: string
          obrigatorio?: boolean
          opcoes_fixas?: string
          ordem?: number
          query_opcoes?: string
          rpb_filtro_id?: never
          rpb_relatorio_id?: number
          tipo?: string
          valor_padrao?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpb_filtro_rpb_relatorio_id_fkey"
            columns: ["rpb_relatorio_id"]
            isOneToOne: false
            referencedRelation: "rpb_relatorio"
            referencedColumns: ["rpb_relatorio_id"]
          },
        ]
      }
      rpb_relatorio: {
        Row: {
          categoria: string
          created_at: string
          descricao: string
          empresa_id: number
          excluido: boolean
          layout_json: Json | null
          nm_form: string
          nome: string
          query_sql: string
          rpb_conexao_id: number | null
          rpb_relatorio_id: number
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string
          empresa_id: number
          excluido?: boolean
          layout_json?: Json | null
          nm_form?: string
          nome: string
          query_sql?: string
          rpb_conexao_id?: number | null
          rpb_relatorio_id?: never
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string
          empresa_id?: number
          excluido?: boolean
          layout_json?: Json | null
          nm_form?: string
          nome?: string
          query_sql?: string
          rpb_conexao_id?: number | null
          rpb_relatorio_id?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpb_relatorio_rpb_conexao_id_fkey"
            columns: ["rpb_conexao_id"]
            isOneToOne: false
            referencedRelation: "rpb_conexao"
            referencedColumns: ["rpb_conexao_id"]
          },
        ]
      }
      sys_sequencial: {
        Row: {
          empresa_id: number
          nm_campo1: string
          nm_campo2: string
          tabela: string | null
          ult_seq: number | null
        }
        Insert: {
          empresa_id: number
          nm_campo1?: string
          nm_campo2?: string
          tabela?: string | null
          ult_seq?: number | null
        }
        Update: {
          empresa_id?: number
          nm_campo1?: string
          nm_campo2?: string
          tabela?: string | null
          ult_seq?: number | null
        }
        Relationships: []
      }
      tp_operacao: {
        Row: {
          altera_estoque: string | null
          descricao: string
          dt_alteracao: string | null
          dt_cadastro: string | null
          empresa_id: number
          excluido: boolean | null
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
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
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
          dt_alteracao?: string | null
          dt_cadastro?: string | null
          empresa_id?: number
          excluido?: boolean | null
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
      usuario_atalho: {
        Row: {
          created_at: string
          nm_menu: string
          nr_ordem: number
          updated_at: string
          user_id: string
          usuario_atalho_id: number
        }
        Insert: {
          created_at?: string
          nm_menu: string
          nr_ordem?: number
          updated_at?: string
          user_id: string
          usuario_atalho_id?: number
        }
        Update: {
          created_at?: string
          nm_menu?: string
          nr_ordem?: number
          updated_at?: string
          user_id?: string
          usuario_atalho_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      financeiro_view: {
        Row: {
          aplica_juros: string | null
          aplica_multa: string | null
          ativo: string | null
          autenticacao: string | null
          aviario: string | null
          cadastro_id: number | null
          cadastro_id_dest: number | null
          cobranca_asaas: string | null
          cod_barras: string | null
          dias_atraso: number | null
          documento: string | null
          dt_emissao: string | null
          dt_vencto: string | null
          emitido_bol: string | null
          empresa_id: number | null
          enviado_remissa: string | null
          financeiro_id: number | null
          funcionario_id: number | null
          gerou_cobranca: string | null
          linha_digitavel: string | null
          modelo: string | null
          movimento_id: number | null
          nosso_numero: string | null
          observacao1: string | null
          observacao2: string | null
          parcela: number | null
          pct_juros: number | null
          pct_multa: number | null
          plano_id: number | null
          planoconta_id: number | null
          portador_id: number | null
          quantidade: number | null
          serie: string | null
          situacao: string | null
          st_execucao: string | null
          st_programacao: string | null
          status: string | null
          tp_conta: string | null
          tp_documento_id: string | null
          vl_a_pagar: number | null
          vl_adicional: number | null
          vl_desconto: number | null
          vl_despesa: number | null
          vl_juros: number | null
          vl_multa: number | null
          vl_pago: number | null
          vl_titulo: number | null
        }
        Insert: {
          aplica_juros?: string | null
          aplica_multa?: string | null
          ativo?: string | null
          autenticacao?: string | null
          aviario?: string | null
          cadastro_id?: number | null
          cadastro_id_dest?: number | null
          cobranca_asaas?: string | null
          cod_barras?: string | null
          dias_atraso?: never
          documento?: string | null
          dt_emissao?: string | null
          dt_vencto?: string | null
          emitido_bol?: string | null
          empresa_id?: number | null
          enviado_remissa?: string | null
          financeiro_id?: number | null
          funcionario_id?: number | null
          gerou_cobranca?: string | null
          linha_digitavel?: string | null
          modelo?: string | null
          movimento_id?: number | null
          nosso_numero?: string | null
          observacao1?: string | null
          observacao2?: string | null
          parcela?: number | null
          pct_juros?: number | null
          pct_multa?: number | null
          plano_id?: number | null
          planoconta_id?: number | null
          portador_id?: number | null
          quantidade?: number | null
          serie?: string | null
          situacao?: never
          st_execucao?: string | null
          st_programacao?: string | null
          status?: string | null
          tp_conta?: string | null
          tp_documento_id?: string | null
          vl_a_pagar?: never
          vl_adicional?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_juros?: never
          vl_multa?: never
          vl_pago?: number | null
          vl_titulo?: number | null
        }
        Update: {
          aplica_juros?: string | null
          aplica_multa?: string | null
          ativo?: string | null
          autenticacao?: string | null
          aviario?: string | null
          cadastro_id?: number | null
          cadastro_id_dest?: number | null
          cobranca_asaas?: string | null
          cod_barras?: string | null
          dias_atraso?: never
          documento?: string | null
          dt_emissao?: string | null
          dt_vencto?: string | null
          emitido_bol?: string | null
          empresa_id?: number | null
          enviado_remissa?: string | null
          financeiro_id?: number | null
          funcionario_id?: number | null
          gerou_cobranca?: string | null
          linha_digitavel?: string | null
          modelo?: string | null
          movimento_id?: number | null
          nosso_numero?: string | null
          observacao1?: string | null
          observacao2?: string | null
          parcela?: number | null
          pct_juros?: number | null
          pct_multa?: number | null
          plano_id?: number | null
          planoconta_id?: number | null
          portador_id?: number | null
          quantidade?: number | null
          serie?: string | null
          situacao?: never
          st_execucao?: string | null
          st_programacao?: string | null
          status?: string | null
          tp_conta?: string | null
          tp_documento_id?: string | null
          vl_a_pagar?: never
          vl_adicional?: number | null
          vl_desconto?: number | null
          vl_despesa?: number | null
          vl_juros?: never
          vl_multa?: never
          vl_pago?: number | null
          vl_titulo?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      fu_baixar_titulos_cliente: {
        Args: {
          p_cadastro_id: number
          p_conta_id: string
          p_recibo: string
          p_tipo_pag_rec_id: number
          p_vl_recebido: string
        }
        Returns: undefined
      }
      fu_calcular_impostos_movimento: {
        Args: {
          p_modelo?: string
          p_movimento_id: number
          p_nr_nota?: string
          p_serie?: string
        }
        Returns: number
      }
      fu_chat_is_membro: {
        Args: { _sala_id: number; _user_id: string }
        Returns: boolean
      }
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
      fu_is_admin_any: { Args: { _user_id: string }; Returns: boolean }
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
      fu_round_abnt: {
        Args: { p_dec?: number; p_val: number }
        Returns: number
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
      get_or_create_nsu_seq: {
        Args: { p_empresa_id: number; p_tipo_campo: string }
        Returns: number
      }
      rpb_execute_query: { Args: { p_sql: string }; Returns: Json }
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

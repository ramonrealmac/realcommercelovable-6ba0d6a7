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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          id: number
          xacao: string
          xdados_anteriores: Json | null
          xdados_novos: Json | null
          xdt_auditoria: string | null
          xip: string | null
          xobs: string | null
          xregistro_id: string
          xtabela: string
          xusuario_id: string | null
        }
        Insert: {
          id?: never
          xacao: string
          xdados_anteriores?: Json | null
          xdados_novos?: Json | null
          xdt_auditoria?: string | null
          xip?: string | null
          xobs?: string | null
          xregistro_id: string
          xtabela: string
          xusuario_id?: string | null
        }
        Update: {
          id?: never
          xacao?: string
          xdados_anteriores?: Json | null
          xdados_novos?: Json | null
          xdt_auditoria?: string | null
          xip?: string | null
          xobs?: string | null
          xregistro_id?: string
          xtabela?: string
          xusuario_id?: string | null
        }
        Relationships: []
      }
      cliente: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xcd_cliente: string
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xnm_crianca: string | null
          xnm_fantasia_social: string | null
          xnm_razao_social: string
          xnr_cpf_cnpj: string | null
          xnr_telefone: string | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_cliente: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xnm_crianca?: string | null
          xnm_fantasia_social?: string | null
          xnm_razao_social: string
          xnr_cpf_cnpj?: string | null
          xnr_telefone?: string | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_cliente?: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xnm_crianca?: string | null
          xnm_fantasia_social?: string | null
          xnm_razao_social?: string
          xnr_cpf_cnpj?: string | null
          xnr_telefone?: string | null
        }
        Relationships: []
      }
      grupo_produto: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xcd_grupo_produto: string
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xnm_grupo_produto: string
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_grupo_produto: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xnm_grupo_produto: string
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_grupo_produto?: string
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xnm_grupo_produto?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          abacatepay_billing_id: string | null
          abacatepay_payment_url: string | null
          amount: number
          created_at: string
          customer_cellphone: string | null
          customer_email: string
          customer_name: string
          customer_tax_id: string | null
          description: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          abacatepay_billing_id?: string | null
          abacatepay_payment_url?: string | null
          amount: number
          created_at?: string
          customer_cellphone?: string | null
          customer_email: string
          customer_name: string
          customer_tax_id?: string | null
          description?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          abacatepay_billing_id?: string | null
          abacatepay_payment_url?: string | null
          amount?: number
          created_at?: string
          customer_cellphone?: string | null
          customer_email?: string
          customer_name?: string
          customer_tax_id?: string | null
          description?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      parametro: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xabacatepay_api_key: string | null
          xabacatepay_webhook_secret: string | null
          xabacatepay_webhook_url: string | null
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
          xcss_customizado: string | null
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xemail_remetente: string | null
          xlg_valida_estoque_link: boolean | null
          xlg_valida_estoque_pdv: boolean | null
          xmsg_pos_pagamento: string | null
          xnm_escola: string | null
          xurl_banner_vendas: string | null
          xurl_favicon: string | null
          xurl_link_vendas: string | null
          xurl_logo: string | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xabacatepay_api_key?: string | null
          xabacatepay_webhook_secret?: string | null
          xabacatepay_webhook_url?: string | null
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
          xcss_customizado?: string | null
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xemail_remetente?: string | null
          xlg_valida_estoque_link?: boolean | null
          xlg_valida_estoque_pdv?: boolean | null
          xmsg_pos_pagamento?: string | null
          xnm_escola?: string | null
          xurl_banner_vendas?: string | null
          xurl_favicon?: string | null
          xurl_link_vendas?: string | null
          xurl_logo?: string | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xabacatepay_api_key?: string | null
          xabacatepay_webhook_secret?: string | null
          xabacatepay_webhook_url?: string | null
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
          xcss_customizado?: string | null
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xemail_remetente?: string | null
          xlg_valida_estoque_link?: boolean | null
          xlg_valida_estoque_pdv?: boolean | null
          xmsg_pos_pagamento?: string | null
          xnm_escola?: string | null
          xurl_banner_vendas?: string | null
          xurl_favicon?: string | null
          xurl_link_vendas?: string | null
          xurl_logo?: string | null
        }
        Relationships: []
      }
      parametro_horario: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xdia_semana: number
          xhr_fim_matutino: string | null
          xhr_fim_vespertino: string | null
          xhr_inicio_matutino: string | null
          xhr_inicio_vespertino: string | null
          xlg_dia_ativo: boolean | null
          xparametro_id: number | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xdia_semana: number
          xhr_fim_matutino?: string | null
          xhr_fim_vespertino?: string | null
          xhr_inicio_matutino?: string | null
          xhr_inicio_vespertino?: string | null
          xlg_dia_ativo?: boolean | null
          xparametro_id?: number | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xdia_semana?: number
          xhr_fim_matutino?: string | null
          xhr_fim_vespertino?: string | null
          xhr_inicio_matutino?: string | null
          xhr_inicio_vespertino?: string | null
          xlg_dia_ativo?: boolean | null
          xparametro_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parametro_horario_xparametro_id_fkey"
            columns: ["xparametro_id"]
            isOneToOne: false
            referencedRelation: "parametro"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xcliente_id: number | null
          xdt_cancelamento: string | null
          xdt_faturamento: string | null
          xdt_finalizacao: string | null
          xdt_pagamento: string | null
          xdt_pedido: string | null
          xemail_responsavel: string | null
          xhr_pedido: string | null
          xid_transacao_abacatepay: string | null
          xlg_pagamento_online: boolean | null
          xlg_pedido_link: boolean | null
          xlg_pedido_pdv: boolean | null
          xnm_crianca: string | null
          xnm_responsavel: string | null
          xnr_pedido: number | null
          xnr_telefone_responsavel: string | null
          xobs_pedido: string | null
          xqr_code_pagamento: string | null
          xst_pedido: string | null
          xtipo_origem_pedido: string | null
          xurl_pagamento: string | null
          xusuario_id: string | null
          xvl_total_bruto: number | null
          xvl_total_desconto: number | null
          xvl_total_liquido: number | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xcliente_id?: number | null
          xdt_cancelamento?: string | null
          xdt_faturamento?: string | null
          xdt_finalizacao?: string | null
          xdt_pagamento?: string | null
          xdt_pedido?: string | null
          xemail_responsavel?: string | null
          xhr_pedido?: string | null
          xid_transacao_abacatepay?: string | null
          xlg_pagamento_online?: boolean | null
          xlg_pedido_link?: boolean | null
          xlg_pedido_pdv?: boolean | null
          xnm_crianca?: string | null
          xnm_responsavel?: string | null
          xnr_pedido?: number | null
          xnr_telefone_responsavel?: string | null
          xobs_pedido?: string | null
          xqr_code_pagamento?: string | null
          xst_pedido?: string | null
          xtipo_origem_pedido?: string | null
          xurl_pagamento?: string | null
          xusuario_id?: string | null
          xvl_total_bruto?: number | null
          xvl_total_desconto?: number | null
          xvl_total_liquido?: number | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xcliente_id?: number | null
          xdt_cancelamento?: string | null
          xdt_faturamento?: string | null
          xdt_finalizacao?: string | null
          xdt_pagamento?: string | null
          xdt_pedido?: string | null
          xemail_responsavel?: string | null
          xhr_pedido?: string | null
          xid_transacao_abacatepay?: string | null
          xlg_pagamento_online?: boolean | null
          xlg_pedido_link?: boolean | null
          xlg_pedido_pdv?: boolean | null
          xnm_crianca?: string | null
          xnm_responsavel?: string | null
          xnr_pedido?: number | null
          xnr_telefone_responsavel?: string | null
          xobs_pedido?: string | null
          xqr_code_pagamento?: string | null
          xst_pedido?: string | null
          xtipo_origem_pedido?: string | null
          xurl_pagamento?: string | null
          xusuario_id?: string | null
          xvl_total_bruto?: number | null
          xvl_total_desconto?: number | null
          xvl_total_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_xcliente_id_fkey"
            columns: ["xcliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_item: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xcd_produto: string | null
          xnm_produto: string | null
          xpedido_id: number
          xproduto_id: number | null
          xqt_item: number | null
          xun_produto: string | null
          xvl_total_item: number | null
          xvl_unitario: number | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_produto?: string | null
          xnm_produto?: string | null
          xpedido_id: number
          xproduto_id?: number | null
          xqt_item?: number | null
          xun_produto?: string | null
          xvl_total_item?: number | null
          xvl_unitario?: number | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xcd_produto?: string | null
          xnm_produto?: string | null
          xpedido_id?: number
          xproduto_id?: number | null
          xqt_item?: number | null
          xun_produto?: string | null
          xvl_total_item?: number | null
          xvl_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_xpedido_id_fkey"
            columns: ["xpedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_xpedido_id_fkey"
            columns: ["xpedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pedidos_completos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_xproduto_id_fkey"
            columns: ["xproduto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_xproduto_id_fkey"
            columns: ["xproduto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_disponiveis"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_pagamento: {
        Row: {
          excluido_visivel: boolean | null
          id: number
          xdt_pagamento: string | null
          xnr_autorizacao: string | null
          xobs_pagamento: string | null
          xpedido_id: number
          xtp_pagamento: string
          xvl_pagamento: number | null
        }
        Insert: {
          excluido_visivel?: boolean | null
          id?: never
          xdt_pagamento?: string | null
          xnr_autorizacao?: string | null
          xobs_pagamento?: string | null
          xpedido_id: number
          xtp_pagamento: string
          xvl_pagamento?: number | null
        }
        Update: {
          excluido_visivel?: boolean | null
          id?: never
          xdt_pagamento?: string | null
          xnr_autorizacao?: string | null
          xobs_pagamento?: string | null
          xpedido_id?: number
          xtp_pagamento?: string
          xvl_pagamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pagamento_xpedido_id_fkey"
            columns: ["xpedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_pagamento_xpedido_id_fkey"
            columns: ["xpedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pedidos_completos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto: {
        Row: {
          empresa_id: number | null
          excluido_visivel: boolean | null
          id: number
          xcd_barra: string | null
          xcd_produto: string
          xdias_venda_online: string | null
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xgrupo_produto_id: number | null
          xlg_venda_online: boolean | null
          xnm_produto: string
          xpc_markup: number | null
          xqt_estoque_disponivel: number | null
          xqt_estoque_fisico: number | null
          xqt_estoque_minimo: number | null
          xqt_estoque_padrao: number | null
          xqt_estoque_reservado: number | null
          xun_produto: string | null
          xurl_foto: string | null
          xvl_preco_compra: number | null
          xvl_preco_sugerido: number | null
          xvl_preco_venda: number | null
        }
        Insert: {
          empresa_id?: number | null
          excluido_visivel?: boolean | null
          id?: never
          xcd_barra?: string | null
          xcd_produto: string
          xdias_venda_online?: string | null
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xgrupo_produto_id?: number | null
          xlg_venda_online?: boolean | null
          xnm_produto: string
          xpc_markup?: number | null
          xqt_estoque_disponivel?: number | null
          xqt_estoque_fisico?: number | null
          xqt_estoque_minimo?: number | null
          xqt_estoque_padrao?: number | null
          xqt_estoque_reservado?: number | null
          xun_produto?: string | null
          xurl_foto?: string | null
          xvl_preco_compra?: number | null
          xvl_preco_sugerido?: number | null
          xvl_preco_venda?: number | null
        }
        Update: {
          empresa_id?: number | null
          excluido_visivel?: boolean | null
          id?: never
          xcd_barra?: string | null
          xcd_produto?: string
          xdias_venda_online?: string | null
          xdt_alteracao?: string | null
          xdt_cadastro?: string | null
          xgrupo_produto_id?: number | null
          xlg_venda_online?: boolean | null
          xnm_produto?: string
          xpc_markup?: number | null
          xqt_estoque_disponivel?: number | null
          xqt_estoque_fisico?: number | null
          xqt_estoque_minimo?: number | null
          xqt_estoque_padrao?: number | null
          xqt_estoque_reservado?: number | null
          xun_produto?: string | null
          xurl_foto?: string | null
          xvl_preco_compra?: number | null
          xvl_preco_sugerido?: number | null
          xvl_preco_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_xgrupo_produto_id_fkey"
            columns: ["xgrupo_produto_id"]
            isOneToOne: false
            referencedRelation: "grupo_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          xemail: string | null
          xlg_aprovado: boolean
          xnm_usuario: string
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
          xemail?: string | null
          xlg_aprovado?: boolean
          xnm_usuario?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          xemail?: string | null
          xlg_aprovado?: boolean
          xnm_usuario?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_pedidos_completos: {
        Row: {
          excluido_visivel: boolean | null
          id: number | null
          xcliente_id: number | null
          xdt_cancelamento: string | null
          xdt_faturamento: string | null
          xdt_finalizacao: string | null
          xdt_pagamento: string | null
          xdt_pedido: string | null
          xemail_responsavel: string | null
          xhr_pedido: string | null
          xid_transacao_abacatepay: string | null
          xlg_pagamento_online: boolean | null
          xlg_pedido_link: boolean | null
          xlg_pedido_pdv: boolean | null
          xnm_cliente: string | null
          xnm_crianca: string | null
          xnm_responsavel: string | null
          xnr_pedido: number | null
          xnr_telefone_responsavel: string | null
          xobs_pedido: string | null
          xqr_code_pagamento: string | null
          xst_pedido: string | null
          xtipo_origem_pedido: string | null
          xurl_pagamento: string | null
          xusuario_id: string | null
          xvl_total_bruto: number | null
          xvl_total_desconto: number | null
          xvl_total_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_xcliente_id_fkey"
            columns: ["xcliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_produtos_disponiveis: {
        Row: {
          empresa_id: number | null
          excluido_visivel: boolean | null
          id: number | null
          xcd_barra: string | null
          xcd_produto: string | null
          xdias_venda_online: string | null
          xdt_alteracao: string | null
          xdt_cadastro: string | null
          xgrupo_produto_id: number | null
          xlg_venda_online: boolean | null
          xnm_grupo_produto: string | null
          xnm_produto: string | null
          xpc_markup: number | null
          xqt_estoque_disponivel: number | null
          xqt_estoque_fisico: number | null
          xqt_estoque_minimo: number | null
          xqt_estoque_padrao: number | null
          xqt_estoque_reservado: number | null
          xun_produto: string | null
          xurl_foto: string | null
          xvl_preco_compra: number | null
          xvl_preco_sugerido: number | null
          xvl_preco_venda: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_xgrupo_produto_id_fkey"
            columns: ["xgrupo_produto_id"]
            isOneToOne: false
            referencedRelation: "grupo_produto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fu_bootstrap_role: { Args: { _user_id: string }; Returns: undefined }
      fu_ensure_profile: {
        Args: { _email: string; _name: string; _user_id: string }
        Returns: undefined
      }
      fu_get_cliente_public: {
        Args: { _cpf: string }
        Returns: {
          id: number
          xnm_crianca: string
          xnm_razao_social: string
          xnr_telefone: string
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
        Args: { _cpf: string; _pedido_id: number }
        Returns: {
          id: number
          xdt_pedido: string
          xnr_pedido: number
          xst_pedido: string
          xurl_pagamento: string
          xvl_total_liquido: number
        }[]
      }
      fu_is_aprovado: { Args: { _user_id: string }; Returns: boolean }
      fu_list_pedidos_public: {
        Args: { _cpf: string }
        Returns: {
          id: number
          items: Json
          xdt_pedido: string
          xnr_pedido: number
          xst_pedido: string
          xvl_total_liquido: number
        }[]
      }
      fu_list_users_admin: {
        Args: never
        Returns: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          xemail: string
          xlg_aprovado: boolean
          xnm_usuario: string
        }[]
      }
      fu_log_auditoria: {
        Args: {
          _acao: string
          _dados_anteriores?: Json
          _dados_novos?: Json
          _obs?: string
          _registro_id: string
          _tabela: string
        }
        Returns: undefined
      }
      fu_recalcular_pedido: { Args: { _pedido_id: number }; Returns: undefined }
      fu_set_user_approval: {
        Args: { _aprovado: boolean; _user_id: string }
        Returns: undefined
      }
      fu_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      fu_transition_pedido_status: {
        Args: { _novo_status: string; _pedido_id: number; _usuario_id?: string }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADM" | "CAIXA"
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
    Enums: {
      app_role: ["ADM", "CAIXA"],
    },
  },
} as const

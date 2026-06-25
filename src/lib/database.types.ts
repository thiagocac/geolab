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
      amostras: {
        Row: {
          codigo: string | null
          concretagem_id: string
          created_at: string
          data_moldagem: string
          deleted_at: string | null
          hora_moldagem: string | null
          id: string
          observacoes: string | null
          receipt_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          concretagem_id: string
          created_at?: string
          data_moldagem: string
          deleted_at?: string | null
          hora_moldagem?: string | null
          id?: string
          observacoes?: string | null
          receipt_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          concretagem_id?: string
          created_at?: string
          data_moldagem?: string
          deleted_at?: string | null
          hora_moldagem?: string | null
          id?: string
          observacoes?: string | null
          receipt_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amostras_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "material_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          assigned_to: string | null
          comment: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          due_at: string | null
          entity_id: string
          entity_type: string
          id: string
          instance_id: string | null
          instrucoes: string | null
          nome: string
          obrigatoria: boolean
          ordem: number
          role_required: string
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          due_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          instance_id?: string | null
          instrucoes?: string | null
          nome: string
          obrigatoria?: boolean
          ordem: number
          role_required: string
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          due_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          instance_id?: string | null
          instrucoes?: string | null
          nome?: string
          obrigatoria?: boolean
          ordem?: number
          role_required?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          ativo: boolean
          cargo: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          nome: string
          papeis: string[]
          telefone: string | null
          tenant_id: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome: string
          papeis?: string[]
          telefone?: string | null
          tenant_id: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          papeis?: string[]
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      client_telemetry_log: {
        Row: {
          app_version: string | null
          category: string
          created_at: string | null
          error_fingerprint: string | null
          id: string
          ip_address: unknown
          level: string
          member_id: string | null
          message: string
          metadata: Json | null
          occurred_at: string
          session_id: string | null
          stack: string | null
          tenant_id: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          app_version?: string | null
          category: string
          created_at?: string | null
          error_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          level: string
          member_id?: string | null
          message: string
          metadata?: Json | null
          occurred_at: string
          session_id?: string | null
          stack?: string | null
          tenant_id?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          app_version?: string | null
          category?: string
          created_at?: string | null
          error_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          level?: string
          member_id?: string | null
          message?: string
          metadata?: Json | null
          occurred_at?: string
          session_id?: string | null
          stack?: string | null
          tenant_id?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      client_telemetry_rate_limit: {
        Row: {
          actor_key: string
          bucket_start: string
          calls: number
        }
        Insert: {
          actor_key: string
          bucket_start: string
          calls?: number
        }
        Update: {
          actor_key?: string
          bucket_start?: string
          calls?: number
        }
        Relationships: []
      }
      client_works: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          client_id: string
          codigo: string | null
          crea: string | null
          created_at: string
          deleted_at: string | null
          endereco: string | null
          estrutura_habilitada: boolean
          etapa: string | null
          id: string
          nome: string
          precos: Json
          responsavel_tecnico: string | null
          status: string
          tenant_id: string
          tipo: string | null
          traco_habilitado: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_id: string
          codigo?: string | null
          crea?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          estrutura_habilitada?: boolean
          etapa?: string | null
          id?: string
          nome: string
          precos?: Json
          responsavel_tecnico?: string | null
          status?: string
          tenant_id: string
          tipo?: string | null
          traco_habilitado?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string
          codigo?: string | null
          crea?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          estrutura_habilitada?: boolean
          etapa?: string | null
          id?: string
          nome?: string
          precos?: Json
          responsavel_tecnico?: string | null
          status?: string
          tenant_id?: string
          tipo?: string | null
          traco_habilitado?: boolean
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_works_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_works_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_certificacoes: {
        Row: {
          anexo_path: string | null
          colaborador_id: string
          created_at: string
          deleted_at: string | null
          id: string
          numero: string | null
          tenant_id: string
          tipo: string
          validade: string | null
        }
        Insert: {
          anexo_path?: string | null
          colaborador_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          tenant_id: string
          tipo: string
          validade?: string | null
        }
        Update: {
          anexo_path?: string | null
          colaborador_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          numero?: string | null
          tenant_id?: string
          tipo?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_certificacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_certificacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          documento: string | null
          funcoes: string[]
          id: string
          member_id: string | null
          nome: string
          registro_profissional: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          funcoes?: string[]
          id?: string
          member_id?: string | null
          nome: string
          registro_profissional?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          funcoes?: string[]
          id?: string
          member_id?: string | null
          nome?: string
          registro_profissional?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      concretagens: {
        Row: {
          bombeado: boolean
          client_id: string
          clima: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_programada: string | null
          data_real: string | null
          deleted_at: string | null
          dimensao_cp: string | null
          fck_previsto: number | null
          fornecedor_texto: string | null
          hora_fim: string | null
          hora_inicio: string | null
          hora_programada: string | null
          id: string
          local_texto: string | null
          metadata: Json
          moldador_id: string | null
          observacoes: string | null
          operational_material_id: string | null
          origem: string
          responsavel_member_id: string | null
          retroativa_justificativa: string | null
          status: Database["public"]["Enums"]["record_status"]
          temperatura_ambiente_c: number | null
          tenant_id: string
          traco_texto: string | null
          unit_id: string | null
          updated_at: string
          volume_lancado_m3: number | null
          volume_programado_m3: number | null
          work_id: string
        }
        Insert: {
          bombeado?: boolean
          client_id: string
          clima?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_programada?: string | null
          data_real?: string | null
          deleted_at?: string | null
          dimensao_cp?: string | null
          fck_previsto?: number | null
          fornecedor_texto?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          hora_programada?: string | null
          id?: string
          local_texto?: string | null
          metadata?: Json
          moldador_id?: string | null
          observacoes?: string | null
          operational_material_id?: string | null
          origem?: string
          responsavel_member_id?: string | null
          retroativa_justificativa?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          temperatura_ambiente_c?: number | null
          tenant_id: string
          traco_texto?: string | null
          unit_id?: string | null
          updated_at?: string
          volume_lancado_m3?: number | null
          volume_programado_m3?: number | null
          work_id: string
        }
        Update: {
          bombeado?: boolean
          client_id?: string
          clima?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_programada?: string | null
          data_real?: string | null
          deleted_at?: string | null
          dimensao_cp?: string | null
          fck_previsto?: number | null
          fornecedor_texto?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          hora_programada?: string | null
          id?: string
          local_texto?: string | null
          metadata?: Json
          moldador_id?: string | null
          observacoes?: string | null
          operational_material_id?: string | null
          origem?: string
          responsavel_member_id?: string | null
          retroativa_justificativa?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          temperatura_ambiente_c?: number | null
          tenant_id?: string
          traco_texto?: string | null
          unit_id?: string | null
          updated_at?: string
          volume_lancado_m3?: number | null
          volume_programado_m3?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concretagens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_moldador_id_fkey"
            columns: ["moldador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_operational_material_id_fkey"
            columns: ["operational_material_id"]
            isOneToOne: false
            referencedRelation: "operational_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_responsavel_member_id_fkey"
            columns: ["responsavel_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      config_lab: {
        Row: {
          acreditacao_inmetro: string | null
          art_numero: string | null
          concretagem_campos: Json
          cor_primaria: string | null
          cp_overdue_days: number
          crea_gq: string | null
          crea_rt: string | null
          created_at: string
          ensaio_campos: Json
          gerente_qualidade: string | null
          idade_controle_default: number
          laudo_campos: Json
          local_ensaio: string | null
          logo_path: string | null
          nota_rodape: string | null
          recebimento_campos: Json
          responsavel_tecnico: string | null
          tenant_id: string
          updated_at: string
          validade_acreditacao: string | null
        }
        Insert: {
          acreditacao_inmetro?: string | null
          art_numero?: string | null
          concretagem_campos?: Json
          cor_primaria?: string | null
          cp_overdue_days?: number
          crea_gq?: string | null
          crea_rt?: string | null
          created_at?: string
          ensaio_campos?: Json
          gerente_qualidade?: string | null
          idade_controle_default?: number
          laudo_campos?: Json
          local_ensaio?: string | null
          logo_path?: string | null
          nota_rodape?: string | null
          recebimento_campos?: Json
          responsavel_tecnico?: string | null
          tenant_id: string
          updated_at?: string
          validade_acreditacao?: string | null
        }
        Update: {
          acreditacao_inmetro?: string | null
          art_numero?: string | null
          concretagem_campos?: Json
          cor_primaria?: string | null
          cp_overdue_days?: number
          crea_gq?: string | null
          crea_rt?: string | null
          created_at?: string
          ensaio_campos?: Json
          gerente_qualidade?: string | null
          idade_controle_default?: number
          laudo_campos?: Json
          local_ensaio?: string | null
          logo_path?: string | null
          nota_rodape?: string | null
          recebimento_campos?: Json
          responsavel_tecnico?: string | null
          tenant_id?: string
          updated_at?: string
          validade_acreditacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_lab_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_test_types: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          material_test_type_id: string
          tenant_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          material_test_type_id: string
          tenant_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          material_test_type_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_test_types_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lab_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_test_types_material_test_type_id_fkey"
            columns: ["material_test_type_id"]
            isOneToOne: false
            referencedRelation: "material_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_test_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_works: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          tenant_id: string
          work_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          tenant_id: string
          work_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_works_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lab_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_works_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      corpos_prova: {
        Row: {
          amostra_id: string
          codigo: string
          concretagem_id: string | null
          contraprova: boolean
          contraprova_de_id: string | null
          created_at: string
          data_moldagem: string | null
          data_prevista_rompimento: string | null
          data_real_rompimento: string | null
          data_recebimento_lab: string | null
          deleted_at: string | null
          external_key: string | null
          id: string
          idade_dias: number | null
          idade_unidade: string
          material_test_type_id: string | null
          metadata: Json
          motivo_descarte: string | null
          numeracao_lab: string | null
          ordem: number | null
          receipt_id: string | null
          situacao: string
          tenant_id: string
          updated_at: string
          valor_esperado: number | null
        }
        Insert: {
          amostra_id: string
          codigo: string
          concretagem_id?: string | null
          contraprova?: boolean
          contraprova_de_id?: string | null
          created_at?: string
          data_moldagem?: string | null
          data_prevista_rompimento?: string | null
          data_real_rompimento?: string | null
          data_recebimento_lab?: string | null
          deleted_at?: string | null
          external_key?: string | null
          id?: string
          idade_dias?: number | null
          idade_unidade?: string
          material_test_type_id?: string | null
          metadata?: Json
          motivo_descarte?: string | null
          numeracao_lab?: string | null
          ordem?: number | null
          receipt_id?: string | null
          situacao?: string
          tenant_id: string
          updated_at?: string
          valor_esperado?: number | null
        }
        Update: {
          amostra_id?: string
          codigo?: string
          concretagem_id?: string | null
          contraprova?: boolean
          contraprova_de_id?: string | null
          created_at?: string
          data_moldagem?: string | null
          data_prevista_rompimento?: string | null
          data_real_rompimento?: string | null
          data_recebimento_lab?: string | null
          deleted_at?: string | null
          external_key?: string | null
          id?: string
          idade_dias?: number | null
          idade_unidade?: string
          material_test_type_id?: string | null
          metadata?: Json
          motivo_descarte?: string | null
          numeracao_lab?: string | null
          ordem?: number | null
          receipt_id?: string | null
          situacao?: string
          tenant_id?: string
          updated_at?: string
          valor_esperado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corpos_prova_amostra_id_fkey"
            columns: ["amostra_id"]
            isOneToOne: false
            referencedRelation: "amostras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_contraprova_de_id_fkey"
            columns: ["contraprova_de_id"]
            isOneToOne: false
            referencedRelation: "corpos_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_material_test_type_id_fkey"
            columns: ["material_test_type_id"]
            isOneToOne: false
            referencedRelation: "material_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "material_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corpos_prova_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_action_records: {
        Row: {
          acao_preventiva: string | null
          causa_raiz: string | null
          created_at: string
          data_validacao: string | null
          deleted_at: string | null
          eficacia_validada: boolean | null
          id: string
          nc_id: string | null
          numero: string
          origem: string | null
          plano_acao: string | null
          prazo: string | null
          reincidencia: boolean
          severidade: string | null
          status: string | null
          tenant_id: string
          updated_at: string
          validado_por: string | null
        }
        Insert: {
          acao_preventiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          data_validacao?: string | null
          deleted_at?: string | null
          eficacia_validada?: boolean | null
          id?: string
          nc_id?: string | null
          numero: string
          origem?: string | null
          plano_acao?: string | null
          prazo?: string | null
          reincidencia?: boolean
          severidade?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
          validado_por?: string | null
        }
        Update: {
          acao_preventiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          data_validacao?: string | null
          deleted_at?: string | null
          eficacia_validada?: boolean | null
          id?: string
          nc_id?: string | null
          numero?: string
          origem?: string | null
          plano_acao?: string | null
          prazo?: string | null
          reincidencia?: boolean
          severidade?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_action_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_action_records_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_heartbeat: {
        Row: {
          active: boolean
          consecutive_failures: number
          created_at: string
          description: string | null
          expected_max_age_minutes: number
          job_name: string
          last_error: string | null
          last_seen_at: string
          last_status: string | null
          total_failures: number
          total_runs: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          expected_max_age_minutes: number
          job_name: string
          last_error?: string | null
          last_seen_at?: string
          last_status?: string | null
          total_failures?: number
          total_runs?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          expected_max_age_minutes?: number
          job_name?: string
          last_error?: string | null
          last_seen_at?: string
          last_status?: string | null
          total_failures?: number
          total_runs?: number
          updated_at?: string
        }
        Relationships: []
      }
      ef_invocation_log: {
        Row: {
          actor_id: string | null
          created_at: string | null
          duration_ms: number
          error_message: string | null
          fn_name: string
          id: string
          metadata: Json | null
          request_id: string | null
          started_at: string
          status_code: number
          tenant_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          duration_ms: number
          error_message?: string | null
          fn_name: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          started_at: string
          status_code: number
          tenant_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          duration_ms?: number
          error_message?: string | null
          fn_name?: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          started_at?: string
          status_code?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          metadata: Json
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          metadata?: Json
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          metadata?: Json
          reason?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          anexo_certificado_path: string | null
          ativo: boolean
          capacidade_kn: number | null
          classe: string | null
          created_at: string
          data_calibracao: string | null
          deleted_at: string | null
          id: string
          incerteza_mpa: number | null
          lab_calibrador: string | null
          marca_modelo: string | null
          numero_certificado: string | null
          numero_serie: string | null
          observacao: string | null
          tenant_id: string
          tipo: string
          tipos_ensaio: string[]
          updated_at: string
          validade_calibracao: string | null
        }
        Insert: {
          anexo_certificado_path?: string | null
          ativo?: boolean
          capacidade_kn?: number | null
          classe?: string | null
          created_at?: string
          data_calibracao?: string | null
          deleted_at?: string | null
          id?: string
          incerteza_mpa?: number | null
          lab_calibrador?: string | null
          marca_modelo?: string | null
          numero_certificado?: string | null
          numero_serie?: string | null
          observacao?: string | null
          tenant_id: string
          tipo?: string
          tipos_ensaio?: string[]
          updated_at?: string
          validade_calibracao?: string | null
        }
        Update: {
          anexo_certificado_path?: string | null
          ativo?: boolean
          capacidade_kn?: number | null
          classe?: string | null
          created_at?: string
          data_calibracao?: string | null
          deleted_at?: string | null
          id?: string
          incerteza_mpa?: number | null
          lab_calibrador?: string | null
          marca_modelo?: string | null
          numero_certificado?: string | null
          numero_serie?: string | null
          observacao?: string | null
          tenant_id?: string
          tipo?: string
          tipos_ensaio?: string[]
          updated_at?: string
          validade_calibracao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          concretagem_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          id: string
          path: string
          receipt_id: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          concretagem_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          path: string
          receipt_id?: string | null
          tenant_id: string
          tipo?: string
        }
        Update: {
          concretagem_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          path?: string
          receipt_id?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "material_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          client_id: string | null
          competencia: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          medicao_id: string | null
          numero: string
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          client_id?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          medicao_id?: string | null
          numero: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          client_id?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          medicao_id?: string | null
          numero?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_movimentacoes: {
        Row: {
          colaborador_id: string | null
          created_at: string
          data: string | null
          deleted_at: string | null
          id: string
          observacoes: string | null
          quantidade: number
          tenant_id: string
          tipo: string
          updated_at: string
          work_id: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          id?: string
          observacoes?: string | null
          quantidade?: number
          tenant_id: string
          tipo: string
          updated_at?: string
          work_id: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          id?: string
          observacoes?: string | null
          quantidade?: number
          tenant_id?: string
          tipo?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_movimentacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_movimentacoes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_canary_checks: {
        Row: {
          cache_name: string | null
          error: string | null
          evaluated_at: string | null
          id: number
          ok: boolean | null
          request_id: number | null
          requested_at: string
          status_code: number | null
          url: string
        }
        Insert: {
          cache_name?: string | null
          error?: string | null
          evaluated_at?: string | null
          id?: number
          ok?: boolean | null
          request_id?: number | null
          requested_at?: string
          status_code?: number | null
          url: string
        }
        Update: {
          cache_name?: string | null
          error?: string | null
          evaluated_at?: string | null
          id?: number
          ok?: boolean | null
          request_id?: number | null
          requested_at?: string
          status_code?: number | null
          url?: string
        }
        Relationships: []
      }
      lab_clients: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          observacoes: string | null
          precos: Json
          razao_social: string
          status: string
          telefone: string | null
          tenant_id: string
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          precos?: Json
          razao_social: string
          status?: string
          telefone?: string | null
          tenant_id: string
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          precos?: Json
          razao_social?: string
          status?: string
          telefone?: string | null
          tenant_id?: string
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_contracts: {
        Row: {
          anexo_path: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          descricao: string | null
          id: string
          numero: string | null
          precos: Json
          status: string
          tenant_id: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          anexo_path?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          precos?: Json
          status?: string
          tenant_id: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          anexo_path?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          precos?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          amostra_id: string | null
          approved_at: string | null
          approved_by: string | null
          art: string | null
          client_id: string
          concretagem_id: string | null
          crea_rt: string | null
          created_at: string
          data_emissao: string | null
          deleted_at: string | null
          escopo: string
          hash_sha256: string | null
          id: string
          justificativa: string | null
          laboratorio_nome: string | null
          lote_importacao_id: string | null
          material_test_type_id: string | null
          numero: string
          origem: string
          responsavel_tecnico: string | null
          revisao: number
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
          work_id: string
        }
        Insert: {
          amostra_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          art?: string | null
          client_id: string
          concretagem_id?: string | null
          crea_rt?: string | null
          created_at?: string
          data_emissao?: string | null
          deleted_at?: string | null
          escopo?: string
          hash_sha256?: string | null
          id?: string
          justificativa?: string | null
          laboratorio_nome?: string | null
          lote_importacao_id?: string | null
          material_test_type_id?: string | null
          numero: string
          origem?: string
          responsavel_tecnico?: string | null
          revisao?: number
          status?: string
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
          work_id: string
        }
        Update: {
          amostra_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          art?: string | null
          client_id?: string
          concretagem_id?: string | null
          crea_rt?: string | null
          created_at?: string
          data_emissao?: string | null
          deleted_at?: string | null
          escopo?: string
          hash_sha256?: string | null
          id?: string
          justificativa?: string | null
          laboratorio_nome?: string | null
          lote_importacao_id?: string | null
          material_test_type_id?: string | null
          numero?: string
          origem?: string
          responsavel_tecnico?: string | null
          revisao?: number
          status?: string
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_amostra_id_fkey"
            columns: ["amostra_id"]
            isOneToOne: false
            referencedRelation: "amostras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_lote_importacao_id_fkey"
            columns: ["lote_importacao_id"]
            isOneToOne: false
            referencedRelation: "lotes_importacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_material_test_type_id_fkey"
            columns: ["material_test_type_id"]
            isOneToOne: false
            referencedRelation: "material_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      laudo_resultados: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          lab_report_id: string
          material_test_id: string
          tenant_id: string
          vinculo_origem: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          lab_report_id: string
          material_test_id: string
          tenant_id: string
          vinculo_origem?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          lab_report_id?: string
          material_test_id?: string
          tenant_id?: string
          vinculo_origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudo_resultados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudo_resultados_lab_report_id_fkey"
            columns: ["lab_report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudo_resultados_material_test_id_fkey"
            columns: ["material_test_id"]
            isOneToOne: false
            referencedRelation: "material_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudo_resultados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_aceitacao: {
        Row: {
          condicao_preparo: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fck_est: number | null
          fck_mpa: number
          fcm: number | null
          id: string
          idade_controle_dias: number
          n_exemplares: number
          numero: string
          observacao: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          sd: number | null
          status: string
          tenant_id: string
          updated_at: string
          work_id: string
        }
        Insert: {
          condicao_preparo?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fck_est?: number | null
          fck_mpa: number
          fcm?: number | null
          id?: string
          idade_controle_dias?: number
          n_exemplares?: number
          numero: string
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          sd?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
          work_id: string
        }
        Update: {
          condicao_preparo?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fck_est?: number | null
          fck_mpa?: number
          fcm?: number | null
          id?: string
          idade_controle_dias?: number
          n_exemplares?: number
          numero?: string
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          sd?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_aceitacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_aceitacao_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_importacao: {
        Row: {
          alertas: Json
          arquivo_bucket: string | null
          arquivo_path: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          erros: Json
          feature_ocr_enabled: boolean
          id: string
          linhas_extraidas: number
          origem: string
          preview: Json
          status: Database["public"]["Enums"]["record_status"]
          tenant_id: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          alertas?: Json
          arquivo_bucket?: string | null
          arquivo_path?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          erros?: Json
          feature_ocr_enabled?: boolean
          id?: string
          linhas_extraidas?: number
          origem?: string
          preview?: Json
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          alertas?: Json
          arquivo_bucket?: string | null
          arquivo_path?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          erros?: Json
          feature_ocr_enabled?: boolean
          id?: string
          linhas_extraidas?: number
          origem?: string
          preview?: Json
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_importacao_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_importacao_linhas: {
        Row: {
          created_at: string
          dados_extraidos: Json
          deleted_at: string | null
          erros: Json
          external_key: string | null
          id: string
          lab_report_id: string | null
          linha_numero: number
          lote_id: string
          resultado_id: string | null
          status: Database["public"]["Enums"]["record_status"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          dados_extraidos?: Json
          deleted_at?: string | null
          erros?: Json
          external_key?: string | null
          id?: string
          lab_report_id?: string | null
          linha_numero: number
          lote_id: string
          resultado_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          dados_extraidos?: Json
          deleted_at?: string | null
          erros?: Json
          external_key?: string | null
          id?: string
          lab_report_id?: string | null
          linha_numero?: number
          lote_id?: string
          resultado_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_importacao_linhas_lab_report_fk"
            columns: ["lab_report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_linhas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_importacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_linhas_resultado_id_fkey"
            columns: ["resultado_id"]
            isOneToOne: false
            referencedRelation: "material_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_importacao_linhas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_links: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_table: string
          expires_at: string
          id: string
          purpose: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_table: string
          expires_at: string
          id?: string
          purpose: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_table?: string
          expires_at?: string
          id?: string
          purpose?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      material_receipts: {
        Row: {
          agua_litros: number | null
          concretagem_id: string
          created_at: string
          deleted_at: string | null
          elementos_concretados: string | null
          external_key: string | null
          hora_chegada_obra: string | null
          hora_fim_descarga: string | null
          hora_inicio_descarga: string | null
          hora_moldagem: string | null
          hora_saida_usina: string | null
          houve_adicao_agua: boolean
          id: string
          motivo_rejeicao: string | null
          motorista: string | null
          nota_fiscal: string
          observacoes: string | null
          placa: string | null
          rejeitado: boolean
          serie: number | null
          slump_medido_cm: number | null
          temperatura_concreto_c: number | null
          tempo_transporte_min: number | null
          tenant_id: string
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          agua_litros?: number | null
          concretagem_id: string
          created_at?: string
          deleted_at?: string | null
          elementos_concretados?: string | null
          external_key?: string | null
          hora_chegada_obra?: string | null
          hora_fim_descarga?: string | null
          hora_inicio_descarga?: string | null
          hora_moldagem?: string | null
          hora_saida_usina?: string | null
          houve_adicao_agua?: boolean
          id?: string
          motivo_rejeicao?: string | null
          motorista?: string | null
          nota_fiscal: string
          observacoes?: string | null
          placa?: string | null
          rejeitado?: boolean
          serie?: number | null
          slump_medido_cm?: number | null
          temperatura_concreto_c?: number | null
          tempo_transporte_min?: number | null
          tenant_id: string
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          agua_litros?: number | null
          concretagem_id?: string
          created_at?: string
          deleted_at?: string | null
          elementos_concretados?: string | null
          external_key?: string | null
          hora_chegada_obra?: string | null
          hora_fim_descarga?: string | null
          hora_inicio_descarga?: string | null
          hora_moldagem?: string | null
          hora_saida_usina?: string | null
          houve_adicao_agua?: boolean
          id?: string
          motivo_rejeicao?: string | null
          motorista?: string | null
          nota_fiscal?: string
          observacoes?: string | null
          placa?: string | null
          rejeitado?: boolean
          serie?: number | null
          slump_medido_cm?: number | null
          temperatura_concreto_c?: number | null
          tempo_transporte_min?: number | null
          tenant_id?: string
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_receipts_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipts_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      material_test_types: {
        Row: {
          ativo: boolean
          codigo: string
          cp_altura_padrao_mm: number | null
          cp_diametro_padrao_mm: number | null
          created_at: string
          deleted_at: string | null
          descarte_automatico: boolean
          descricao_curta: string | null
          email_idades: string | null
          ensaio_grupo: string
          enviar_email: boolean
          gera_nc: boolean
          id: string
          idade_controle: number | null
          idade_controle_unidade: string
          idade_padrao_dias: number | null
          limite_max: number | null
          limite_min: number | null
          material_kind: Database["public"]["Enums"]["material_kind"]
          nc_tipo_code: string | null
          nome: string
          observacao: string | null
          padrao: boolean
          tenant_id: string | null
          tipo_resultado_consolidado: string
          unidade_resultado: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          cp_altura_padrao_mm?: number | null
          cp_diametro_padrao_mm?: number | null
          created_at?: string
          deleted_at?: string | null
          descarte_automatico?: boolean
          descricao_curta?: string | null
          email_idades?: string | null
          ensaio_grupo: string
          enviar_email?: boolean
          gera_nc?: boolean
          id?: string
          idade_controle?: number | null
          idade_controle_unidade?: string
          idade_padrao_dias?: number | null
          limite_max?: number | null
          limite_min?: number | null
          material_kind: Database["public"]["Enums"]["material_kind"]
          nc_tipo_code?: string | null
          nome: string
          observacao?: string | null
          padrao?: boolean
          tenant_id?: string | null
          tipo_resultado_consolidado?: string
          unidade_resultado?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          cp_altura_padrao_mm?: number | null
          cp_diametro_padrao_mm?: number | null
          created_at?: string
          deleted_at?: string | null
          descarte_automatico?: boolean
          descricao_curta?: string | null
          email_idades?: string | null
          ensaio_grupo?: string
          enviar_email?: boolean
          gera_nc?: boolean
          id?: string
          idade_controle?: number | null
          idade_controle_unidade?: string
          idade_padrao_dias?: number | null
          limite_max?: number | null
          limite_min?: number | null
          material_kind?: Database["public"]["Enums"]["material_kind"]
          nc_tipo_code?: string | null
          nome?: string
          observacao?: string | null
          padrao?: boolean
          tenant_id?: string | null
          tipo_resultado_consolidado?: string
          unidade_resultado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_test_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      material_tests: {
        Row: {
          aprovado_at: string | null
          aprovado_by: string | null
          capeamento: string | null
          carga_ruptura_kn: number | null
          codigo: string | null
          concretagem_id: string | null
          corpo_prova_id: string
          cp_altura_mm: number
          cp_diametro_mm: number
          created_at: string
          data_rompimento: string | null
          deleted_at: string | null
          equipamento_id: string | null
          external_key: string | null
          fck_referencia_mpa: number | null
          hora_rompimento: string | null
          id: string
          idade_dias: number | null
          idade_unidade: string
          justificativa_alteracao: string | null
          massa_cp_g: number | null
          material_test_type_id: string | null
          observacao: string | null
          operador_id: string | null
          origem: string
          receipt_id: string | null
          result_version: number
          resultado_valor: number | null
          status: Database["public"]["Enums"]["record_status"] | null
          substitui_resultado_id: string | null
          tenant_id: string
          tipo_ruptura: string | null
          unidade_resultado: string
          updated_at: string
        }
        Insert: {
          aprovado_at?: string | null
          aprovado_by?: string | null
          capeamento?: string | null
          carga_ruptura_kn?: number | null
          codigo?: string | null
          concretagem_id?: string | null
          corpo_prova_id: string
          cp_altura_mm?: number
          cp_diametro_mm?: number
          created_at?: string
          data_rompimento?: string | null
          deleted_at?: string | null
          equipamento_id?: string | null
          external_key?: string | null
          fck_referencia_mpa?: number | null
          hora_rompimento?: string | null
          id?: string
          idade_dias?: number | null
          idade_unidade?: string
          justificativa_alteracao?: string | null
          massa_cp_g?: number | null
          material_test_type_id?: string | null
          observacao?: string | null
          operador_id?: string | null
          origem?: string
          receipt_id?: string | null
          result_version?: number
          resultado_valor?: number | null
          status?: Database["public"]["Enums"]["record_status"] | null
          substitui_resultado_id?: string | null
          tenant_id: string
          tipo_ruptura?: string | null
          unidade_resultado?: string
          updated_at?: string
        }
        Update: {
          aprovado_at?: string | null
          aprovado_by?: string | null
          capeamento?: string | null
          carga_ruptura_kn?: number | null
          codigo?: string | null
          concretagem_id?: string | null
          corpo_prova_id?: string
          cp_altura_mm?: number
          cp_diametro_mm?: number
          created_at?: string
          data_rompimento?: string | null
          deleted_at?: string | null
          equipamento_id?: string | null
          external_key?: string | null
          fck_referencia_mpa?: number | null
          hora_rompimento?: string | null
          id?: string
          idade_dias?: number | null
          idade_unidade?: string
          justificativa_alteracao?: string | null
          massa_cp_g?: number | null
          material_test_type_id?: string | null
          observacao?: string | null
          operador_id?: string | null
          origem?: string
          receipt_id?: string | null
          result_version?: number
          resultado_valor?: number | null
          status?: Database["public"]["Enums"]["record_status"] | null
          substitui_resultado_id?: string | null
          tenant_id?: string
          tipo_ruptura?: string | null
          unidade_resultado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_tests_aprovado_by_fkey"
            columns: ["aprovado_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "concretagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_concretagem_id_fkey"
            columns: ["concretagem_id"]
            isOneToOne: false
            referencedRelation: "v_concretagens_central"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_corpo_prova_id_fkey"
            columns: ["corpo_prova_id"]
            isOneToOne: false
            referencedRelation: "corpos_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_material_test_type_id_fkey"
            columns: ["material_test_type_id"]
            isOneToOne: false
            referencedRelation: "material_test_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "material_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_substitui_resultado_id_fkey"
            columns: ["substitui_resultado_id"]
            isOneToOne: false
            referencedRelation: "material_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          adicionais: Json
          client_id: string | null
          competencia: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          escopo: string
          escopo_id: string | null
          id: string
          itens: Json
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          tenant_id: string
          updated_at: string
          valor_adicionais: number
          valor_itens: number
          valor_total: number
        }
        Insert: {
          adicionais?: Json
          client_id?: string | null
          competencia?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escopo?: string
          escopo_id?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          tenant_id: string
          updated_at?: string
          valor_adicionais?: number
          valor_itens?: number
          valor_total?: number
        }
        Update: {
          adicionais?: Json
          client_id?: string | null
          competencia?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escopo?: string
          escopo_id?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_adicionais?: number
          valor_itens?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lab_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notification_prefs: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          id: string
          member_id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          member_id: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          member_id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notification_prefs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notification_prefs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      member_obras: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          member_id: string
          tenant_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          member_id: string
          tenant_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          member_id?: string
          tenant_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_obras_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_obras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_obras_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          active: boolean
          auth_id: string
          cargo: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          is_selected: boolean
          role: string
          roles: string[]
          telefone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_id: string
          cargo?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_selected?: boolean
          role?: string
          roles?: string[]
          telefone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_id?: string
          cargo?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_selected?: boolean
          role?: string
          roles?: string[]
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_action_templates: {
        Row: {
          acao_automatica: boolean
          acao_projetista: boolean
          ativo: boolean
          campos: Json
          classification_code: string | null
          conclui_nc: boolean
          created_at: string
          deleted_at: string | null
          disponibiliza_campos: Json | null
          gatilho_backend: string | null
          id: string
          mensagem: string | null
          nome: string
          obrigatorio_campos: Json | null
          permissao_requerida: string | null
          permite_multipla_acao: boolean
          situacao_destino: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          acao_automatica?: boolean
          acao_projetista?: boolean
          ativo?: boolean
          campos?: Json
          classification_code?: string | null
          conclui_nc?: boolean
          created_at?: string
          deleted_at?: string | null
          disponibiliza_campos?: Json | null
          gatilho_backend?: string | null
          id?: string
          mensagem?: string | null
          nome: string
          obrigatorio_campos?: Json | null
          permissao_requerida?: string | null
          permite_multipla_acao?: boolean
          situacao_destino?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          acao_automatica?: boolean
          acao_projetista?: boolean
          ativo?: boolean
          campos?: Json
          classification_code?: string | null
          conclui_nc?: boolean
          created_at?: string
          deleted_at?: string | null
          disponibiliza_campos?: Json | null
          gatilho_backend?: string | null
          id?: string
          mensagem?: string | null
          nome?: string
          obrigatorio_campos?: Json | null
          permissao_requerida?: string | null
          permite_multipla_acao?: boolean
          situacao_destino?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nc_action_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_action_transitions: {
        Row: {
          ativo: boolean
          created_at: string
          from_action_id: string | null
          id: string
          ordem: number | null
          tenant_id: string
          to_action_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          from_action_id?: string | null
          id?: string
          ordem?: number | null
          tenant_id: string
          to_action_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          from_action_id?: string | null
          id?: string
          ordem?: number | null
          tenant_id?: string
          to_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_action_transitions_from_action_id_fkey"
            columns: ["from_action_id"]
            isOneToOne: false
            referencedRelation: "nc_action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_action_transitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_action_transitions_to_action_id_fkey"
            columns: ["to_action_id"]
            isOneToOne: false
            referencedRelation: "nc_action_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_actions: {
        Row: {
          action_template_id: string | null
          campos_dinamicos: Json | null
          created_at: string
          deleted_at: string | null
          descricao: string
          executada_em: string | null
          id: string
          nc_id: string | null
          situacao_codigo: string | null
          tenant_id: string
        }
        Insert: {
          action_template_id?: string | null
          campos_dinamicos?: Json | null
          created_at?: string
          deleted_at?: string | null
          descricao: string
          executada_em?: string | null
          id?: string
          nc_id?: string | null
          situacao_codigo?: string | null
          tenant_id: string
        }
        Update: {
          action_template_id?: string | null
          campos_dinamicos?: Json | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string
          executada_em?: string | null
          id?: string
          nc_id?: string | null
          situacao_codigo?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_actions_action_template_id_fkey"
            columns: ["action_template_id"]
            isOneToOne: false
            referencedRelation: "nc_action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_classifications: {
        Row: {
          ativa: boolean
          codigo: string
          created_at: string
          escopo_gatilho: string
          fixed: boolean
          id: string
          justificativa: boolean
          nome: string
          ordem: number
        }
        Insert: {
          ativa?: boolean
          codigo: string
          created_at?: string
          escopo_gatilho: string
          fixed?: boolean
          id?: string
          justificativa?: boolean
          nome: string
          ordem?: number
        }
        Update: {
          ativa?: boolean
          codigo?: string
          created_at?: string
          escopo_gatilho?: string
          fixed?: boolean
          id?: string
          justificativa?: boolean
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      nc_parameters: {
        Row: {
          acao_imediata_pct: number | null
          ativo: boolean
          classification_code: string | null
          conclusao_auto_pct: number | null
          created_at: string
          deleted_at: string | null
          escopo: string | null
          escopo_id: string | null
          flow_tol_mm: number | null
          id: string
          material_kind: Database["public"]["Enums"]["material_kind"] | null
          nome: string
          slump_tol_mm: number | null
          tenant_id: string
          tolerancia: Json | null
          tolerancia_lancamento_min: number | null
          updated_at: string
          validade_concreto_h: number | null
          vigencia_inicio: string | null
        }
        Insert: {
          acao_imediata_pct?: number | null
          ativo?: boolean
          classification_code?: string | null
          conclusao_auto_pct?: number | null
          created_at?: string
          deleted_at?: string | null
          escopo?: string | null
          escopo_id?: string | null
          flow_tol_mm?: number | null
          id?: string
          material_kind?: Database["public"]["Enums"]["material_kind"] | null
          nome: string
          slump_tol_mm?: number | null
          tenant_id: string
          tolerancia?: Json | null
          tolerancia_lancamento_min?: number | null
          updated_at?: string
          validade_concreto_h?: number | null
          vigencia_inicio?: string | null
        }
        Update: {
          acao_imediata_pct?: number | null
          ativo?: boolean
          classification_code?: string | null
          conclusao_auto_pct?: number | null
          created_at?: string
          deleted_at?: string | null
          escopo?: string | null
          escopo_id?: string | null
          flow_tol_mm?: number | null
          id?: string
          material_kind?: Database["public"]["Enums"]["material_kind"] | null
          nome?: string
          slump_tol_mm?: number | null
          tenant_id?: string
          tolerancia?: Json | null
          tolerancia_lancamento_min?: number | null
          updated_at?: string
          validade_concreto_h?: number | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_parameters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_rac_acao_padrao: {
        Row: {
          acao_corretiva: string
          ativo: boolean
          classification_code: string
          created_at: string
          deleted_at: string | null
          id: string
          ordem: number
          quando: string | null
          quem: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acao_corretiva: string
          ativo?: boolean
          classification_code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          ordem: number
          quando?: string | null
          quem?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string
          ativo?: boolean
          classification_code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          ordem?: number
          quando?: string | null
          quem?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_rac_acao_padrao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_situations: {
        Row: {
          codigo: string
          created_at: string
          finaliza: boolean
          grupo: string
          id: string
          nome: string
          observacao: string | null
          ordem: number
          rac: boolean
        }
        Insert: {
          codigo: string
          created_at?: string
          finaliza?: boolean
          grupo: string
          id?: string
          nome: string
          observacao?: string | null
          ordem?: number
          rac?: boolean
        }
        Update: {
          codigo?: string
          created_at?: string
          finaliza?: boolean
          grupo?: string
          id?: string
          nome?: string
          observacao?: string | null
          ordem?: number
          rac?: boolean
        }
        Relationships: []
      }
      nc_types: {
        Row: {
          ativo: boolean
          classification_code: string
          codigo: string
          created_at: string
          fixed: boolean
          gatilho: string
          id: string
          nome: string
          origem: string
        }
        Insert: {
          ativo?: boolean
          classification_code: string
          codigo: string
          created_at?: string
          fixed?: boolean
          gatilho: string
          id?: string
          nome: string
          origem: string
        }
        Update: {
          ativo?: boolean
          classification_code?: string
          codigo?: string
          created_at?: string
          fixed?: boolean
          gatilho?: string
          id?: string
          nome?: string
          origem?: string
        }
        Relationships: []
      }
      non_conformities: {
        Row: {
          classification_code: string | null
          classification_nome: string | null
          created_at: string
          data_abertura: string
          deleted_at: string | null
          descricao: string | null
          entidade_origem: string | null
          entidade_origem_id: string | null
          id: string
          numero: string
          origem: string
          severidade: string
          status: string
          tenant_id: string
          tipo_code: string | null
          tipo_nome: string | null
          updated_at: string
          work_id: string | null
        }
        Insert: {
          classification_code?: string | null
          classification_nome?: string | null
          created_at?: string
          data_abertura?: string
          deleted_at?: string | null
          descricao?: string | null
          entidade_origem?: string | null
          entidade_origem_id?: string | null
          id?: string
          numero: string
          origem?: string
          severidade?: string
          status?: string
          tenant_id: string
          tipo_code?: string | null
          tipo_nome?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          classification_code?: string | null
          classification_nome?: string | null
          created_at?: string
          data_abertura?: string
          deleted_at?: string | null
          descricao?: string | null
          entidade_origem?: string | null
          entidade_origem_id?: string | null
          id?: string
          numero?: string
          origem?: string
          severidade?: string
          status?: string
          tenant_id?: string
          tipo_code?: string | null
          tipo_nome?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatch_log: {
        Row: {
          bounced_at: string | null
          click_count: number
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          dedupe_key: string
          deleted_at: string | null
          delivered_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string
          id: string
          last_clicked_url: string | null
          last_user_agent: string | null
          metadata: Json
          notification_type: string | null
          open_count: number
          opened_at: string | null
          payload: Json
          recipient_email: string
          resend_id: string | null
          status: string
          tenant_id: string | null
          track_token: string | null
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          dedupe_key: string
          deleted_at?: string | null
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          last_clicked_url?: string | null
          last_user_agent?: string | null
          metadata?: Json
          notification_type?: string | null
          open_count?: number
          opened_at?: string | null
          payload?: Json
          recipient_email: string
          resend_id?: string | null
          status?: string
          tenant_id?: string | null
          track_token?: string | null
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          dedupe_key?: string
          deleted_at?: string | null
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          last_clicked_url?: string | null
          last_user_agent?: string | null
          metadata?: Json
          notification_type?: string | null
          open_count?: number
          opened_at?: string | null
          payload?: Json
          recipient_email?: string
          resend_id?: string | null
          status?: string
          tenant_id?: string | null
          track_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dispatch_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatch_settings: {
        Row: {
          dispatch_enabled: boolean
          dispatch_secret: string
          dry_run: boolean
          email_allowlist: string[]
          id: boolean
          notify_event_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dispatch_enabled?: boolean
          dispatch_secret?: string
          dry_run?: boolean
          email_allowlist?: string[]
          id?: boolean
          notify_event_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dispatch_enabled?: boolean
          dispatch_secret?: string
          dry_run?: boolean
          email_allowlist?: string[]
          id?: boolean
          notify_event_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_dispatch_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_types: {
        Row: {
          active: boolean
          categoria: string
          codigo: string
          created_at: string
          default_channel: string
          descricao: string
          digest: boolean
          is_system: boolean
          key: string
          severidade: string
        }
        Insert: {
          active?: boolean
          categoria: string
          codigo: string
          created_at?: string
          default_channel?: string
          descricao: string
          digest?: boolean
          is_system?: boolean
          key: string
          severidade?: string
        }
        Update: {
          active?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          default_channel?: string
          descricao?: string
          digest?: boolean
          is_system?: boolean
          key?: string
          severidade?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          channel: string
          created_at: string
          deleted_at: string | null
          event_type: string
          html_template: string
          id: string
          locale: string
          subject_template: string
          text_template: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel?: string
          created_at?: string
          deleted_at?: string | null
          event_type: string
          html_template: string
          id?: string
          locale?: string
          subject_template: string
          text_template: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: string
          created_at?: string
          deleted_at?: string | null
          event_type?: string
          html_template?: string
          id?: string
          locale?: string
          subject_template?: string
          text_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      notify_event_outbox: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          mode: string
          payload: Json
          processed_at: string | null
          status: string
          tenant_id: string | null
          trace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          mode?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string | null
          trace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          mode?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notify_event_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_materials: {
        Row: {
          aditivo_tipo: string | null
          aplicacao: string | null
          ativo: boolean
          bombeado: boolean
          brita: string | null
          carta_traco_path: string | null
          cimento_tipo: string | null
          codigo: string
          componentes: Json
          condicao_preparo: string | null
          consumo_cimento_kg_m3: number | null
          created_at: string
          deleted_at: string | null
          desvio_padrao_mpa: number | null
          dmax_agregado_mm: number | null
          especificacao: string | null
          fator_ac: number | null
          fcj_mpa: number | null
          fck_mpa: number | null
          id: string
          idade_desforma_horas: number | null
          material_kind: Database["public"]["Enums"]["material_kind"]
          metodo_cura: string | null
          nome: string
          observacoes: string | null
          padrao_moldagem: Json
          resistencia_desforma_mpa: number | null
          schema_campos: Json
          slump_previsto_cm: number | null
          slump_tolerancia_cm: number | null
          tem_dosagem_agua: boolean
          tem_fibra: boolean
          tenant_id: string
          unidade_medida: string | null
          updated_at: string
          validade_concreto_minutos: number | null
          work_id: string | null
        }
        Insert: {
          aditivo_tipo?: string | null
          aplicacao?: string | null
          ativo?: boolean
          bombeado?: boolean
          brita?: string | null
          carta_traco_path?: string | null
          cimento_tipo?: string | null
          codigo: string
          componentes?: Json
          condicao_preparo?: string | null
          consumo_cimento_kg_m3?: number | null
          created_at?: string
          deleted_at?: string | null
          desvio_padrao_mpa?: number | null
          dmax_agregado_mm?: number | null
          especificacao?: string | null
          fator_ac?: number | null
          fcj_mpa?: number | null
          fck_mpa?: number | null
          id?: string
          idade_desforma_horas?: number | null
          material_kind: Database["public"]["Enums"]["material_kind"]
          metodo_cura?: string | null
          nome: string
          observacoes?: string | null
          padrao_moldagem?: Json
          resistencia_desforma_mpa?: number | null
          schema_campos?: Json
          slump_previsto_cm?: number | null
          slump_tolerancia_cm?: number | null
          tem_dosagem_agua?: boolean
          tem_fibra?: boolean
          tenant_id: string
          unidade_medida?: string | null
          updated_at?: string
          validade_concreto_minutos?: number | null
          work_id?: string | null
        }
        Update: {
          aditivo_tipo?: string | null
          aplicacao?: string | null
          ativo?: boolean
          bombeado?: boolean
          brita?: string | null
          carta_traco_path?: string | null
          cimento_tipo?: string | null
          codigo?: string
          componentes?: Json
          condicao_preparo?: string | null
          consumo_cimento_kg_m3?: number | null
          created_at?: string
          deleted_at?: string | null
          desvio_padrao_mpa?: number | null
          dmax_agregado_mm?: number | null
          especificacao?: string | null
          fator_ac?: number | null
          fcj_mpa?: number | null
          fck_mpa?: number | null
          id?: string
          idade_desforma_horas?: number | null
          material_kind?: Database["public"]["Enums"]["material_kind"]
          metodo_cura?: string | null
          nome?: string
          observacoes?: string | null
          padrao_moldagem?: Json
          resistencia_desforma_mpa?: number | null
          schema_campos?: Json
          slump_previsto_cm?: number | null
          slump_tolerancia_cm?: number | null
          tem_dosagem_agua?: boolean
          tem_fibra?: boolean
          tenant_id?: string
          unidade_medida?: string | null
          updated_at?: string
          validade_concreto_minutos?: number | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_materials_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      role_notification_types: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          role_code: string
        }
        Insert: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          role_code: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          role_code?: string
        }
        Relationships: []
      }
      telemetry_alert: {
        Row: {
          alert_key: string
          app_version: string | null
          detail: string | null
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          metric: string | null
          observed: number | null
          occurrences: number
          resolved_at: string | null
          severity: string
          status: string
          threshold: number | null
          title: string
        }
        Insert: {
          alert_key: string
          app_version?: string | null
          detail?: string | null
          first_seen_at?: string
          id?: string
          kind: string
          last_seen_at?: string
          metric?: string | null
          observed?: number | null
          occurrences?: number
          resolved_at?: string | null
          severity?: string
          status?: string
          threshold?: number | null
          title: string
        }
        Update: {
          alert_key?: string
          app_version?: string | null
          detail?: string | null
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          metric?: string | null
          observed?: number | null
          occurrences?: number
          resolved_at?: string | null
          severity?: string
          status?: string
          threshold?: number | null
          title?: string
        }
        Relationships: []
      }
      telemetry_error_group: {
        Row: {
          created_at: string
          fingerprint: string
          muted_until: string | null
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          muted_until?: string | null
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          muted_until?: string | null
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      telemetry_rollup_daily: {
        Row: {
          computed_at: string
          day: string
          dim: string
          errors: number | null
          errors_5xx: number | null
          good: number | null
          needs_improvement: number | null
          p75: number | null
          p95: number | null
          poor: number | null
          samples: number
          scope: string
        }
        Insert: {
          computed_at?: string
          day: string
          dim: string
          errors?: number | null
          errors_5xx?: number | null
          good?: number | null
          needs_improvement?: number | null
          p75?: number | null
          p95?: number | null
          poor?: number | null
          samples?: number
          scope: string
        }
        Update: {
          computed_at?: string
          day?: string
          dim?: string
          errors?: number | null
          errors_5xx?: number | null
          good?: number | null
          needs_improvement?: number | null
          p75?: number | null
          p95?: number | null
          poor?: number | null
          samples?: number
          scope?: string
        }
        Relationships: []
      }
      telemetry_settings: {
        Row: {
          alert_cls_p75: number
          alert_crash_free_enabled: boolean
          alert_crash_free_min_pct: number
          alert_cron_enabled: boolean
          alert_ef_5xx_min: number
          alert_ef_5xx_window_hours: number
          alert_ef_latency_exempt: string[]
          alert_ef_p95_ms: number
          alert_email_bounce_pct: number
          alert_email_complaint_pct: number
          alert_email_enabled: boolean
          alert_email_min_sent: number
          alert_email_window_hours: number
          alert_error_rate_pct: number
          alert_fcp_p75_ms: number
          alert_inp_p75_ms: number
          alert_lcp_p75_ms: number
          alert_min_events: number
          alert_notify_email: boolean
          alert_notify_inapp: boolean
          alert_notify_webhook_url: string | null
          alert_ops_audit_anon: number
          alert_ops_auth_failures: number
          alert_ops_auth_failures_per_user: number
          alert_ops_enabled: boolean
          alert_ops_env_overdue: number
          alert_ops_identity_errors: number
          alert_ops_queue_backlog: number
          alert_ops_queue_max_attempts: number
          alert_pg_dead_pct: number
          alert_pg_enabled: boolean
          alert_pg_mean_ms: number
          alert_pg_min_calls: number
          alert_pg_min_table_bytes: number
          alert_release_min_sessions: number
          alert_schedule_coverage_pct: number
          alert_schedule_enabled: boolean
          alert_ttfb_p75_ms: number
          alert_vital_min_samples: number
          alert_webhook_dead_letter: number
          alerting_enabled: boolean
          id: number
          ingest_enabled: boolean
          sample_rate: number
          updated_at: string
        }
        Insert: {
          alert_cls_p75?: number
          alert_crash_free_enabled?: boolean
          alert_crash_free_min_pct?: number
          alert_cron_enabled?: boolean
          alert_ef_5xx_min?: number
          alert_ef_5xx_window_hours?: number
          alert_ef_latency_exempt?: string[]
          alert_ef_p95_ms?: number
          alert_email_bounce_pct?: number
          alert_email_complaint_pct?: number
          alert_email_enabled?: boolean
          alert_email_min_sent?: number
          alert_email_window_hours?: number
          alert_error_rate_pct?: number
          alert_fcp_p75_ms?: number
          alert_inp_p75_ms?: number
          alert_lcp_p75_ms?: number
          alert_min_events?: number
          alert_notify_email?: boolean
          alert_notify_inapp?: boolean
          alert_notify_webhook_url?: string | null
          alert_ops_audit_anon?: number
          alert_ops_auth_failures?: number
          alert_ops_auth_failures_per_user?: number
          alert_ops_enabled?: boolean
          alert_ops_env_overdue?: number
          alert_ops_identity_errors?: number
          alert_ops_queue_backlog?: number
          alert_ops_queue_max_attempts?: number
          alert_pg_dead_pct?: number
          alert_pg_enabled?: boolean
          alert_pg_mean_ms?: number
          alert_pg_min_calls?: number
          alert_pg_min_table_bytes?: number
          alert_release_min_sessions?: number
          alert_schedule_coverage_pct?: number
          alert_schedule_enabled?: boolean
          alert_ttfb_p75_ms?: number
          alert_vital_min_samples?: number
          alert_webhook_dead_letter?: number
          alerting_enabled?: boolean
          id?: number
          ingest_enabled?: boolean
          sample_rate?: number
          updated_at?: string
        }
        Update: {
          alert_cls_p75?: number
          alert_crash_free_enabled?: boolean
          alert_crash_free_min_pct?: number
          alert_cron_enabled?: boolean
          alert_ef_5xx_min?: number
          alert_ef_5xx_window_hours?: number
          alert_ef_latency_exempt?: string[]
          alert_ef_p95_ms?: number
          alert_email_bounce_pct?: number
          alert_email_complaint_pct?: number
          alert_email_enabled?: boolean
          alert_email_min_sent?: number
          alert_email_window_hours?: number
          alert_error_rate_pct?: number
          alert_fcp_p75_ms?: number
          alert_inp_p75_ms?: number
          alert_lcp_p75_ms?: number
          alert_min_events?: number
          alert_notify_email?: boolean
          alert_notify_inapp?: boolean
          alert_notify_webhook_url?: string | null
          alert_ops_audit_anon?: number
          alert_ops_auth_failures?: number
          alert_ops_auth_failures_per_user?: number
          alert_ops_enabled?: boolean
          alert_ops_env_overdue?: number
          alert_ops_identity_errors?: number
          alert_ops_queue_backlog?: number
          alert_ops_queue_max_attempts?: number
          alert_pg_dead_pct?: number
          alert_pg_enabled?: boolean
          alert_pg_mean_ms?: number
          alert_pg_min_calls?: number
          alert_pg_min_table_bytes?: number
          alert_release_min_sessions?: number
          alert_schedule_coverage_pct?: number
          alert_schedule_enabled?: boolean
          alert_ttfb_p75_ms?: number
          alert_vital_min_samples?: number
          alert_webhook_dead_letter?: number
          alerting_enabled?: boolean
          id?: number
          ingest_enabled?: boolean
          sample_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          active: boolean
          cnpj: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_groups: {
        Row: {
          codigo: string
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          observacoes: string | null
          ordem: number
          tenant_id: string
          tipo_edificacao: string | null
          updated_at: string
          work_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number
          tenant_id: string
          tipo_edificacao?: string | null
          updated_at?: string
          work_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number
          tenant_id?: string
          tipo_edificacao?: string | null
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_groups_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_types: {
        Row: {
          codigo: string
          created_at: string
          deleted_at: string | null
          etapa: string | null
          id: string
          nome: string
          observacoes: string | null
          operational_material_id: string | null
          tenant_id: string
          updated_at: string
          volume_projeto_m3: number | null
          work_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          deleted_at?: string | null
          etapa?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          operational_material_id?: string | null
          tenant_id: string
          updated_at?: string
          volume_projeto_m3?: number | null
          work_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          etapa?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          operational_material_id?: string | null
          tenant_id?: string
          updated_at?: string
          volume_projeto_m3?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_types_operational_material_id_fkey"
            columns: ["operational_material_id"]
            isOneToOne: false
            referencedRelation: "operational_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_types_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          ativa: boolean
          codigo: string
          created_at: string
          deleted_at: string | null
          etapa: string | null
          id: string
          nome: string
          observacoes: string | null
          ordem: number
          tenant_id: string
          unidade_completa: string | null
          unit_group_id: string | null
          unit_type_id: string | null
          updated_at: string
          volume_m3: number | null
          work_id: string
        }
        Insert: {
          ativa?: boolean
          codigo: string
          created_at?: string
          deleted_at?: string | null
          etapa?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number
          tenant_id: string
          unidade_completa?: string | null
          unit_group_id?: string | null
          unit_type_id?: string | null
          updated_at?: string
          volume_m3?: number | null
          work_id: string
        }
        Update: {
          ativa?: boolean
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          etapa?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number
          tenant_id?: string
          unidade_completa?: string | null
          unit_group_id?: string | null
          unit_type_id?: string | null
          updated_at?: string
          volume_m3?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_unit_group_id_fkey"
            columns: ["unit_group_id"]
            isOneToOne: false
            referencedRelation: "unit_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "unit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          action: string
          actor_member_id: string | null
          comment: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          instance_id: string | null
          metadata: Json
          step_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          comment?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          instance_id?: string | null
          metadata?: Json
          step_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          comment?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          instance_id?: string | null
          metadata?: Json
          step_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          current_step_id: string | null
          deleted_at: string | null
          entity_id: string
          entity_type: string
          finished_at: string | null
          id: string
          started_at: string
          started_by: string | null
          status: string
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          current_step_id?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          finished_at?: string | null
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          current_step_id?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          aprovador_especifico_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          instrucoes: string | null
          nome: string
          obrigatoria: boolean
          ordem: number
          role_required: string
          sla_hours: number
          template_id: string
          tenant_id: string
        }
        Insert: {
          aprovador_especifico_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instrucoes?: string | null
          nome: string
          obrigatoria?: boolean
          ordem: number
          role_required: string
          sla_hours?: number
          template_id: string
          tenant_id: string
        }
        Update: {
          aprovador_especifico_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          instrucoes?: string | null
          nome?: string
          obrigatoria?: boolean
          ordem?: number
          role_required?: string
          sla_hours?: number
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_aprovador_especifico_id_fkey"
            columns: ["aprovador_especifico_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          entity_type: string
          id: string
          is_default: boolean
          nome: string
          tenant_id: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_type: string
          id?: string
          is_default?: boolean
          nome: string
          tenant_id: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean
          nome?: string
          tenant_id?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          action: string
          created_at: string
          deleted_at: string | null
          from_step_id: string | null
          id: string
          template_id: string
          tenant_id: string
          to_step_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          deleted_at?: string | null
          from_step_id?: string | null
          id?: string
          template_id: string
          tenant_id: string
          to_step_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          deleted_at?: string | null
          from_step_id?: string | null
          id?: string
          template_id?: string
          tenant_id?: string
          to_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_client_health_by_version: {
        Row: {
          app_version: string | null
          error_rate_pct: number | null
          errors: number | null
          events: number | null
          last_seen: string | null
          sessions: number | null
          tenant_id: string | null
          warnings: number | null
        }
        Relationships: []
      }
      v_client_metric_daily: {
        Row: {
          avg: number | null
          day: string | null
          metric: string | null
          p50: number | null
          p95: number | null
          samples: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_client_vitals_daily: {
        Row: {
          day: string | null
          good: number | null
          metric: string | null
          needs_improvement: number | null
          p75: number | null
          p95: number | null
          poor: number | null
          samples: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_concretagens_central: {
        Row: {
          client_id: string | null
          codigo: string | null
          data_programada: string | null
          data_real: string | null
          fck_previsto: number | null
          fornecedor_texto: string | null
          id: string | null
          n_amostras: number | null
          n_caminhoes: number | null
          n_cps: number | null
          n_cps_atrasados: number | null
          n_cps_rompidos: number | null
          n_laudos: number | null
          origem: string | null
          status: Database["public"]["Enums"]["record_status"] | null
          status_tecnico: string | null
          tenant_id: string | null
          work_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concretagens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "lab_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concretagens_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      v_domain_events_daily: {
        Row: {
          area: string | null
          day: string | null
          event: string | null
          last_seen: string | null
          members: number | null
          sessions: number | null
          tenants: number | null
          total: number | null
        }
        Relationships: []
      }
      v_ef_metrics_hourly: {
        Row: {
          avg_ms: number | null
          calls: number | null
          errors: number | null
          errors_5xx: number | null
          fn_name: string | null
          hour: string | null
          max_ms: number | null
          p50_ms: number | null
          p95_ms: number | null
          p99_ms: number | null
        }
        Relationships: []
      }
      v_formas_saldo: {
        Row: {
          saldo: number | null
          tenant_id: string | null
          work_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_movimentacoes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "client_works"
            referencedColumns: ["id"]
          },
        ]
      }
      v_release_health: {
        Row: {
          app_version: string | null
          crash_free_sessions_pct: number | null
          crash_free_users_pct: number | null
          error_rate_pct: number | null
          error_sessions: number | null
          error_users: number | null
          errors: number | null
          events: number | null
          first_seen: string | null
          last_seen: string | null
          sessions: number | null
          tenant_id: string | null
          users: number | null
        }
        Relationships: []
      }
      v_telemetry_incident_stats: {
        Row: {
          alert_key: string | null
          avg_mttr_minutes: number | null
          critical_incidents: number | null
          currently_open: boolean | null
          first_incident_at: string | null
          kind: string | null
          last_resolved_at: string | null
          last_seen_at: string | null
          max_mttr_minutes: number | null
          median_mttr_minutes: number | null
          open_incidents: number | null
          resolved_incidents: number | null
          total_incidents: number | null
          total_occurrences: number | null
        }
        Relationships: []
      }
      v_telemetry_mttr_summary: {
        Row: {
          avg_mttr_minutes_30d: number | null
          critical_30d: number | null
          distinct_keys_30d: number | null
          incidents_30d: number | null
          max_mttr_minutes_30d: number | null
          open_incidents: number | null
          resolved_30d: number | null
        }
        Relationships: []
      }
      v_webhook_dead_letter_alerts: {
        Row: {
          dead_letter_count: number | null
          events_affected: string[] | null
          oldest_dead_at: string | null
          sample_error: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notify_event_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_nc_manual: {
        Args: {
          p_descricao: string
          p_entidade_origem?: string
          p_entidade_origem_id?: string
          p_severidade?: string
          p_tenant_id: string
          p_tipo_code: string
          p_work_id: string
        }
        Returns: {
          classification_code: string | null
          classification_nome: string | null
          created_at: string
          data_abertura: string
          deleted_at: string | null
          descricao: string | null
          entidade_origem: string | null
          entidade_origem_id: string | null
          id: string
          numero: string
          origem: string
          severidade: string
          status: string
          tenant_id: string
          tipo_code: string | null
          tipo_nome: string | null
          updated_at: string
          work_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "non_conformities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_trace_id: { Args: never; Returns: string }
      aprovar_laudo: {
        Args: { p_lab_report_id: string }
        Returns: {
          amostra_id: string | null
          approved_at: string | null
          approved_by: string | null
          art: string | null
          client_id: string
          concretagem_id: string | null
          crea_rt: string | null
          created_at: string
          data_emissao: string | null
          deleted_at: string | null
          escopo: string
          hash_sha256: string | null
          id: string
          justificativa: string | null
          laboratorio_nome: string | null
          lote_importacao_id: string | null
          material_test_type_id: string | null
          numero: string
          origem: string
          responsavel_tecnico: string | null
          revisao: number
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
          work_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lab_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_client_telemetry_rate_limit: {
        Args: { p_actor_key: string; p_bucket_start: string }
        Returns: number
      }
      calcular_aceitacao_lote: { Args: { p_lote: string }; Returns: Json }
      computar_medicao: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
          p_precos: Json
        }
        Returns: Json
      }
      consume_magic_link_laudo: {
        Args: { p_comment?: string; p_decision: string; p_token: string }
        Returns: Json
      }
      criar_lote_aceitacao: { Args: { payload: Json }; Returns: Json }
      criar_magic_link: {
        Args: {
          p_dias?: number
          p_entity_id: string
          p_entity_table: string
          p_purpose: string
        }
        Returns: string
      }
      current_member_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      emitir_fatura: {
        Args: { p_medicao_id: string; p_vencimento?: string }
        Returns: {
          client_id: string | null
          competencia: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          medicao_id: string | null
          numero: string
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "faturas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      frontend_canary_run: { Args: never; Returns: Json }
      gerar_contraprova_cp: { Args: { payload: Json }; Returns: string }
      gerar_ncs_cp_atrasado: { Args: never; Returns: number }
      has_role: { Args: { p_role: string }; Returns: boolean }
      is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_writer: { Args: { p_tenant_id: string }; Returns: boolean }
      lancar_rompimento_cp: { Args: { payload: Json }; Returns: Json }
      lancar_situacao_cp: { Args: { payload: Json }; Returns: undefined }
      log_ef_invocation: {
        Args: {
          p_actor_id: string
          p_duration_ms: number
          p_error: string
          p_fn_name: string
          p_metadata: Json
          p_request_id: string
          p_started_at: string
          p_status_code: number
          p_tenant_id: string
        }
        Returns: undefined
      }
      member_can_access_work: { Args: { p_work_id: string }; Returns: boolean }
      prune_client_telemetry: { Args: never; Returns: undefined }
      raise_telemetry_alert: {
        Args: {
          p_alert_key: string
          p_app_version: string
          p_detail: string
          p_kind: string
          p_metric: string
          p_observed: number
          p_severity: string
          p_threshold: number
          p_title: string
        }
        Returns: boolean
      }
      reabrir_laudo: {
        Args: { p_justificativa?: string; p_lab_report_id: string }
        Returns: {
          amostra_id: string | null
          approved_at: string | null
          approved_by: string | null
          art: string | null
          client_id: string
          concretagem_id: string | null
          crea_rt: string | null
          created_at: string
          data_emissao: string | null
          deleted_at: string | null
          escopo: string
          hash_sha256: string | null
          id: string
          justificativa: string | null
          laboratorio_nome: string | null
          lote_importacao_id: string | null
          material_test_type_id: string | null
          numero: string
          origem: string
          responsavel_tecnico: string | null
          revisao: number
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
          work_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lab_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_cron_heartbeat: {
        Args: {
          p_description?: string
          p_error?: string
          p_expected_max_age_minutes: number
          p_job_name: string
          p_status?: string
        }
        Returns: undefined
      }
      registrar_acao_nc: { Args: { payload: Json }; Returns: Json }
      relatorio_produtividade: {
        Args: { p_fim: string; p_inicio: string }
        Returns: Json
      }
      resolve_telemetry_alerts: {
        Args: { p_active_keys: string[] }
        Returns: number
      }
      rollup_telemetry_daily: { Args: { p_day: string }; Returns: number }
      rollup_telemetry_daily_recent: {
        Args: { p_days?: number }
        Returns: number
      }
      seed_nc_action_engine: { Args: { p_tenant: string }; Returns: number }
      seed_nc_rac_padrao: { Args: { p_tenant: string }; Returns: number }
      select_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      set_numeracao_cp: {
        Args: { p_id: string; p_numeracao: string }
        Returns: undefined
      }
      telemetry_admin_member_ids: {
        Args: never
        Returns: {
          member_id: string
        }[]
      }
      telemetry_email_alarm_run: { Args: never; Returns: Json }
      telemetry_error_fingerprint: {
        Args: { p_category: string; p_message: string; p_stack: string }
        Returns: string
      }
      telemetry_pg_alarm_run: { Args: never; Returns: Json }
      telemetry_release_alarm_run: { Args: never; Returns: Json }
    }
    Enums: {
      material_kind:
        | "concreto"
        | "solos"
        | "bloco_estrutural"
        | "argamassa"
        | "graute"
        | "cbuq"
      record_status:
        | "rascunho"
        | "registrado"
        | "pendente"
        | "aprovado"
        | "reprovado"
        | "concluida"
        | "aberta"
        | "cancelada"
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
      material_kind: [
        "concreto",
        "solos",
        "bloco_estrutural",
        "argamassa",
        "graute",
        "cbuq",
      ],
      record_status: [
        "rascunho",
        "registrado",
        "pendente",
        "aprovado",
        "reprovado",
        "concluida",
        "aberta",
        "cancelada",
      ],
    },
  },
} as const

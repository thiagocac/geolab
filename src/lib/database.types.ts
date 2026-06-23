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
      client_works: {
        Row: {
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
          responsavel_tecnico: string | null
          status: string
          tenant_id: string
          tipo: string | null
          traco_habilitado: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
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
          responsavel_tecnico?: string | null
          status?: string
          tenant_id: string
          tipo?: string | null
          traco_habilitado?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
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
          cor_primaria: string | null
          cp_overdue_days: number
          crea_rt: string | null
          created_at: string
          ensaio_campos: Json
          idade_controle_default: number
          laudo_campos: Json
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
          cor_primaria?: string | null
          cp_overdue_days?: number
          crea_rt?: string | null
          created_at?: string
          ensaio_campos?: Json
          idade_controle_default?: number
          laudo_campos?: Json
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
          cor_primaria?: string | null
          cp_overdue_days?: number
          crea_rt?: string | null
          created_at?: string
          ensaio_campos?: Json
          idade_controle_default?: number
          laudo_campos?: Json
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
          id: string
          member_id: string
          tenant_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          tenant_id: string
          work_id: string
        }
        Update: {
          created_at?: string
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
    }
    Functions: {
      current_member_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      has_role: { Args: { p_role: string }; Returns: boolean }
      is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_writer: { Args: { p_tenant_id: string }; Returns: boolean }
      select_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
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

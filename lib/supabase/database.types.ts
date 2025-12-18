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
    PostgrestVersion: '13.0.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      auditlog: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          resource_id: string
          resource_type: string
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          resource_id: string
          resource_type?: string
          success: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          resource_id?: string
          resource_type?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      board: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credential: {
        Row: {
          created_at: string | null
          encrypted_value: string | null
          encryption_key_id: string | null
          id: string
          last_accessed: string | null
          location: string | null
          masked_display: string | null
          name: string
          note: string | null
          project_info_id: string
          reference: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_value?: string | null
          encryption_key_id?: string | null
          id?: string
          last_accessed?: string | null
          location?: string | null
          masked_display?: string | null
          name: string
          note?: string | null
          project_info_id: string
          reference?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_value?: string | null
          encryption_key_id?: string | null
          id?: string
          last_accessed?: string | null
          location?: string | null
          masked_display?: string | null
          name?: string
          note?: string | null
          project_info_id?: string
          reference?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'credential_project_info_id_fkey'
            columns: ['project_info_id']
            isOneToOne: false
            referencedRelation: 'projectinfo'
            referencedColumns: ['id']
          },
        ]
      }
      maintenance: {
        Row: {
          created_at: string | null
          hidden: boolean | null
          id: string
          note: string | null
          repo_card_id: string | null
          repo_name: string
          repo_owner: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hidden?: boolean | null
          id?: string
          note?: string | null
          repo_card_id?: string | null
          repo_name: string
          repo_owner: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          hidden?: boolean | null
          id?: string
          note?: string | null
          repo_card_id?: string | null
          repo_name?: string
          repo_owner?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'maintenance_repo_card_id_fkey'
            columns: ['repo_card_id']
            isOneToOne: true
            referencedRelation: 'repocard'
            referencedColumns: ['id']
          },
        ]
      }
      projectinfo: {
        Row: {
          created_at: string | null
          id: string
          links: Json | null
          quick_note: string | null
          repo_card_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          links?: Json | null
          quick_note?: string | null
          repo_card_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          links?: Json | null
          quick_note?: string | null
          repo_card_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'projectinfo_repo_card_id_fkey'
            columns: ['repo_card_id']
            isOneToOne: true
            referencedRelation: 'repocard'
            referencedColumns: ['id']
          },
        ]
      }
      repocard: {
        Row: {
          board_id: string
          created_at: string | null
          id: string
          meta: Json | null
          note: string | null
          order: number
          repo_name: string
          repo_owner: string
          status_id: string
          updated_at: string | null
        }
        Insert: {
          board_id: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          note?: string | null
          order?: number
          repo_name: string
          repo_owner: string
          status_id: string
          updated_at?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          note?: string | null
          order?: number
          repo_name?: string
          repo_owner?: string
          status_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'repocard_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'board'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'repocard_status_id_fkey'
            columns: ['status_id']
            isOneToOne: false
            referencedRelation: 'statuslist'
            referencedColumns: ['id']
          },
        ]
      }
      statuslist: {
        Row: {
          board_id: string
          color: string | null
          created_at: string | null
          id: string
          name: string
          order: number
          updated_at: string | null
          wip_limit: number | null
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          order?: number
          updated_at?: string | null
          wip_limit?: number | null
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order?: number
          updated_at?: string | null
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'statuslist_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'board'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

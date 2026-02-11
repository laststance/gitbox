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
      board: {
        Row: {
          created_at: string | null
          id: string
          is_favorite: boolean
          name: string
          settings: Json | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean
          name: string
          settings?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean
          name?: string
          settings?: Json | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      maintenance: {
        Row: {
          created_at: string | null
          id: string
          repo_name: string
          repo_owner: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          repo_name: string
          repo_owner: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          repo_name?: string
          repo_owner?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      projectinfo: {
        Row: {
          comment: string | null
          comment_color: string | null
          created_at: string | null
          id: string
          links: Json | null
          maintenance_id: string | null
          note: string | null
          repo_card_id: string | null
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          comment_color?: string | null
          created_at?: string | null
          id?: string
          links?: Json | null
          maintenance_id?: string | null
          note?: string | null
          repo_card_id?: string | null
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          comment_color?: string | null
          created_at?: string | null
          id?: string
          links?: Json | null
          maintenance_id?: string | null
          note?: string | null
          repo_card_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'projectinfo_maintenance_id_fkey'
            columns: ['maintenance_id']
            isOneToOne: false
            referencedRelation: 'maintenance'
            referencedColumns: ['id']
          },
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
          grid_col: number
          grid_row: number
          id: string
          name: string
          order: number
          updated_at: string | null
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string | null
          grid_col?: number
          grid_row?: number
          id?: string
          name: string
          order?: number
          updated_at?: string | null
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string | null
          grid_col?: number
          grid_row?: number
          id?: string
          name?: string
          order?: number
          updated_at?: string | null
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
      user_link_presets: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          label: string
          updated_at: string | null
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          label: string
          updated_at?: string | null
          user_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          label?: string
          updated_at?: string | null
          user_id?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      swap_statuslist_positions: {
        Args: {
          id_a: string
          id_b: string
        }
        Returns: undefined
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

type Enums<
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

type CompositeTypes<
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

const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// Convenience type aliases for common table types
export type Board = Tables<'board'>
type StatusList = Tables<'statuslist'>
type RepoCard = Tables<'repocard'>
type ProjectInfo = Tables<'projectinfo'>
type Maintenance = Tables<'maintenance'>
type UserLinkPreset = Tables<'user_link_presets'>

// Comment color type (stored as string in projectinfo.comment_color)
// Matches COMMENT_BORDER_COLORS keys in CommentDisplay.tsx
export type CommentColor =
  | 'primary'
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'cyan'
  | 'neutral'

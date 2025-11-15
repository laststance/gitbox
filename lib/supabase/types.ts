/**
 * Supabase Database Types
 *
 * Note: このファイルは通常 `supabase gen types typescript` で自動生成されますが、
 * 開発初期段階のため、data-model.md を基に手動で作成しています。
 *
 * 本番環境では以下のコマンドで再生成してください：
 * npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      Board: {
        Row: {
          id: string
          user_id: string
          name: string
          theme: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          theme?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          theme?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      StatusList: {
        Row: {
          id: string
          board_id: string
          name: string
          color: string
          wip_limit: number | null
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          color?: string
          wip_limit?: number | null
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          color?: string
          wip_limit?: number | null
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      RepoCard: {
        Row: {
          id: string
          board_id: string
          status_id: string
          repo_owner: string
          repo_name: string
          note: string | null
          order: number
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          status_id: string
          repo_owner: string
          repo_name: string
          note?: string | null
          order?: number
          meta?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          status_id?: string
          repo_owner?: string
          repo_name?: string
          note?: string | null
          order?: number
          meta?: Json
          created_at?: string
          updated_at?: string
        }
      }
      ProjectInfo: {
        Row: {
          id: string
          repo_card_id: string
          links: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          repo_card_id: string
          links?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          repo_card_id?: string
          links?: Json
          created_at?: string
          updated_at?: string
        }
      }
      Credential: {
        Row: {
          id: string
          project_info_id: string
          type: 'reference' | 'encrypted' | 'external'
          name: string
          reference: string | null
          encrypted_value: string | null
          encryption_key_id: string | null
          masked_display: string | null
          location: string | null
          note: string | null
          created_at: string
          last_accessed: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          project_info_id: string
          type: 'reference' | 'encrypted' | 'external'
          name: string
          reference?: string | null
          encrypted_value?: string | null
          encryption_key_id?: string | null
          masked_display?: string | null
          location?: string | null
          note?: string | null
          created_at?: string
          last_accessed?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          project_info_id?: string
          type?: 'reference' | 'encrypted' | 'external'
          name?: string
          reference?: string | null
          encrypted_value?: string | null
          encryption_key_id?: string | null
          masked_display?: string | null
          location?: string | null
          note?: string | null
          created_at?: string
          last_accessed?: string | null
          updated_at?: string
        }
      }
      Maintenance: {
        Row: {
          id: string
          user_id: string
          repo_card_id: string | null
          repo_owner: string
          repo_name: string
          note: string | null
          hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          repo_card_id?: string | null
          repo_owner: string
          repo_name: string
          note?: string | null
          hidden?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          repo_card_id?: string | null
          repo_owner?: string
          repo_name?: string
          note?: string | null
          hidden?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      AuditLog: {
        Row: {
          id: string
          user_id: string
          action: 'reveal' | 'copy' | 'update' | 'delete'
          resource_id: string
          resource_type: string
          ip_address: string | null
          user_agent: string | null
          success: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: 'reveal' | 'copy' | 'update' | 'delete'
          resource_id: string
          resource_type?: string
          ip_address?: string | null
          user_agent?: string | null
          success: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: 'reveal' | 'copy' | 'update' | 'delete'
          resource_id?: string
          resource_type?: string
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          created_at?: string
        }
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
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Specific table types for convenience
export type Board = Tables<'Board'>
export type StatusList = Tables<'StatusList'>
export type RepoCard = Tables<'RepoCard'>
export type ProjectInfo = Tables<'ProjectInfo'>
export type Credential = Tables<'Credential'>
export type Maintenance = Tables<'Maintenance'>
export type AuditLog = Tables<'AuditLog'>

// Insert types
export type BoardInsert = TablesInsert<'Board'>
export type StatusListInsert = TablesInsert<'StatusList'>
export type RepoCardInsert = TablesInsert<'RepoCard'>
export type ProjectInfoInsert = TablesInsert<'ProjectInfo'>
export type CredentialInsert = TablesInsert<'Credential'>
export type MaintenanceInsert = TablesInsert<'Maintenance'>
export type AuditLogInsert = TablesInsert<'AuditLog'>

// Update types
export type BoardUpdate = TablesUpdate<'Board'>
export type StatusListUpdate = TablesUpdate<'StatusList'>
export type RepoCardUpdate = TablesUpdate<'RepoCard'>
export type ProjectInfoUpdate = TablesUpdate<'ProjectInfo'>
export type CredentialUpdate = TablesUpdate<'Credential'>
export type MaintenanceUpdate = TablesUpdate<'Maintenance'>
export type AuditLogUpdate = TablesUpdate<'AuditLog'>

// Theme types
export type Theme =
  | 'sunrise'
  | 'sandstone'
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'rose'
  | 'midnight'
  | 'graphite'
  | 'forest'
  | 'ocean'
  | 'plum'
  | 'rust'

// Credential types
export type CredentialType = 'reference' | 'encrypted' | 'external'

// Audit action types
export type AuditAction = 'reveal' | 'copy' | 'update' | 'delete'

// Board settings type
export interface BoardSettings {
  wipLimits?: {
    [statusId: string]: number
  }
  compactMode?: boolean
  showArchived?: boolean
}

// RepoCard meta type
export interface RepoCardMeta {
  stars?: number
  updatedAt?: string
  visibility?: 'public' | 'private'
  language?: string
  topics?: string[]
}

// ProjectInfo links type
export interface ProjectInfoLinks {
  production?: string[]
  tracking?: string[]
  supabase?: string[]
}

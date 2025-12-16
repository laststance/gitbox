/**
 * Project Info CRUD Operations
 *
 * Constitution要件:
 * - Principle V: セキュリティファースト (input validation, XSS prevention)
 *
 * User Story 4:
 * - Quick note: 1-3行のメモ (300文字制限)
 * - Links: Production URL、Tracking services、Supabase Dashboard
 * - Supabase integration for persistent storage
 *
 * User Story 5:
 * - Credentials: 3パターンの認証情報管理
 *   - Pattern A: Reference (ダッシュボードURLのみ)
 *   - Pattern B: Encrypted (AES-256-GCM暗号化)
 *   - Pattern C: External (1Password/Bitwarden参照)
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { TablesInsert, Tables, TablesUpdate } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';

type ProjectInfoRow = Tables<'projectinfo'>;
type ProjectInfoInsert = TablesInsert<'projectinfo'>;
type ProjectInfoUpdate = TablesUpdate<'projectinfo'>;
type CredentialRow = Tables<'credential'>;
type CredentialInsert = TablesInsert<'credential'>;

export interface ProjectLink {
  url: string;
  type: 'production' | 'tracking' | 'supabase';
}

export interface Credential {
  id?: string;
  type: 'reference' | 'encrypted' | 'external';
  name: string;
  reference?: string;
  encrypted_value?: string;
  encryption_key_id?: string;
  masked_display?: string;
  location?: string;
  note?: string;
}

export interface ProjectInfoData {
  quickNote: string;
  links: ProjectLink[];
  credentials?: Credential[];
}

/**
 * Quick noteのバリデーション
 */
function validateQuickNote(note: string): boolean {
  if (note.length > 300) {
    throw new Error('Quick note must be 300 characters or less');
  }
  return true;
}

/**
 * URLのバリデーション
 */
function validateUrl(url: string): boolean {
  if (!url) return true; // 空のURLは許可（フィルタリングされる）

  const urlRegex = /^https?:\/\/.+/;
  if (!urlRegex.test(url)) {
    throw new Error('URL must start with http:// or https://');
  }

  try {
    new URL(url);
    return true;
  } catch {
    throw new Error('Invalid URL format');
  }
}

/**
 * XSS対策: HTMLエスケープ
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Credentialのバリデーション
 */
function validateCredential(credential: Credential): boolean {
  // 名前は必須
  if (!credential.name || credential.name.trim().length === 0) {
    throw new Error('Credential name is required');
  }

  // 名前の長さ制限 (100文字)
  if (credential.name.length > 100) {
    throw new Error('Credential name must be 100 characters or less');
  }

  // Pattern A: Reference - referenceフィールド必須
  if (credential.type === 'reference') {
    if (credential.reference) {
      validateUrl(credential.reference);
    }
  }

  // Pattern B: Encrypted - encrypted_valueまたはmasked_displayが必要
  if (credential.type === 'encrypted') {
    if (!credential.encrypted_value && !credential.masked_display) {
      throw new Error('Encrypted credential must have encrypted_value or masked_display');
    }
  }

  // Pattern C: External - locationフィールド推奨 (必須ではない)
  // locationは任意の文字列

  // Noteは任意、長さ制限 (500文字)
  if (credential.note && credential.note.length > 500) {
    throw new Error('Credential note must be 500 characters or less');
  }

  return true;
}

/**
 * Project Info取得
 */
export async function getProjectInfo(
  repoCardId: string
): Promise<ProjectInfoData | null> {
  const supabase = await createClient();

  const { data: projectInfo, error: infoError } = await supabase
    .from('projectinfo')
    .select('*')
    .eq('repo_card_id', repoCardId)
    .single<ProjectInfoRow>();

  if (infoError) {
    if (infoError.code === 'PGRST116') {
      // データが存在しない場合は空の状態を返す
      return { quickNote: '', links: [], credentials: [] };
    }
    console.error('Failed to fetch project info:', infoError);
    throw new Error('Failed to fetch project information');
  }

  // linksをJsonから配列に変換
  type LinksJson = { production?: string[]; tracking?: string[]; supabase?: string[] };
  const linksData = (projectInfo.links as LinksJson | null) || { production: [], tracking: [], supabase: [] };
  const linksArray: ProjectInfoData['links'] = [
    ...(linksData.production || []).map((url: string) => ({ url, type: 'production' as const })),
    ...(linksData.tracking || []).map((url: string) => ({ url, type: 'tracking' as const })),
    ...(linksData.supabase || []).map((url: string) => ({ url, type: 'supabase' as const })),
  ];

  // Credentialsを取得
  const { data: credentials, error: credError } = await supabase
    .from('credential')
    .select('*')
    .eq('project_info_id', projectInfo.id);

  if (credError) {
    console.error('Failed to fetch credentials:', credError);
    // Credentialsの取得失敗は致命的ではないため、空配列を返す
  }

  // Credentialsをインターフェースに変換
  const credentialsArray: Credential[] = (credentials || []).map((cred: CredentialRow) => ({
    id: cred.id,
    type: cred.type as 'reference' | 'encrypted' | 'external',
    name: cred.name,
    reference: cred.reference || undefined,
    encrypted_value: cred.encrypted_value || undefined,
    encryption_key_id: cred.encryption_key_id || undefined,
    masked_display: cred.masked_display || undefined,
    location: cred.location || undefined,
    note: cred.note || undefined,
  }));

  return {
    quickNote: projectInfo.quick_note || '',
    links: linksArray,
    credentials: credentialsArray,
  };
}

/**
 * Project Info作成・更新
 */
export async function upsertProjectInfo(
  repoCardId: string,
  data: ProjectInfoData
): Promise<void> {
  const supabase = await createClient();

  // バリデーション
  validateQuickNote(data.quickNote);
  data.links.forEach((link) => {
    if (link.url) {
      validateUrl(link.url);
    }
  });

  // Credentialsのバリデーション
  if (data.credentials) {
    data.credentials.forEach((credential) => {
      validateCredential(credential);
    });
  }

  // XSSエスケープ
  const escapedNote = escapeHtml(data.quickNote);

  // linksを型に合わせて変換
  const linksJson = {
    production: data.links.filter(l => l.type === 'production').map(l => l.url),
    tracking: data.links.filter(l => l.type === 'tracking').map(l => l.url),
    supabase: data.links.filter(l => l.type === 'supabase').map(l => l.url),
  };

  try {
    // project_info の upsert
    const { data: existingInfo } = await supabase
      .from('projectinfo')
      .select('id')
      .eq('repo_card_id', repoCardId)
      .single<{ id: string }>();

    let projectInfoId: string;

    if (existingInfo) {
      // 更新
      projectInfoId = existingInfo.id;
      const updateData: ProjectInfoUpdate = {
        quick_note: escapedNote,
        links: linksJson,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('projectinfo')
        .update(updateData)
        .eq('id', existingInfo.id);

      if (updateError) {
        console.error('Failed to update project info:', updateError);
        throw new Error('Failed to update project information');
      }
    } else {
      // 新規作成
      const insertData: ProjectInfoInsert = {
        repo_card_id: repoCardId,
        quick_note: escapedNote,
        links: linksJson,
      };

      const { data: newProjectInfo, error: createError } = await supabase
        .from('projectinfo')
        .insert(insertData)
        .select('id')
        .single<{ id: string }>();

      if (createError || !newProjectInfo) {
        console.error('Failed to create project info:', createError);
        throw new Error('Failed to create project information');
      }

      projectInfoId = newProjectInfo.id;
    }

    // Credentials の処理
    if (data.credentials) {
      // 既存のCredentialsを取得
      const { data: existingCredentials } = await supabase
        .from('credential')
        .select('id')
        .eq('project_info_id', projectInfoId);

      const existingCredentialIds = new Set((existingCredentials || []).map(c => c.id));
      const submittedCredentialIds = new Set(
        data.credentials.filter(c => c.id).map(c => c.id!)
      );

      // 削除: 送信されなかったCredentialsを削除
      const credentialsToDelete = Array.from(existingCredentialIds).filter(
        id => !submittedCredentialIds.has(id)
      );

      if (credentialsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('credential')
          .delete()
          .in('id', credentialsToDelete);

        if (deleteError) {
          console.error('Failed to delete credentials:', deleteError);
        }
      }

      // 更新と新規作成
      for (const credential of data.credentials) {
        const credentialData = {
          project_info_id: projectInfoId,
          type: credential.type,
          name: escapeHtml(credential.name),
          reference: credential.reference ? escapeHtml(credential.reference) : null,
          encrypted_value: credential.encrypted_value || null,
          encryption_key_id: credential.encryption_key_id || null,
          masked_display: credential.masked_display || null,
          location: credential.location ? escapeHtml(credential.location) : null,
          note: credential.note ? escapeHtml(credential.note) : null,
        };

        if (credential.id && existingCredentialIds.has(credential.id)) {
          // 更新
          const { error: updateCredError } = await supabase
            .from('credential')
            .update(credentialData)
            .eq('id', credential.id);

          if (updateCredError) {
            console.error('Failed to update credential:', updateCredError);
            throw new Error(`Failed to update credential: ${credential.name}`);
          }
        } else {
          // 新規作成
          const { error: insertCredError } = await supabase
            .from('credential')
            .insert(credentialData as CredentialInsert);

          if (insertCredError) {
            console.error('Failed to insert credential:', insertCredError);
            throw new Error(`Failed to create credential: ${credential.name}`);
          }
        }
      }
    }

    // キャッシュ無効化
    revalidatePath('/board');
    revalidatePath(`/board/${repoCardId}`);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An error occurred while saving project information');
  }
}

/**
 * Project Info削除
 */
export async function deleteProjectInfo(repoCardId: string): Promise<void> {
  const supabase = await createClient();

  const { data: projectInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>();

  if (!projectInfo) {
    return; // データが存在しない場合は何もしない
  }

  const { error } = await supabase
    .from('projectinfo')
    .delete()
    .eq('id', projectInfo.id);

  if (error) {
    console.error('Failed to delete project info:', error);
    throw new Error('Failed to delete project information');
  }

  // キャッシュ無効化
  revalidatePath('/board');
  revalidatePath(`/board/${repoCardId}`);
}
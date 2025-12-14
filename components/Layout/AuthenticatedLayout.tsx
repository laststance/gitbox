/**
 * Authenticated Layout Component
 *
 * 認証済みユーザー向けのレイアウト
 * - Sidebar ナビゲーション
 * - メインコンテンツエリア
 */

'use client';

import React from 'react';
import { Sidebar } from '@/components/Sidebar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userAvatar?: string;
}

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  children,
  userName,
  userAvatar,
}) => {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar userName={userName} userAvatar={userAvatar} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default AuthenticatedLayout;


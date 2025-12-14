/**
 * Keyboard Shortcuts Help Modal
 *
 * Constitution要件:
 * - Principle I: ブラウザ検証必須（Playwright MCPで検証）
 * - Principle IV: WCAG AA準拠（キーボードナビゲーション、フォーカス管理）
 * - Principle VII: 日本語ファースト（UI表示は日本語）
 *
 * 機能:
 * - ?キーでモーダル開閉
 * - ESCキーでモーダルを閉じる
 * - カテゴリ別にショートカットを整理
 * - アクセシブルなテーブル形式
 */

"use client";

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Keyboard,
  Command,
  CornerDownLeft,
  RotateCcw,
  HelpCircle,
  MoreHorizontal,
} from 'lucide-react';

interface ShortcutItem {
  key: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

interface ShortcutsHelpProps {
  defaultOpen?: boolean;
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  /**
   * ショートカット定義
   * Constitution準拠: 日本語表示
   */
  const shortcuts: ShortcutItem[] = [
    {
      key: 'Tab',
      description: 'カード間を移動',
      icon: <Keyboard className="w-4 h-4" />,
      category: 'ナビゲーション',
    },
    {
      key: '.',
      description: 'オーバーフローメニューを開く',
      icon: <MoreHorizontal className="w-4 h-4" />,
      category: 'ナビゲーション',
    },
    {
      key: 'Enter',
      description: 'カードを開く',
      icon: <CornerDownLeft className="w-4 h-4" />,
      category: 'アクション',
    },
    {
      key: 'Z',
      description: '最後の操作を元に戻す',
      icon: <RotateCcw className="w-4 h-4" />,
      category: 'アクション',
    },
    {
      key: '?',
      description: 'このヘルプを表示/非表示',
      icon: <HelpCircle className="w-4 h-4" />,
      category: 'ヘルプ',
    },
    {
      key: '⌘K',
      description: 'コマンドパレットを開く',
      icon: <Command className="w-4 h-4" />,
      category: 'ナビゲーション',
    },
  ];

  /**
   * カテゴリ別にグループ化
   */
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  /**
   * キーボードイベントハンドラー
   * Constitution要件: ? キーでヘルプ表示、ESCで閉じる
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ? キーでトグル（input/textareaでは無効）
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          event.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }

      // ESCキーで閉じる
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="shortcuts-help-modal"
        aria-describedby="keyboard-shortcuts-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Keyboard className="w-6 h-6" />
            キーボードショートカット
          </DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description">
            GitHub Repository管理アプリのキーボードショートカット一覧
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {category}
              </h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">アイコン</th>
                      <th scope="col">ショートカットキー</th>
                      <th scope="col">説明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((shortcut, index) => (
                      <tr
                        key={`${category}-${index}`}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 w-12">
                          <div className="text-muted-foreground flex items-center justify-center">
                            {shortcut.icon}
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <kbd className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold bg-muted border border-border rounded-md shadow-sm min-w-[3rem]">
                            {shortcut.key}
                          </kbd>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shortcut.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
              ?
            </kbd>{' '}
            または{' '}
            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
              ESC
            </kbd>{' '}
            を押してこのダイアログを閉じる
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsHelp;

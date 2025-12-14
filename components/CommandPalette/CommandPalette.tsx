/**
 * Command Palette Component
 *
 * PRD: Command Palette (⌘K)
 * - グローバルコマンド検索
 * - キーボードナビゲーション
 * - ショートカットアクセス
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Home,
  Settings,
  PlusCircle,
  Archive,
  HelpCircle,
  LogOut,
  Palette,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/actions/auth';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'settings';
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    // Navigation
    {
      id: 'home',
      label: 'Go to Boards',
      icon: <Home className="h-4 w-4" />,
      shortcut: 'G B',
      action: () => router.push('/boards'),
      category: 'navigation',
    },
    {
      id: 'maintenance',
      label: 'Go to Maintenance',
      icon: <Archive className="h-4 w-4" />,
      shortcut: 'G M',
      action: () => router.push('/maintenance'),
      category: 'navigation',
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      icon: <Settings className="h-4 w-4" />,
      shortcut: 'G S',
      action: () => router.push('/settings'),
      category: 'navigation',
    },
    // Actions
    {
      id: 'new-board',
      label: 'Create New Board',
      icon: <PlusCircle className="h-4 w-4" />,
      shortcut: 'N',
      action: () => router.push('/boards/new'),
      category: 'actions',
    },
    {
      id: 'change-theme',
      label: 'Change Theme',
      icon: <Palette className="h-4 w-4" />,
      action: () => router.push('/settings'),
      category: 'actions',
    },
    // Settings
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      icon: <Keyboard className="h-4 w-4" />,
      shortcut: '?',
      action: () => {
        setIsOpen(false);
        // Show shortcuts modal (to be implemented)
        alert('Keyboard Shortcuts:\n\n⌘K - Command Palette\n? - Shortcuts Help\nG B - Go to Boards\nG M - Go to Maintenance\nG S - Go to Settings\nN - New Board\nZ - Undo\n. - Card Menu');
      },
      category: 'settings',
    },
    {
      id: 'help',
      label: 'Help & Documentation',
      icon: <HelpCircle className="h-4 w-4" />,
      action: () => window.open('https://github.com/laststance/gitbox', '_blank'),
      category: 'settings',
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: <LogOut className="h-4 w-4" />,
      action: async () => {
        await signOut();
        router.push('/login');
      },
      category: 'settings',
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
  };

  // Flatten for keyboard navigation
  const flatCommands = Object.values(groupedCommands).flat();

  // Open/close with ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch('');
        setSelectedIndex(0);
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
      } else if (e.key === 'Enter' && flatCommands[selectedIndex]) {
        e.preventDefault();
        flatCommands[selectedIndex].action();
        setIsOpen(false);
      }
    },
    [flatCommands, selectedIndex]
  );

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleClose = () => {
    setIsOpen(false);
    setSearch('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-background shadow-2xl"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands..."
                className="h-14 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="hidden rounded bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Command List */}
            <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
              {flatCommands.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No commands found
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category} className="mb-2">
                    <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                      {categoryLabels[category]}
                    </div>
                    {cmds.map((cmd) => {
                      const globalIndex = flatCommands.findIndex((c) => c.id === cmd.id);
                      return (
                        <button
                          key={cmd.id}
                          data-index={globalIndex}
                          onClick={() => {
                            cmd.action();
                            setIsOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          )}
                        >
                          <span
                            className={cn(
                              globalIndex === selectedIndex
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {cmd.icon}
                          </span>
                          <span className="flex-1">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                globalIndex === selectedIndex
                                  ? 'bg-primary-foreground/20 text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1.5 py-0.5">esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


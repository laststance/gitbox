/**
 * Theme Hook
 *
 * テーマ切り替え機能を提供するカスタムフック
 * LocalStorageに保存し、data-theme属性で適用
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeType =
  // Light themes
  | 'sunrise'
  | 'sandstone'
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'rose'
  // Dark themes
  | 'midnight'
  | 'graphite'
  | 'forest'
  | 'ocean'
  | 'plum'
  | 'rust'
  // Default (no custom theme)
  | 'system';

export const LIGHT_THEMES: ThemeType[] = [
  'sunrise',
  'sandstone',
  'mint',
  'sky',
  'lavender',
  'rose',
];

export const DARK_THEMES: ThemeType[] = [
  'midnight',
  'graphite',
  'forest',
  'ocean',
  'plum',
  'rust',
];

export const ALL_THEMES: ThemeType[] = [...LIGHT_THEMES, ...DARK_THEMES, 'system'];

export function isDarkTheme(theme: ThemeType): boolean {
  return DARK_THEMES.includes(theme);
}

const THEME_STORAGE_KEY = 'gitbox-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeType>('system');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
    if (stored && ALL_THEMES.includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Remove previous theme
    ALL_THEMES.forEach((t) => {
      if (t !== 'system') {
        root.removeAttribute('data-theme');
      }
    });

    if (theme === 'system') {
      // Use system preference
      root.removeAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      // Apply custom theme
      root.setAttribute('data-theme', theme);

      // Set dark class for dark themes
      if (isDarkTheme(theme)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  return {
    theme,
    setTheme,
    isDark: isDarkTheme(theme),
    mounted,
  };
}


/**
 * Theme System
 *
 * テーマをDOMに適用し、CSS変数を管理する
 */

import type { Theme } from './supabase/types'

/**
 * テーマをDOMに適用
 *
 * @param theme - 適用するテーマ名
 *
 * @example
 * ```ts
 * applyTheme('sunrise')  // ライトテーマ
 * applyTheme('midnight') // ダークテーマ
 * ```
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return // SSR環境ではスキップ
  }

  const html = document.documentElement
  html.setAttribute('data-theme', theme)

  // ダークテーマの場合は dark クラスを追加
  if (isDarkTheme(theme)) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

/**
 * 現在適用されているテーマを取得
 *
 * @returns 現在のテーマ名、未設定の場合はnull
 */
export function getCurrentTheme(): Theme | null {
  if (typeof document === 'undefined') {
    return null
  }

  const html = document.documentElement
  const theme = html.getAttribute('data-theme')

  return theme as Theme | null
}

/**
 * CSS変数の値を取得
 *
 * @param variableName - CSS変数名（例: 'color-bg-primary'）
 * @returns CSS変数の値
 *
 * @example
 * ```ts
 * const bgColor = getCSSVariable('color-bg-primary')
 * // "#ffffff"
 * ```
 */
export function getCSSVariable(variableName: string): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const styles = getComputedStyle(document.documentElement)
  return styles.getPropertyValue(`--${variableName}`).trim()
}

/**
 * テーマがダークモードかを判定
 *
 * @param theme - テーマ名
 * @returns ダークモードの場合true
 */
export function isDarkTheme(theme: Theme): boolean {
  const darkThemes: Theme[] = [
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]

  return darkThemes.includes(theme)
}

/**
 * すべてのテーマ名を取得
 *
 * @returns 12種類のテーマ名配列
 */
export function getAllThemes(): Theme[] {
  return [
    'sunrise',
    'sandstone',
    'mint',
    'sky',
    'lavender',
    'rose',
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]
}

/**
 * ライトテーマとダークテーマに分類
 *
 * @returns ライトとダークのテーマ配列
 */
export function getThemesByMode(): {
  light: Theme[]
  dark: Theme[]
} {
  return {
    light: ['sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose'],
    dark: ['midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'],
  }
}

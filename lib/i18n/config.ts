/**
 * next-intl Configuration
 *
 * 国際化（i18n）設定
 * サポート言語: 英語（en）、日本語（ja）
 */

import { getRequestConfig } from 'next-intl/server'

export const locales = ['en', 'ja'] as const
export const defaultLocale = 'ja' as const

export type Locale = (typeof locales)[number]

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
  timeZone: 'Asia/Tokyo',
  now: new Date(),
}))

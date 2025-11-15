/**
 * Root Layout
 *
 * アプリケーション全体のルートレイアウト
 * - next-intl プロバイダー
 * - Redux プロバイダー
 * - テーマ適用
 */

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/lib/i18n/config'
import '@/styles/globals.css'

// テーマファイルのインポート
import '@/styles/themes/light/sunrise.css'
import '@/styles/themes/dark/midnight.css'
// 他のテーマファイルもここでインポート

export function generateStaticParams() {
  return locales.map(locale => ({ locale }))
}

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // 有効なロケールかチェック
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound()
  }

  // メッセージを取得
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="GitHub Repository を Kanban ボード形式で管理" />
        <title>Vibe Rush - GitHub Repository Manager</title>
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  const requested = await requestLocale

  // Ensure that the incoming locale is valid
  const locale =
    requested && routing.locales.includes(requested as any)
      ? requested
      : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../lib/i18n/messages/${locale}.json`)).default,
  }
})

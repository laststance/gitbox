/**
 * Check if E2E test mode is enabled
 * When true, GitHub actions return mock data to bypass real API calls
 */
export const isTestMode = () =>
  process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
  (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')

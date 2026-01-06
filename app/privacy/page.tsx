/**
 * Privacy Policy Page
 *
 * GDPR-compliant privacy policy for GitBox
 * - Personal project with GitHub OAuth
 * - Minimal data collection
 */

import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - GitBox',
  description: 'Privacy Policy for GitBox application',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <header className="mb-8">
          <Link
            href="/login"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Back to Login
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last updated: January 7, 2026
          </p>
        </header>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Introduction
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              GitBox (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a
              personal project that helps you organize GitHub repositories in
              Kanban format. This Privacy Policy explains how we collect, use,
              and protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Data We Collect
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We collect minimal data necessary to provide our service:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>
                <strong>GitHub Profile Information:</strong> Username, email,
                and avatar URL (provided via GitHub OAuth)
              </li>
              <li>
                <strong>GitHub Repository Data:</strong> Public repository names
                and metadata you choose to add to boards
              </li>
              <li>
                <strong>User-Generated Content:</strong> Board names, notes, and
                project information you create
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              3. How We Use Your Data
            </h2>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>To authenticate you via GitHub OAuth</li>
              <li>To display and manage your Kanban boards</li>
              <li>To save your preferences and settings</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 mt-4">
              We do <strong>not</strong> sell your data, use it for advertising,
              or share it with third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Data Storage
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your data is stored securely using:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>
                <strong>Supabase:</strong> For database storage and
                authentication (
                <a
                  href="https://supabase.com/privacy"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase Privacy Policy
                </a>
                )
              </li>
              <li>
                <strong>Vercel:</strong> For application hosting (
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vercel Privacy Policy
                </a>
                )
              </li>
              <li>
                <strong>Local Storage:</strong> For preferences like theme
                settings (stored in your browser)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Your Rights (GDPR)
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Under GDPR, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>
                <strong>Right to Access:</strong> Request a copy of your data
              </li>
              <li>
                <strong>Right to Rectification:</strong> Correct inaccurate data
              </li>
              <li>
                <strong>Right to Erasure:</strong> Delete your account and all
                associated data via Settings → Account → Delete Account
              </li>
              <li>
                <strong>Right to Data Portability:</strong> Export your data
              </li>
              <li>
                <strong>Right to Object:</strong> Object to data processing
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Cookies
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              We use essential cookies only for authentication. We do not use
              tracking cookies or analytics that require consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Contact
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              For privacy-related inquiries, please open an issue on our{' '}
              <a
                href="https://github.com/laststance/gitbox/issues"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Changes to This Policy
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>
        </div>

        <footer className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/terms"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View Terms of Use →
          </Link>
        </footer>
      </article>
    </main>
  )
}

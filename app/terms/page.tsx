/**
 * Terms of Use Page
 *
 * Terms of use for GitBox personal project
 */

import type { Metadata } from 'next'
import Link from 'next/link'
export const metadata: Metadata = {
  title: 'Terms of Use - GitBox',
  description: 'Terms of Use for GitBox application',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <header className="mb-8">
          <Link
            href="/login"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Back to Login
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
            Terms of Use
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last updated: January 7, 2026
          </p>
        </header>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              By accessing and using GitBox, you accept and agree to be bound by
              the terms and conditions of this agreement. If you do not agree to
              these terms, please do not use the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Description of Service
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              GitBox is a free, open-source personal project that allows you to
              organize your GitHub repositories in a Kanban-style board format.
              The service is provided &quot;as is&quot; without any guarantees
              or warranty.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              3. User Responsibilities
            </h2>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>
                You are responsible for maintaining the confidentiality of your
                GitHub account
              </li>
              <li>
                You agree not to use the service for any illegal or unauthorized
                purpose
              </li>
              <li>
                You must not attempt to access data belonging to other users
              </li>
              <li>
                You agree not to interfere with or disrupt the service or
                servers
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Intellectual Property
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              GitBox is open-source software licensed under the MIT License. The
              source code is available on{' '}
              <a
                href="https://github.com/laststance/gitbox"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              .
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Your content (notes, board configurations, etc.) remains your
              property. By using the service, you grant us a license to store
              and display your content solely for the purpose of providing the
              service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Limitation of Liability
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              GitBox is a personal project provided free of charge. To the
              maximum extent permitted by law:
            </p>
            <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
              <li>
                The service is provided &quot;as is&quot; without warranty of
                any kind
              </li>
              <li>
                We are not liable for any damages arising from use of the
                service
              </li>
              <li>We do not guarantee continuous, uninterrupted service</li>
              <li>We are not responsible for data loss</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Account Termination
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              You may delete your account at any time through Settings → Account
              → Delete Account. Upon deletion, all your data will be permanently
              removed from our systems.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Service Modifications
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              We reserve the right to modify, suspend, or discontinue the
              service at any time without prior notice. As this is a personal
              project, features may change based on development priorities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Governing Law
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              These terms shall be governed by and construed in accordance with
              applicable laws. For EU users, GDPR rights apply as described in
              our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Contact
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              For questions about these Terms, please open an issue on our{' '}
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
        </div>

        <footer className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/privacy"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View Privacy Policy →
          </Link>
        </footer>
      </article>
    </main>
  )
}

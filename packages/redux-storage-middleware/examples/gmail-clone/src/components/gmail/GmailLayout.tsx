'use client'

/**
 * Main Gmail Layout Component
 */

import { memo, useCallback, useEffect, useState } from 'react'
import { Menu, Settings, HelpCircle, Grid3X3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import {
  loadEmails,
  generateMockEmails,
  clearAllEmails,
} from '@/lib/features/emails/emailSlice'
import { storageApi } from '@/lib/store'

import SearchBar from './SearchBar'
import StatsBar from './StatsBar'
import Sidebar from './Sidebar'
import EmailList from './EmailList'
import EmailViewer from './EmailViewer'

function GmailLayout() {
  const dispatch = useAppDispatch()
  const emailCount = useAppSelector((state) => state.emails.emails.length)
  const selectedId = useAppSelector((state) => state.emails.selectedId)
  const [isInitialized, setIsInitialized] = useState(false)

  // Check if hydration is complete
  useEffect(() => {
    const checkHydration = async () => {
      // Wait a bit for hydration to complete
      await new Promise((resolve) => setTimeout(resolve, 100))
      setIsInitialized(true)
    }
    checkHydration()
  }, [])

  // Generate mock emails (for demo purposes)
  const handleGenerateEmails = useCallback(
    (count: number) => {
      const startTime = performance.now()
      const emails = generateMockEmails(count)
      const generateTime = performance.now() - startTime

      dispatch(loadEmails(emails))

      console.log(
        `[Gmail Clone] Generated ${count} emails in ${generateTime.toFixed(2)}ms`,
      )
    },
    [dispatch],
  )

  // Clear all emails
  const handleClearEmails = useCallback(() => {
    dispatch(clearAllEmails())
    storageApi.clearStorage()
    console.log('[Gmail Clone] Cleared all emails and storage')
  }, [dispatch])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 border-b">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <svg className="h-8 w-8" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M22 6.5c0-.83-.67-1.5-1.5-1.5h-17C2.67 5 2 5.67 2 6.5v11c0 .83.67 1.5 1.5 1.5h17c.83 0 1.5-.67 1.5-1.5v-11z"
            />
            <path
              fill="#FBBC05"
              d="M22 6.5L12 13 2 6.5c0-.83.67-1.5 1.5-1.5h17c.83 0 1.5.67 1.5 1.5z"
            />
          </svg>
          <span className="text-xl font-medium text-gray-600">Gmail Clone</span>
        </div>

        <SearchBar />

        <div className="flex items-center gap-2 ml-auto">
          {/* Demo Controls */}
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateEmails(100)}
            >
              +100 Emails
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateEmails(1000)}
            >
              +1000 Emails
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateEmails(5000)}
            >
              +5000 Emails
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearEmails}
              disabled={emailCount === 0}
            >
              Clear All
            </Button>
          </div>

          <Button variant="ghost" size="icon">
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Grid3X3 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Email List */}
        <div className="flex-1 flex overflow-hidden">
          <div
            className={`${selectedId ? 'w-1/2' : 'w-full'} border-r overflow-hidden`}
          >
            <EmailList />
          </div>

          {/* Email Viewer */}
          {selectedId && (
            <div className="w-1/2 overflow-hidden">
              <EmailViewer />
            </div>
          )}
        </div>
      </div>

      {/* Footer with performance info */}
      {isInitialized && (
        <footer className="px-4 py-1 bg-slate-100 border-t text-xs text-muted-foreground flex items-center gap-4">
          <span>
            redux-storage-middleware demo | {emailCount.toLocaleString()} emails
            persisted to localStorage
          </span>
          <span className="ml-auto">
            Hydration: {storageApi.hasHydrated() ? '✅ Complete' : '⏳ Pending'}
          </span>
        </footer>
      )}
    </div>
  )
}

export default memo(GmailLayout)

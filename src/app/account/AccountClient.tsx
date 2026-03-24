/**
 * Account Client Component
 *
 * Client component for account management UI
 * - Profile section (avatar, username, linked since)
 * - Account Data section (boards, cards, maintenance counts)
 * - Danger Zone section (account deletion)
 */

'use client'

import { LayoutDashboard, FileText, Archive, LogOut } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { memo, useCallback, useState, useTransition } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { DeleteAccountDialog } from '@/components/Modals/DeleteAccountDialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { signOut } from '@/lib/actions/auth'

import type { AccountData, UserProfile } from './page'

interface AccountClientProps {
  userProfile: UserProfile
  accountData: AccountData
}

/**
 * Format date for display
 *
 * @param isoDate - ISO date string
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
const formatLinkedDate = (isoDate: string): string => {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const AccountClient = memo(function AccountClient({
  userProfile,
  accountData,
}: AccountClientProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()

  const handleSignOut = useCallback(() => {
    startSignOutTransition(async () => {
      await signOut()
    })
  }, [])

  const handleOpenDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true)
  }, [])

  const handleCloseDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false)
  }, [])

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and data
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GithubIcon className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your GitHub account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {userProfile.userAvatar ? (
                <Image
                  src={userProfile.userAvatar}
                  alt={userProfile.userName}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                  <GithubIcon className="text-muted-foreground h-8 w-8" />
                </div>
              )}
              <div>
                <p className="text-lg font-semibold">@{userProfile.userName}</p>
                <p className="text-muted-foreground text-sm">
                  Connected via GitHub
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-sm">
                Linked since {formatLinkedDate(userProfile.linkedSince)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Data Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account Data</CardTitle>
            <CardDescription>Summary of your GitBox data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center rounded-lg border p-4">
                <LayoutDashboard className="text-muted-foreground mb-2 h-6 w-6" />
                <span className="text-2xl font-bold">
                  {accountData.boardsCount}
                </span>
                <span className="text-muted-foreground text-sm">Boards</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-4">
                <FileText className="text-muted-foreground mb-2 h-6 w-6" />
                <span className="text-2xl font-bold">
                  {accountData.cardsCount}
                </span>
                <span className="text-muted-foreground text-sm">
                  Repository Cards
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-4">
                <Archive className="text-muted-foreground mb-2 h-6 w-6" />
                <span className="text-2xl font-bold">
                  {accountData.maintenanceCount}
                </span>
                <span className="text-muted-foreground text-sm">
                  Maintenance Items
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone Section */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">
                Deleting your account will permanently remove all your boards,
                cards, and settings. This action cannot be undone.
              </p>
              <p className="text-foreground mt-2 text-sm font-medium">
                Your GitHub repositories will NOT be affected.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleOpenDeleteDialog}
              data-testid="delete-account-button"
            >
              Delete Account
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Link href="/boards">
            <Button variant="outline">Back to Boards</Button>
          </Link>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      />
    </div>
  )
})

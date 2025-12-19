'use client'

/**
 * Stats Bar Component - Shows email statistics and performance metrics
 */

import { memo, useEffect, useState } from 'react'
import { Database, HardDrive, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useAppSelector } from '@/lib/hooks'
import { selectEmailStats } from '@/lib/features/emails/emailSlice'

function StatsBar() {
  const stats = useAppSelector(selectEmailStats)
  const [storageSize, setStorageSize] = useState<string>('0 KB')
  const [lastSync, setLastSync] = useState<string>('')
  const lastSyncTime = useAppSelector((state) => state.emails.lastSyncTime)

  useEffect(() => {
    // Calculate localStorage size
    try {
      const data = localStorage.getItem('gmail-clone-state')
      if (data) {
        const bytes = new Blob([data]).size
        if (bytes < 1024) {
          setStorageSize(`${bytes} B`)
        } else if (bytes < 1024 * 1024) {
          setStorageSize(`${(bytes / 1024).toFixed(1)} KB`)
        } else {
          setStorageSize(`${(bytes / (1024 * 1024)).toFixed(2)} MB`)
        }
      }
    } catch {
      setStorageSize('N/A')
    }
  }, [stats.total])

  useEffect(() => {
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime).toLocaleTimeString())
    }
  }, [lastSyncTime])

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <span>
          Total:{' '}
          <Badge variant="secondary">{stats.total.toLocaleString()}</Badge>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span>
          Unread:{' '}
          <Badge variant="destructive">{stats.unread.toLocaleString()}</Badge>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span>
          Starred:{' '}
          <Badge variant="outline">{stats.starred.toLocaleString()}</Badge>
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <HardDrive className="h-4 w-4" />
        <span>Storage: {storageSize}</span>
      </div>

      {lastSync && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Synced: {lastSync}</span>
        </div>
      )}
    </div>
  )
}

export default memo(StatsBar)

'use client'

/**
 * Stats Bar Component - Shows email statistics and performance metrics
 */

import { memo, useMemo } from 'react'
import { Database, HardDrive, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useAppSelector } from '@/lib/hooks'
import { selectEmailStats } from '@/lib/features/emails/emailSlice'

/**
 * Format bytes to human-readable size string.
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 KB", "2.3 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
}

/**
 * Calculate localStorage size safely.
 * @param key - localStorage key to measure
 * @returns Size string or 'N/A' on error
 */
function getStorageSize(key: string): string {
  if (typeof window === 'undefined') return '0 KB'
  try {
    const data = localStorage.getItem(key)
    if (data) {
      const bytes = new Blob([data]).size
      return formatBytes(bytes)
    }
    return '0 KB'
  } catch {
    return 'N/A'
  }
}

function StatsBar() {
  const stats = useAppSelector(selectEmailStats)
  const lastSyncTime = useAppSelector((state) => state.emails.lastSyncTime)

  // Compute storage size - recalculates when total changes (stats.total as version trigger)
  const storageSize = useMemo(
    () => getStorageSize('gmail-clone-state'),
    [stats.total],
  )

  // Compute last sync time using useMemo instead of useState + useEffect
  const lastSync = useMemo(() => {
    if (!lastSyncTime) return ''
    return new Date(lastSyncTime).toLocaleTimeString()
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

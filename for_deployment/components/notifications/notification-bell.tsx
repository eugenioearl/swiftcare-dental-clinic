'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Check, CheckCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { playNotificationSound, isMuted, setMuted, preloadNotificationSounds, subscribeMuteChange, testNotificationSound } from './notification-sound'
import { Volume2 } from 'lucide-react'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  module?: string | null
  priority: 'low' | 'normal' | 'important' | 'high' | 'urgent' | 'emergency'
  redirectUrl?: string | null
  relatedRecordId?: string | null
  readAt?: string | null
  createdAt: string
}

interface NotificationsResponse {
  success: boolean
  data?: {
    notifications: NotificationItem[]
    unreadCount: number
  }
}

const POLL_INTERVAL_MS = 15_000

const PRIORITY_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  emergency: { dot: 'bg-red-600', badge: 'bg-red-600 text-white', label: 'EMERGENCY' },
  urgent: { dot: 'bg-orange-500', badge: 'bg-orange-500 text-white', label: 'URGENT' },
  high: { dot: 'bg-amber-500', badge: 'bg-amber-500 text-white', label: 'HIGH' },
  important: { dot: 'bg-yellow-400', badge: 'bg-yellow-400 text-yellow-900', label: 'IMPORTANT' },
  normal: { dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-800', label: 'NORMAL' },
  low: { dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-700', label: 'LOW' },
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [muted, setMutedState] = useState<boolean>(false)
  const [markingAll, setMarkingAll] = useState(false)

  // Track notifications we've already seen so we only ring the bell for truly new ones.
  const seenIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef<boolean>(true)

  // Initialize mute state on mount and preload sound files to eliminate first-play lag.
  // Also subscribe to mute-preference changes broadcast from other components (e.g.
  // the /notifications page toggle) so the icon stays in sync across UIs.
  useEffect(() => {
    setMutedState(isMuted())
    preloadNotificationSounds()
    const unsub = subscribeMuteChange((m) => setMutedState(m))
    return () => unsub()
  }, [])

  const fetchLatest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=10&includeArchived=0', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: NotificationsResponse = await res.json()
      if (!json.success || !json.data) throw new Error('Invalid response')

      const items = json.data.notifications || []
      const count = json.data.unreadCount || 0

      // Detect brand-new unread notifications across the full page (not just newest id).
      // If any item we haven't seen before is unread, play the highest-priority chime.
      if (!firstLoadRef.current && items.length > 0) {
        const unseenUnread = items.filter((n) => !n.readAt && !seenIdsRef.current.has(n.id))
        if (unseenUnread.length > 0) {
          // Pick the highest-priority among the unseen items for the chime.
          const order: Record<string, number> = {
            emergency: 6, urgent: 5, high: 4, important: 3, normal: 2, low: 1,
          }
          const top = unseenUnread.reduce((a, b) =>
            (order[a.priority] || 0) >= (order[b.priority] || 0) ? a : b
          )
          try { playNotificationSound(top.priority) } catch (err) { console.warn('Sound play failed:', err) }
        }
      }
      // Track every id we've rendered so we don't re-ring for the same items.
      for (const n of items) seenIdsRef.current.add(n.id)
      firstLoadRef.current = false
      setNotifications(items)
      setUnreadCount(count)
      setError(null)
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err)
      if (!silent) setError('Unable to load notifications')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Initial load + polling.
  useEffect(() => {
    fetchLatest(false)
    let active = true
    const tick = () => {
      if (!active) return
      // Pause when tab hidden to save bandwidth.
      if (typeof document !== 'undefined' && document.hidden) return
      fetchLatest(true)
    }
    const interval = window.setInterval(tick, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLatest(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchLatest])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) fetchLatest(false)
  }

  const handleItemClick = async (n: NotificationItem) => {
    setOpen(false)
    // Optimistically mark read.
    if (!n.readAt) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await fetch(`/api/notifications/${n.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ markAsRead: true, clicked: true }),
        })
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    }
    if (n.redirectUrl) {
      router.push(n.redirectUrl)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
    // When turning sound ON, play a short test chime to confirm audio works.
    if (!next) {
      try { testNotificationSound() } catch {}
    }
  }

  const handleTestSound = () => {
    try { testNotificationSound() } catch {}
  }

  // Emergency notifications should float to the top of the list.
  const sorted = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const aE = a.priority === 'emergency' ? 1 : 0
      const bE = b.priority === 'emergency' ? 1 : 0
      if (aE !== bE) return bE - aE
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [notifications])

  const hasEmergency = notifications.some((n) => n.priority === 'emergency' && !n.readAt)

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`hover:bg-muted relative ${hasEmergency ? 'animate-pulse' : ''}`}
          aria-label={`Notifications${muted ? ' (sound muted)' : ''}`}
          title={muted ? 'Notifications (sound is muted \u2014 click to view and unmute)' : 'Notifications'}
        >
          <Bell className={`w-5 h-5 ${hasEmergency ? 'text-red-600' : ''}`} />
          {unreadCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow ${
                hasEmergency ? 'bg-red-600 ring-2 ring-red-200' : 'bg-teal-500'
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {muted && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gray-500 ring-2 ring-background flex items-center justify-center shadow"
              aria-hidden
            >
              <BellOff className="w-2 h-2 text-white" strokeWidth={3} />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] sm:w-[420px] max-w-[95vw] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div>
            <p className="font-semibold text-gray-800">Notifications</p>
            <p className="text-xs text-gray-500">
              {unreadCount === 0
                ? 'All caught up'
                : `${unreadCount} unread${hasEmergency ? ' • includes emergency' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!muted && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px] font-medium gap-1 text-teal-700 hover:bg-teal-50"
                onClick={handleTestSound}
                title="Play test chime"
              >
                <Volume2 className="w-4 h-4" />
                <span className="hidden sm:inline">Test</span>
              </Button>
            )}
            <Button
              variant={muted ? 'outline' : 'ghost'}
              size="sm"
              className={`h-8 px-2 text-[11px] font-medium gap-1 ${muted ? 'text-gray-500 border-gray-300' : 'text-teal-700 hover:bg-teal-50'}`}
              onClick={toggleMute}
              aria-pressed={!muted}
              title={muted ? 'Turn notification sounds ON' : 'Turn notification sounds OFF'}
            >
              {muted ? (
                <>
                  <BellOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Sound off</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Sound on</span>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={handleMarkAll}
              disabled={markingAll || unreadCount === 0}
              title="Mark all as read"
            >
              {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600 px-4">
              {error}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => fetchLatest(false)}>
                  Retry
                </Button>
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 px-4">
              <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((n) => {
                const style = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.normal
                const unread = !n.readAt
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition ${
                        unread ? 'bg-teal-50/40' : ''
                      } ${n.priority === 'emergency' ? 'border-l-4 border-red-500' : ''}`}
                    >
                      <div className="pt-1 shrink-0">
                        {n.priority === 'emergency' ? (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        ) : (
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {n.title}
                          </p>
                          {n.priority === 'emergency' && (
                            <Badge className="bg-red-600 text-white text-[10px] uppercase">Emergency</Badge>
                          )}
                          {n.priority === 'urgent' && (
                            <Badge className="bg-orange-500 text-white text-[10px] uppercase">Urgent</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {unread && <span className="w-2 h-2 rounded-full bg-teal-500 mt-2 shrink-0" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t px-4 py-2 bg-gray-50 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              router.push('/notifications')
            }}
            className="text-xs"
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell

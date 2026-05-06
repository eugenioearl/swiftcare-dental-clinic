'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bell,
  BellOff,
  CheckCheck,
  Archive,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  CreditCard,
  ClipboardList,
  FileText,
  MessageSquare,
  Info,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { cn } from '@/lib/utils'
import {
  playNotificationSound,
  preloadNotificationSounds,
  isMuted,
  setMuted as setSoundMuted,
  subscribeMuteChange,
  testNotificationSound,
} from '@/components/notifications/notification-sound'

const POLL_INTERVAL_MS = 15_000

type Notification = {
  id: string
  title: string
  message: string
  type: string
  priority: string
  status: string
  readAt?: string | null
  createdAt: string
  module?: string | null
  relatedRecordId?: string | null
  redirectUrl?: string | null
  archivedAt?: string | null
  metadata?: any
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  emergency: { label: 'EMERGENCY', className: 'bg-red-600 text-white border-red-700' },
  urgent: { label: 'URGENT', className: 'bg-red-100 text-red-700 border-red-300' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 border-orange-300' },
  important: { label: 'Important', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  normal: { label: 'Normal', className: 'bg-muted text-foreground border-border' },
  low: { label: 'Low', className: 'bg-muted/60 text-muted-foreground border-border' },
}

const MODULE_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  patients: 'Patients',
  queue: 'Queue',
  billing: 'Billing',
  treatments: 'Treatments',
  forms: 'Forms',
  documents: 'Documents',
  system: 'System',
}

function moduleIcon(module?: string | null) {
  switch (module) {
    case 'appointments':
      return <Calendar className="w-4 h-4" />
    case 'billing':
      return <CreditCard className="w-4 h-4" />
    case 'queue':
      return <ClipboardList className="w-4 h-4" />
    case 'forms':
      return <FileText className="w-4 h-4" />
    case 'documents':
      return <FileText className="w-4 h-4" />
    case 'treatments':
      return <ClipboardList className="w-4 h-4" />
    case 'system':
      return <Info className="w-4 h-4" />
    default:
      return <MessageSquare className="w-4 h-4" />
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleString()
}

export default function NotificationsCenterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false)
  const [filterModule, setFilterModule] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // Sound mute state — synced with the cross-UI mute preference.
  const [soundMuted, setSoundMutedState] = useState<boolean>(false)

  // Track the newest notification id we've seen so we only play sound on truly new ones.
  const latestSeenIdRef = useRef<string | null>(null)
  const firstLoadRef = useRef<boolean>(true)

  const loadNotifications = useCallback(
    async (isRefresh = false, silent = false) => {
      if (!silent) {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
      }
      if (!silent) setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (filterUnreadOnly) params.set('read', 'unread')
        if (filterModule !== 'all') params.set('module', filterModule)
        if (filterPriority !== 'all') params.set('priority', filterPriority)
        if (search.trim()) params.set('q', search.trim())
        if (includeArchived) params.set('includeArchived', '1')

        const res = await fetch(`/api/notifications?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const json = await res.json()
        // API returns { success: true, data: { notifications: [...], unreadCount, pagination } }
        const list: Notification[] = Array.isArray(json?.data?.notifications)
          ? json.data.notifications
          : Array.isArray(json?.notifications)
          ? json.notifications
          : Array.isArray(json)
          ? json
          : []

        // Play notification sound if a brand-new unread item appeared since last poll.
        if (!firstLoadRef.current && list.length > 0) {
          const newest = list[0]
          if (newest && newest.id !== latestSeenIdRef.current && !newest.readAt) {
            playNotificationSound(newest.priority as any)
          }
        }
        if (list.length > 0) latestSeenIdRef.current = list[0].id
        firstLoadRef.current = false

        setItems(list)
      } catch (e: any) {
        if (!silent) setError(e?.message || 'Failed to load notifications')
      } finally {
        if (!silent) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [filterUnreadOnly, filterModule, filterPriority, search, includeArchived]
  )

  // Initial + filter-triggered load (resets firstLoad so filter changes don't ring).
  useEffect(() => {
    firstLoadRef.current = true
    latestSeenIdRef.current = null
    loadNotifications()
  }, [loadNotifications])

  // Background polling: refresh every 30s and play a sound on new arrivals.
  // Pauses when the tab is hidden and immediately catches up on re-focus.
  useEffect(() => {
    let active = true
    const tick = () => {
      if (!active) return
      if (typeof document !== 'undefined' && document.hidden) return
      loadNotifications(false, true)
    }
    const interval = window.setInterval(tick, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications(false, true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadNotifications])

  // Preload sounds + sync mute state across UIs.
  useEffect(() => {
    preloadNotificationSounds()
    setSoundMutedState(isMuted())
    const unsub = subscribeMuteChange((m) => setSoundMutedState(m))
    return () => unsub()
  }, [])

  const toggleSoundMute = () => {
    const next = !soundMuted
    setSoundMutedState(next)
    setSoundMuted(next)
    // Confirm audio works when re-enabling.
    if (!next) {
      try { testNotificationSound() } catch {}
    }
    toast({
      title: next ? 'Notification sounds OFF' : 'Notification sounds ON',
      description: next
        ? 'You will no longer hear chimes for new notifications.'
        : 'You will now hear a chime for each new notification.',
    })
  }

  const handleTestSound = () => {
    try { testNotificationSound() } catch {}
    toast({
      title: 'Playing test chime',
      description: 'If you did not hear a sound, check your device volume and browser audio permissions.',
    })
  }

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items])

  const handleClick = async (n: Notification) => {
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      try {
        await fetch(`/api/notifications/${n.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ markAsRead: true }),
        })
      } catch {}
    }
    if (n.redirectUrl) {
      router.push(n.redirectUrl)
    }
  }

  const handleMarkRead = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markAsRead: true }),
      })
    } catch {
      toast({ title: 'Error', description: 'Could not mark as read', variant: 'destructive' })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleArchive = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    const prevItems = items
    setItems((prev) => prev.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archive: true }),
      })
      if (!res.ok) throw new Error('archive failed')
      toast({ title: 'Archived', description: 'Notification archived.' })
    } catch {
      setItems(prevItems)
      toast({ title: 'Error', description: 'Could not archive notification', variant: 'destructive' })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete notification?',
      description: 'This notification will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    setProcessingIds((prev) => new Set(prev).add(id))
    const prevItems = items
    setItems((prev) => prev.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: 'Deleted', description: 'Notification removed.' })
    } catch {
      setItems(prevItems)
      toast({ title: 'Error', description: 'Could not delete notification', variant: 'destructive' })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    setBulkBusy(true)
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      toast({ title: 'Marked as read', description: 'All notifications marked as read.' })
    } catch {
      toast({ title: 'Error', description: 'Could not mark all as read', variant: 'destructive' })
    } finally {
      setBulkBusy(false)
    }
  }

  const handleArchiveAllRead = async () => {
    const readIds = items.filter((i) => i.readAt).map((i) => i.id)
    if (readIds.length === 0) {
      toast({ title: 'Nothing to archive', description: 'No read notifications to archive.' })
      return
    }
    const ok = await confirm({
      title: `Archive ${readIds.length} read notification${readIds.length === 1 ? '' : 's'}?`,
      description: 'These notifications will be moved to your archive and removed from this list.',
      confirmLabel: 'Archive',
      variant: 'warning',
    })
    if (!ok) return
    setBulkBusy(true)
    const prevItems = items
    setItems((prev) => prev.filter((x) => !x.readAt))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'archive_all_read' }),
      })
      toast({ title: 'Archived', description: 'Archived all read notifications.' })
    } catch {
      setItems(prevItems)
      toast({ title: 'Error', description: 'Could not archive notifications', variant: 'destructive' })
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <DashboardLayout title="Notifications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Notification Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'You are all caught up'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!soundMuted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSound}
                title="Play a test chime to confirm audio"
                className="text-teal-700 border-teal-300 hover:bg-teal-50"
              >
                <Volume2 className="w-4 h-4 mr-1" /> Test sound
              </Button>
            )}
            <Button
              variant={soundMuted ? 'outline' : 'default'}
              size="sm"
              onClick={toggleSoundMute}
              aria-pressed={!soundMuted}
              title={soundMuted ? 'Turn notification sounds ON' : 'Turn notification sounds OFF'}
              className={cn(
                !soundMuted && 'bg-teal-600 hover:bg-teal-700 text-white',
                soundMuted && 'text-gray-600 border-gray-300'
              )}
            >
              {soundMuted ? (
                <>
                  <VolumeX className="w-4 h-4 mr-1" /> Sound off
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-1" /> Sound on
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadNotifications(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={bulkBusy || unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveAllRead}
              disabled={bulkBusy}
            >
              <Archive className="w-4 h-4 mr-1" /> Archive read
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notifications"
                  className="pl-8"
                />
              </div>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={filterUnreadOnly}
                    onCheckedChange={(v) => setFilterUnreadOnly(Boolean(v))}
                  />
                  <span>Unread only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={includeArchived}
                    onCheckedChange={(v) => setIncludeArchived(Boolean(v))}
                  />
                  <span>Include archived</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading notifications...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => loadNotifications()}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BellOff className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterUnreadOnly || filterModule !== 'all' || filterPriority !== 'all' || search
                    ? 'Try adjusting your filters.'
                    : 'You will see alerts and updates here.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            items.map((n) => {
              const isUnread = !n.readAt
              const isEmergency = n.priority === 'emergency'
              const badgeMeta = PRIORITY_BADGE[n.priority] || PRIORITY_BADGE.normal
              const busy = processingIds.has(n.id)
              return (
                <Card
                  key={n.id}
                  className={cn(
                    'transition-shadow hover:shadow-md border-l-4',
                    isEmergency
                      ? 'border-l-red-500 bg-red-50/50'
                      : isUnread
                      ? 'border-l-primary bg-primary/5'
                      : 'border-l-transparent'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-full shrink-0',
                          isEmergency ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
                        )}
                      >
                        {isEmergency ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          moduleIcon(n.module)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleClick(n)}
                          className="block w-full text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={cn(
                                'text-sm',
                                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                              )}
                            >
                              {n.title}
                            </h3>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="unread" />
                            )}
                            <Badge variant="outline" className={cn('text-[10px] font-semibold', badgeMeta.className)}>
                              {badgeMeta.label}
                            </Badge>
                            {n.module && (
                              <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground border-border">
                                {MODULE_LABELS[n.module] || n.module}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatTime(n.createdAt)}</p>
                        </button>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isUnread && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkRead(n.id)}
                            disabled={busy}
                            title="Mark as read"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(n.id)}
                          disabled={busy}
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(n.id)}
                          disabled={busy}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

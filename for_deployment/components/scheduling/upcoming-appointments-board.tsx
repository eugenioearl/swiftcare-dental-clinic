'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { format, isToday, isTomorrow, startOfDay, addDays } from 'date-fns'
import {
  CalendarClock,
  Check,
  X,
  UserCheck,
  Stethoscope,
  AlertTriangle,
  Flame,
  Users,
  Search,
  RefreshCw,
  Clock,
  Loader2,
  Filter,
  UserPlus,
  ChevronRight,
  CalendarX,
} from 'lucide-react'
import { cn, formatDentistName } from '@/lib/utils'

interface UpcomingApt {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  durationMinutes: number
  appointmentType: string
  status: string
  reasonForVisit: string | null
  notes: string | null
  isEmergency: boolean
  patient: {
    id: string
    patientNumber: string | null
    fullName: string
    mobileNumber?: string | null
    emailDirect?: string | null
  }
  dentist: {
    id: string
    user?: { firstName: string | null; lastName: string | null }
  } | null
}

interface Props {
  role: string
  currentDentistId?: string
  /**
   * When set, the matching appointment card will be scrolled into view
   * and visually highlighted briefly. Used by notification deep-links.
   */
  highlightAppointmentId?: string
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pending:            { label: 'Pending',         classes: 'bg-amber-50 text-amber-700 border-amber-300' },
  pending_assignment: { label: 'Needs Dentist',   classes: 'bg-amber-50 text-amber-700 border-amber-300' },
  scheduled:          { label: 'Scheduled',       classes: 'bg-blue-50 text-blue-700 border-blue-300' },
  confirmed:          { label: 'Confirmed',       classes: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  rescheduled:        { label: 'Rescheduled',     classes: 'bg-purple-50 text-purple-700 border-purple-300' },
  cancelled:          { label: 'Cancelled',       classes: 'bg-rose-50 text-rose-700 border-rose-300' },
  rejected:           { label: 'Rejected',        classes: 'bg-rose-50 text-rose-700 border-rose-300' },
  no_show:            { label: 'No-show',         classes: 'bg-rose-50 text-rose-700 border-rose-300' },
}

const APT_TYPE_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  cleaning:     'Cleaning',
  procedure:    'Procedure',
  surgery:      'Surgery',
  emergency:    'Emergency',
  follow_up:    'Follow-up',
  x_ray:        'X-Ray',
  walk_in:      'Walk-in',
}

function groupByDate(items: UpcomingApt[]): Array<{ date: Date; label: string; items: UpcomingApt[] }> {
  const map = new Map<string, UpcomingApt[]>()
  items.forEach(a => {
    const d = startOfDay(new Date(a.scheduledDatetime))
    const key = d.toISOString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, list]) => {
      const d = new Date(iso)
      let label = format(d, 'EEEE, MMMM d, yyyy')
      if (isToday(d)) label = `Today \u2022 ${format(d, 'EEEE, MMM d')}`
      else if (isTomorrow(d)) label = `Tomorrow \u2022 ${format(d, 'EEEE, MMM d')}`
      return { date: d, label, items: list.sort((x, y) => new Date(x.scheduledDatetime).getTime() - new Date(y.scheduledDatetime).getTime()) }
    })
}

export function UpcomingAppointmentsBoard({ role, currentDentistId, highlightAppointmentId }: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<UpcomingApt[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [rangeDays, setRangeDays] = useState<number>(14) // default: next 14 days
  const [includeToday, setIncludeToday] = useState(false)

  // Dialog state
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; apt: UpcomingApt | null }>({ open: false, apt: null })
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; apt: UpcomingApt | null }>({ open: false, apt: null })
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; apt: UpcomingApt | null }>({ open: false, apt: null })
  const [assignDentistId, setAssignDentistId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actioning, setActioning] = useState(false)
  const [dentists, setDentists] = useState<Array<{ id: string; name: string }>>([])

  // Dentists are now allowed to manage appointments (assign dentist, reschedule, cancel etc.)
  // alongside admin/staff/receptionist.
  const canManage = useMemo(
    () => ['admin', 'super_admin', 'manager', 'receptionist', 'staff', 'dentist'].includes(role),
    [role]
  )

  const fetchAppointments = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const now = new Date()
      const base = includeToday ? startOfDay(now) : startOfDay(addDays(now, 1))
      const dateFrom = base.toISOString()
      const dateTo = addDays(base, rangeDays).toISOString()
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        limit: '200',
        // Active pipeline statuses – skip finished/terminal states
        status: 'pending,pending_assignment,scheduled,confirmed,rescheduled',
      })
      const res = await fetch(`/api/appointments?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load appointments')
      const json = await res.json()
      const list: UpcomingApt[] = json?.data?.appointments || json?.appointments || []
      setItems(list)
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to load upcoming appointments', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [rangeDays, includeToday, toast])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Fetch dentists for assign dialog
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/dentists?limit=100')
        if (!res.ok) return
        const j = await res.json()
        const list = j?.data?.dentists || j?.dentists || []
        setDentists(
          list.map((d: any) => ({
            id: d.id,
            name: d.user
              ? formatDentistName(d.user.firstName, d.user.lastName)
              : `Dentist ${d.id?.slice(0, 6)}`,
          })),
        )
      } catch (err) {
        console.warn('Failed to load dentists', err)
      }
    })()
  }, [])

  // Filter client-side
  const filtered = useMemo(() => {
    let list = items.slice()
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        list = list.filter(a => a.status === 'pending' || a.status === 'pending_assignment')
      } else {
        list = list.filter(a => a.status === statusFilter)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(a =>
        a.patient.fullName.toLowerCase().includes(q) ||
        a.appointmentNumber.toLowerCase().includes(q) ||
        (a.reasonForVisit || '').toLowerCase().includes(q) ||
        (a.patient.patientNumber || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [items, search, statusFilter])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const pendingCount = useMemo(() => items.filter(a => a.status === 'pending' || a.status === 'pending_assignment').length, [items])

  const updateStatus = async (aptId: string, status: string, extra: { notes?: string; cancellationReason?: string } = {}) => {
    setActioning(true)
    try {
      const res = await fetch(`/api/appointments/${aptId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.error || 'Failed to update'
        throw new Error(msg)
      }
      toast({ title: `Appointment ${status.replace('_', ' ')}` })
      await fetchAppointments(true)
    } catch (err: any) {
      toast({ title: err?.message || 'Action failed', variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  const handleApprove = (apt: UpcomingApt) => {
    updateStatus(apt.id, 'confirmed')
  }

  const handleReject = async () => {
    if (!rejectDialog.apt) return
    await updateStatus(rejectDialog.apt.id, 'rejected', {
      notes: rejectReason.trim() || undefined,
      cancellationReason: rejectReason.trim() || 'Rejected by staff',
    })
    setRejectDialog({ open: false, apt: null })
    setRejectReason('')
  }

  const handleCancel = async () => {
    if (!cancelDialog.apt) return
    await updateStatus(cancelDialog.apt.id, 'cancelled', {
      notes: rejectReason.trim() || undefined,
      cancellationReason: rejectReason.trim() || 'Cancelled by staff',
    })
    setCancelDialog({ open: false, apt: null })
    setRejectReason('')
  }

  const openAssignDialog = (apt: UpcomingApt) => {
    setAssignDialog({ open: true, apt })
    setAssignDentistId(apt.dentist?.id || '')
  }

  const handleAssignDentist = async () => {
    if (!assignDialog.apt || !assignDentistId) {
      toast({ title: 'Select a dentist', variant: 'destructive' })
      return
    }
    setActioning(true)
    try {
      const res = await fetch(`/api/appointments/${assignDialog.apt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dentistId: assignDentistId }),
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.error || 'Failed to assign'
        throw new Error(msg)
      }
      toast({ title: 'Dentist assigned successfully' })
      setAssignDialog({ open: false, apt: null })
      setAssignDentistId('')
      await fetchAppointments(true)
    } catch (err: any) {
      toast({ title: err?.message || 'Assignment failed', variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // -------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mr-2">
              <CalendarClock className="w-4 h-4 text-[#2D9DA8]" />
              Upcoming Appointments
            </div>
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 border">
                {pendingCount} pending approval
              </Badge>
            )}

            <div className="flex-1" />

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, reason..."
                className="h-8 w-60 text-xs pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending approval</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Next 3 days</SelectItem>
                <SelectItem value="7">Next 7 days</SelectItem>
                <SelectItem value="14">Next 14 days</SelectItem>
                <SelectItem value="30">Next 30 days</SelectItem>
                <SelectItem value="60">Next 60 days</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className={cn('h-8 text-xs', includeToday && 'bg-blue-50 border-blue-300 text-blue-700')}
              onClick={() => setIncludeToday(v => !v)}
            >
              <Clock className="w-3 h-3 mr-1" /> {includeToday ? 'Today + Future' : 'Future only'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchAppointments(true)}
              className="h-8 w-8"
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Loading upcoming appointments…</p>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <CalendarX className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No upcoming appointments</h3>
            <p className="text-sm text-gray-500 mt-1">
              Nothing matches your filters in the next {rangeDays} day{rangeDays === 1 ? '' : 's'}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(group => (
            <div key={group.date.toISOString()} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-6 rounded-sm bg-gradient-to-b from-[#2D9DA8] to-[#4A90E2]" />
                <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
                <Badge variant="outline" className="text-[10px] text-gray-500">
                  {group.items.length} appointment{group.items.length === 1 ? '' : 's'}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {group.items.map(apt => (
                  <UpcomingCard
                    key={apt.id}
                    apt={apt}
                    canManage={canManage}
                    actioning={actioning}
                    isHighlighted={!!highlightAppointmentId && apt.id === highlightAppointmentId}
                    onApprove={() => handleApprove(apt)}
                    onReject={() => setRejectDialog({ open: true, apt })}
                    onCancel={() => setCancelDialog({ open: true, apt })}
                    onAssign={() => openAssignDialog(apt)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={o => {
          if (!o) {
            setRejectDialog({ open: false, apt: null })
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject appointment?</DialogTitle>
            <DialogDescription>
              The patient will be notified that this request was rejected. You can optionally include a reason.
            </DialogDescription>
          </DialogHeader>
          {rejectDialog.apt && (
            <div className="text-sm bg-gray-50 rounded p-3 border">
              <div className="font-semibold text-gray-900">{rejectDialog.apt.patient.fullName}</div>
              <div className="text-xs text-gray-500">
                {format(new Date(rejectDialog.apt.scheduledDatetime), 'EEEE, MMM d \u2022 h:mm a')}
              </div>
            </div>
          )}
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Optional reason for rejection…"
            className="min-h-[88px] text-sm"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog({ open: false, apt: null })
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actioning}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actioning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog.open}
        onOpenChange={o => {
          if (!o) {
            setCancelDialog({ open: false, apt: null })
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment?</DialogTitle>
            <DialogDescription>
              The appointment will be marked as cancelled. You can optionally include a cancellation reason.
            </DialogDescription>
          </DialogHeader>
          {cancelDialog.apt && (
            <div className="text-sm bg-gray-50 rounded p-3 border">
              <div className="font-semibold text-gray-900">{cancelDialog.apt.patient.fullName}</div>
              <div className="text-xs text-gray-500">
                {format(new Date(cancelDialog.apt.scheduledDatetime), 'EEEE, MMM d \u2022 h:mm a')}
              </div>
            </div>
          )}
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Optional cancellation reason…"
            className="min-h-[88px] text-sm"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialog({ open: false, apt: null })
                setRejectReason('')
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={actioning}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actioning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dentist Dialog */}
      <Dialog
        open={assignDialog.open}
        onOpenChange={o => {
          if (!o) {
            setAssignDialog({ open: false, apt: null })
            setAssignDentistId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignDialog.apt?.dentist ? 'Reassign Dentist' : 'Assign Dentist'}
            </DialogTitle>
            <DialogDescription>
              Pick a dentist for this upcoming appointment.
              {assignDialog.apt?.status === 'pending_assignment' && ' The patient will be notified once approved.'}
            </DialogDescription>
          </DialogHeader>
          {assignDialog.apt && (
            <div className="text-sm bg-gray-50 rounded p-3 border">
              <div className="font-semibold text-gray-900">{assignDialog.apt.patient.fullName}</div>
              <div className="text-xs text-gray-500">
                {format(new Date(assignDialog.apt.scheduledDatetime), 'EEEE, MMM d \u2022 h:mm a')}
                {' \u2022 '}
                {APT_TYPE_LABEL[assignDialog.apt.appointmentType] || assignDialog.apt.appointmentType}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Dentist</Label>
            <Select value={assignDentistId} onValueChange={setAssignDentistId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a dentist..." />
              </SelectTrigger>
              <SelectContent>
                {dentists.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No dentists available
                  </SelectItem>
                ) : (
                  dentists.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialog({ open: false, apt: null })
                setAssignDentistId('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignDentist}
              disabled={actioning || !assignDentistId}
              className="bg-[#2D9DA8] hover:bg-[#23828d] text-white"
            >
              {actioning ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4 mr-1" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Card Component ────────────────────────────────────────────────
interface CardProps {
  apt: UpcomingApt
  canManage: boolean
  actioning: boolean
  isHighlighted?: boolean
  onApprove: () => void
  onReject: () => void
  onCancel: () => void
  onAssign: () => void
}

function UpcomingCard({ apt, canManage, actioning, isHighlighted = false, onApprove, onReject, onCancel, onAssign }: CardProps) {
  const date = new Date(apt.scheduledDatetime)
  const isPending = apt.status === 'pending' || apt.status === 'pending_assignment'
  const statusInfo = STATUS_LABELS[apt.status] || { label: apt.status, classes: 'bg-gray-50 text-gray-700 border-gray-300' }
  const dentistName = apt.dentist?.user
    ? formatDentistName(apt.dentist.user.firstName, apt.dentist.user.lastName)
    : null

  const cardRef = useRef<HTMLDivElement | null>(null)
  const [highlightActive, setHighlightActive] = useState(false)
  useEffect(() => {
    if (!isHighlighted) return
    const node = cardRef.current
    if (!node) return
    setHighlightActive(true)
    const scrollTimer = setTimeout(() => {
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        // ignore older browsers
      }
    }, 100)
    const pulseTimer = setTimeout(() => setHighlightActive(false), 4000)
    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(pulseTimer)
    }
  }, [isHighlighted])

  return (
    <div
      ref={cardRef}
      className={cn(
        'group bg-white rounded-md border p-3 shadow-sm hover:shadow-md transition-all',
        apt.isEmergency && 'border-red-300 bg-red-50/40',
        isPending && 'border-amber-300 bg-amber-50/30',
        highlightActive && 'ring-2 ring-[#2D9DA8] ring-offset-2 shadow-lg animate-pulse',
      )}
    >
      {/* Header row: name + status */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-semibold text-sm truncate text-gray-900">
              {apt.patient.fullName}
            </h4>
            {apt.isEmergency && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1 py-0 h-4">
                <Flame className="w-2.5 h-2.5 mr-0.5" /> EMRG
              </Badge>
            )}
            {apt.appointmentType === 'walk_in' && (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-1 py-0 h-4">
                <UserPlus className="w-2.5 h-2.5 mr-0.5" /> Walk-in
              </Badge>
            )}
          </div>
          {apt.patient.patientNumber && (
            <p className="text-[11px] text-gray-500 truncate">#{apt.patient.patientNumber} &bull; {apt.appointmentNumber}</p>
          )}
        </div>
        <Badge variant="outline" className={cn('text-[10px] font-medium whitespace-nowrap', statusInfo.classes)}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Meta: time, type, dentist */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-gray-700">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="font-medium">{format(date, 'h:mm a')}</span>
          <span className="text-gray-400">&bull;</span>
          <span className="text-gray-500">{apt.durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Stethoscope className="w-3 h-3 text-gray-400" />
          <span className="truncate">
            {APT_TYPE_LABEL[apt.appointmentType] || apt.appointmentType}
          </span>
          {dentistName ? (
            <>
              <span className="text-gray-400">&bull;</span>
              <span className="truncate">{dentistName}</span>
            </>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 h-4 px-1">
              No dentist
            </Badge>
          )}
        </div>
        {apt.reasonForVisit && (
          <div className="text-gray-500 italic truncate">&ldquo;{apt.reasonForVisit}&rdquo;</div>
        )}
      </div>

      {/* Action buttons */}
      {canManage && (
        <div className="mt-2.5 pt-2.5 border-t flex items-center gap-1.5 flex-wrap">
          {isPending ? (
            <>
              <Button
                size="sm"
                disabled={actioning}
                onClick={onApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs flex-1 min-w-[110px]"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actioning}
                onClick={onReject}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 text-xs flex-1 min-w-[110px]"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actioning}
                onClick={onAssign}
                className="border-[#2D9DA8]/40 text-[#2D9DA8] hover:bg-[#2D9DA8]/5 h-7 text-xs w-full"
              >
                <Stethoscope className="w-3.5 h-3.5 mr-1" />
                {dentistName ? 'Reassign Dentist' : 'Assign Dentist'}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={actioning}
                onClick={onAssign}
                className="border-[#2D9DA8]/40 text-[#2D9DA8] hover:bg-[#2D9DA8]/5 h-7 text-xs"
              >
                <Stethoscope className="w-3.5 h-3.5 mr-1" />
                {dentistName ? 'Reassign' : 'Assign Dentist'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actioning}
                onClick={onCancel}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 text-xs"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              {apt.status === 'scheduled' && (
                <Button
                  size="sm"
                  disabled={actioning}
                  onClick={onApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Confirm
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

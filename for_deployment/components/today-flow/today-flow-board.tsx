'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import {
  CalendarClock,
  Clock,
  UserCheck,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Play,
  Check,
  X,
  LogOut,
  MoreVertical,
  RefreshCw,
  UserPlus,
  Flame,
  Timer,
  Users,
  ArrowRightCircle,
  Search,
  Grip,
  ChevronsRight,
  TimerOff,
  Filter,
  ClipboardList,
  QrCode,
  Copy,
  ExternalLink,
  Loader2,
  FileText,
  LayoutDashboard,
  Mail,
  Send,
  Plus,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { cn, formatDentistName, copyToClipboard as safeCopyToClipboard } from '@/lib/utils'
import {
  statusLabel,
  statusBadgeClass,
  canMoveToLane,
  laneToStatus,
  type FlowLane,
} from '@/lib/patient-flow'

interface Patient {
  id: string
  patientNumber: string | null
  fullName: string
  phone: string | null
  email: string | null
}

interface Dentist {
  id: string
  name: string
}

interface FlowAppointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  durationMinutes: number
  appointmentType: string
  status: string
  reasonForVisit: string | null
  notes: string | null
  isEmergency: boolean
  isWalkIn: boolean
  isStandby: boolean
  isLate: boolean
  minutesLate: number
  checkedInAt: string | null
  startedAt: string | null
  completedAt: string | null
  priority: number
  patient: Patient
  dentist: Dentist | null
}

interface LaneCounts {
  today_schedule: number
  waiting: number
  queue: number
  standby: number
  in_treatment: number
  completed: number
  cancelled: number
  no_show: number
  total: number
  total_walk_ins: number
  late_patients: number
  emergencies: number
}

interface FlowAlert {
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  appointmentId?: string
}

interface TodayFlowData {
  lanes: Record<FlowLane, FlowAppointment[]>
  cancelled: FlowAppointment[]
  no_show: FlowAppointment[]
  counts: LaneCounts
  alerts: FlowAlert[]
  timestamp: string
}

const LANE_META: Record<
  FlowLane,
  {
    title: string
    icon: any
    bg: string
    header: string
    border: string
    description: string
    dropHighlight: string
  }
> = {
  today_schedule: {
    title: "Today's Schedule",
    icon: CalendarClock,
    bg: 'bg-blue-50/60',
    header: 'bg-blue-100 text-blue-800',
    border: 'border-blue-200',
    description: 'Scheduled patients (not yet arrived)',
    dropHighlight: 'ring-2 ring-blue-400 bg-blue-50',
  },
  standby: {
    title: 'Walk-In Standby',
    icon: UserPlus,
    bg: 'bg-orange-50/60',
    header: 'bg-orange-100 text-orange-800',
    border: 'border-orange-200',
    description: 'Walk-ins awaiting approval',
    dropHighlight: 'ring-2 ring-orange-400 bg-orange-50',
  },
  waiting: {
    title: 'Waiting',
    icon: Clock,
    bg: 'bg-amber-50/60',
    header: 'bg-amber-100 text-amber-800',
    border: 'border-amber-200',
    description: 'Checked-in, in the waiting area',
    dropHighlight: 'ring-2 ring-amber-400 bg-amber-50',
  },
  queue: {
    title: 'In Queue',
    icon: Users,
    bg: 'bg-yellow-50/60',
    header: 'bg-yellow-100 text-yellow-900',
    border: 'border-yellow-200',
    description: 'Active queue — ready for dentist',
    dropHighlight: 'ring-2 ring-yellow-400 bg-yellow-50',
  },
  in_treatment: {
    title: 'In Treatment',
    icon: Stethoscope,
    bg: 'bg-purple-50/60',
    header: 'bg-purple-100 text-purple-800',
    border: 'border-purple-200',
    description: 'Currently with dentist',
    dropHighlight: 'ring-2 ring-purple-400 bg-purple-50',
  },
  completed: {
    title: 'Completed Today',
    icon: CheckCircle2,
    bg: 'bg-emerald-50/60',
    header: 'bg-emerald-100 text-emerald-800',
    border: 'border-emerald-200',
    description: 'Done — ready for billing / follow-up',
    dropHighlight: 'ring-2 ring-emerald-400 bg-emerald-50',
  },
}

// Polling interval for the Operations Board.
// Increased from 5s → 15s: 5s was causing visible flicker / perceived
// auto-refresh while users interacted with dropdowns, dialogs and drags.
// 15s is still "live" while giving the UI breathing room.
const POLL_INTERVAL_MS = 15000
const LANE_ORDER: FlowLane[] = ['today_schedule', 'standby', 'waiting', 'queue', 'in_treatment', 'completed']

type ViewFilter = 'all' | 'scheduled_only' | 'walkins_only' | 'active_only'

interface TodayFlowBoardProps {
  role?: string
  currentDentistId?: string
  /**
   * When set, the matching appointment card will be scrolled into view
   * and visually highlighted (3s pulse) shortly after the data loads.
   * Used by notification deep-links from the email/in-app notifications.
   */
  highlightAppointmentId?: string
}

export function TodayFlowBoard({ role = 'staff', highlightAppointmentId }: TodayFlowBoardProps) {
  const { toast } = useToast()
  const [data, setData] = useState<TodayFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDentistId, setFilterDentistId] = useState<string>('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])

  // Dialog states
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<FlowAppointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelType, setCancelType] = useState<'cancelled' | 'left' | 'no_show'>('cancelled')

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<FlowAppointment | null>(null)
  const [assignDentistId, setAssignDentistId] = useState('')

  // Approve / Reject dialog (for pending scheduled appointments)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<FlowAppointment | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Forms dialog
  const [formsTarget, setFormsTarget] = useState<FlowAppointment | null>(null)

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverLane, setDragOverLane] = useState<FlowLane | null>(null)

  const isMountedRef = useRef(true)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Dentists are now allowed to manage appointments (assign dentist, reschedule, cancel etc.)
  // alongside admin/staff. This was requested so that dentists can self-assign or reassign
  // patients to themselves or to other dentists when they need to swap coverage.
  const canManage = ['admin', 'super_admin', 'manager', 'staff', 'receptionist', 'dentist'].includes(role)
  const canTreat = ['dentist', 'admin', 'super_admin'].includes(role)

  // -------------------- Fetchers --------------------
  const fetchFlow = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      const res = await fetch('/api/today-flow', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!isMountedRef.current) return
      if (json?.data) {
        setData(json.data as TodayFlowData)
        setLastUpdated(new Date())
        setError(null)
      }
    } catch (e: any) {
      console.error('TodayFlow fetch error:', e)
      if (isMountedRef.current) setError(e?.message || 'Failed to load flow')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  const fetchDentists = useCallback(async () => {
    try {
      const res = await fetch('/api/dentists')
      if (!res.ok) return
      const json = await res.json()
      const list = (json?.data?.dentists || []).map((d: any) => ({
        id: d.id,
        name: formatDentistName(d.user?.firstName, d.user?.lastName),
      }))
      if (isMountedRef.current) setDentists(list)
    } catch (e) {
      console.error('Dentists fetch error:', e)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchFlow(false)
    fetchDentists()
    pollRef.current = setInterval(() => fetchFlow(true), POLL_INTERVAL_MS)
    return () => {
      isMountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchFlow, fetchDentists])

  // -------------------- Core mutation: status update --------------------
  const updateStatus = async (
    appointmentId: string,
    newStatus: string,
    extra: { cancellationReason?: string; notes?: string } = {}
  ) => {
    // Optimistic: mark the card as moving
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extra }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || `HTTP ${res.status}`)
      }
      toast({
        title: 'Updated',
        description: `Status changed to ${newStatus.replace('_', ' ')}`,
      })
      await fetchFlow(true)
      return true
    } catch (e: any) {
      console.error('Status update error:', e)
      toast({
        title: 'Update failed',
        description: e?.message || 'Could not update status',
        variant: 'destructive',
      })
      return false
    }
  }

  // Append a note to an appointment (used by Mark Late)
  const appendNote = async (appointmentId: string, noteText: string) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    } catch (e: any) {
      console.error('Note update error:', e)
      return false
    }
  }

  // Assign dentist helper (also moves walk-in standby to waiting)
  const assignDentist = async (appointmentId: string, dentistId: string, moveToWaiting: boolean = false) => {
    try {
      const body: any = { dentistId }
      if (moveToWaiting) body.status = 'waiting'
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || `HTTP ${res.status}`)
      }
      toast({ title: 'Assigned', description: 'Dentist assigned successfully' })
      await fetchFlow(true)
      return true
    } catch (e: any) {
      console.error('Assign error:', e)
      toast({
        title: 'Assignment failed',
        description: e?.message || 'Could not assign dentist',
        variant: 'destructive',
      })
      return false
    }
  }

  // -------------------- Card action handlers --------------------
  const handleCheckIn = (apt: FlowAppointment) => updateStatus(apt.id, 'checked_in')
  const handleMoveToWaiting = (apt: FlowAppointment) => updateStatus(apt.id, 'checked_in')
  const handleMoveToQueue = (apt: FlowAppointment) => updateStatus(apt.id, 'waiting')
  const handleStartTreatment = (apt: FlowAppointment) => updateStatus(apt.id, 'in_progress')
  const handleComplete = (apt: FlowAppointment) => updateStatus(apt.id, 'completed')

  const handleMarkLate = async (apt: FlowAppointment) => {
    const existing = apt.notes ? apt.notes + '\n' : ''
    const stamp = format(new Date(), 'HH:mm')
    const note = `${existing}[${stamp}] Marked LATE by staff`
    const ok = await appendNote(apt.id, note)
    if (ok) {
      toast({ title: 'Marked late', description: `${apt.patient.fullName} flagged as late` })
      await fetchFlow(true)
    } else {
      toast({ title: 'Failed', description: 'Could not mark late', variant: 'destructive' })
    }
  }

  const openCancelDialog = (apt: FlowAppointment, type: 'cancelled' | 'left' | 'no_show' = 'cancelled') => {
    setCancelTarget(apt)
    setCancelType(type)
    setCancelReason(
      type === 'left'
        ? 'Patient left without treatment'
        : type === 'no_show'
        ? 'Patient did not show up'
        : ''
    )
    setCancelDialogOpen(true)
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    if (!cancelReason.trim() && cancelType === 'cancelled') {
      toast({ title: 'Reason required', description: 'Please provide a reason', variant: 'destructive' })
      return
    }
    const status = cancelType === 'no_show' ? 'no_show' : 'cancelled'
    const ok = await updateStatus(cancelTarget.id, status, {
      cancellationReason: cancelReason,
    })
    if (ok) {
      setCancelDialogOpen(false)
      setCancelTarget(null)
      setCancelReason('')
    }
  }

  const openAssignDialog = (apt: FlowAppointment) => {
    setAssignTarget(apt)
    setAssignDentistId(apt.dentist?.id || '')
    setAssignDialogOpen(true)
  }

  const confirmAssign = async () => {
    if (!assignTarget || !assignDentistId) {
      toast({ title: 'Select dentist', description: 'Please pick a dentist', variant: 'destructive' })
      return
    }
    const moveToWaiting = assignTarget.isStandby || assignTarget.status === 'pending_assignment'
    const ok = await assignDentist(assignTarget.id, assignDentistId, moveToWaiting)
    if (ok) {
      setAssignDialogOpen(false)
      setAssignTarget(null)
    }
  }

  // Approve a pending scheduled appointment (pending → scheduled, triggers approval email)
  const handleApprove = async (apt: FlowAppointment) => {
    const ok = await updateStatus(apt.id, 'scheduled')
    if (ok) {
      toast({
        title: 'Appointment approved',
        description: `${apt.patient.fullName} has been notified by email`,
      })
    }
  }

  const openRejectDialog = (apt: FlowAppointment) => {
    setRejectTarget(apt)
    setRejectReason('')
    setRejectDialogOpen(true)
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    const ok = await updateStatus(rejectTarget.id, 'rejected', {
      cancellationReason: rejectReason.trim() || 'Rejected by staff',
    })
    if (ok) {
      toast({
        title: 'Appointment rejected',
        description: `${rejectTarget.patient.fullName} has been notified by email`,
      })
      setRejectDialogOpen(false)
      setRejectTarget(null)
      setRejectReason('')
    }
  }

  // -------------------- Drag & drop handlers --------------------
  const handleDragStart = (e: React.DragEvent, apt: FlowAppointment) => {
    setDraggingId(apt.id)
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({
        id: apt.id,
        status: apt.status,
        appointmentType: apt.appointmentType,
        isStandby: apt.isStandby,
      }))
    } catch {}
  }
  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverLane(null)
  }
  const handleDragOver = (e: React.DragEvent, lane: FlowLane) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverLane !== lane) setDragOverLane(lane)
  }
  const handleDragLeave = (lane: FlowLane) => {
    if (dragOverLane === lane) setDragOverLane(null)
  }
  const handleDrop = async (e: React.DragEvent, targetLane: FlowLane) => {
    e.preventDefault()
    setDragOverLane(null)
    setDraggingId(null)

    let payload: any = null
    try {
      payload = JSON.parse(e.dataTransfer.getData('application/json'))
    } catch {
      return
    }
    if (!payload?.id) return

    const check = canMoveToLane(
      {
        status: payload.status,
        appointmentType: payload.appointmentType,
        isStandby: payload.isStandby,
      },
      targetLane
    )
    if (!check.allowed) {
      toast({
        title: 'Move not allowed',
        description: check.reason || 'Invalid transition',
        variant: 'destructive',
      })
      return
    }
    const targetStatus = laneToStatus(targetLane)
    if (!targetStatus) return
    await updateStatus(payload.id, targetStatus)
  }

  // -------------------- View filters + search --------------------
  const filteredData = useMemo(() => {
    if (!data) return null
    const q = searchQuery.trim().toLowerCase()
    const filterApt = (apt: FlowAppointment) => {
      // View filter
      if (viewFilter === 'scheduled_only' && apt.isWalkIn) return false
      if (viewFilter === 'walkins_only' && !apt.isWalkIn) return false
      if (viewFilter === 'active_only') {
        const active = ['checked_in', 'waiting', 'in_progress'].includes(apt.status)
        if (!active && !apt.isStandby) return false
      }
      // Dentist filter
      if (filterDentistId !== 'all') {
        if (filterDentistId === 'unassigned') {
          if (apt.dentist) return false
        } else if (apt.dentist?.id !== filterDentistId) {
          return false
        }
      }
      // Search
      if (!q) return true
      return (
        apt.patient.fullName.toLowerCase().includes(q) ||
        apt.appointmentNumber.toLowerCase().includes(q) ||
        (apt.patient.patientNumber?.toLowerCase().includes(q) ?? false) ||
        (apt.reasonForVisit?.toLowerCase().includes(q) ?? false)
      )
    }
    return {
      ...data,
      lanes: {
        today_schedule: data.lanes.today_schedule.filter(filterApt),
        standby: data.lanes.standby.filter(filterApt),
        waiting: data.lanes.waiting.filter(filterApt),
        queue: data.lanes.queue.filter(filterApt),
        in_treatment: data.lanes.in_treatment.filter(filterApt),
        completed: data.lanes.completed.filter(filterApt),
      },
    }
  }, [data, searchQuery, filterDentistId, viewFilter])

  // -------------------- Render --------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!filteredData) return null

  return (
    <div className="space-y-4">
      {/* Top bar: live indicator + view filters + search + dentist filter + refresh */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-medium text-gray-700">Live</span>
                {lastUpdated && (
                  <span className="text-xs text-gray-500">
                    &middot; {format(lastUpdated, 'HH:mm:ss')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {data?.counts.total || 0} today &middot; {data?.counts.total_walk_ins || 0} walk-ins
                  {data?.counts.emergencies ? ` · ${data.counts.emergencies} emergency` : ''}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-44"
                />
              </div>
              <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
                <SelectTrigger className="h-9 w-36">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All patients</SelectItem>
                  <SelectItem value="scheduled_only">Appointments only</SelectItem>
                  <SelectItem value="walkins_only">Walk-ins only</SelectItem>
                  <SelectItem value="active_only">In clinic only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDentistId} onValueChange={setFilterDentistId}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="Filter dentist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dentists</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchFlow(true)}
                disabled={refreshing}
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                <span className="hidden sm:inline ml-2">Refresh</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.slice(0, 3).map((alert, idx) => (
            <Alert
              key={`${alert.type}-${idx}`}
              className={cn(
                alert.severity === 'critical' && 'border-red-300 bg-red-50 text-red-900',
                alert.severity === 'warning' && 'border-amber-300 bg-amber-50 text-amber-900',
                alert.severity === 'info' && 'border-blue-300 bg-blue-50 text-blue-900'
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Drag hint */}
      <div className="hidden md:flex items-center gap-1.5 text-[11px] text-gray-500 px-1">
        <Grip className="w-3 h-3" />
        <span>Drag any card between lanes to change status &mdash; or use the buttons on each card.</span>
      </div>

      {/* Desktop: horizontal scrolling kanban with 6 lanes */}
      <div className="hidden md:block overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {LANE_ORDER.map((lane) => (
            <LaneColumn
              key={lane}
              lane={lane}
              appointments={filteredData.lanes[lane] || []}
              meta={LANE_META[lane]}
              role={role}
              canManage={canManage}
              canTreat={canTreat}
              draggingId={draggingId}
              isDropTarget={dragOverLane === lane}
              highlightAppointmentId={highlightAppointmentId}
              onDragOver={(e) => handleDragOver(e, lane)}
              onDragLeave={() => handleDragLeave(lane)}
              onDrop={(e) => handleDrop(e, lane)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCheckIn={handleCheckIn}
              onMoveToWaiting={handleMoveToWaiting}
              onMoveToQueue={handleMoveToQueue}
              onStartTreatment={handleStartTreatment}
              onComplete={handleComplete}
              onMarkLate={handleMarkLate}
              onCancel={(apt) => openCancelDialog(apt, 'cancelled')}
              onLeft={(apt) => openCancelDialog(apt, 'left')}
              onNoShow={(apt) => openCancelDialog(apt, 'no_show')}
              onAssign={openAssignDialog}
              onForms={setFormsTarget}
              onApprove={handleApprove}
              onReject={openRejectDialog}
            />
          ))}
        </div>
      </div>

      {/* Mobile: accordion */}
      <div className="md:hidden">
        <Accordion
          type="multiple"
          defaultValue={['waiting', 'queue', 'standby', 'in_treatment']}
          className="w-full space-y-2"
        >
          {LANE_ORDER.map((lane) => {
            const meta = LANE_META[lane]
            const items = filteredData.lanes[lane] || []
            const Icon = meta.icon
            return (
              <AccordionItem
                key={lane}
                value={lane}
                className={cn('border rounded-lg px-3', meta.border, meta.bg)}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={cn('p-1.5 rounded-md', meta.header)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm">{meta.title}</span>
                    <Badge variant="secondary" className="ml-auto mr-2">
                      {items.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pb-2">
                    {items.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        {meta.description}
                      </p>
                    ) : (
                      items.map((apt) => (
                        <PatientCard
                          key={apt.id}
                          apt={apt}
                          lane={lane}
                          role={role}
                          canManage={canManage}
                          canTreat={canTreat}
                          isDragging={false}
                          draggable={false}
                          isHighlighted={!!highlightAppointmentId && apt.id === highlightAppointmentId}
                          onDragStart={() => {}}
                          onDragEnd={() => {}}
                          onCheckIn={handleCheckIn}
                          onMoveToWaiting={handleMoveToWaiting}
                          onMoveToQueue={handleMoveToQueue}
                          onStartTreatment={handleStartTreatment}
                          onComplete={handleComplete}
                          onMarkLate={handleMarkLate}
                          onCancel={(apt) => openCancelDialog(apt, 'cancelled')}
                          onLeft={(apt) => openCancelDialog(apt, 'left')}
                          onNoShow={(apt) => openCancelDialog(apt, 'no_show')}
                          onAssign={openAssignDialog}
                          onForms={setFormsTarget}
                          onApprove={handleApprove}
                          onReject={openRejectDialog}
                        />
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>

      {/* Cancel / Left / No Show dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelType === 'cancelled'
                ? 'Cancel Appointment'
                : cancelType === 'left'
                ? 'Patient Left'
                : 'Mark as No Show'}
            </DialogTitle>
            <DialogDescription>
              {cancelTarget?.patient.fullName} &mdash;{' '}
              {cancelTarget ? format(new Date(cancelTarget.scheduledDatetime), 'MMM d, h:mm a') : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Reason</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={
                cancelType === 'left'
                  ? 'Patient left without treatment'
                  : cancelType === 'no_show'
                  ? 'Patient did not show up'
                  : 'Enter reason for cancellation'
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button
              variant={cancelType === 'cancelled' ? 'destructive' : 'default'}
              onClick={confirmCancel}
            >
              {cancelType === 'cancelled'
                ? 'Cancel Appointment'
                : cancelType === 'left'
                ? 'Mark as Left'
                : 'Mark as No Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dentist / fit walk-in dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignTarget?.isStandby ? 'Fit Walk-In Into Slot' : 'Assign Dentist'}
            </DialogTitle>
            <DialogDescription>
              {assignTarget?.patient.fullName} &mdash; pick a dentist to{' '}
              {assignTarget?.isStandby ? 'move this walk-in into the queue' : 'assign this appointment'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Dentist</Label>
            <Select value={assignDentistId} onValueChange={setAssignDentistId}>
              <SelectTrigger>
                <SelectValue placeholder="Select dentist" />
              </SelectTrigger>
              <SelectContent>
                {dentists.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAssign}>
              {assignTarget?.isStandby ? 'Add to Queue' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject appointment dialog */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(o) => {
          setRejectDialogOpen(o)
          if (!o) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Appointment</DialogTitle>
            <DialogDescription>
              {rejectTarget?.patient.fullName}
              {rejectTarget
                ? ` — ${format(new Date(rejectTarget.scheduledDatetime), 'MMM d, h:mm a')}`
                : ''}
              . The patient will be notified by email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this appointment being rejected?"
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consent Forms & Signing Link dialog */}
      <FormsDialog
        appointment={formsTarget}
        onClose={() => setFormsTarget(null)}
      />
    </div>
  )
}

// ------------------------------------------------------------------
//  Lane Column (drop target)
// ------------------------------------------------------------------
interface LaneColumnProps {
  lane: FlowLane
  meta: typeof LANE_META[FlowLane]
  appointments: FlowAppointment[]
  role: string
  canManage: boolean
  canTreat: boolean
  draggingId: string | null
  isDropTarget: boolean
  highlightAppointmentId?: string
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onDragStart: (e: React.DragEvent, apt: FlowAppointment) => void
  onDragEnd: () => void
  onCheckIn: (apt: FlowAppointment) => void
  onMoveToWaiting: (apt: FlowAppointment) => void
  onMoveToQueue: (apt: FlowAppointment) => void
  onStartTreatment: (apt: FlowAppointment) => void
  onComplete: (apt: FlowAppointment) => void
  onMarkLate: (apt: FlowAppointment) => void
  onCancel: (apt: FlowAppointment) => void
  onLeft: (apt: FlowAppointment) => void
  onNoShow: (apt: FlowAppointment) => void
  onAssign: (apt: FlowAppointment) => void
  onForms: (apt: FlowAppointment) => void
  onApprove: (apt: FlowAppointment) => void
  onReject: (apt: FlowAppointment) => void
}

function LaneColumn(props: LaneColumnProps) {
  const { lane, meta, appointments, isDropTarget } = props
  const Icon = meta.icon
  return (
    <div
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      className={cn(
        'rounded-lg border flex flex-col min-h-[360px] w-[260px] flex-shrink-0 transition-all',
        meta.border,
        meta.bg,
        isDropTarget && meta.dropHighlight
      )}
    >
      <div className={cn('rounded-t-lg px-3 py-2 flex items-center gap-2', meta.header)}>
        <Icon className="w-4 h-4" />
        <h3 className="font-semibold text-sm flex-1">{meta.title}</h3>
        <Badge variant="secondary" className="bg-white/80">
          {appointments.length}
        </Badge>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
        {appointments.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-6 px-2">
            <p>{meta.description}</p>
            <p className="mt-1 text-[10px] text-gray-400">Drop patients here</p>
          </div>
        ) : (
          appointments.map((apt) => (
            <PatientCard
              key={apt.id}
              apt={apt}
              lane={lane}
              role={props.role}
              canManage={props.canManage}
              canTreat={props.canTreat}
              isDragging={props.draggingId === apt.id}
              draggable={true}
              isHighlighted={!!props.highlightAppointmentId && apt.id === props.highlightAppointmentId}
              onDragStart={props.onDragStart}
              onDragEnd={props.onDragEnd}
              onCheckIn={props.onCheckIn}
              onMoveToWaiting={props.onMoveToWaiting}
              onMoveToQueue={props.onMoveToQueue}
              onStartTreatment={props.onStartTreatment}
              onComplete={props.onComplete}
              onMarkLate={props.onMarkLate}
              onCancel={props.onCancel}
              onLeft={props.onLeft}
              onNoShow={props.onNoShow}
              onAssign={props.onAssign}
              onForms={props.onForms}
              onApprove={props.onApprove}
              onReject={props.onReject}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
//  Patient Card (draggable)
// ------------------------------------------------------------------
interface PatientCardProps {
  apt: FlowAppointment
  lane: FlowLane
  role: string
  canManage: boolean
  canTreat: boolean
  isDragging: boolean
  draggable: boolean
  isHighlighted?: boolean
  onDragStart: (e: React.DragEvent, apt: FlowAppointment) => void
  onDragEnd: () => void
  onCheckIn: (apt: FlowAppointment) => void
  onMoveToWaiting: (apt: FlowAppointment) => void
  onMoveToQueue: (apt: FlowAppointment) => void
  onStartTreatment: (apt: FlowAppointment) => void
  onComplete: (apt: FlowAppointment) => void
  onMarkLate: (apt: FlowAppointment) => void
  onCancel: (apt: FlowAppointment) => void
  onLeft: (apt: FlowAppointment) => void
  onNoShow: (apt: FlowAppointment) => void
  onAssign: (apt: FlowAppointment) => void
  onForms: (apt: FlowAppointment) => void
  onApprove: (apt: FlowAppointment) => void
  onReject: (apt: FlowAppointment) => void
}

function PatientCard({
  apt,
  lane,
  canManage,
  canTreat,
  isDragging,
  draggable,
  isHighlighted = false,
  onDragStart,
  onDragEnd,
  onCheckIn,
  onMoveToWaiting,
  onMoveToQueue,
  onStartTreatment,
  onComplete,
  onMarkLate,
  onCancel,
  onLeft,
  onNoShow,
  onAssign,
  onForms,
  onApprove,
  onReject,
}: PatientCardProps) {
  const router = useRouter()
  const scheduled = new Date(apt.scheduledDatetime)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [highlightActive, setHighlightActive] = useState(false)

  // Scroll to and visually pulse this card if it's the deep-link target.
  // We arm a 4s pulse and clear it so the highlight fades naturally.
  useEffect(() => {
    if (!isHighlighted) return
    const node = cardRef.current
    if (!node) return
    setHighlightActive(true)
    // Defer scroll until next frame so layout has settled
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

  // wait-time calculation
  const waitSince = apt.checkedInAt
    ? new Date(apt.checkedInAt)
    : apt.isWalkIn
    ? scheduled
    : null
  const waitMinutes = waitSince
    ? Math.floor((Date.now() - waitSince.getTime()) / 60000)
    : 0
  const isWaitTooLong =
    waitMinutes > 30 && (lane === 'waiting' || lane === 'queue' || lane === 'standby')

  // Derive the primary quick-action (always visible, stage-aware)
  type PrimaryAction = {
    label: string
    icon: React.ReactNode
    onClick: () => void
    variant: 'default' | 'outline' | 'secondary'
    className?: string
  }
  const isPendingApproval =
    apt.status === 'pending' || apt.status === 'pending_assignment'

  let primary: PrimaryAction | null = null
  if (lane === 'today_schedule' && canManage) {
    if (isPendingApproval) {
      // Pending scheduled appointments need approval first
      primary = {
        label: 'Approve',
        icon: <Check className="w-3.5 h-3.5" />,
        onClick: () => onApprove(apt),
        variant: 'default',
        className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      }
    } else {
      primary = {
        label: 'Check In',
        icon: <UserCheck className="w-3.5 h-3.5" />,
        onClick: () => onCheckIn(apt),
        variant: 'default',
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
      }
    }
  } else if (lane === 'standby' && canManage) {
    primary = {
      label: 'Approve \u2192 Queue',
      icon: <ChevronsRight className="w-3.5 h-3.5" />,
      onClick: () => onMoveToQueue(apt),
      variant: 'default',
      className: 'bg-orange-600 hover:bg-orange-700 text-white',
    }
  } else if (lane === 'waiting' && canManage) {
    primary = {
      label: 'Move to Queue',
      icon: <ChevronsRight className="w-3.5 h-3.5" />,
      onClick: () => onMoveToQueue(apt),
      variant: 'default',
      className: 'bg-amber-600 hover:bg-amber-700 text-white',
    }
  } else if (lane === 'queue' && canTreat) {
    primary = {
      label: 'Start Treatment',
      icon: <Play className="w-3.5 h-3.5" />,
      onClick: () => onStartTreatment(apt),
      variant: 'default',
      className: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    }
  } else if (lane === 'in_treatment' && canTreat) {
    primary = {
      label: 'Complete',
      icon: <Check className="w-3.5 h-3.5" />,
      onClick: () => onComplete(apt),
      variant: 'default',
      className: 'bg-purple-600 hover:bg-purple-700 text-white',
    }
  }

  return (
    <div
      ref={cardRef}
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, apt)}
      onDragEnd={onDragEnd}
      className={cn(
        'group bg-white rounded-md border p-2.5 shadow-sm hover:shadow-md transition-all',
        draggable && 'cursor-grab active:cursor-grabbing',
        apt.isEmergency && 'border-red-300 bg-red-50/40',
        apt.isLate && 'border-amber-400',
        isWaitTooLong && 'border-orange-400',
        isDragging && 'opacity-40 scale-95',
        highlightActive && 'ring-2 ring-[#2D9DA8] ring-offset-2 shadow-lg animate-pulse'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {draggable && (
              <Grip className="w-3 h-3 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
            )}
            <h4 className="font-semibold text-sm truncate text-gray-900">
              {apt.patient.fullName}
            </h4>
            {apt.isEmergency && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1 py-0 h-4">
                <Flame className="w-2.5 h-2.5 mr-0.5" /> EMRG
              </Badge>
            )}
            {apt.isWalkIn && (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-1 py-0 h-4">
                <UserPlus className="w-2.5 h-2.5 mr-0.5" /> Walk-in
              </Badge>
            )}
          </div>
          {apt.patient.patientNumber && (
            <p className="text-[11px] text-gray-500 truncate">#{apt.patient.patientNumber}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Clinical access — available to dentists & admins at any stage */}
            {canTreat && (
              <>
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/chart?patientId=${apt.patient.id}`)}
                >
                  <FileText className="w-4 h-4 mr-2" /> Open Dental Chart
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/patients/${apt.patient.id}`)}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Open Workspace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Consent & intake forms (available at all stages except after treatment) */}
            {lane !== 'in_treatment' && lane !== 'completed' && canManage && (
              <>
                <DropdownMenuItem onClick={() => onForms(apt)}>
                  <ClipboardList className="w-4 h-4 mr-2" /> Forms & Signing Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Stage-appropriate primary actions */}
            {lane === 'today_schedule' && canManage && isPendingApproval && (
              <>
                <DropdownMenuItem onClick={() => onApprove(apt)} className="text-emerald-700">
                  <Check className="w-4 h-4 mr-2" /> Approve Appointment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReject(apt)} className="text-rose-700">
                  <X className="w-4 h-4 mr-2" /> Reject Appointment
                </DropdownMenuItem>
              </>
            )}
            {lane === 'today_schedule' && canManage && !isPendingApproval && (
              <DropdownMenuItem onClick={() => onCheckIn(apt)}>
                <UserCheck className="w-4 h-4 mr-2" /> Check In
              </DropdownMenuItem>
            )}
            {lane === 'standby' && canManage && (
              <>
                <DropdownMenuItem onClick={() => onMoveToWaiting(apt)}>
                  <UserCheck className="w-4 h-4 mr-2" /> Approve → Waiting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMoveToQueue(apt)}>
                  <ChevronsRight className="w-4 h-4 mr-2" /> Approve → In Queue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAssign(apt)}>
                  <ArrowRightCircle className="w-4 h-4 mr-2" /> Assign Slot
                </DropdownMenuItem>
              </>
            )}
            {lane === 'waiting' && canManage && (
              <DropdownMenuItem onClick={() => onMoveToQueue(apt)}>
                <ChevronsRight className="w-4 h-4 mr-2" /> Move to Queue
              </DropdownMenuItem>
            )}
            {(lane === 'waiting' || lane === 'queue') && canTreat && (
              <DropdownMenuItem onClick={() => onStartTreatment(apt)}>
                <Play className="w-4 h-4 mr-2" /> Start Treatment
              </DropdownMenuItem>
            )}
            {lane === 'queue' && canManage && (
              <DropdownMenuItem onClick={() => onMoveToWaiting(apt)}>
                <Clock className="w-4 h-4 mr-2" /> Back to Waiting
              </DropdownMenuItem>
            )}
            {lane === 'in_treatment' && canTreat && (
              <DropdownMenuItem onClick={() => onComplete(apt)}>
                <Check className="w-4 h-4 mr-2" /> Complete
              </DropdownMenuItem>
            )}
            {(lane === 'today_schedule' ||
              lane === 'standby' ||
              lane === 'waiting' ||
              lane === 'queue') &&
              canManage && (
                <DropdownMenuItem onClick={() => onAssign(apt)}>
                  <Stethoscope className="w-4 h-4 mr-2" /> Assign Dentist
                </DropdownMenuItem>
              )}

            {canManage && lane !== 'completed' && <DropdownMenuSeparator />}

            {lane === 'today_schedule' && canManage && (
              <DropdownMenuItem onClick={() => onMarkLate(apt)} className="text-amber-700">
                <TimerOff className="w-4 h-4 mr-2" /> Mark Late
              </DropdownMenuItem>
            )}
            {(lane === 'waiting' || lane === 'queue' || lane === 'standby') && canManage && (
              <DropdownMenuItem onClick={() => onLeft(apt)} className="text-orange-600">
                <LogOut className="w-4 h-4 mr-2" /> Mark as Left
              </DropdownMenuItem>
            )}
            {lane === 'today_schedule' && canManage && (
              <DropdownMenuItem onClick={() => onNoShow(apt)} className="text-rose-600">
                <AlertCircle className="w-4 h-4 mr-2" /> Mark No Show
              </DropdownMenuItem>
            )}
            {lane !== 'completed' && (canManage || (lane === 'in_treatment' && canTreat)) && (
              <DropdownMenuItem onClick={() => onCancel(apt)} className="text-red-600">
                <X className="w-4 h-4 mr-2" /> Cancel Appointment
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Time / reason / dentist */}
      <div className="space-y-1 text-[11px] text-gray-600">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="w-3 h-3" />
          <span>{format(scheduled, 'h:mm a')}</span>
          <span className="text-gray-400">&middot;</span>
          <span>{apt.durationMinutes} min</span>
        </div>
        {apt.reasonForVisit && (
          <p className="truncate text-gray-500">{apt.reasonForVisit}</p>
        )}
        {apt.dentist && (
          <p className="text-gray-500 truncate">
            <Stethoscope className="w-3 h-3 inline mr-1" />
            {apt.dentist.name}
          </p>
        )}
      </div>

      {/* Status / warning badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 h-4', statusBadgeClass(apt.status as any))}
        >
          {statusLabel(apt.status as any, apt.appointmentType)}
        </Badge>
        {apt.isLate && (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4">
            <Timer className="w-2.5 h-2.5 mr-0.5" /> {apt.minutesLate}m late
          </Badge>
        )}
        {isWaitTooLong && !apt.isLate && (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-1.5 py-0 h-4">
            <Timer className="w-2.5 h-2.5 mr-0.5" /> Waited {waitMinutes}m
          </Badge>
        )}
        {(lane === 'waiting' || lane === 'queue') && !isWaitTooLong && waitMinutes > 0 && (
          <span className="text-[10px] text-gray-500 self-center">Waited {waitMinutes}m</span>
        )}
      </div>

      {/* Inline primary quick-action button — always visible, stage-aware */}
      {primary && (
        <div className="mt-2 flex gap-1.5">
          <Button
            size="sm"
            variant={primary.variant}
            className={cn(
              'flex-1 h-7 text-[11px] font-medium',
              primary.className
            )}
            onClick={(e) => {
              e.stopPropagation()
              primary.onClick()
            }}
          >
            {primary.icon}
            <span className="ml-1">{primary.label}</span>
          </Button>
          {/* Inline Reject button for pending today_schedule cards */}
          {lane === 'today_schedule' && isPendingApproval && canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] font-medium border-rose-300 text-rose-700 hover:bg-rose-50 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onReject(apt)
              }}
            >
              <X className="w-3.5 h-3.5" />
              <span className="ml-1">Reject</span>
            </Button>
          )}
          {/* Inline Cancel button for in_treatment cards */}
          {lane === 'in_treatment' && canTreat && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] font-medium border-red-300 text-red-700 hover:bg-red-50 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onCancel(apt)
              }}
            >
              <X className="w-3.5 h-3.5" />
              <span className="ml-1">Cancel</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
//  Forms & Signing Link Dialog (consent / intake forms preparation)
// ------------------------------------------------------------------
interface FormsDialogProps {
  appointment: FlowAppointment | null
  onClose: () => void
}

interface FormItem {
  id: string
  title: string
  description: string | null
  status: string
  patientSignature: string | null
  patientSignedAt: string | null
  consentNumber: string
}

function FormsDialog({ appointment, onClose }: FormsDialogProps) {
  const { toast } = useToast()
  const [forms, setForms] = useState<FormItem[]>([])
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Assign-form picker state
  const [assignOpen, setAssignOpen] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; title: string; category: string }[]>([])
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const open = !!appointment

  const load = useCallback(async (appointmentId: string) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/checkin-forms?appointmentId=${encodeURIComponent(appointmentId)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setForms((json?.forms || []) as FormItem[])
      setSigningUrl(json?.signingUrl || null)
    } catch (e: any) {
      console.error('Load forms error:', e)
      toast({
        title: 'Failed to load forms',
        description: e?.message || 'Could not load consent forms',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (appointment?.id) {
      void load(appointment.id)
    } else {
      setForms([])
      setSigningUrl(null)
    }
  }, [appointment?.id, load])

  const handlePrepare = async () => {
    if (!appointment) return
    setPreparing(true)
    try {
      const res = await fetch('/api/checkin-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, auto: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      toast({
        title: 'Forms prepared',
        description: `${json?.formsCount || 0} form(s) ready for signing`,
      })
      await load(appointment.id)
    } catch (e: any) {
      console.error('Prepare forms error:', e)
      toast({
        title: 'Failed to prepare forms',
        description: e?.message || 'Could not prepare forms',
        variant: 'destructive',
      })
    } finally {
      setPreparing(false)
    }
  }

  const handleCopy = async () => {
    if (!signingUrl) return
    const ok = await safeCopyToClipboard(signingUrl)
    toast({ title: ok ? 'Link copied' : 'Copy failed', description: ok ? 'Signing link copied to clipboard' : 'Could not copy link', variant: ok ? 'default' : 'destructive' })
  }

  const handleOpen = () => {
    if (!signingUrl) return
    window.open(signingUrl, '_blank', 'noopener,noreferrer')
  }

  const openEmailDialog = () => {
    setEmailTo(appointment?.patient.email || '')
    setEmailNote('')
    setEmailOpen(true)
  }

  const handleSendEmail = async () => {
    if (!appointment) return
    const trimmed = (emailTo || '').trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      })
      return
    }
    setSendingEmail(true)
    try {
      const res = await fetch('/api/checkin-forms/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.id,
          email: trimmed,
          note: emailNote.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      toast({
        title: 'Email sent',
        description: json?.message || `Signing link sent to ${trimmed}`,
      })
      setEmailOpen(false)
    } catch (e: any) {
      toast({
        title: 'Failed to send email',
        description: e?.message || 'Could not send email',
        variant: 'destructive',
      })
    } finally {
      setSendingEmail(false)
    }
  }

  const openAssignDialog = async () => {
    setSelectedTemplateKey('')
    setAssignOpen(true)
    if (availableTemplates.length > 0) return
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/checkin-forms?templates=true')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setAvailableTemplates((json.templates || []).map((t: any) => ({ id: t.id, title: t.title, category: t.category || '' })))
    } catch {
      toast({ title: 'Could not load templates', variant: 'destructive' })
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleAssignForm = async () => {
    if (!appointment || !selectedTemplateKey) return
    setAssigning(true)
    try {
      const res = await fetch('/api/checkin-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, templateIds: [selectedTemplateKey] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      toast({ title: 'Form assigned', description: `${json?.formsCount || 1} form(s) added` })
      setAssignOpen(false)
      await load(appointment.id)
    } catch (e: any) {
      toast({ title: 'Failed to assign form', description: e?.message || 'Try again', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const signedCount = forms.filter((f) => !!f.patientSignature).length
  const totalCount = forms.length
  const allSigned = totalCount > 0 && signedCount === totalCount

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Consent Forms & Signing Link
            </DialogTitle>
            <DialogDescription>
              {appointment?.patient.fullName}
              {appointment && (
                <>
                  {' '}&mdash;{' '}
                  {format(new Date(appointment.scheduledDatetime), 'MMM d, h:mm a')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading forms...
              </div>
            ) : forms.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-6 text-center space-y-3">
                <ClipboardList className="w-8 h-8 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    No forms prepared yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Prepare the required forms for this appointment type, then
                    share the signing link or QR with the patient.
                  </p>
                </div>
                <div className="flex gap-2 justify-center mt-2">
                  <Button
                    onClick={handlePrepare}
                    disabled={preparing}
                  >
                    {preparing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing...
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-4 h-4 mr-2" /> Prepare Required Forms
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={openAssignDialog}>
                    <Plus className="w-4 h-4 mr-2" /> Assign Form
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    className={cn(
                      'h-5 px-2',
                      allSigned
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                    )}
                  >
                    {signedCount} / {totalCount} signed
                  </Badge>
                  {allSigned && (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All forms complete
                    </span>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 rounded-md border bg-gray-50 p-2">
                  {forms.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start justify-between gap-2 bg-white rounded border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {f.title}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {f.consentNumber}
                        </p>
                      </div>
                      {f.patientSignature ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] h-5">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Signed
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] h-5">
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAssignDialog}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Assign Form
                  </Button>
                  {!allSigned && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrepare}
                      disabled={preparing}
                    >
                      {preparing ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Re-prepare
                    </Button>
                  )}
                </div>

                {signingUrl && !allSigned && (
                  <div className="space-y-2 rounded-md border bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700">
                        Signing link for patient
                      </p>
                      <Badge variant="outline" className="text-[10px] h-5">
                        Expires in 24h
                      </Badge>
                    </div>
                    <div className="bg-white border rounded px-2 py-1.5">
                      <p className="text-[11px] text-gray-700 truncate font-mono">
                        {signingUrl}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="h-8"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQrOpen(true)}
                        className="h-8"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1" /> QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpen}
                        className="h-8"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openEmailDialog}
                        className="h-8"
                      >
                        <Mail className="w-3.5 h-3.5 mr-1" /> Email
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Hand the phone to the patient, scan the QR at your counter,
                      or email them the link for in-room signing.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR code dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Scan to Sign Forms
            </DialogTitle>
            <DialogDescription>
              Have the patient scan this QR with their phone to open the signing
              page.
            </DialogDescription>
          </DialogHeader>
          {signingUrl && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-3 rounded-md border shadow-sm">
                <QRCode value={signingUrl} size={220} level="M" />
              </div>
              <div className="w-full bg-gray-50 border rounded px-2 py-1.5">
                <p className="text-[10px] text-gray-600 truncate font-mono text-center">
                  {signingUrl}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpen}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Signing Link to Patient
            </DialogTitle>
            <DialogDescription>
              We&apos;ll email the signing link so the patient can fill out and
              sign the forms from any device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email-to" className="text-xs font-medium">
                Recipient Email
              </Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="patient@example.com"
                className="mt-1"
              />
              {!appointment?.patient.email && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No email on file for this patient. Enter one to proceed.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="email-note" className="text-xs font-medium">
                Optional Note (included in the email)
              </Label>
              <Textarea
                id="email-note"
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                placeholder="e.g. Please complete these forms at least 30 minutes before your appointment."
                className="mt-1"
                rows={3}
              />
            </div>
            {signingUrl && (
              <div className="rounded-md bg-gray-50 border px-2 py-1.5">
                <p className="text-[10px] text-gray-500 mb-0.5">Link that will be sent:</p>
                <p className="text-[11px] text-gray-700 truncate font-mono">
                  {signingUrl}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign specific form dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Assign Form
            </DialogTitle>
            <DialogDescription>
              Manually assign a specific form to this appointment. This bypasses the once-only rule for previously signed forms.
            </DialogDescription>
          </DialogHeader>
          {templatesLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No form templates available.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Select Form Template</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                >
                  <option value="">Choose a form…</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAssignForm} disabled={!selectedTemplateKey || assigning}>
              {assigning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
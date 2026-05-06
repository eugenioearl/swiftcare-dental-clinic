
'use client'

import { formatDisplayName, formatDentistName, formatPatientName } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent, 
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Grid3x3,
  List,
  Search,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  status: string
  appointmentType: string
  durationMinutes: number
  reasonForVisit?: string
  patient: {
    fullName?: string | null
    user?: {
      firstName: string
      lastName: string
      phone?: string
      email?: string
    } | null
  }
  dentist?: {
    id: string
    user?: {
      firstName: string
      lastName: string
    } | null
  }
  appointmentTreatments?: any[]
}

interface EnhancedCalendarProps {
  userRole: 'staff' | 'dentist' | 'admin' | 'manager'
  currentUserId?: string
}

// Time slots for the day (9 AM to 6 PM clinic hours, 30-minute intervals)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30'
]

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Format 24h time to 12h AM/PM for display
function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Droppable Time Slot Component
function DroppableTimeSlot({ 
  id, 
  children, 
  className = '' 
}: { 
  id: string
  children: React.ReactNode
  className?: string 
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
    >
      {children}
    </div>
  )
}

// Draggable Appointment Component
function DraggableAppointment({ appointment, onAssignDentist, dentists }: {
  appointment: Appointment
  onAssignDentist?: (appointmentId: string, dentistId: string) => void
  dentists?: any[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: appointment.id })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_assignment': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200'
      case 'checked_in': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'in_progress': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAppointmentTypeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'border-l-red-500'
      case 'surgery': return 'border-l-purple-500'
      case 'consultation': return 'border-l-blue-500'
      case 'cleaning': return 'border-l-green-500'
      case 'procedure': return 'border-l-orange-500'
      case 'x_ray': return 'border-l-indigo-500'
      default: return 'border-l-gray-300'
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative bg-white rounded-lg border-2 border-l-4 shadow-sm p-3 mb-2 cursor-grab active:cursor-grabbing
        hover:shadow-md transition-all duration-200 
        ${getAppointmentTypeColor(appointment.appointmentType)}
        ${isDragging ? 'opacity-50 shadow-lg transform rotate-2' : ''}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
          </p>
          <p className="text-xs text-gray-500">#{appointment.appointmentNumber}</p>
        </div>
        <Badge className={`text-xs ml-2 ${getStatusColor(appointment.status)}`}>
          {appointment.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Time and Type */}
      <div className="flex items-center text-xs text-gray-600 mb-2">
        <Clock className="w-3 h-3 mr-1" />
        <span>
          {format(parseISO(appointment.scheduledDatetime), 'h:mm a')} 
          ({appointment.durationMinutes}min)
        </span>
        <span className="mx-2">•</span>
        <span className="capitalize">{appointment.appointmentType.replace('_', ' ')}</span>
      </div>

      {/* Reason */}
      {appointment.reasonForVisit && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
          {appointment.reasonForVisit}
        </p>
      )}

      {/* Dentist Assignment or Info */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600 flex items-center">
          <User className="w-3 h-3 mr-1" />
          {appointment.dentist ? (
            <span>{formatDentistName(appointment?.dentist?.user?.firstName, appointment?.dentist?.user?.lastName)}</span>
          ) : (
            <span className="text-orange-600 font-medium">No dentist assigned</span>
          )}
        </div>
        
        {!appointment.dentist && onAssignDentist && dentists && dentists.length > 0 && (
          <Select onValueChange={(dentistId) => onAssignDentist(appointment.id, dentistId)}>
            <SelectTrigger className="h-6 text-xs w-20">
              <SelectValue placeholder="Assign" />
            </SelectTrigger>
            <SelectContent>
              {dentists
                .filter(dentist => dentist.id && typeof dentist.id === 'string' && dentist.id.trim() !== '')
                .map((dentist) => (
                  <SelectItem 
                    key={dentist.id} 
                    value={dentist.id}
                  >
                    Dr. {dentist.user?.lastName || 'Unknown'}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Emergency indicator */}
      {appointment.appointmentType === 'emergency' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      )}
    </div>
  )
}

export function EnhancedCalendar({ userRole, currentUserId }: EnhancedCalendarProps) {
  const { data: session } = useSession() || {}
  const { toast } = useToast()

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Create Appointment Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createSlotDate, setCreateSlotDate] = useState<string>('')
  const [createSlotTime, setCreateSlotTime] = useState<string>('')
  const [patientList, setPatientList] = useState<any[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [selectedDentist, setSelectedDentist] = useState<string>('')
  const [newAppointmentType, setNewAppointmentType] = useState<string>('consultation')
  const [newAppointmentDuration, setNewAppointmentDuration] = useState<number>(30)
  const [newAppointmentReason, setNewAppointmentReason] = useState<string>('')
  const [creatingAppointment, setCreatingAppointment] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Get week days
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Fetch appointments (extracted as useCallback for reuse)
  const fetchAppointments = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      else setRefreshing(true)
      
      const startDate = format(weekStart, 'yyyy-MM-dd')
      const endDate = format(weekEnd, 'yyyy-MM-dd')
      
      let url = `/api/appointments?startDate=${startDate}&endDate=${endDate}&limit=200`
      
      // If dentist role, filter by current dentist
      if (userRole === 'dentist' && currentUserId) {
        url += `&dentistId=${currentUserId}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.data?.appointments || [])
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      if (showLoading) setLoading(false)
      else setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString(), weekEnd.toISOString(), userRole, currentUserId])

  // Initial fetch on week change
  useEffect(() => {
    fetchAppointments(true)
  }, [fetchAppointments])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAppointments(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchAppointments])

  // Fetch dentists (for staff/admin)
  useEffect(() => {
    const fetchDentists = async () => {
      if (!['staff', 'admin', 'super_admin', 'manager', 'receptionist'].includes(userRole)) return

      try {
        const response = await fetch('/api/dentists')
        if (response.ok) {
          const data = await response.json()
          setDentists(data.data?.dentists || [])
        }
      } catch (error) {
        console.error('Error fetching dentists:', error)
      }
    }

    fetchDentists()
  }, [userRole])

  // Filter appointments
  const filteredAppointments = appointments.filter(appointment => {
    if (filterStatus === 'all') return true
    return appointment.status === filterStatus
  })

  // Group appointments by day and time
  const getAppointmentsForDayAndTime = (day: Date, timeSlot: string) => {
    return filteredAppointments.filter(appointment => {
      const appointmentDate = parseISO(appointment.scheduledDatetime)
      const appointmentTime = format(appointmentDate, 'HH:mm')
      return isSameDay(appointmentDate, day) && appointmentTime === timeSlot
    })
  }

  // Get all appointments for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter(appointment => {
      const appointmentDate = parseISO(appointment.scheduledDatetime)
      return isSameDay(appointmentDate, day)
    }).sort((a, b) => 
      parseISO(a.scheduledDatetime).getTime() - parseISO(b.scheduledDatetime).getTime()
    )
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const appointmentId = active.id as string
    const dropZoneId = over.id as string

    let newDateTime: string | null = null

    // Parse drop zone ID to determine new datetime
    // Week view format: "day-YYYY-MM-DD-time-HH:MM"
    const timeMatch = dropZoneId.match(/^day-(\d{4}-\d{2}-\d{2})-time-(\d{2}:\d{2})$/)
    // Day view format: "day-YYYY-MM-DD-all"
    const allDayMatch = dropZoneId.match(/^day-(\d{4}-\d{2}-\d{2})-all$/)

    if (timeMatch) {
      const [, newDate, newTime] = timeMatch
      newDateTime = `${newDate}T${newTime}:00+08:00`
    } else if (allDayMatch) {
      const [, newDate] = allDayMatch
      const originalAppointment = appointments.find(apt => apt.id === appointmentId)
      if (originalAppointment) {
        const originalTime = format(parseISO(originalAppointment.scheduledDatetime), 'HH:mm')
        newDateTime = `${newDate}T${originalTime}:00+08:00`
      }
    }

    if (!newDateTime) return

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDatetime: newDateTime
        })
      })

      if (response.ok) {
        // Update local state
        setAppointments(prev => prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, scheduledDatetime: newDateTime! }
            : apt
        ))
        
        toast({
          title: "Appointment moved",
          description: `Appointment rescheduled to ${format(parseISO(newDateTime), 'MMM d, yyyy')} at ${format(parseISO(newDateTime), 'HH:mm')}`,
        })
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMsg = errorData?.error || `Server error (${response.status})`
        toast({
          title: "Cannot move appointment",
          description: errorMsg,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast({
        title: "Error",
        description: "Network error — failed to move appointment. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle dentist assignment
  const handleAssignDentist = async (appointmentId: string, dentistId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dentistId,
          status: 'scheduled'
        })
      })

      if (response.ok) {
        // Refresh appointments via centralized fetcher
        await fetchAppointments(false)

        toast({
          title: "Dentist assigned",
          description: "Appointment has been assigned to the selected dentist.",
        })
      }
    } catch (error) {
      console.error('Error assigning dentist:', error)
      toast({
        title: "Error",
        description: "Failed to assign dentist. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Load patients when opening create dialog
  const loadPatients = useCallback(async (search?: string) => {
    // Only staff/admin can create appointments
    if (!['staff', 'admin', 'super_admin', 'manager', 'receptionist'].includes(userRole)) return
    try {
      setLoadingPatients(true)
      const query = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
      const response = await fetch(`/api/patients?limit=20${query}`)
      if (response.ok) {
        const data = await response.json()
        setPatientList(data.data?.patients || [])
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoadingPatients(false)
    }
  }, [userRole])

  // Open create dialog for a specific slot
  const openCreateDialog = (day: Date, timeSlot: string) => {
    // Only staff/admin/manager/receptionist can create appointments via calendar
    if (!['staff', 'admin', 'super_admin', 'manager', 'receptionist'].includes(userRole)) return

    setCreateSlotDate(format(day, 'yyyy-MM-dd'))
    setCreateSlotTime(timeSlot)
    setSelectedPatient(null)
    setPatientSearch('')
    setSelectedDentist('')
    setNewAppointmentType('consultation')
    setNewAppointmentDuration(30)
    setNewAppointmentReason('')
    setCreateDialogOpen(true)
    // Load initial patient list
    loadPatients()
  }

  // Handle patient search (debounced via useEffect below)
  useEffect(() => {
    if (!createDialogOpen) return
    const handle = setTimeout(() => {
      loadPatients(patientSearch)
    }, 300)
    return () => clearTimeout(handle)
  }, [patientSearch, createDialogOpen, loadPatients])

  // Create new appointment
  const createAppointment = async () => {
    if (!selectedPatient) {
      toast({
        title: "Select a patient",
        description: "Please select a patient to book the appointment for.",
        variant: "destructive",
      })
      return
    }

    try {
      setCreatingAppointment(true)

      const scheduledDatetime = `${createSlotDate}T${createSlotTime}:00+08:00`

      const body: any = {
        patientId: selectedPatient.id,
        scheduledDatetime,
        durationMinutes: newAppointmentDuration,
        appointmentType: newAppointmentType,
        reasonForVisit: newAppointmentReason || undefined,
        isEmergency: newAppointmentType === 'emergency',
      }

      if (selectedDentist) {
        body.dentistId = selectedDentist
        body.status = 'scheduled'
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json().catch(() => null)

      if (response.ok) {
        toast({
          title: "Appointment created",
          description: `Scheduled for ${format(parseISO(scheduledDatetime), 'MMM d, yyyy')} at ${format(parseISO(scheduledDatetime), 'h:mm a')}`,
        })
        setCreateDialogOpen(false)
        await fetchAppointments(false)
      } else {
        toast({
          title: "Cannot create appointment",
          description: result?.error || `Server error (${response.status})`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast({
        title: "Error",
        description: "Network error — failed to create appointment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreatingAppointment(false)
    }
  }

  // Week Navigation
  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1))
  }

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1))
  }

  const handleToday = () => {
    setCurrentWeek(new Date())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handlePreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-lg font-semibold text-gray-900">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </div>
            <Button variant="outline" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Today
            </Button>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Live indicator */}
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="font-medium text-green-700">Live</span>
              <span className="text-gray-500 hidden sm:inline">· {format(lastUpdate, 'h:mm:ss a')}</span>
            </div>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAppointments(false)}
              disabled={refreshing}
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_assignment">Pending Assignment</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                className="rounded-r-none"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Helper banner: click empty slots to create */}
        {['staff', 'admin', 'super_admin', 'manager', 'receptionist'].includes(userRole) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>
              <strong>Tip:</strong> Click any empty time slot to create a new appointment. Drag appointments across slots to reschedule. Auto-refreshes every 30 seconds.
            </span>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {/* Calendar Grid */}
              <div className="grid grid-cols-8 border-b min-w-[700px]">
                {/* Time column header */}
                <div className="p-3 bg-gray-50 border-r font-medium text-sm text-gray-600">
                  Time
                </div>
                
                {/* Day headers */}
                {weekDays.map((day, index) => (
                  <div key={day.toISOString()} className="p-3 bg-gray-50 border-r last:border-r-0 text-center">
                    <div className="font-medium text-sm text-gray-900">
                      {DAYS_OF_WEEK[index]}
                    </div>
                    <div className={`text-lg font-semibold mt-1 ${
                      isSameDay(day, new Date()) 
                        ? 'text-blue-600 bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                        : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getAppointmentsForDay(day).length} apt{getAppointmentsForDay(day).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time slots grid */}
              <div className="max-h-96 overflow-y-auto">
                {TIME_SLOTS.map((timeSlot) => (
                  <div key={timeSlot} className="grid grid-cols-8 border-b last:border-b-0 min-w-[700px]">
                    {/* Time label */}
                    <div className="p-3 bg-gray-50 border-r text-xs font-medium text-gray-600">
                      {formatTimeLabel(timeSlot)}
                    </div>
                    
                    {/* Day columns */}
                    {weekDays.map((day) => {
                      const dayAppointments = getAppointmentsForDayAndTime(day, timeSlot)
                      const dropZoneId = `day-${format(day, 'yyyy-MM-dd')}-time-${timeSlot}`
                      const canCreate = ['staff', 'admin', 'super_admin', 'manager', 'receptionist'].includes(userRole)
                      const isEmpty = dayAppointments.length === 0
                      
                      return (
                        <DroppableTimeSlot
                          key={`${day.toISOString()}-${timeSlot}`}
                          id={dropZoneId}
                          className={`min-h-[80px] p-2 border-r last:border-r-0 transition-colors ${
                            canCreate && isEmpty
                              ? 'cursor-pointer hover:bg-blue-50/60 group'
                              : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <div
                            onClick={() => {
                              if (canCreate && isEmpty) openCreateDialog(day, timeSlot)
                            }}
                            className="h-full min-h-[60px]"
                          >
                            {dayAppointments.map((appointment) => (
                              <DraggableAppointment
                                key={appointment.id}
                                appointment={appointment}
                                onAssignDentist={userRole !== 'dentist' ? handleAssignDentist : undefined}
                                dentists={dentists}
                              />
                            ))}
                            {canCreate && isEmpty && (
                              <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </DroppableTimeSlot>
                      )
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {weekDays.map((day) => {
              const dayAppointments = getAppointmentsForDay(day)
              
              return (
                <Card key={day.toISOString()} className="min-h-[400px]">
                  <div className="p-4 border-b bg-gray-50">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-xl font-bold mt-1 ${
                        isSameDay(day, new Date()) 
                          ? 'text-blue-600' 
                          : 'text-gray-900'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {dayAppointments.length} appointments
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <DroppableTimeSlot
                      id={`day-${format(day, 'yyyy-MM-dd')}-all`}
                      className="min-h-[300px]"
                    >
                      <div className="space-y-3">
                        {dayAppointments.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No appointments</p>
                            <p className="text-xs text-gray-400 mt-1">Drop appointments here</p>
                          </div>
                        ) : (
                          dayAppointments.map((appointment) => (
                            <DraggableAppointment
                              key={appointment.id}
                              appointment={appointment}
                              onAssignDentist={userRole !== 'dentist' ? handleAssignDentist : undefined}
                              dentists={dentists}
                            />
                          ))
                        )}
                      </div>
                    </DroppableTimeSlot>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-white p-4 rounded-lg border-2 shadow-xl opacity-90 rotate-2">
              <p className="font-semibold text-sm text-gray-900">Moving appointment...</p>
              <p className="text-xs text-gray-500">Drop in a time slot to reschedule</p>
            </div>
          ) : null}
        </DragOverlay>

        {/* Stats Footer */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredAppointments.length}
                </div>
                <p className="text-xs text-gray-600">Total</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {filteredAppointments.filter(a => a.status === 'pending_assignment').length}
                </div>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {filteredAppointments.filter(a => a.status === 'confirmed').length}
                </div>
                <p className="text-xs text-gray-600">Confirmed</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {filteredAppointments.filter(a => a.status === 'checked_in').length}
                </div>
                <p className="text-xs text-gray-600">Waiting</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {filteredAppointments.filter(a => a.status === 'in_progress').length}
                </div>
                <p className="text-xs text-gray-600">In Progress</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {filteredAppointments.filter(a => a.status === 'completed').length}
                </div>
                <p className="text-xs text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Appointment Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Appointment</DialogTitle>
              <DialogDescription>
                {createSlotDate && createSlotTime && (
                  <>
                    Book a new appointment for{' '}
                    <strong>
                      {format(parseISO(`${createSlotDate}T${createSlotTime}:00`), 'EEEE, MMM d, yyyy')}
                    </strong>{' '}
                    at{' '}
                    <strong>{formatTimeLabel(createSlotTime)}</strong>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Patient Search */}
              <div className="space-y-2">
                <Label htmlFor="patient-search">Patient *</Label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between border rounded-md p-3 bg-blue-50 border-blue-200">
                    <div>
                      <p className="font-medium text-sm">
                        {selectedPatient.fullName ||
                          formatDisplayName(selectedPatient.user?.firstName, selectedPatient.user?.lastName, '') ||
                          'Unnamed patient'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedPatient.patientNumber && <>#{selectedPatient.patientNumber} · </>}
                        {selectedPatient.user?.email || selectedPatient.emailDirect || 'No email'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPatient(null)
                        setPatientSearch('')
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="patient-search"
                        placeholder="Search by name, patient number, or email..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                      {loadingPatients ? (
                        <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading patients...
                        </div>
                      ) : patientList.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No patients found. Try a different search.
                        </div>
                      ) : (
                        patientList.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPatient(p)}
                            className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                          >
                            <p className="font-medium text-sm">
                              {p.fullName ||
                                formatDisplayName(p.user?.firstName, p.user?.lastName, '') ||
                                'Unnamed patient'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {p.patientNumber && <>#{p.patientNumber} · </>}
                              {p.user?.email || p.emailDirect || 'No email'}
                              {p.mobileNumber && <> · {p.mobileNumber}</>}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Appointment Type & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointment-type">Type *</Label>
                  <Select value={newAppointmentType} onValueChange={setNewAppointmentType}>
                    <SelectTrigger id="appointment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="surgery">Surgery</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="x_ray">X-Ray</SelectItem>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min) *</Label>
                  <Select
                    value={String(newAppointmentDuration)}
                    onValueChange={(v) => setNewAppointmentDuration(parseInt(v))}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                      <SelectItem value="120">120 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dentist (optional) */}
              <div className="space-y-2">
                <Label htmlFor="dentist">Assign to Dentist (optional)</Label>
                <Select
                  value={selectedDentist || 'unassigned'}
                  onValueChange={(v) => setSelectedDentist(v === 'unassigned' ? '' : v)}
                >
                  <SelectTrigger id="dentist">
                    <SelectValue placeholder="Unassigned (will be assigned later)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {dentists
                      .filter(d => d.id && typeof d.id === 'string' && d.id.trim() !== '')
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {formatDentistName(d.user?.firstName, d.user?.lastName)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Visit (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g. Routine checkup, tooth pain, follow-up consultation..."
                  value={newAppointmentReason}
                  onChange={(e) => setNewAppointmentReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creatingAppointment}>
                Cancel
              </Button>
              <Button onClick={createAppointment} disabled={creatingAppointment || !selectedPatient}>
                {creatingAppointment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Appointment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  )
}

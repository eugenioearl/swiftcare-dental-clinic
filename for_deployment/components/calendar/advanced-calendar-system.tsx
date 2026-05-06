
'use client'

import { formatDisplayName, formatPatientName } from '@/lib/utils'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
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
  DragOverEvent,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  Settings,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Users,
  Building,
  Stethoscope,
  Phone,
  Mail,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  Calendar,
  Timer,
  Zap,
  Target,
  Activity
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO, 
  addWeeks, 
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  startOfDay,
  endOfDay,
  addMinutes,
  differenceInMinutes,
  isWithinInterval,
  addHours,
  setHours,
  setMinutes
} from 'date-fns'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  status: string
  appointmentType: string
  durationMinutes: number
  reasonForVisit?: string
  notes?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  patient: {
    id: string
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
    specialization?: string
  }
  room?: {
    id: string
    name: string
    type: string
  }
  appointmentTreatments?: any[]
  conflictsWith?: string[]
}

interface Resource {
  id: string
  name: string
  type: 'room' | 'equipment' | 'dentist'
  isAvailable: boolean
  capacity?: number
  description?: string
}

interface CalendarView {
  type: 'day' | 'week' | 'month' | 'timeline' | 'agenda'
  title: string
  icon: React.ReactNode
}

interface ConflictInfo {
  appointmentId: string
  conflicts: {
    type: 'time_overlap' | 'resource_conflict' | 'dentist_unavailable'
    details: string
    severity: 'warning' | 'error'
  }[]
}

interface AdvancedCalendarProps {
  userRole: 'staff' | 'dentist' | 'admin' | 'manager' | 'receptionist'
  currentUserId?: string
  allowedActions?: string[]
  onAppointmentUpdate?: (appointment: Appointment) => void
}

const CALENDAR_VIEWS: CalendarView[] = [
  { type: 'day', title: 'Day', icon: <Calendar className="w-4 h-4" /> },
  { type: 'week', title: 'Week', icon: <Grid3x3 className="w-4 h-4" /> },
  { type: 'month', title: 'Month', icon: <CalendarIcon className="w-4 h-4" /> },
  { type: 'timeline', title: 'Timeline', icon: <Activity className="w-4 h-4" /> },
  { type: 'agenda', title: 'Agenda', icon: <List className="w-4 h-4" /> },
]

const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8 // Start from 8 AM
  const minute = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
})

// Enhanced Draggable Appointment Component
function AdvancedAppointmentCard({ 
  appointment, 
  onEdit, 
  onDelete,
  onDuplicate,
  onView,
  conflicts = [],
  compactMode = false,
  showActions = true 
}: {
  appointment: Appointment
  onEdit?: (appointment: Appointment) => void
  onDelete?: (appointmentId: string) => void
  onDuplicate?: (appointment: Appointment) => void
  onView?: (appointment: Appointment) => void
  conflicts?: ConflictInfo['conflicts']
  compactMode?: boolean
  showActions?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: appointment.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'normal': return 'border-blue-500 bg-blue-50'
      case 'low': return 'border-gray-500 bg-gray-50'
      default: return 'border-gray-300 bg-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'in_progress': return <Timer className="w-4 h-4 text-blue-500" />
      case 'confirmed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'pending_assignment': return <Circle className="w-4 h-4 text-orange-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const hasConflicts = conflicts.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative bg-white rounded-lg border-2 border-l-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing
        ${getPriorityColor(appointment.priority)}
        ${isDragging ? 'opacity-50 shadow-lg transform rotate-1 scale-105' : ''}
        ${hasConflicts ? 'ring-2 ring-red-300 bg-red-50' : ''}
        ${compactMode ? 'p-2' : 'p-3'}
      `}
    >
      {/* Conflict indicator */}
      {hasConflicts && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-2 h-2 text-white" />
        </div>
      )}

      {/* Priority indicator */}
      {appointment.priority === 'urgent' && (
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      )}

      <div className={`space-y-${compactMode ? '1' : '2'}`}>
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              {getStatusIcon(appointment.status)}
              <p className={`font-semibold text-gray-900 truncate ${compactMode ? 'text-xs' : 'text-sm'}`}>
                {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
              </p>
            </div>
            <p className={`text-gray-500 ${compactMode ? 'text-xs' : 'text-xs'}`}>#{appointment.appointmentNumber}</p>
          </div>
          
          {showActions && !compactMode && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onView?.(appointment)
                }}
                className="h-6 w-6 p-0"
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(appointment)
                }}
                className="h-6 w-6 p-0"
              >
                <Edit className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Time and Duration */}
        <div className={`flex items-center text-gray-600 ${compactMode ? 'text-xs' : 'text-xs'}`}>
          <Clock className="w-3 h-3 mr-1" />
          <span>
            {format(parseISO(appointment.scheduledDatetime), 'HH:mm')} 
            ({appointment.durationMinutes}min)
          </span>
          {appointment.appointmentType === 'emergency' && (
            <>
              <span className="mx-1">•</span>
              <Zap className="w-3 h-3 text-red-500" />
              <span className="text-red-600 font-medium">Emergency</span>
            </>
          )}
        </div>

        {/* Reason/Treatment */}
        {!compactMode && appointment.reasonForVisit && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {appointment.reasonForVisit}
          </p>
        )}

        {/* Dentist and Room */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-600">
            <User className="w-3 h-3 mr-1" />
            {appointment.dentist ? (
              <span>Dr. {appointment?.dentist?.user?.lastName}</span>
            ) : (
              <span className="text-orange-600 font-medium">Unassigned</span>
            )}
          </div>
          
          {appointment.room && !compactMode && (
            <div className="flex items-center text-gray-600">
              <MapPin className="w-3 h-3 mr-1" />
              <span>{appointment.room.name}</span>
            </div>
          )}
        </div>

        {/* Contact Info (hover/expanded view) */}
        {!compactMode && (
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            {appointment?.patient?.user?.phone && (
              <div className="flex items-center">
                <Phone className="w-3 h-3 mr-1" />
                <span>{appointment?.patient?.user?.phone}</span>
              </div>
            )}
            {appointment?.patient?.user?.email && (
              <div className="flex items-center">
                <Mail className="w-3 h-3 mr-1" />
                <span className="truncate">{appointment?.patient?.user?.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Conflicts Display */}
        {hasConflicts && !compactMode && (
          <div className="text-xs text-red-600 bg-red-100 rounded p-1">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// Resource Timeline View Component
function ResourceTimeline({ 
  resources, 
  appointments, 
  selectedDate,
  onAppointmentDrop 
}: {
  resources: Resource[]
  appointments: Appointment[]
  selectedDate: Date
  onAppointmentDrop?: (event: DragEndEvent) => void
}) {
  const timeSlots = TIME_SLOTS

  const getAppointmentsForResourceAndTime = (resourceId: string, timeSlot: string) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.scheduledDatetime)
      const aptTime = format(aptDate, 'HH:mm')
      
      // Check if appointment is for this resource (dentist or room)
      const matchesResource = 
        (apt.dentist?.id === resourceId) || 
        (apt.room?.id === resourceId)
      
      return isSameDay(aptDate, selectedDate) && aptTime === timeSlot && matchesResource
    })
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-[1200px]">
        {/* Header */}
        <div className="grid grid-cols-[200px_1fr] border-b bg-gray-50">
          <div className="p-3 font-medium text-gray-700">Resources</div>
          <div className="grid grid-cols-20 gap-px">
            {timeSlots.map(time => (
              <div key={time} className="p-2 text-xs text-center font-medium text-gray-600 border-l">
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* Resource Rows */}
        {resources.map(resource => (
          <div key={resource.id} className="grid grid-cols-[200px_1fr] border-b hover:bg-gray-50">
            {/* Resource Info */}
            <div className="p-3 border-r">
              <div className="flex items-center space-x-2">
                {resource.type === 'dentist' && <Stethoscope className="w-4 h-4 text-blue-500" />}
                {resource.type === 'room' && <Building className="w-4 h-4 text-green-500" />}
                {resource.type === 'equipment' && <Settings className="w-4 h-4 text-purple-500" />}
                <div>
                  <p className="font-medium text-sm">{resource.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{resource.type}</p>
                </div>
              </div>
              <div className={`mt-2 text-xs ${resource.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {resource.isAvailable ? 'Available' : 'Unavailable'}
              </div>
            </div>

            {/* Time Slots */}
            <div className="grid grid-cols-20 gap-px">
              {timeSlots.map(timeSlot => {
                const resourceAppointments = getAppointmentsForResourceAndTime(resource.id, timeSlot)
                const dropZoneId = `resource-${resource.id}-time-${timeSlot}`
                
                return (
                  <DroppableTimeSlot
                    key={timeSlot}
                    id={dropZoneId}
                    className="min-h-[60px] p-1 border-l hover:bg-blue-50 transition-colors"
                  >
                    {resourceAppointments.map(apt => (
                      <AdvancedAppointmentCard
                        key={apt.id}
                        appointment={apt}
                        compactMode={true}
                        showActions={false}
                      />
                    ))}
                  </DroppableTimeSlot>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Conflict Detection Hook
function useConflictDetection(appointments: Appointment[]) {
  return useMemo(() => {
    const conflicts: ConflictInfo[] = []

    appointments.forEach(apt => {
      const aptConflicts: ConflictInfo['conflicts'] = []
      const aptStart = parseISO(apt.scheduledDatetime)
      const aptEnd = addMinutes(aptStart, apt.durationMinutes)

      // Check for time overlaps with same dentist
      if (apt.dentist) {
        const overlapping = appointments.filter(other => 
          other.id !== apt.id && 
          other.dentist?.id === apt.dentist?.id &&
          other.status !== 'cancelled'
        ).filter(other => {
          const otherStart = parseISO(other.scheduledDatetime)
          const otherEnd = addMinutes(otherStart, other.durationMinutes)
          
          return (
            (aptStart >= otherStart && aptStart < otherEnd) ||
            (aptEnd > otherStart && aptEnd <= otherEnd) ||
            (aptStart <= otherStart && aptEnd >= otherEnd)
          )
        })

        overlapping.forEach(conflict => {
          aptConflicts.push({
            type: 'time_overlap',
            details: `Overlaps with appointment ${conflict.appointmentNumber}`,
            severity: 'error'
          })
        })
      }

      // Check for room conflicts
      if (apt.room) {
        const roomConflicts = appointments.filter(other => 
          other.id !== apt.id && 
          other.room?.id === apt.room?.id &&
          other.status !== 'cancelled'
        ).filter(other => {
          const otherStart = parseISO(other.scheduledDatetime)
          const otherEnd = addMinutes(otherStart, other.durationMinutes)
          
          return isWithinInterval(aptStart, { start: otherStart, end: otherEnd }) ||
                 isWithinInterval(aptEnd, { start: otherStart, end: otherEnd })
        })

        roomConflicts.forEach(conflict => {
          aptConflicts.push({
            type: 'resource_conflict',
            details: `Room conflict with appointment ${conflict.appointmentNumber}`,
            severity: 'warning'
          })
        })
      }

      if (aptConflicts.length > 0) {
        conflicts.push({
          appointmentId: apt.id,
          conflicts: aptConflicts
        })
      }
    })

    return conflicts
  }, [appointments])
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
      className={`${className} ${isOver ? 'bg-blue-100 ring-2 ring-blue-400 transition-all duration-200' : ''}`}
    >
      {children}
    </div>
  )
}

export function AdvancedCalendarSystem({ 
  userRole, 
  currentUserId, 
  allowedActions = [],
  onAppointmentUpdate 
}: AdvancedCalendarProps) {
  const { data: session } = useSession() || {}
  const { toast } = useToast()

  // State Management
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<any[]>([])
  const [rooms, setRooms] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedView, setSelectedView] = useState<CalendarView['type']>('week')
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    dentist: 'all',
    appointmentType: 'all',
    priority: 'all',
    searchTerm: ''
  })

  // Dialogs
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // Settings
  const [settings, setSettings] = useState({
    showConflicts: true,
    autoRefresh: true,
    compactMode: false,
    showWeekends: true,
    workingHours: { start: '08:00', end: '18:00' }
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  // Conflict detection
  const conflicts = useConflictDetection(appointments)

  // Fetch data
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      
      let startDate: Date, endDate: Date
      
      switch (selectedView) {
        case 'day':
          startDate = startOfDay(currentDate)
          endDate = endOfDay(currentDate)
          break
        case 'week':
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
          break
        case 'month':
          startDate = startOfMonth(currentDate)
          endDate = endOfMonth(currentDate)
          break
        default:
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
      }

      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      })

      if (userRole === 'dentist' && currentUserId) {
        params.append('dentistId', currentUserId)
      }

      const response = await fetch(`/api/appointments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.data?.appointments || [])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast({
        title: "Error",
        description: "Failed to fetch appointments",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [currentDate, selectedView, userRole, currentUserId, toast])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Fetch resources
  useEffect(() => {
    const fetchResources = async () => {
      try {
        // Fetch dentists
        const dentistResponse = await fetch('/api/dentists')
        if (dentistResponse.ok) {
          const dentistData = await dentistResponse.json()
          setDentists(dentistData.data?.dentists || [])
        }

        // Fetch rooms (mock for now)
        setRooms([
          { id: 'room1', name: 'Room 1', type: 'room', isAvailable: true, description: 'General consultation room' },
          { id: 'room2', name: 'Room 2', type: 'room', isAvailable: true, description: 'Surgery room' },
          { id: 'room3', name: 'X-Ray Room', type: 'room', isAvailable: true, description: 'Imaging room' },
        ])
      } catch (error) {
        console.error('Error fetching resources:', error)
      }
    }

    if (!['patient'].includes(userRole)) {
      fetchResources()
    }
  }, [userRole])

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (filters.status !== 'all' && apt.status !== filters.status) return false
      if (filters.dentist !== 'all' && apt.dentist?.id !== filters.dentist) return false
      if (filters.appointmentType !== 'all' && apt.appointmentType !== filters.appointmentType) return false
      if (filters.priority !== 'all' && apt.priority !== filters.priority) return false
      
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        const patientName = formatDisplayName(apt?.patient?.user?.firstName, apt?.patient?.user?.lastName, '').toLowerCase()
        const appointmentNumber = apt.appointmentNumber.toLowerCase()
        const reason = apt.reasonForVisit?.toLowerCase() || ''
        
        if (!patientName.includes(searchLower) && 
            !appointmentNumber.includes(searchLower) && 
            !reason.includes(searchLower)) {
          return false
        }
      }
      
      return true
    })
  }, [appointments, filters])

  // Handle drag operations
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const appointmentId = active.id as string
    const dropZoneId = over.id as string

    // Parse drop zone and update appointment
    let newDateTime: string | null = null

    if (dropZoneId.includes('-time-')) {
      const parts = dropZoneId.split('-')
      if (parts[0] === 'day') {
        // Day/week view: format "day-YYYY-MM-DD-time-HH:MM"
        const newDate = parts.slice(1, 4).join('-')
        const newTime = parts.slice(5).join(':')
        newDateTime = `${newDate}T${newTime}:00`
      } else if (parts[0] === 'resource') {
        // Resource view: format "resource-{resourceId}-time-HH:MM"
        const resourceId = parts[1]
        const newTime = parts[3]
        const newDate = format(currentDate, 'yyyy-MM-dd')
        newDateTime = `${newDate}T${newTime}:00`
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
        await fetchAppointments()
        
        toast({
          title: "Appointment moved",
          description: `Rescheduled to ${format(parseISO(newDateTime), 'MMM d, yyyy')} at ${format(parseISO(newDateTime), 'HH:mm')}`,
        })
      }
    } catch (error) {
      console.error('Error moving appointment:', error)
      toast({
        title: "Error",
        description: "Failed to move appointment",
        variant: "destructive"
      })
    }
  }

  // Navigation functions
  const handlePrevious = () => {
    switch (selectedView) {
      case 'day':
        setCurrentDate(prev => subDays(prev, 1))
        break
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1))
        break
      case 'month':
        setCurrentDate(prev => subDays(prev, 30))
        break
      default:
        setCurrentDate(prev => subWeeks(prev, 1))
    }
  }

  const handleNext = () => {
    switch (selectedView) {
      case 'day':
        setCurrentDate(prev => addDays(prev, 1))
        break
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1))
        break
      case 'month':
        setCurrentDate(prev => addDays(prev, 30))
        break
      default:
        setCurrentDate(prev => addWeeks(prev, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Get view title
  const getViewTitle = () => {
    switch (selectedView) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy')
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      case 'month':
        return format(currentDate, 'MMMM yyyy')
      default:
        return format(currentDate, 'MMMM yyyy')
    }
  }

  // Get conflict info for appointment
  const getConflictInfo = (appointmentId: string) => {
    return conflicts.find(c => c.appointmentId === appointmentId)?.conflicts || []
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
        <p className="text-gray-600 font-medium">Loading calendar data...</p>
      </div>
    )
  }

  // Show helpful message when no appointments
  const hasNoAppointments = filteredAppointments.length === 0

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              {/* Navigation and Title */}
              <div className="flex items-center space-x-4">
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
                  {getViewTitle()}
                </h2>
                <Button variant="outline" size="sm" onClick={handleNext}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
              </div>

              {/* View Selector */}
              <div className="flex items-center space-x-2">
                <div className="flex rounded-lg border">
                  {CALENDAR_VIEWS.map((view) => (
                    <Button
                      key={view.type}
                      variant={selectedView === view.type ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedView(view.type)}
                      className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                    >
                      {view.icon}
                      <span className="ml-2 hidden sm:inline">{view.title}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Filters and Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Search and Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search appointments..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    className="pl-9 w-64"
                  />
                </div>

                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending_assignment">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked_in">Checked In</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                {userRole !== 'dentist' && (
                  <Select value={filters.dentist} onValueChange={(value) => setFilters(prev => ({ ...prev, dentist: value }))}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Dentist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dentists</SelectItem>
                      {dentists.map((dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          Dr. {dentist.user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {conflicts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConflictDialog(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {conflicts.length} Conflicts
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsDialog(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>

                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Appointment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Views */}
        <Card className="min-h-[600px]">
          <CardContent className="p-0">
            {selectedView === 'timeline' && (
              <ResourceTimeline
                resources={[...dentists.map(d => ({ ...d, type: 'dentist' as const })), ...rooms]}
                appointments={filteredAppointments}
                selectedDate={currentDate}
                onAppointmentDrop={handleDragEnd}
              />
            )}
            
            {selectedView === 'agenda' && (
              <div className="p-6">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {filteredAppointments.length === 0 ? (
                      <div className="text-center py-12">
                        <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No appointments found</p>
                      </div>
                    ) : (
                      filteredAppointments.map((appointment) => (
                        <AdvancedAppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          conflicts={getConflictInfo(appointment.id)}
                          onView={setSelectedAppointment}
                          onEdit={setSelectedAppointment}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Week/Day views would go here - using existing enhanced calendar for now */}
            {(selectedView === 'week' || selectedView === 'day') && (
              <div className="p-6">
                <p className="text-gray-500 text-center">Enhanced week/day view integrated with existing component</p>
              </div>
            )}

            {selectedView === 'month' && (
              <div className="p-6">
                <div className="grid grid-cols-7 gap-2">
                  {/* Month view implementation would go here */}
                  <p className="col-span-7 text-gray-500 text-center">Month view implementation</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredAppointments.length}</div>
              <p className="text-xs text-gray-600">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredAppointments.filter(a => a.status === 'pending_assignment').length}
              </div>
              <p className="text-xs text-gray-600">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredAppointments.filter(a => a.status === 'confirmed').length}
              </div>
              <p className="text-xs text-gray-600">Confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredAppointments.filter(a => a.status === 'in_progress').length}
              </div>
              <p className="text-xs text-gray-600">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {conflicts.length}
              </div>
              <p className="text-xs text-gray-600">Conflicts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredAppointments.filter(a => a.priority === 'urgent').length}
              </div>
              <p className="text-xs text-gray-600">Urgent</p>
            </CardContent>
          </Card>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-white p-4 rounded-lg border-2 shadow-2xl opacity-95 rotate-3 scale-110">
              <p className="font-semibold text-sm text-gray-900">Moving appointment...</p>
              <p className="text-xs text-gray-500">Drop in a time slot to reschedule</p>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      {/* Conflicts Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Conflicts ({conflicts.length})</DialogTitle>
            <DialogDescription>
              The following appointments have scheduling conflicts that need attention.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {conflicts.map((conflict) => {
                const appointment = appointments.find(a => a.id === conflict.appointmentId)
                if (!appointment) return null

                return (
                  <Card key={conflict.appointmentId} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(parseISO(appointment.scheduledDatetime), 'MMM d, yyyy HH:mm')} 
                          ({appointment.durationMinutes}min)
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {conflict.conflicts.length} issue{conflict.conflicts.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {conflict.conflicts.map((issue, idx) => (
                        <div key={idx} className={`flex items-center space-x-2 text-sm p-2 rounded ${
                          issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          <AlertTriangle className="w-4 h-4" />
                          <span>{issue.details}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calendar Settings</DialogTitle>
            <DialogDescription>
              Customize your calendar view and behavior preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-conflicts">Show conflict indicators</Label>
              <Switch
                id="show-conflicts"
                checked={settings.showConflicts}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, showConflicts: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-refresh">Auto-refresh appointments</Label>
              <Switch
                id="auto-refresh"
                checked={settings.autoRefresh}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoRefresh: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="compact-mode">Compact appointment cards</Label>
              <Switch
                id="compact-mode"
                checked={settings.compactMode}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, compactMode: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-weekends">Show weekends</Label>
              <Switch
                id="show-weekends"
                checked={settings.showWeekends}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, showWeekends: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

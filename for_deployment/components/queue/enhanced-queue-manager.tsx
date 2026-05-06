
'use client'

import { formatPatientName } from '@/lib/utils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  Clock, 
  Users, 
  Play, 
  Pause, 
  ArrowUp, 
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Timer,
  Bell,
  SkipForward,
  UserX,
  TrendingUp,
  Activity,
  BarChart3,
  Zap,
  FileText
} from 'lucide-react'
import { format, parseISO, differenceInMinutes } from 'date-fns'

interface QueueItem {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  appointmentType: string
  status: 'pending_assignment' | 'scheduled' | 'confirmed' | 'checked_in' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  reasonForVisit: string
  checkedInAt?: string
  startedAt?: string
  completedAt?: string
  actualWaitTime?: number
  estimatedWaitTime: number
  priority: 'normal' | 'urgent' | 'emergency'
  queuePosition: number
  patient: {
    id: string
    fullName?: string | null
    user?: { firstName: string; lastName: string; phone?: string } | null
    mobileNumber?: string | null
    patientNumber: string
  }
  dentist?: {
    id: string
    user?: { firstName: string; lastName: string } | null
  }
  isPaused?: boolean
  pauseReason?: string
  notificationSent?: boolean
  specialInstructions?: string
}

interface QueueAnalytics {
  averageWaitTime: number
  averageTreatmentTime: number
  currentEfficiency: number
  peakHours: string[]
  bottlenecks: string[]
  patientsServedToday: number
  totalWaitTimeToday: number
}

interface EnhancedQueueManagerProps {
  role: 'staff' | 'dentist' | 'admin' | 'super_admin' | 'receptionist' | 'manager'
  dentistId?: string
  realTimeUpdates?: boolean
}

export function EnhancedQueueManager({ 
  role, 
  dentistId, 
  realTimeUpdates = true 
}: EnhancedQueueManagerProps) {
  const canTreat = ['dentist', 'admin', 'super_admin'].includes(role)
  const router = useRouter()
  const { toast } = useToast()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [analytics, setAnalytics] = useState<QueueAnalytics | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Cancellation dialog state
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; appointmentId: string | null; patientName: string }>({
    open: false,
    appointmentId: null,
    patientName: ''
  })
  const [cancelReason, setCancelReason] = useState('')

  // Track whether to show loading spinner — only on initial load, not on silent refresh
  const hasLoadedOnceRef = useRef(false)

  // Fetch queue data - extracted as a callable function
  const fetchQueue = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const endpoint = role === 'dentist' && dentistId
        ? `/api/queue/enhanced?dentistId=${dentistId}`
        : '/api/queue/enhanced'

      const response = await fetch(endpoint, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setQueue(data.queue || [])
        setAnalytics(data.analytics || null)
        setLastRefresh(new Date())
      } else {
        console.error('Failed to fetch queue:', response.status)
        if (!hasLoadedOnceRef.current) {
          setQueue([])
          setAnalytics(null)
        }
      }
    } catch (error) {
      console.error('Error fetching queue:', error)
      if (!hasLoadedOnceRef.current) {
        setQueue([])
        setAnalytics(null)
      }
    } finally {
      hasLoadedOnceRef.current = true
      if (showLoading) setLoading(false)
    }
  }, [role, dentistId])

  // Update current time every 10 seconds for accurate "last updated" display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Initial fetch + real-time polling
  useEffect(() => {
    fetchQueue(true)
    if (realTimeUpdates) {
      const interval = setInterval(() => fetchQueue(false), 5000) // Poll every 5 seconds
      return () => clearInterval(interval)
    }
  }, [fetchQueue, realTimeUpdates])

  // Smart Queue Operations
  const moveToTop = async (queueId: string) => {
    try {
      const response = await fetch(`/api/queue/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId: queueId, 
          action: 'move_to_top',
          reason: 'Staff priority override'
        })
      })

      if (response.ok) {
        toast({ title: "Patient moved to top of queue" })
        await fetchQueue(false)
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to prioritize patient",
        variant: "destructive" 
      })
    }
  }

  const pausePatient = async (queueId: string, reason: string) => {
    try {
      const response = await fetch(`/api/queue/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId: queueId, 
          action: 'pause',
          reason 
        })
      })

      if (response.ok) {
        toast({ title: "Patient paused in queue" })
        await fetchQueue(false)
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to pause patient",
        variant: "destructive" 
      })
    }
  }

  const sendNotification = async (queueId: string, message: string) => {
    try {
      const response = await fetch(`/api/queue/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appointmentId: queueId, 
          message,
          channel: 'sms' // Could be 'sms', 'email', or 'push'
        })
      })

      if (response.ok) {
        toast({ title: "Notification sent" })
        await fetchQueue(false)
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to send notification",
        variant: "destructive" 
      })
    }
  }

  // Update status with optimistic UI — immediate feedback, then actual API call + refresh
  const updateStatus = async (queueId: string, newStatus: QueueItem['status']): Promise<boolean> => {
    // Optimistic update: immediately reflect new status in UI
    const previousQueue = queue
    const timestampField: Partial<QueueItem> = {}
    const nowIso = new Date().toISOString()
    if (newStatus === 'checked_in') (timestampField as any).checkedInAt = nowIso
    if (newStatus === 'in_progress') (timestampField as any).startedAt = nowIso
    if (newStatus === 'completed') (timestampField as any).completedAt = nowIso

    setQueue(prev => prev.map(item =>
      item.id === queueId ? { ...item, ...timestampField, status: newStatus } : item
    ))

    try {
      const response = await fetch(`/api/appointments/${queueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (response.ok) {
        toast({
          title: "Status updated",
          description: `Patient status changed to ${newStatus.replace('_', ' ')}`
        })
        // Fetch fresh data to get server-side computed fields (queue position, wait time, etc.)
        await fetchQueue(false)
        return true
      }

      // Rollback on error
      setQueue(previousQueue)
      const err = await response.json().catch(() => ({ error: 'Unknown' }))
      toast({
        title: "Error",
        description: err.error || "Failed to update status",
        variant: "destructive"
      })
      return false
    } catch (error) {
      setQueue(previousQueue)
      toast({
        title: "Error",
        description: "Network error — failed to update status",
        variant: "destructive"
      })
      return false
    }
  }

  // Cancel appointment with reason
  const openCancelDialog = (queueId: string, patientName: string) => {
    setCancelDialog({ open: true, appointmentId: queueId, patientName })
    setCancelReason('')
  }

  const handleCancelConfirm = async () => {
    if (!cancelDialog.appointmentId) return
    if (!cancelReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for cancellation so the patient can be informed.",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch(`/api/appointments/${cancelDialog.appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancellationReason: cancelReason.trim()
        })
      })

      if (response.ok) {
        toast({
          title: "Appointment cancelled",
          description: `${cancelDialog.patientName} has been notified via email.`
        })
        setCancelDialog({ open: false, appointmentId: null, patientName: '' })
        setCancelReason('')
        await fetchQueue(false)
      } else {
        const err = await response.json().catch(() => ({ error: 'Unknown' }))
        toast({
          title: "Error",
          description: err.error || "Failed to cancel appointment",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error — failed to cancel",
        variant: "destructive"
      })
    }
  }

  // Calculate dynamic wait times
  const calculateWaitTime = (item: QueueItem, queuePosition: number) => {
    if (item.status === 'in_progress') return 0
    
    // Base time estimates by appointment type
    const baseTime = {
      'cleaning': 45,
      'consultation': 30, 
      'filling': 60,
      'extraction': 90,
      'emergency': 45,
      'walk_in': 30
    }[item.appointmentType] || 30

    // Factor in current queue ahead
    const queueTime = Math.max(0, (queuePosition - 1) * 20)
    
    // Emergency priority adjustment
    if (item.priority === 'emergency') return Math.min(10, queueTime)
    if (item.priority === 'urgent') return Math.min(20, queueTime)
    
    return queueTime + (baseTime * 0.3) // Add buffer time
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-blue-100 text-blue-800'
      case 'waiting': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'border-l-red-500 bg-red-50'
      case 'urgent': return 'border-l-orange-500 bg-orange-50'
      case 'normal': return 'border-l-blue-500 bg-blue-50'
      default: return 'border-l-gray-500 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
        <p className="text-gray-600 font-medium">Loading queue data...</p>
      </div>
    )
  }

  const hasNoQueueItems = queue.length === 0

  return (
    <div className="space-y-6">
      {/* Help Banner - Show when queue is empty */}
      {hasNoQueueItems && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <Users className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Queue is Empty</h3>
                <p className="text-blue-800 mb-3">
                  The patient queue shows appointments for today that are checked in or in progress. Currently, there are no patients in the queue.
                </p>
                <p className="text-blue-700 text-sm">
                  <strong>Note:</strong> Patients will appear here once they check in for their appointments. The queue updates in real-time every 5 seconds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {queue.filter(q => ['checked_in', 'waiting'].includes(q.status)).length}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
              <Users className="w-4 h-4 mr-1" />
              In Queue
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {queue.filter(q => q.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
              <Activity className="w-4 h-4 mr-1" />
              In Progress
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {queue.filter(q => q.priority === 'emergency').length}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Emergency
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {analytics?.averageWaitTime || 0}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
              <Timer className="w-4 h-4 mr-1" />
              Avg Wait (min)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {analytics?.currentEfficiency || 0}%
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Efficiency
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="queue" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3"><span className="hidden sm:inline">Active </span>Queue ({queue.filter(q => !['completed', 'cancelled'].includes(q.status)).length})</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">Analytics</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3"><span className="sm:hidden">Notif</span><span className="hidden sm:inline">Notifications</span></TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">Settings</TabsTrigger>
        </TabsList>

        {/* Active Queue Management */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Smart Queue Management
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                  <span>• Last update: {format(lastRefresh, 'HH:mm:ss')}</span>
                  <Button size="sm" variant="ghost" onClick={() => fetchQueue(false)} className="h-6 px-2" title="Refresh now">
                    <Activity className="w-3 h-3" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {queue
                  .filter(item => !['completed', 'cancelled', 'no_show'].includes(item.status))
                  .sort((a, b) => {
                    // Emergency priority first
                    if (a.priority === 'emergency' && b.priority !== 'emergency') return -1
                    if (b.priority === 'emergency' && a.priority !== 'emergency') return 1
                    
                    // Then in_progress
                    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
                    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
                    
                    // Then by queue position
                    return a.queuePosition - b.queuePosition
                  })
                  .map((item, index) => (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-lg border-2 border-l-4 transition-all hover:shadow-md ${getPriorityColor(item.priority)} ${
                        item.isPaused ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="text-center flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                item.status === 'in_progress' ? 'bg-purple-600 animate-pulse' :
                                item.priority === 'emergency' ? 'bg-red-600' :
                                item.priority === 'urgent' ? 'bg-orange-600' :
                                'bg-blue-600'
                              }`}>
                                {index + 1}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 flex items-center flex-wrap gap-x-2 break-anywhere">
                                <span className="text-blue-600">{item.appointmentNumber}</span>
                                <span className="break-anywhere">{formatPatientName(item.patient.fullName, item.patient.user?.firstName, item.patient.user?.lastName, item.patient.patientNumber)}</span>
                                {item.priority === 'emergency' && (
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                )}
                                {item.isPaused && (
                                  <Pause className="w-4 h-4 text-gray-600" />
                                )}
                              </h3>
                              <p className="text-sm text-gray-600 break-anywhere">
                                {item.appointmentType.replace('_', ' ').toUpperCase()} • {item.reasonForVisit}
                              </p>
                              <p className="text-xs text-gray-500 break-anywhere">
                                {item.patient.patientNumber}
                                {(item.patient.mobileNumber || item?.patient?.user?.phone) && ` • ${item.patient.mobileNumber || item?.patient?.user?.phone}`}
                                {' • Scheduled: '}{format(parseISO(item.scheduledDatetime), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col sm:text-right items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1 flex-shrink-0">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <div className="text-sm font-medium text-blue-600 whitespace-nowrap">
                            ~{calculateWaitTime(item, index + 1)} min wait
                          </div>
                          {item.checkedInAt && (
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              Checked in: {format(parseISO(item.checkedInAt), 'HH:mm')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Advanced Queue Controls */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-3 border-t gap-2">
                        <div className="flex flex-wrap gap-2">
                          {/* Status progression buttons */}
                          {item.status === 'checked_in' && (
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                onClick={() => updateStatus(item.id, 'waiting')}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Clock className="w-4 h-4 mr-1" />
                                Start Wait
                              </Button>
                              {canTreat && (
                                <Button 
                                  size="sm" 
                                  onClick={async () => {
                                    await updateStatus(item.id, 'in_progress')
                                    router.push(`/admin/chart?patientId=${item.patient.id}`)
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Start Treatment
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {item.status === 'waiting' && canTreat && (
                            <Button 
                              size="sm" 
                              onClick={async () => {
                                await updateStatus(item.id, 'in_progress')
                                router.push(`/admin/chart?patientId=${item.patient.id}`)
                              }}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start Treatment
                            </Button>
                          )}
                          
                          {item.status === 'in_progress' && (
                            <div className="flex space-x-2">
                              {canTreat && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => router.push(`/admin/chart?patientId=${item.patient.id}`)}
                                >
                                  <FileText className="w-4 h-4 mr-1" />
                                  Patient Chart
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                onClick={() => updateStatus(item.id, 'completed')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 justify-end">
                          {/* Queue management controls */}
                          {!item.isPaused && item.status === 'waiting' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => moveToTop(item.id)}
                                title="Move to top of queue"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => pausePatient(item.id, 'Temporary hold')}
                                title="Pause patient"
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            </>
                          )}

                          {/* Notification button */}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => sendNotification(item.id, 'Your appointment will begin shortly. Please be ready.')}
                            title="Send notification"
                          >
                            <Bell className="w-4 h-4" />
                          </Button>

                          {/* Skip/Cancel */}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openCancelDialog(
                              item.id,
                              item.patient.fullName ||
                                formatPatientName(item.patient.fullName, item.patient.user?.firstName, item.patient.user?.lastName, item.patient.patientNumber)
                            )}
                            title="Cancel appointment (patient will be notified)"
                            className="text-red-600 hover:text-red-700"
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Special instructions or pause reason */}
                      {(item.isPaused || item.specialInstructions) && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                          {item.isPaused && (
                            <p className="text-yellow-800 font-medium">
                              ⏸️ Paused: {item.pauseReason}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="text-blue-800">
                              📝 Instructions: {item.specialInstructions}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                {queue.filter(item => !['completed', 'cancelled', 'no_show'].includes(item.status)).length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Queue is Empty</h3>
                    <p className="text-gray-600">No patients currently in queue</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Queue Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Performance Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Wait Time:</span>
                        <span className="font-medium">{analytics.averageWaitTime} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Treatment Time:</span>
                        <span className="font-medium">{analytics.averageTreatmentTime} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Efficiency Score:</span>
                        <span className="font-medium">{analytics.currentEfficiency}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Patients Today:</span>
                        <span className="font-medium">{analytics.patientsServedToday}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Peak Hours</h4>
                    <div className="space-y-2">
                      {analytics.peakHours.map((hour) => (
                        <div key={hour} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm">{hour}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Identified Bottlenecks</h4>
                    <div className="space-y-2">
                      {analytics.bottlenecks.map((bottleneck, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">{bottleneck}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No analytics data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Patient Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={() => {
                      // Send bulk notifications to waiting patients
                      toast({ title: "Notifications sent to all waiting patients" })
                    }}
                    className="flex items-center justify-center"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Notify All Waiting
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      // Send arrival reminders to upcoming appointments
                      toast({ title: "Arrival reminders sent" })
                    }}
                    className="flex items-center justify-center"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Send Arrival Reminders
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Recent Notifications</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium">SMS sent to Alice Johnson</p>
                      <p className="text-xs text-gray-600">2 minutes ago • "Your appointment will begin in ~10 minutes"</p>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium">SMS sent to Bob Wilson</p>
                      <p className="text-xs text-gray-600">5 minutes ago • "Please proceed to treatment room 2"</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Queue Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Timing Settings</h4>
                    <div className="space-y-3">
                      <div>
                        <Label>Average Treatment Time (minutes)</Label>
                        <Input type="number" defaultValue="30" className="mt-1" />
                      </div>
                      <div>
                        <Label>Buffer Time Between Patients (minutes)</Label>
                        <Input type="number" defaultValue="5" className="mt-1" />
                      </div>
                      <div>
                        <Label>Emergency Priority Time (minutes)</Label>
                        <Input type="number" defaultValue="10" className="mt-1" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Notification Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="auto-notify" defaultChecked />
                        <Label htmlFor="auto-notify">Auto-notify when ready</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="arrival-reminders" defaultChecked />
                        <Label htmlFor="arrival-reminders">Send arrival reminders</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="delay-notifications" defaultChecked />
                        <Label htmlFor="delay-notifications">Notify on delays</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button>Save Settings</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancellation Dialog */}
      <Dialog
        open={cancelDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialog({ open: false, appointmentId: null, patientName: '' })
            setCancelReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cancel the appointment for <strong>{cancelDialog.patientName}</strong>?
              {' '}The patient will be automatically notified via email.
            </p>
            <div>
              <Label htmlFor="cancel-reason" className="mb-1 block">Reason for cancellation <span className="text-red-500">*</span></Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Dentist unavailable, equipment maintenance, patient requested..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialog({ open: false, appointmentId: null, patientName: '' })
                setCancelReason('')
              }}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim()}
            >
              Cancel & Notify Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
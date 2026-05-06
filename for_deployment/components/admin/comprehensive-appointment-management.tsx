
'use client'

import { formatDisplayName, formatDentistName, formatPatientName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Calendar, Search, Filter, Download, Eye, Edit, Trash2, UserPlus,
  Clock, User, MapPin, Phone, AlertCircle, CheckCircle2, X, Save, Loader2,
  ShieldCheck, XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { format } from 'date-fns'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  durationMinutes: number
  status: string
  appointmentType: string
  reasonForVisit?: string
  notes?: string
  estimatedCost?: number
  isEmergency: boolean
  patient: {
    id: string
    patientNumber: string
    fullName?: string | null
    mobileNumber?: string | null
    emailDirect?: string | null
    user?: {
      firstName: string
      lastName: string
      email: string
      phone?: string
    } | null
  }
  dentist?: {
    id: string
    user?: {
      firstName: string
      lastName: string
    } | null
  } | null
  appointmentTreatments: Array<{
    treatment: {
      name: string
      baseCost: number
    }
  }>
  createdAt: string
}

interface Dentist {
  id: string
  user: { firstName: string; lastName: string }
}

export default function ComprehensiveAppointmentManagement() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const { confirm } = useConfirm()
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dentistFilter, setDentistFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [editForm, setEditForm] = useState({
    scheduledDatetime: '',
    durationMinutes: 30,
    appointmentType: '',
    dentistId: '',
    reasonForVisit: '',
    notes: '',
    estimatedCost: 0,
    isEmergency: false,
  })
  const [saving, setSaving] = useState(false)
  const [dentists, setDentists] = useState<Dentist[]>([])

  // Walk-in dialog state
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState({
    patientName: '',
    mobileNumber: '',
    reasonForVisit: '',
    isEmergency: false,
    dentistId: '',
  })
  const [walkInSaving, setWalkInSaving] = useState(false)

  // Approval dialog state (pending_assignment / pending appointments)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approveAppointment, setApproveAppointment] = useState<Appointment | null>(null)
  const [approveDentistId, setApproveDentistId] = useState('')
  const [approveStatus, setApproveStatus] = useState<string>('scheduled')
  const [approveSaving, setApproveSaving] = useState(false)

  const openApproveDialog = (appointment: Appointment) => {
    setApproveAppointment(appointment)
    setApproveDentistId(appointment.dentist?.id || '')
    setApproveStatus('scheduled')
    setApproveDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!approveAppointment) return
    if (!approveDentistId) {
      toast({ title: 'Dentist required', description: 'Please assign a dentist before approving the appointment.', variant: 'destructive' })
      return
    }
    setApproveSaving(true)
    try {
      const res = await fetch(`/api/appointments/${approveAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dentistId: approveDentistId,
          status: approveStatus,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to approve appointment')
      }
      toast({ title: 'Appointment approved', description: 'Dentist assigned and status updated.' })
      setApproveDialogOpen(false)
      setApproveAppointment(null)
      setApproveDentistId('')
      fetchAppointments()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to approve appointment', variant: 'destructive' })
    } finally {
      setApproveSaving(false)
    }
  }

  const handleReject = async (appointment: Appointment) => {
    const ok = await confirm({
      title: `Reject appointment ${appointment.appointmentNumber}?`,
      description: `${appointment.patient.fullName || 'The patient'} will see this appointment as cancelled. This cannot be undone.`,
      confirmLabel: 'Reject',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to reject')
      }
      toast({ title: 'Appointment rejected', description: `${appointment.appointmentNumber} has been rejected.` })
      fetchAppointments()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to reject', variant: 'destructive' })
    }
  }

  const isPendingApproval = (status: string) => status === 'pending' || status === 'pending_assignment'

  const handleCreateWalkIn = async () => {
    if (!walkInForm.patientName.trim()) {
      toast({ title: 'Error', description: 'Patient name is required', variant: 'destructive' })
      return
    }
    setWalkInSaving(true)
    try {
      // 1. Create or find patient
      const patientRes = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: walkInForm.patientName.trim(),
          mobileNumber: walkInForm.mobileNumber.trim() || undefined,
        }),
      })
      const patientData = await patientRes.json()
      if (!patientRes.ok) throw new Error(patientData.error || 'Failed to create patient')
      const patientId = patientData.data?.patient?.id

      // 2. Create walk-in appointment (now, today)
      const now = new Date()
      // Philippine Time offset
      const pht = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      const scheduledDatetime = pht.toISOString().replace('Z', '+08:00')

      const apptRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          scheduledDatetime: now.toISOString(),
          durationMinutes: 30,
          appointmentType: 'walk_in',
          // Status is intentionally omitted - the server defaults to
          // pending/pending_assignment so every walk-in goes through approval.
          reasonForVisit: walkInForm.reasonForVisit || 'Walk-in visit',
          isEmergency: walkInForm.isEmergency,
          ...(walkInForm.dentistId && { dentistId: walkInForm.dentistId }),
        }),
      })
      const apptData = await apptRes.json()
      if (!apptRes.ok) throw new Error(apptData.error || 'Failed to create appointment')

      toast({
        title: 'Walk-in Added',
        description: `${walkInForm.patientName} has been added. Please assign a dentist and approve the appointment to move it into the queue.`,
      })
      setWalkInDialogOpen(false)
      setWalkInForm({ patientName: '', mobileNumber: '', reasonForVisit: '', isEmergency: false, dentistId: '' })
      fetchAppointments()
    } catch (error: any) {
      console.error('Walk-in creation error:', error)
      toast({ title: 'Error', description: error.message || 'Failed to create walk-in', variant: 'destructive' })
    }
    setWalkInSaving(false)
  }

  // Status styling
  const getStatusBadge = (status: string) => {
    const statusStyles = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'confirmed': 'bg-green-100 text-green-800',
      'checked_in': 'bg-purple-100 text-purple-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
      'no_show': 'bg-red-100 text-red-800',
      'rejected': 'bg-red-100 text-red-800',
      'pending': 'bg-amber-100 text-amber-800',
      'pending_assignment': 'bg-orange-100 text-orange-800',
      'waiting': 'bg-blue-100 text-blue-800',
    }
    
    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    )
  }

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(dentistFilter !== 'all' && { dentistId: dentistFilter }),
        ...(dateFilter !== 'all' && { date: dateFilter })
      })

      const res = await fetch(`/api/appointments?${params}`, {
        credentials: 'include'
      })
      
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.data?.appointments || [])
        setTotalPages(data.data?.pagination?.totalPages || 1)
      } else {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast({
        title: "Error",
        description: "Failed to fetch appointments",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchAppointments()
    }
  }, [session, currentPage, itemsPerPage, searchTerm, statusFilter, typeFilter, dentistFilter, dateFilter])

  // Fetch dentists for edit form
  const fetchDentists = async () => {
    try {
      const res = await fetch('/api/dentists', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDentists(data.data?.dentists || data.dentists || [])
      }
    } catch (error) {
      console.error('Error fetching dentists:', error)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchDentists()
    }
  }, [session])

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        await fetchAppointments()
        toast({ title: "Success", description: "Appointment status updated successfully" })
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update status')
      }
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast({ title: "Error", description: error.message || "Failed to update appointment status", variant: "destructive" })
    }
  }

  const openViewDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setViewDialogOpen(true)
  }

  const openEditDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    const dt = new Date(appointment.scheduledDatetime)
    setEditForm({
      scheduledDatetime: format(dt, "yyyy-MM-dd'T'HH:mm"),
      durationMinutes: appointment.durationMinutes || 30,
      appointmentType: appointment.appointmentType,
      dentistId: appointment.dentist?.id || '',
      reasonForVisit: appointment.reasonForVisit || '',
      notes: appointment.notes || '',
      estimatedCost: appointment.estimatedCost || 0,
      isEmergency: appointment.isEmergency || false,
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedAppointment) return
    setSaving(true)
    try {
      const payload: any = {
        scheduledDatetime: new Date(editForm.scheduledDatetime).toISOString(),
        durationMinutes: editForm.durationMinutes,
        appointmentType: editForm.appointmentType,
        reasonForVisit: editForm.reasonForVisit,
        notes: editForm.notes,
        estimatedCost: editForm.estimatedCost,
        isEmergency: editForm.isEmergency,
      }
      if (editForm.dentistId) {
        payload.dentistId = editForm.dentistId
      }

      const res = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        await fetchAppointments()
        setEditDialogOpen(false)
        setSelectedAppointment(null)
        toast({ title: "Success", description: "Appointment updated successfully" })
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update appointment')
      }
    } catch (error: any) {
      console.error('Error saving appointment:', error)
      toast({ title: "Error", description: error.message || "Failed to update appointment", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const getPatientName = (appointment: Appointment) => {
    return appointment.patient.fullName || 
      formatDisplayName(appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Appointment Management</h2>
          <p className="text-gray-600">Manage all clinic appointments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWalkInDialogOpen(true)} className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
            <UserPlus className="w-4 h-4 mr-2" />
            Walk-in
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Input
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_assignment">Pending Assignment</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="procedure">Procedure</SelectItem>
                <SelectItem value="surgery">Surgery</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="next_week">Next Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setStatusFilter('all')
              setTypeFilter('all')
              setDateFilter('all')
              setCurrentPage(1)
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Appointments ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appointment #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dentist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">
                      {appointment.appointmentNumber}
                      {appointment.isEmergency && (
                        <AlertCircle className="w-4 h-4 text-red-500 inline ml-2" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.patient.patientNumber}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{format(new Date(appointment.scheduledDatetime), 'MMM dd, yyyy')}</div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(appointment.scheduledDatetime), 'h:mm a')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {appointment.appointmentType.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {appointment.dentist?.user ? (
                        formatDentistName(appointment?.dentist?.user?.firstName, appointment?.dentist?.user?.lastName)
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(appointment.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openViewDialog(appointment)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(appointment)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isPendingApproval(appointment.status) ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => openApproveDialog(appointment)}
                              title="Approve & Assign Dentist"
                            >
                              <ShieldCheck className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleReject(appointment)}
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Select
                            value={appointment.status}
                            onValueChange={(value) => handleStatusChange(appointment.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="checked_in">Checked In</SelectItem>
                              <SelectItem value="waiting">Waiting</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              <SelectItem value="no_show">No Show</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {appointments.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-600">Try adjusting your filters or create a new appointment.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Appointment Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Appointment #</p>
                  <p className="font-medium">{selectedAppointment.appointmentNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedAppointment.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{getPatientName(selectedAppointment)}</p>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.patient.patientNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dentist</p>
                  <p className="font-medium">
                    {selectedAppointment.dentist?.user 
                      ? formatDentistName(selectedAppointment.dentist.user.firstName, selectedAppointment.dentist.user.lastName) 
                      : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{format(new Date(selectedAppointment.scheduledDatetime), 'MMM dd, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedAppointment.durationMinutes} minutes</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline">{selectedAppointment.appointmentType.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emergency</p>
                  <p className="font-medium">{selectedAppointment.isEmergency ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {selectedAppointment.reasonForVisit && (
                <div>
                  <p className="text-sm text-muted-foreground">Reason for Visit</p>
                  <p className="font-medium">{selectedAppointment.reasonForVisit}</p>
                </div>
              )}
              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{selectedAppointment.notes}</p>
                </div>
              )}
              {selectedAppointment.appointmentTreatments?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Treatments</p>
                  <div className="space-y-1">
                    {selectedAppointment.appointmentTreatments.map((at, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{at.treatment.name}</span>
                        <span>₱{at.treatment.baseCost?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedAppointment.estimatedCost != null && selectedAppointment.estimatedCost > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Cost</p>
                  <p className="font-medium">₱{selectedAppointment.estimatedCost.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="text-sm">{selectedAppointment.patient.emailDirect || selectedAppointment.patient.user?.email || 'N/A'}</p>
                <p className="text-sm">{selectedAppointment.patient.mobileNumber || selectedAppointment.patient.user?.phone || 'N/A'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setViewDialogOpen(false); if (selectedAppointment) openEditDialog(selectedAppointment) }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Appointment {selectedAppointment?.appointmentNumber}</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">Patient: {getPatientName(selectedAppointment)}</p>
                <p className="text-xs text-muted-foreground">{selectedAppointment.patient.patientNumber}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-2">
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.scheduledDatetime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, scheduledDatetime: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    value={editForm.durationMinutes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 30 }))}
                  />
                </div>

                <div>
                  <Label>Appointment Type</Label>
                  <Select value={editForm.appointmentType} onValueChange={(v) => setEditForm(prev => ({ ...prev, appointmentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="surgery">Surgery</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="x_ray">X-Ray</SelectItem>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Assigned Dentist</Label>
                  <Select value={editForm.dentistId || '__none__'} onValueChange={(v) => setEditForm(prev => ({ ...prev, dentistId: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select dentist" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {dentists.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {formatDentistName(d.user.firstName, d.user.lastName)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Reason for Visit</Label>
                  <Textarea
                    value={editForm.reasonForVisit}
                    onChange={(e) => setEditForm(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                    rows={2}
                    placeholder="Reason for the appointment..."
                  />
                </div>

                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Additional notes..."
                  />
                </div>

                <div>
                  <Label>Estimated Cost (₱)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.estimatedCost}
                    onChange={(e) => setEditForm(prev => ({ ...prev, estimatedCost: parseFloat(e.target.value) || 0 }))}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isEmergency"
                    checked={editForm.isEmergency}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isEmergency: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isEmergency" className="cursor-pointer">Emergency</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in Dialog */}
      <Dialog open={walkInDialogOpen} onOpenChange={setWalkInDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              Add Walk-in Patient
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient Name *</Label>
              <Input
                placeholder="Full name"
                value={walkInForm.patientName}
                onChange={e => setWalkInForm(prev => ({ ...prev, patientName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                placeholder="09XX XXX XXXX"
                value={walkInForm.mobileNumber}
                onChange={e => setWalkInForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reason for Visit</Label>
              <Textarea
                placeholder="Brief description..."
                value={walkInForm.reasonForVisit}
                onChange={e => setWalkInForm(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label>Assign Dentist (optional)</Label>
              <Select value={walkInForm.dentistId} onValueChange={v => setWalkInForm(prev => ({ ...prev, dentistId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Auto-assign later" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Auto-assign later</SelectItem>
                  {dentists.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {formatDentistName(d.user?.firstName, d.user?.lastName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="walkInEmergency"
                checked={walkInForm.isEmergency}
                onChange={e => setWalkInForm(prev => ({ ...prev, isEmergency: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="walkInEmergency" className="cursor-pointer flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Emergency (Priority Queue)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkInDialogOpen(false)} disabled={walkInSaving}>Cancel</Button>
            <Button onClick={handleCreateWalkIn} disabled={walkInSaving} className="bg-orange-600 hover:bg-orange-700">
              {walkInSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {walkInSaving ? 'Adding...' : 'Add to Queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / Assign Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Approve Appointment
            </DialogTitle>
          </DialogHeader>
          {approveAppointment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
                <p className="text-sm font-medium">
                  {approveAppointment.patient.fullName ||
                    (approveAppointment.patient.user
                      ? formatDisplayName(approveAppointment.patient.user.firstName, approveAppointment.patient.user.lastName)
                      : 'Unknown patient')}
                </p>
                <p className="text-xs text-gray-500">
                  {approveAppointment.appointmentNumber} &middot;{' '}
                  {format(new Date(approveAppointment.scheduledDatetime), 'MMM dd, yyyy h:mm a')}
                </p>
                <p className="text-xs text-gray-500">
                  {approveAppointment.appointmentType.replace(/_/g, ' ').toUpperCase()}
                  {approveAppointment.isEmergency && (
                    <span className="ml-2 inline-flex items-center text-red-600">
                      <AlertCircle className="w-3 h-3 mr-1" /> Emergency
                    </span>
                  )}
                </p>
                {approveAppointment.reasonForVisit && (
                  <p className="text-xs text-gray-600 pt-1 border-t border-gray-200 mt-2">
                    <span className="font-medium">Reason: </span>
                    {approveAppointment.reasonForVisit}
                  </p>
                )}
              </div>

              <div>
                <Label>Assign Dentist *</Label>
                <Select value={approveDentistId} onValueChange={setApproveDentistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dentist" />
                  </SelectTrigger>
                  <SelectContent>
                    {dentists.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {formatDentistName(d.user.firstName, d.user.lastName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Every appointment needs an assigned dentist before approval.
                </p>
              </div>

              <div>
                <Label>Status after approval</Label>
                <Select value={approveStatus} onValueChange={setApproveStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked_in">Checked In (today)</SelectItem>
                    <SelectItem value="waiting">Waiting (queue)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Use &ldquo;Checked In&rdquo; or &ldquo;Waiting&rdquo; when approving a walk-in that has already arrived.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={approveSaving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {approveSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {approveSaving ? 'Approving...' : 'Approve Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



'use client'

import { formatDisplayName, formatDentistName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { Calendar, Clock, User, Stethoscope, AlertTriangle, CheckCircle, FileText } from 'lucide-react'

export default function StaffBookAppointment() {
  const { data: session } = useSession() || {}
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    patientId: '',
    dentistId: '',
    appointmentType: '',
    procedures: [] as string[],
    date: '',
    time: '',
    reasonForVisit: '',
    notes: '',
    isEmergency: false
  })
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState([])
  const [dentists, setDentists] = useState([])
  const [procedures, setProcedures] = useState([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotInfo, setSlotInfo] = useState<{ totalDentists: number; clinicClosed?: boolean; closedReason?: string } | null>(null)
  const [estimatedDuration, setEstimatedDuration] = useState(30)
  const [requiredForms, setRequiredForms] = useState([])
  const [completedForms, setCompletedForms] = useState<string[]>([])

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch patients
        const patientsResponse = await fetch('/api/patients', { credentials: 'include' })
        if (patientsResponse.ok) {
          const patientsData = await patientsResponse.json()
          setPatients(patientsData.data?.patients || [])
        }

        // Fetch dentists
        const dentistsResponse = await fetch('/api/dentists', { credentials: 'include' })
        if (dentistsResponse.ok) {
          const dentistsData = await dentistsResponse.json()
          setDentists(dentistsData.data?.dentists || [])
        }

        // Fetch procedures
        const proceduresResponse = await fetch('/api/treatments', { credentials: 'include' })
        if (proceduresResponse.ok) {
          const proceduresData = await proceduresResponse.json()
          setProcedures(proceduresData.data?.treatments || [])
        }
      } catch (error) {
        console.error('Error fetching initial data:', error)
      }
    }

    if (session?.user) {
      fetchInitialData()
    }
  }, [session])

  // Fetch available time slots when date or procedures change
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!formData.date) return

      setSlotsLoading(true)
      setSlotInfo(null)
      try {
        const selectedProcedures = formData.procedures.join(',')
        const response = await fetch(
          `/api/appointments/available-slots?date=${formData.date}&procedures=${selectedProcedures}`,
          { credentials: 'include' }
        )
        if (response.ok) {
          const data = await response.json()
          setAvailableTimeSlots(data.availableSlots || [])
          setSlotInfo({
            totalDentists: data.totalDentists || 0,
            clinicClosed: data.clinicClosed || false,
            closedReason: data.closedReason || ''
          })
        }
      } catch (error) {
        console.error('Error fetching available slots:', error)
      } finally {
        setSlotsLoading(false)
      }
    }

    fetchAvailableSlots()
  }, [formData.date, formData.procedures])

  // Calculate estimated duration when procedures change
  useEffect(() => {
    if (formData.procedures.length > 0) {
      const selectedProcedures = procedures.filter((proc: any) => 
        formData.procedures.includes(proc.id)
      )
      const totalDuration = selectedProcedures.reduce((sum, proc: any) => 
        sum + (proc.estimatedDurationMinutes || 30), 0
      )
      setEstimatedDuration(totalDuration)
    } else {
      setEstimatedDuration(30)
    }
  }, [formData.procedures, procedures])

  // Check required forms when procedures change
  useEffect(() => {
    const checkRequiredForms = async () => {
      if (formData.procedures.length > 0) {
        try {
          const response = await fetch('/api/forms/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceIds: formData.procedures }),
            credentials: 'include'
          })
          
          if (response.ok) {
            const data = await response.json()
            setRequiredForms(data.data.requiredForms || [])
          }
        } catch (error) {
          console.error('Error fetching required forms:', error)
        }
      } else {
        setRequiredForms([])
      }
    }

    checkRequiredForms()
  }, [formData.procedures])

  // Fetch completed forms for selected patient
  useEffect(() => {
    const fetchCompletedForms = async () => {
      if (formData.patientId) {
        try {
          const response = await fetch(`/api/forms?patientId=${formData.patientId}`, { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            const forms = data.data?.forms || []
            const completed = forms
              .filter((f: any) => f.status === 'completed' || f.status === 'submitted')
              .map((f: any) => f.documentType)
            setCompletedForms(completed)
          }
        } catch (error) {
          console.error('Error fetching completed forms:', error)
        }
      } else {
        setCompletedForms([])
      }
    }

    fetchCompletedForms()
  }, [formData.patientId])

  const appointmentTypes = [
    'consultation',
    'cleaning',
    'procedure',
    'surgery',
    'emergency',
    'follow_up',
    'x_ray'
  ]

  const handleProcedureToggle = (procedureId: string) => {
    setFormData(prev => ({
      ...prev,
      procedures: prev.procedures.includes(procedureId)
        ? prev.procedures.filter(p => p !== procedureId)
        : [...prev.procedures, procedureId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validation
      if (!formData.patientId) {
        throw new Error('Please select a patient')
      }

      if (!formData.appointmentType) {
        throw new Error('Please select appointment type')
      }

      if (!formData.date || !formData.time) {
        throw new Error('Please select date and time')
      }

      // Combine date and time
      const scheduledDatetime = new Date(`${formData.date}T${formData.time}:00`)
      
      const appointmentData = {
        patientId: formData.patientId,
        dentistId: formData.dentistId || undefined,
        appointmentType: formData.appointmentType,
        scheduledDatetime: scheduledDatetime.toISOString(),
        durationMinutes: estimatedDuration,
        reasonForVisit: formData.reasonForVisit || null,
        isEmergency: formData.isEmergency,
        procedures: formData.procedures,
        notes: formData.notes || `Booked by staff. ${formData.dentistId ? 'Dentist assigned.' : 'Dentist to be assigned.'}`
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to book appointment')
      }

      const result = await response.json()

      toast({
        title: "Appointment Booked Successfully!",
        description: `Appointment ${result.data.appointmentNumber} has been created.`,
      })

      // Reset form
      setFormData({
        patientId: '',
        dentistId: '',
        appointmentType: '',
        procedures: [],
        date: '',
        time: '',
        reasonForVisit: '',
        notes: '',
        isEmergency: false
      })

    } catch (error) {
      console.error('Booking error:', error)
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user || !['receptionist', 'staff', 'admin', 'manager'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Book Appointment">
        <div className="text-center py-8">
          <p className="text-gray-600">Access denied. Staff access required.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Book Appointment">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Book New Appointment</h1>
          <p className="text-gray-600">Schedule an appointment for any patient</p>
          <p className="text-sm text-blue-600 mt-2">Staff can book appointments and assign dentists</p>
        </div>

        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patient Selection */}
                <div className="space-y-2">
                  <Label htmlFor="patient">Select Patient *</Label>
                  <Select
                    value={formData.patientId}
                    onValueChange={(value) => setFormData({...formData, patientId: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {(patients || []).map((patient: any) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {formatDisplayName(patient.user?.firstName, patient.user?.lastName)}
                          {patient.user?.email && ` (${patient.user.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dentist Selection (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="dentist">Assign Dentist (Optional)</Label>
                  <Select
                    value={formData.dentistId || '__later__'}
                    onValueChange={(value) => setFormData({...formData, dentistId: value === '__later__' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose dentist or leave unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__later__">Assign later</SelectItem>
                      {(dentists || []).map((dentist: any) => (
                        <SelectItem key={dentist.id} value={dentist.id}>
                          {formatDentistName(dentist.user?.firstName, dentist.user?.lastName)}
                          {dentist.specialization && ` - ${dentist.specialization}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointmentType">Appointment Type *</Label>
                <Select
                  value={formData.appointmentType}
                  onValueChange={(value) => setFormData({...formData, appointmentType: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select appointment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(appointmentTypes || []).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Procedures Selection */}
              <div className="space-y-3">
                <Label>Select Procedures (Optional)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {procedures.map((procedure: any) => (
                    <div key={procedure.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`proc-${procedure.id}`}
                        checked={formData.procedures.includes(procedure.id)}
                        onChange={() => handleProcedureToggle(procedure.id)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`proc-${procedure.id}`} className="text-sm">
                        <div className="font-medium">{procedure.name}</div>
                        <div className="text-xs text-gray-500">
                          {procedure.estimatedDurationMinutes} min - ₱{parseFloat(procedure.baseCost).toFixed(2)}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                {formData.procedures.length > 0 && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    Estimated duration: {estimatedDuration} minutes
                  </div>
                )}
              </div>

              {/* Required Forms Section */}
              {requiredForms.length > 0 && formData.patientId && (
                <div className="space-y-3">
                  <Label className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Required Forms for Selected Patient & Services</span>
                  </Label>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 mb-3">
                      The following forms are required before the appointment:
                    </p>
                    <div className="space-y-2">
                      {requiredForms.map((form: any) => {
                        const isCompleted = completedForms.includes(form.id)
                        return (
                          <div key={form.id} className="flex items-center justify-between p-2 bg-white border rounded">
                            <div className="flex items-center space-x-3">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                              )}
                              <div>
                                <div className="font-medium text-sm">{form.title}</div>
                                <div className="text-xs text-gray-600">
                                  {form.category} • {form.estimatedTime}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {isCompleted ? (
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                  Completed
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {requiredForms.some((form: any) => !completedForms.includes(form.id)) && (
                      <div className="mt-3 p-2 bg-amber-100 rounded text-sm text-amber-800">
                        <strong>Note:</strong> Patient needs to complete missing forms before the appointment.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date">Appointment Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Available Time Slots *</Label>
                  {(() => {
                    const slotsList = availableTimeSlots as any[]
                    const hasAnySelectable = slotsList.some(s => s.available !== false)
                    const hasNoSlots = slotsList.length === 0
                    return (
                      <>
                        <Select
                          value={formData.time}
                          onValueChange={(value) => setFormData({...formData, time: value})}
                          required
                          disabled={!formData.date || slotsLoading || !hasAnySelectable}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !formData.date 
                                ? "Select date first" 
                                : slotsLoading
                                  ? "Loading slots..."
                                  : !hasAnySelectable
                                    ? "No slots available" 
                                    : "Select available time"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {slotsList.map((slot: any) => {
                              const isDisabled = slot.available === false
                              return (
                                <SelectItem key={slot.time} value={slot.time} disabled={isDisabled}>
                                  <div className={`flex justify-between items-center w-full ${isDisabled ? 'opacity-50' : ''}`}>
                                    <span className={isDisabled ? 'line-through' : ''}>{slot.time}</span>
                                    <span className="text-xs text-gray-500 ml-4">
                                      {slot.full
                                        ? `Full (${slot.booked ?? 0}/${slot.capacity ?? 0})`
                                        : `${slot.availableDentists ?? 0} dentist${(slot.availableDentists ?? 0) !== 1 ? 's' : ''} free`}
                                    </span>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                        {formData.date && !slotsLoading && (hasNoSlots || !hasAnySelectable) && slotInfo && (
                          <div className="text-sm mt-1">
                            {slotInfo.clinicClosed ? (
                              <p className="text-orange-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {slotInfo.closedReason || 'Clinic is closed on this date'}
                              </p>
                            ) : slotInfo.totalDentists === 0 ? (
                              <p className="text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                No dentists are currently available in the system. Please add dentists first via the Staff Management page.
                              </p>
                            ) : (
                              <p className="text-red-500">No available time slots for the selected date. All slots are fully booked.</p>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Visit</Label>
                <Textarea
                  id="reason"
                  placeholder="Brief description of the visit purpose..."
                  value={formData.reasonForVisit}
                  onChange={(e) => setFormData({...formData, reasonForVisit: e.target.value})}
                  className="min-h-20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Staff Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Internal notes, special instructions, etc..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="min-h-20"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="emergency"
                  checked={formData.isEmergency}
                  onChange={(e) => setFormData({...formData, isEmergency: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="emergency" className="text-sm font-medium">
                  Mark as emergency appointment
                </Label>
              </div>

              <div className="flex space-x-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Booking...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Appointment
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => router.push('/admin/scheduling')}
                  className="px-8"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}


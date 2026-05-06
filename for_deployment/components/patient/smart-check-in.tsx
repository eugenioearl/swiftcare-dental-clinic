
'use client'

import { formatDisplayName, formatDentistName, formatPatientName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { RealTimeQueueDisplay } from '@/components/queue/real-time-queue-display'
import { 
  Clock, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  Bell, 
  FileText,
  Calendar,
  MapPin,
  Phone,
  Heart,
  Shield,
  QrCode
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import QRCode from 'react-qr-code'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  appointmentType: string
  reasonForVisit?: string
  status: string
  durationMinutes: number
  dentist?: {
    user: { firstName: string; lastName: string }
  }
  patient: {
    id: string
    fullName?: string | null
    user?: { firstName: string; lastName: string; phone?: string } | null
    patientNumber: string
  }
}

interface SmartCheckInProps {
  patientId?: string
  appointmentId?: string
  qrMode?: boolean
}

export function SmartCheckIn({ patientId, appointmentId, qrMode = false }: SmartCheckInProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [checkInStep, setCheckInStep] = useState<'search' | 'verify' | 'forms' | 'complete'>('search')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [searchData, setSearchData] = useState({
    appointmentNumber: '',
    lastName: '',
    phone: '',
    dateOfBirth: ''
  })
  const [preCheckInData, setPreCheckInData] = useState({
    hasFormsCompleted: false,
    reasonForVisit: '',
    emergencyContact: '',
    emergencyPhone: '',
    currentMedications: '',
    allergies: '',
    symptoms: '',
    painLevel: '',
    insuranceUpdated: false,
    consentUpdated: false,
    specialInstructions: ''
  })
  const [queuePosition, setQueuePosition] = useState<{
    position: number
    estimatedWaitTime: number
  } | null>(null)

  // Auto-load appointment if IDs are provided
  useEffect(() => {
    if (appointmentId) {
      loadAppointment(appointmentId)
    } else if (patientId) {
      findTodaysAppointment(patientId)
    } else {
      setLoading(false)
    }
  }, [appointmentId, patientId])

  const loadAppointment = async (aptId: string) => {
    try {
      const response = await fetch(`/api/appointments/${aptId}`)
      if (response.ok) {
        const data = await response.json()
        setAppointment(data.data.appointment)
        setCheckInStep('verify')
      } else {
        toast({
          title: "Appointment not found",
          description: "Please check your appointment details.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error loading appointment:', error)
      toast({
        title: "Error",
        description: "Failed to load appointment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const findTodaysAppointment = async (pId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/appointments?patientId=${pId}&date=${today}`)
      if (response.ok) {
        const data = await response.json()
        const todaysAppointments = data.data?.appointments || []
        
        if (todaysAppointments.length > 0) {
          // Get the next appointment for today
          const nextAppointment = todaysAppointments
            .filter((apt: Appointment) => !['completed', 'cancelled'].includes(apt.status))
            .sort((a: Appointment, b: Appointment) => 
              new Date(a.scheduledDatetime).getTime() - new Date(b.scheduledDatetime).getTime()
            )[0]

          if (nextAppointment) {
            setAppointment(nextAppointment)
            setCheckInStep('verify')
          }
        }
      }
    } catch (error) {
      console.error('Error finding appointment:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchAppointment = async () => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (searchData.appointmentNumber) searchParams.set('appointmentNumber', searchData.appointmentNumber)
      if (searchData.lastName) searchParams.set('lastName', searchData.lastName)
      if (searchData.phone) searchParams.set('phone', searchData.phone)
      if (searchData.dateOfBirth) searchParams.set('dateOfBirth', searchData.dateOfBirth)
      
      const today = new Date().toISOString().split('T')[0]
      searchParams.set('date', today)

      const response = await fetch(`/api/appointments?${searchParams.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const appointments = data.data?.appointments || []
        
        if (appointments.length > 0) {
          setAppointment(appointments[0])
          setCheckInStep('verify')
        } else {
          toast({
            title: "No appointment found",
            description: "No appointment found with the provided information for today.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('Error searching appointment:', error)
      toast({
        title: "Search failed",
        description: "Failed to search for appointment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const performCheckIn = async () => {
    if (!appointment) return

    setLoading(true)
    try {
      // Update appointment status to checked_in
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'checked_in',
          checkedInAt: new Date().toISOString(),
          metadata: {
            checkInData: preCheckInData,
            checkInTimestamp: new Date().toISOString(),
            checkInMethod: qrMode ? 'qr_code' : 'manual'
          }
        })
      })

      if (response.ok) {
        // Get queue position
        const positionResponse = await fetch('/api/queue/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: appointment.id })
        })

        if (positionResponse.ok) {
          const positionData = await positionResponse.json()
          setQueuePosition({
            position: positionData.data.position,
            estimatedWaitTime: positionData.data.estimatedWaitTime
          })
        }

        setCheckInStep('complete')
        
        toast({
          title: "Check-in successful!",
          description: "You have been added to the queue.",
        })

        // Send notification to staff
        try {
          await fetch('/api/queue/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId: appointment.id,
              message: `${formatDisplayName(appointment?.patient?.user?.firstName, appointment?.patient?.user?.lastName)} has checked in.`,
              channel: 'internal'
            })
          })
        } catch (notifyError) {
          console.error('Error sending staff notification:', notifyError)
        }

      } else {
        throw new Error('Check-in failed')
      }
    } catch (error) {
      console.error('Error during check-in:', error)
      toast({
        title: "Check-in failed",
        description: "Failed to check in. Please see the front desk.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const requestEmergency = async () => {
    try {
      const response = await fetch('/api/queue/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency: true,
          reason: 'Emergency walk-in via kiosk'
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Emergency request submitted",
          description: "Staff has been notified. Please wait at the front desk.",
        })
      }
    } catch (error) {
      toast({
        title: "Request failed",
        description: "Unable to submit emergency request. Please see the front desk immediately.",
        variant: "destructive",
      })
    }
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
      {checkInStep === 'search' && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Find Your Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Appointment Number (if available)</Label>
              <Input
                placeholder="e.g., APT-2024-0001"
                value={searchData.appointmentNumber}
                onChange={(e) => setSearchData(prev => ({ ...prev, appointmentNumber: e.target.value }))}
              />
            </div>
            
            <div className="text-center text-gray-500 text-sm">OR</div>
            
            <div className="space-y-3">
              <div>
                <Label>Last Name</Label>
                <Input
                  placeholder="Your last name"
                  value={searchData.lastName}
                  onChange={(e) => setSearchData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="Your phone number"
                  value={searchData.phone}
                  onChange={(e) => setSearchData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={searchData.dateOfBirth}
                  onChange={(e) => setSearchData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                />
              </div>
            </div>

            <Button 
              onClick={searchAppointment} 
              className="w-full"
              disabled={!searchData.appointmentNumber && !searchData.lastName}
            >
              Find Appointment
            </Button>

            <div className="text-center pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full text-red-600 border-red-300 hover:bg-red-50"
                onClick={requestEmergency}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emergency / Walk-in
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {checkInStep === 'verify' && appointment && (
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Verify Your Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">
                {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{format(parseISO(appointment.scheduledDatetime), 'PPPP')}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{format(parseISO(appointment.scheduledDatetime), 'h:mm a')} ({appointment.durationMinutes} minutes)</span>
                </div>
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{appointment.appointmentType.replace('_', ' ').toUpperCase()}</span>
                </div>
                {appointment.dentist && (
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    <span>{formatDentistName(appointment?.dentist?.user?.firstName, appointment?.dentist?.user?.lastName)}</span>
                  </div>
                )}
                {appointment.reasonForVisit && (
                  <div className="flex items-start">
                    <FileText className="w-4 h-4 mr-2 text-gray-500 mt-0.5" />
                    <span>{appointment.reasonForVisit}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => setCheckInStep('forms')} 
                className="w-full"
              >
                Yes, This is My Appointment
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCheckInStep('search')} 
                className="w-full"
              >
                No, Search Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {checkInStep === 'forms' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Pre-Visit Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Reason for Today's Visit</Label>
                <Textarea
                  placeholder="Describe your symptoms or reason for the visit..."
                  value={preCheckInData.reasonForVisit}
                  onChange={(e) => setPreCheckInData(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pain Level (0-10)</Label>
                  <Select 
                    value={preCheckInData.painLevel} 
                    onValueChange={(value) => setPreCheckInData(prev => ({ ...prev, painLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pain level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - No Pain</SelectItem>
                      <SelectItem value="1-3">1-3 - Mild Pain</SelectItem>
                      <SelectItem value="4-6">4-6 - Moderate Pain</SelectItem>
                      <SelectItem value="7-8">7-8 - Severe Pain</SelectItem>
                      <SelectItem value="9-10">9-10 - Worst Pain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Current Symptoms</Label>
                  <Input
                    placeholder="e.g., swelling, sensitivity"
                    value={preCheckInData.symptoms}
                    onChange={(e) => setPreCheckInData(prev => ({ ...prev, symptoms: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Current Medications</Label>
                <Textarea
                  placeholder="List any medications you're currently taking..."
                  value={preCheckInData.currentMedications}
                  onChange={(e) => setPreCheckInData(prev => ({ ...prev, currentMedications: e.target.value }))}
                  rows={2}
                />
              </div>

              <div>
                <Label>Allergies</Label>
                <Input
                  placeholder="List any allergies (medications, materials, etc.)"
                  value={preCheckInData.allergies}
                  onChange={(e) => setPreCheckInData(prev => ({ ...prev, allergies: e.target.value }))}
                />
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Confirmations
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="forms-completed"
                      checked={preCheckInData.hasFormsCompleted}
                      onCheckedChange={(checked) => 
                        setPreCheckInData(prev => ({ ...prev, hasFormsCompleted: checked === true }))
                      }
                    />
                    <Label htmlFor="forms-completed" className="text-sm">
                      I have completed all required forms online
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="insurance-updated"
                      checked={preCheckInData.insuranceUpdated}
                      onCheckedChange={(checked) => 
                        setPreCheckInData(prev => ({ ...prev, insuranceUpdated: checked === true }))
                      }
                    />
                    <Label htmlFor="insurance-updated" className="text-sm">
                      My insurance information is up to date
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="consent-updated"
                      checked={preCheckInData.consentUpdated}
                      onCheckedChange={(checked) => 
                        setPreCheckInData(prev => ({ ...prev, consentUpdated: checked === true }))
                      }
                    />
                    <Label htmlFor="consent-updated" className="text-sm">
                      I acknowledge the treatment consent forms
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={performCheckIn} 
              className="w-full"
              disabled={!preCheckInData.reasonForVisit}
            >
              Complete Check-In
            </Button>
          </CardContent>
        </Card>
      )}

      {checkInStep === 'complete' && appointment && (
        <div className="max-w-lg mx-auto space-y-6">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-900 mb-2">Check-In Complete!</h2>
              <p className="text-green-700 mb-4">
                You have successfully checked in for your appointment.
              </p>
              
              {queuePosition && (
                <div className="bg-white p-4 rounded-lg mb-4">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    #{queuePosition.position}
                  </div>
                  <p className="text-gray-700 mb-2">Your position in queue</p>
                  <div className="text-lg font-semibold text-indigo-600">
                    Estimated wait: ~{queuePosition.estimatedWaitTime} minutes
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm text-green-700">
                <p>• Please take a seat in the waiting area</p>
                <p>• You will be called when it's your turn</p>
                <p>• For urgent matters, please see the front desk</p>
              </div>
            </CardContent>
          </Card>

          {/* Live Queue Status */}
          <RealTimeQueueDisplay 
            patientId={appointment.id}
            refreshInterval={30000}
          />

          {/* QR Code for future check-ins */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <QrCode className="w-4 h-4 mr-2" />
                Quick Check-In QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCode 
                  value={`${window.location.origin}/patient/check-in?apt=${appointment.id}`}
                  size={120}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Save this QR code for faster check-in next time
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

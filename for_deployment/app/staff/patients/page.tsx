'use client'

import { formatDisplayName, formatDentistName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Mail,
  MapPin,
  Calendar,
  FileText,
  Eye,
  Edit,
  Plus,
  User,
  Activity,
  AlertTriangle,
  Heart,
  Pill
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Patient {
  id: string
  patientNumber: string
  fullName?: string | null
  mobileNumber?: string | null
  emailDirect?: string | null
  dateOfBirth: string
  gender?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  medicalHistory?: string
  allergies?: string
  currentMedications?: string
  insuranceProvider?: string
  isActive?: boolean
  user?: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    isActive: boolean
  } | null
  appointments?: Array<{
    id: string
    scheduledDatetime: string
    status: string
    appointmentType: string
    reasonForVisit?: string
    dentist?: {
      user: {
        firstName: string
        lastName: string
      }
    }
  }>
  totalVisits?: number
  lastVisit?: string
  nextAppointment?: string
}

export default function StaffPatientsPage() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const router = useRouter()
  
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false)
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [newPatientDialogOpen, setNewPatientDialogOpen] = useState(false)
  const [editPatientDialogOpen, setEditPatientDialogOpen] = useState(false)
  
  // New patient form
  const [newPatientForm, setNewPatientForm] = useState({
    fullName: '',
    mobileNumber: '',
    emailDirect: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    medicalHistory: '',
    allergies: '',
    currentMedications: '',
    insuranceProvider: ''
  })

  // Booking form
  const [bookingForm, setBookingForm] = useState({
    appointmentType: '',
    reasonForVisit: '',
    scheduledDatetime: '',
    dentistId: '',
    durationMinutes: '30',
    isEmergency: false
  })

  const [dentists, setDentists] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patients
        const patientsResponse = await fetch('/api/patients?isActive=true')
        if (patientsResponse.ok) {
          const patientsData = await patientsResponse.json()
          setPatients(patientsData.data?.patients || [])
        }

        // Fetch dentists
        const dentistsResponse = await fetch('/api/dentists')
        if (dentistsResponse.ok) {
          const dentistsData = await dentistsResponse.json()
          setDentists(dentistsData.data?.dentists || [])
        }

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user && ['receptionist', 'staff', 'admin', 'manager', 'super_admin', 'dentist'].includes(session.user.role)) {
      fetchData()
    }
  }, [session])

  // Helper to get display name for a patient
  const getPatientName = (p: Patient) => {
    if (p.fullName) return p.fullName
    if (p.user) return formatDisplayName(p.user.firstName, p.user.lastName)
    return 'Unknown'
  }

  const getPatientEmail = (p: Patient) => p.user?.email || p.emailDirect || ''
  const getPatientPhone = (p: Patient) => p.user?.phone || p.mobileNumber || ''

  const filteredPatients = patients.filter(patient => {
    const name = getPatientName(patient).toLowerCase()
    const email = getPatientEmail(patient).toLowerCase()
    const phone = getPatientPhone(patient).toLowerCase()
    const term = searchTerm.toLowerCase()
    return name.includes(term) ||
      patient.patientNumber?.toLowerCase().includes(term) ||
      email.includes(term) ||
      phone.includes(term)
  })

  const openPatientDetails = async (patient: Patient) => {
    try {
      // Fetch patient's appointments
      const appointmentsResponse = await fetch(`/api/appointments?patientId=${patient.id}`)
      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json()
        const appointments = appointmentsData.data?.appointments || []
        
        // Calculate stats
        const lastVisit = appointments
          .filter((apt: any) => apt.status === 'completed')
          .sort((a: any, b: any) => new Date(b.scheduledDatetime).getTime() - new Date(a.scheduledDatetime).getTime())[0]
        
        const nextAppointment = appointments
          .filter((apt: any) => ['scheduled', 'confirmed'].includes(apt.status))
          .sort((a: any, b: any) => new Date(a.scheduledDatetime).getTime() - new Date(b.scheduledDatetime).getTime())[0]

        const enhancedPatient = {
          ...patient,
          appointments,
          totalVisits: appointments.filter((apt: any) => apt.status === 'completed').length,
          lastVisit: lastVisit?.scheduledDatetime,
          nextAppointment: nextAppointment?.scheduledDatetime
        }

        setSelectedPatient(enhancedPatient)
        setPatientDetailsOpen(true)
      }
    } catch (error) {
      console.error('Error fetching patient details:', error)
      setSelectedPatient(patient)
      setPatientDetailsOpen(true)
    }
  }

  const openBookingDialog = (patient: Patient) => {
    setSelectedPatient(patient)
    setBookingForm({
      appointmentType: '',
      reasonForVisit: '',
      scheduledDatetime: '',
      dentistId: '',
      durationMinutes: '30',
      isEmergency: false
    })
    setBookingDialogOpen(true)
  }

  const handleCreatePatient = async () => {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPatientForm)
      })

      if (response.ok) {
        const result = await response.json()
        setPatients(prev => [...prev, result.data.patient])
        
        toast({
          title: "Patient created",
          description: "New patient has been added to the system.",
        })
        
        setNewPatientDialogOpen(false)
        setNewPatientForm({
          fullName: '',
          mobileNumber: '',
          emailDirect: '',
          dateOfBirth: '',
          gender: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          medicalHistory: '',
          allergies: '',
          currentMedications: '',
          insuranceProvider: ''
        })
      } else {
        const err = await response.json()
        throw new Error(err.error || 'Failed to create patient')
      }
    } catch (error: any) {
      console.error('Error creating patient:', error)
      toast({
        title: "Error",
        description: error?.message || "Failed to create patient. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBookAppointment = async () => {
    if (!selectedPatient) return

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          ...bookingForm,
          durationMinutes: parseInt(bookingForm.durationMinutes)
        })
      })

      if (response.ok) {
        toast({
          title: "Appointment booked",
          description: "Appointment has been scheduled successfully.",
        })
        
        setBookingDialogOpen(false)
      } else {
        throw new Error('Failed to book appointment')
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      toast({
        title: "Error",
        description: "Failed to book appointment. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!session?.user || !['receptionist', 'staff', 'admin', 'manager', 'super_admin', 'dentist'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Patient Directory">
        <div className="text-center py-8">
          <p className="text-gray-600">Access denied. Staff access required.</p>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout title="Patient Directory">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Patient Directory">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Directory</h1>
            <p className="text-gray-600">Manage patient records and appointments</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button onClick={() => setNewPatientDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              New Patient
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">{patients.length}</div>
                  <p className="text-sm text-gray-600">Total Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">
                    {patients.filter(p => p.isActive !== false && (p.user?.isActive !== false)).length}
                  </div>
                  <p className="text-sm text-gray-600">Active Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserPlus className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">
                    {patients.filter(p => {
                      return false // Placeholder logic
                    }).length}
                  </div>
                  <p className="text-sm text-gray-600">New This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Heart className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <div className="text-2xl font-bold">
                    {patients.filter(p => p.allergies || p.currentMedications).length}
                  </div>
                  <p className="text-sm text-gray-600">With Conditions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help Banner - Show when no patients exist */}
        {patients.length === 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <UserPlus className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">No Patients Yet</h3>
                  <p className="text-blue-800 mb-3">
                    This is the patient directory where you can view and manage all clinic patients. To get started, click the "New Patient" button above to register your first patient.
                  </p>
                  <p className="text-blue-700 text-sm">
                    <strong>Tip:</strong> Once you add patients, you'll be able to view their details, book appointments, and manage their medical records from this page.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patients Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Patients ({filteredPatients.length})
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPatients.length > 0 ? (
              <div className="space-y-3">
                {filteredPatients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base break-anywhere">
                            {getPatientName(patient)}
                          </h4>
                          {!patient.user && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs whitespace-nowrap">No Account</Badge>
                          )}
                          {patient.user && !patient.user.isActive && (
                            <Badge className="bg-gray-100 text-gray-800 text-[10px] sm:text-xs whitespace-nowrap">Inactive</Badge>
                          )}
                          {patient.allergies && (
                            <Badge className="bg-red-100 text-red-800 text-[10px] sm:text-xs whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Allergies
                            </Badge>
                          )}
                          {patient.currentMedications && (
                            <Badge className="bg-orange-100 text-orange-800 text-[10px] sm:text-xs whitespace-nowrap">
                              <Pill className="w-3 h-3 mr-1" />
                              Meds
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-600 mt-1">
                          <span className="font-mono whitespace-nowrap">{patient.patientNumber}</span>
                          {getPatientEmail(patient) && (
                            <span className="flex items-start gap-1 min-w-0">
                              <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                              <span className="break-anywhere">{getPatientEmail(patient)}</span>
                            </span>
                          )}
                          {getPatientPhone(patient) && (
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              {getPatientPhone(patient)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2 sm:flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPatientDetails(patient)}
                        className="w-full sm:w-auto"
                      >
                        <Eye className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/staff/patients/${patient.id}`)}
                        className="w-full sm:w-auto"
                      >
                        <FileText className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Records</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openBookingDialog(patient)}
                        className="w-full sm:w-auto"
                      >
                        <Calendar className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Book</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
                <p className="text-gray-600">No patients match your search criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Patient Dialog */}
        <Dialog open={newPatientDialogOpen} onOpenChange={setNewPatientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>
                Create a new patient record with their basic information.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Juan Dela Cruz"
                  value={newPatientForm.fullName}
                  onChange={(e) => setNewPatientForm({...newPatientForm, fullName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <Input
                  id="mobileNumber"
                  placeholder="e.g. 09171234567"
                  value={newPatientForm.mobileNumber}
                  onChange={(e) => setNewPatientForm({...newPatientForm, mobileNumber: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="emailDirect">Email</Label>
                <Input
                  id="emailDirect"
                  type="email"
                  placeholder="Optional"
                  value={newPatientForm.emailDirect}
                  onChange={(e) => setNewPatientForm({...newPatientForm, emailDirect: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={newPatientForm.dateOfBirth}
                  onChange={(e) => setNewPatientForm({...newPatientForm, dateOfBirth: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select onValueChange={(value) => setNewPatientForm({...newPatientForm, gender: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newPatientForm.address}
                  onChange={(e) => setNewPatientForm({...newPatientForm, address: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newPatientForm.city}
                  onChange={(e) => setNewPatientForm({...newPatientForm, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={newPatientForm.state}
                  onChange={(e) => setNewPatientForm({...newPatientForm, state: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactName">Emergency Contact</Label>
                <Input
                  id="emergencyContactName"
                  value={newPatientForm.emergencyContactName}
                  onChange={(e) => setNewPatientForm({...newPatientForm, emergencyContactName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Emergency Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  value={newPatientForm.emergencyContactPhone}
                  onChange={(e) => setNewPatientForm({...newPatientForm, emergencyContactPhone: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  value={newPatientForm.allergies}
                  onChange={(e) => setNewPatientForm({...newPatientForm, allergies: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPatientDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePatient}
                disabled={!newPatientForm.fullName}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Patient
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking Dialog */}
        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
              <DialogDescription>
                {selectedPatient && `Book an appointment for ${getPatientName(selectedPatient)}`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="appointmentType">Appointment Type *</Label>
                <Select onValueChange={(value) => setBookingForm({...bookingForm, appointmentType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="procedure">Procedure (Filling / Crown / Root Canal / Extraction)</SelectItem>
                    <SelectItem value="surgery">Surgery</SelectItem>
                    <SelectItem value="x_ray">X-Ray</SelectItem>
                    <SelectItem value="follow_up">Follow-Up</SelectItem>
                    <SelectItem value="walk_in">Walk-In</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dentist">Dentist</Label>
                <Select onValueChange={(value) => setBookingForm({...bookingForm, dentistId: value === '__auto__' ? '' : value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dentist (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-assign</SelectItem>
                    {dentists.map((dentist) => (
                      <SelectItem key={dentist.id} value={dentist.id}>
                        {formatDentistName(dentist.user?.firstName, dentist.user?.lastName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="scheduledDatetime">Date & Time *</Label>
                <Input
                  id="scheduledDatetime"
                  type="datetime-local"
                  value={bookingForm.scheduledDatetime}
                  onChange={(e) => setBookingForm({...bookingForm, scheduledDatetime: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="reasonForVisit">Reason for Visit</Label>
                <Textarea
                  id="reasonForVisit"
                  value={bookingForm.reasonForVisit}
                  onChange={(e) => setBookingForm({...bookingForm, reasonForVisit: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBookAppointment}
                disabled={!bookingForm.appointmentType || !bookingForm.scheduledDatetime}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Patient Details Dialog - Same as in dentist page but simplified */}
        <Dialog open={patientDetailsOpen} onOpenChange={setPatientDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Patient Profile
              </DialogTitle>
            </DialogHeader>
            
            {selectedPatient && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <p className="text-gray-900">{getPatientName(selectedPatient)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Patient ID</label>
                        <p className="text-gray-900">{selectedPatient.patientNumber}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <p className="text-gray-900">{getPatientEmail(selectedPatient) || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Phone</label>
                        <p className="text-gray-900">{getPatientPhone(selectedPatient) || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Medical Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Allergies</label>
                        <p className="text-gray-900">{selectedPatient.allergies || 'No known allergies'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Current Medications</label>
                        <p className="text-gray-900">{selectedPatient.currentMedications || 'None'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Insurance</label>
                        <p className="text-gray-900">{selectedPatient.insuranceProvider || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Total Visits</label>
                        <p className="text-gray-900">{selectedPatient.totalVisits || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Appointments */}
                {selectedPatient.appointments && selectedPatient.appointments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recent Appointments</h3>
                    <div className="space-y-2">
                      {selectedPatient.appointments
                        .sort((a, b) => new Date(b.scheduledDatetime).getTime() - new Date(a.scheduledDatetime).getTime())
                        .slice(0, 5)
                        .map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {appointment.appointmentType.charAt(0).toUpperCase() + appointment.appointmentType.slice(1)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {appointment.reasonForVisit || 'No reason provided'}
                            </p>
                            {appointment.dentist && (
                              <p className="text-sm text-blue-600">
                                {formatDentistName(appointment?.dentist?.user?.firstName, appointment?.dentist?.user?.lastName)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {format(parseISO(appointment.scheduledDatetime), 'MMM d, yyyy')}
                            </p>
                            <Badge 
                              className={`text-xs ${
                                appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPatientDetailsOpen(false)}>
                Close
              </Button>
              <Button onClick={() => selectedPatient && openBookingDialog(selectedPatient)}>
                <Calendar className="w-4 h-4 mr-2" />
                Book Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
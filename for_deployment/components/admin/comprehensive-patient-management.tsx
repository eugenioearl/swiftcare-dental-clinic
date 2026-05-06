
'use client'

import { formatPatientName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { 
  Users, Search, UserPlus, Edit, Trash2, Download, Upload, Filter, 
  MoreVertical, Phone, Mail, Calendar, MapPin, FileText, Heart,
  Shield, CreditCard, AlertCircle, CheckCircle2, Eye
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format, parse } from 'date-fns'

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
  insurancePolicyNumber?: string
  profilePicture?: string | null
  profilePictureCloudPath?: string | null
  profilePictureUrl?: string | null
  isActive: boolean
  createdAt: string
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    phone?: string
    isActive: boolean
  } | null
  _count?: {
    appointments: number
    billing: number
  }
}

export default function ComprehensivePatientManagement() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const router = useRouter()
  
  // State management
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [genderFilter, setGenderFilter] = useState('all')
  const [insuranceFilter, setInsuranceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Portal account toggle: when off, patient is created without a login (no email/password required)
  const [createPortalAccount, setCreatePortalAccount] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    // User fields
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    
    // Patient fields
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    medicalHistory: '',
    allergies: '',
    currentMedications: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceGroupNumber: '',
    preferredLanguage: 'English',
    communicationPreference: 'email'
  })

  // Fetch patients
  const fetchPatients = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { isActive: statusFilter === 'active' ? 'true' : 'false' })
      })

      const res = await fetch(`/api/patients?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPatients(data.data?.patients || [])
        setTotalPages(data.data?.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
      toast({
        title: "Error",
        description: "Failed to fetch patients",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Apply local filters and sorting
  useEffect(() => {
    let filtered = [...patients]

    // Apply filters
    if (genderFilter !== 'all') {
      filtered = filtered.filter(p => p.gender === genderFilter)
    }
    if (insuranceFilter !== 'all') {
      if (insuranceFilter === 'insured') {
        filtered = filtered.filter(p => p.insuranceProvider)
      } else if (insuranceFilter === 'uninsured') {
        filtered = filtered.filter(p => !p.insuranceProvider)
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortBy) {
        case 'name':
          aVal = formatPatientName(a.fullName, a.user?.firstName, a.user?.lastName, '').toLowerCase()
          bVal = formatPatientName(b.fullName, b.user?.firstName, b.user?.lastName, '').toLowerCase()
          break
        case 'patientNumber':
          aVal = a.patientNumber
          bVal = b.patientNumber
          break
        case 'createdAt':
          aVal = new Date(a.createdAt)
          bVal = new Date(b.createdAt)
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredPatients(filtered)
  }, [patients, genderFilter, insuranceFilter, sortBy, sortOrder])

  // Load data
  useEffect(() => {
    if (session?.user) {
      fetchPatients()
    }
  }, [session, currentPage, itemsPerPage, searchTerm, statusFilter])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const method = selectedPatient ? 'PUT' : 'POST'
      const url = selectedPatient ? `/api/patients/${selectedPatient.id}` : '/api/patients'

      // Build the payload — only include email/password when portal account is being created
      const payload: any = { ...formData }
      if (!selectedPatient && !createPortalAccount) {
        // Patient without a portal login — drop credentials and map email -> emailDirect
        if (payload.email) {
          payload.emailDirect = payload.email
        }
        delete payload.email
        delete payload.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: `Patient ${selectedPatient ? 'updated' : 'created'} successfully`,
        })
        setShowCreateDialog(false)
        setShowEditDialog(false)
        resetForm()
        fetchPatients()
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save patient')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save patient",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '', firstName: '', lastName: '', phone: '', password: '',
      dateOfBirth: '', gender: '', address: '', city: '', state: '', zipCode: '',
      emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
      medicalHistory: '', allergies: '', currentMedications: '',
      insuranceProvider: '', insurancePolicyNumber: '', insuranceGroupNumber: '',
      preferredLanguage: 'English', communicationPreference: 'email'
    })
    setSelectedPatient(null)
    setCreatePortalAccount(false)
  }

  // Handle edit
  const handleEdit = (patient: Patient) => {
    setSelectedPatient(patient)
    setFormData({
      email: patient.user?.email || patient.emailDirect || '',
      firstName: patient.user?.firstName || patient.fullName?.split(' ')[0] || '',
      lastName: patient.user?.lastName || patient.fullName?.split(' ').slice(1).join(' ') || '',
      phone: patient.user?.phone || patient.mobileNumber || '',
      password: '',
      dateOfBirth: patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'yyyy-MM-dd') : '',
      gender: patient.gender || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
      emergencyContactRelationship: '',
      medicalHistory: patient.medicalHistory || '',
      allergies: patient.allergies || '',
      currentMedications: patient.currentMedications || '',
      insuranceProvider: patient.insuranceProvider || '',
      insurancePolicyNumber: patient.insurancePolicyNumber || '',
      insuranceGroupNumber: '',
      preferredLanguage: 'English',
      communicationPreference: 'email'
    })
    setShowEditDialog(true)
  }

  // Handle view details
  const handleView = (patient: Patient) => {
    setSelectedPatient(patient)
    setShowViewDialog(true)
  }

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedPatients.length === 0) return
    
    try {
      const res = await fetch('/api/patients/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientIds: selectedPatients })
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Patients Deleted",
          description: `${data.data?.deletedCount || selectedPatients.length} patient(s) removed successfully`,
        })
        setSelectedPatients([])
        fetchPatients()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete patients",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete patients",
        variant: "destructive",
      })
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/patients/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patientIds: selectedPatients.length > 0 ? selectedPatients : undefined,
          filters: { statusFilter, genderFilter, insuranceFilter, searchTerm }
        })
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `patients-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export patients",
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Patient Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Comprehensive patient records and management</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {selectedPatients.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 sm:flex-none sm:size-default">
                <Download className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export Selected</span>
                <span className="sm:hidden">Export ({selectedPatients.length})</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)} className="flex-1 sm:flex-none sm:size-default">
                <Trash2 className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Delete Selected ({selectedPatients.length})</span>
                <span className="sm:hidden">Delete ({selectedPatients.length})</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 sm:flex-none sm:size-default">
            <Download className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Export All</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-none sm:size-default">
            <UserPlus className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Add Patient</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Patients</p>
                <p className="text-lg sm:text-2xl font-bold">{patients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Active Patients</p>
                <p className="text-lg sm:text-2xl font-bold">{patients.filter(p => p.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Insured</p>
                <p className="text-lg sm:text-2xl font-bold">{patients.filter(p => p.insuranceProvider).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">This Month</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {patients.filter(p => {
                    const created = new Date(p.createdAt)
                    const now = new Date()
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 sm:items-center">
            <div className="w-full sm:flex-1 sm:min-w-[260px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, patient number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 sm:items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={insuranceFilter} onValueChange={setInsuranceFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Insurance</SelectItem>
                  <SelectItem value="insured">Insured</SelectItem>
                  <SelectItem value="uninsured">Uninsured</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Created</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="patientNumber">Patient #</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="text-base sm:text-lg">Patient Directory ({filteredPatients.length})</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground sm:hidden">Show:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-[80px] sm:w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPatients.length > 0 ? (
            <div className="space-y-4">
              {/* Mobile / Tablet Card View (shown below xl breakpoint) */}
              <div className="xl:hidden space-y-3">
                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="border rounded-lg p-3 bg-white hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1 flex-shrink-0"
                        checked={selectedPatients.includes(patient.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPatients([...selectedPatients, patient.id])
                          } else {
                            setSelectedPatients(selectedPatients.filter(id => id !== patient.id))
                          }
                        }}
                      />
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold cursor-pointer" onClick={() => router.push(`/admin/patients/${patient.id}`)}>
                        {patient.profilePictureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={patient.profilePictureUrl}
                            alt={formatPatientName(patient.fullName, patient.user?.firstName, patient.user?.lastName, 'Patient')}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>
                            {((patient.user?.firstName || patient.fullName || 'P').charAt(0) +
                              (patient.user?.lastName || patient.fullName?.split(' ').slice(-1)[0] || '').charAt(0)).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/admin/patients/${patient.id}`)}>
                        <p className="font-medium text-sm truncate hover:text-primary transition-colors">
                          {formatPatientName(patient.fullName, patient.user?.firstName, patient.user?.lastName, 'Unknown')}
                        </p>
                        <p className="text-xs text-gray-500">#{patient.patientNumber}</p>
                        {patient.dateOfBirth && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Born: {format(new Date(patient.dateOfBirth), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                      {/* Action Icons - Always visible on mobile */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => router.push(`/admin/patients/${patient.id}`)}
                          title="Open full record"
                        >
                          <FileText className="w-4 h-4 text-teal-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleView(patient)}
                          title="Quick view"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(patient)}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                      </div>
                    </div>
                    {/* Secondary Info Row */}
                    <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                      {(patient.user?.email || patient.emailDirect) && (
                        <span className="flex items-center gap-1 truncate max-w-full">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{patient.user?.email || patient.emailDirect}</span>
                        </span>
                      )}
                      {(patient.user?.phone || patient.mobileNumber) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {patient.user?.phone || patient.mobileNumber}
                        </span>
                      )}
                      <Badge variant={patient.isActive ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 h-5">
                        {patient.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {patient.insuranceProvider && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
                          {patient.insuranceProvider}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (xl and above) */}
              <div className="hidden xl:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]" />
                      <TableHead>Patient Info</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedPatients.includes(patient.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPatients([...selectedPatients, patient.id])
                              } else {
                                setSelectedPatients(selectedPatients.filter(id => id !== patient.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="cursor-pointer hover:text-primary transition-colors flex items-center gap-3" onClick={() => router.push(`/admin/patients/${patient.id}`)}>
                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold">
                              {patient.profilePictureUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={patient.profilePictureUrl}
                                  alt={formatPatientName(patient.fullName, patient.user?.firstName, patient.user?.lastName, 'Patient')}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>
                                  {((patient.user?.firstName || patient.fullName || 'P').charAt(0) +
                                    (patient.user?.lastName || patient.fullName?.split(' ').slice(-1)[0] || '').charAt(0)).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{formatPatientName(patient.fullName, patient.user?.firstName, patient.user?.lastName, 'Unknown')}</p>
                              <p className="text-sm text-gray-500">#{patient.patientNumber}</p>
                              {patient.dateOfBirth && (
                                <p className="text-xs text-gray-400">
                                  Born: {format(new Date(patient.dateOfBirth), 'MMM dd, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {patient.user?.email || patient.emailDirect || 'N/A'}
                            </div>
                            {(patient.user?.phone || patient.mobileNumber) && (
                              <div className="flex items-center text-sm">
                                <Phone className="w-3 h-3 mr-1" />
                                {patient.user?.phone || patient.mobileNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {patient.insuranceProvider ? (
                            <div>
                              <Badge variant="secondary">{patient.insuranceProvider}</Badge>
                              {patient.insurancePolicyNumber && (
                                <p className="text-xs text-gray-500 mt-1">#{patient.insurancePolicyNumber}</p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">No Insurance</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={patient.isActive ? 'default' : 'secondary'}>
                            {patient.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{format(new Date(patient.createdAt), 'MMM dd, yyyy')}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/patients/${patient.id}`)}
                              title="Open full record"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(patient)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(patient)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredPatients.length)} to {Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length} patients
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Patient
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Patient Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
            <DialogDescription>Enter patient information to create a new patient record.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <form onSubmit={handleSubmit} className="space-y-6 pr-4">
              <Tabs defaultValue="personal">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="medical">Medical</TabsTrigger>
                  <TabsTrigger value="insurance">Insurance</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">
                        Email {createPortalAccount && !selectedPatient ? '*' : <span className="text-gray-400 font-normal">(optional)</span>}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required={createPortalAccount && !selectedPatient}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
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
                  </div>

                  {/* Portal account toggle — hide on edit */}
                  {!selectedPatient && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createPortalAccount}
                          onChange={(e) => setCreatePortalAccount(e.target.checked)}
                          className="w-4 h-4 mt-0.5 accent-[#2D9DA8]"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Create patient portal login</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Give this patient an online account so they can book appointments, view records, and sign forms themselves. Requires an email and a password.
                          </p>
                        </div>
                      </label>
                      {createPortalAccount && (
                        <div>
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Minimum 6 characters"
                            required
                            minLength={6}
                          />
                          <p className="text-xs text-gray-500 mt-1">Share this password with the patient so they can sign in.</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contact" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="preferredLanguage">Preferred Language</Label>
                      <Select value={formData.preferredLanguage} onValueChange={(value) => setFormData({ ...formData, preferredLanguage: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Spanish">Spanish</SelectItem>
                          <SelectItem value="French">French</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      />
                    </div>
                  </div>
                  <Separator />
                  <h4 className="font-medium">Emergency Contact</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="space-y-4">
                  <div>
                    <Label htmlFor="medicalHistory">Medical History</Label>
                    <Textarea
                      id="medicalHistory"
                      value={formData.medicalHistory}
                      onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currentMedications">Current Medications</Label>
                    <Textarea
                      id="currentMedications"
                      value={formData.currentMedications}
                      onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="insurance" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                      <Input
                        id="insuranceProvider"
                        value={formData.insuranceProvider}
                        onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                      <Input
                        id="insurancePolicyNumber"
                        value={formData.insurancePolicyNumber}
                        onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="insuranceGroupNumber">Group Number</Label>
                    <Input
                      id="insuranceGroupNumber"
                      value={formData.insuranceGroupNumber}
                      onChange={(e) => setFormData({ ...formData, insuranceGroupNumber: e.target.value })}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update patient information.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            {/* Same form as create, but populated with existing data */}
            <form onSubmit={handleSubmit} className="space-y-6 pr-4">
              {/* Form content similar to create dialog */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              {/* More form fields... */}
            </form>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Patient Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Complete patient information and history
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            {selectedPatient && (
              <div className="space-y-6 pr-4">
                <div className="flex flex-col sm:flex-row items-start gap-2 sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold break-words">
                      {formatPatientName(selectedPatient.fullName, selectedPatient.user?.firstName, selectedPatient.user?.lastName, 'Unknown')}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600">Patient #{selectedPatient.patientNumber}</p>
                  </div>
                  <Badge variant={selectedPatient.isActive ? 'default' : 'secondary'}>
                    {selectedPatient.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="medical">Medical</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Personal Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Date of Birth</p>
                            <p>{selectedPatient.dateOfBirth ? format(new Date(selectedPatient.dateOfBirth), 'MMMM dd, yyyy') : 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Gender</p>
                            <p>{selectedPatient.gender || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Email</p>
                            <p>{selectedPatient.user?.email || selectedPatient.emailDirect || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Phone</p>
                            <p>{selectedPatient.user?.phone || selectedPatient.mobileNumber || 'Not provided'}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedPatient.address ? (
                            <div className="space-y-1">
                              <p>{selectedPatient.address}</p>
                              <p>
                                {selectedPatient.city}, {selectedPatient.state} {selectedPatient.zipCode}
                              </p>
                            </div>
                          ) : (
                            <p className="text-gray-500">No address on file</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {(selectedPatient.emergencyContactName || selectedPatient.emergencyContactPhone) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Emergency Contact</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedPatient.emergencyContactName && (
                              <p><strong>Name:</strong> {selectedPatient.emergencyContactName}</p>
                            )}
                            {selectedPatient.emergencyContactPhone && (
                              <p><strong>Phone:</strong> {selectedPatient.emergencyContactPhone}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="medical" className="space-y-4">
                    <div className="grid gap-4">
                      {selectedPatient.medicalHistory && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                              <Heart className="w-5 h-5 mr-2 text-red-500" />
                              Medical History
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap">{selectedPatient.medicalHistory}</p>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPatient.allergies && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                              <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                              Allergies
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap">{selectedPatient.allergies}</p>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPatient.currentMedications && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                              <FileText className="w-5 h-5 mr-2 text-blue-500" />
                              Current Medications
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap">{selectedPatient.currentMedications}</p>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPatient.insuranceProvider && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                              <Shield className="w-5 h-5 mr-2 text-purple-500" />
                              Insurance Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p><strong>Provider:</strong> {selectedPatient.insuranceProvider}</p>
                              {selectedPatient.insurancePolicyNumber && (
                                <p><strong>Policy Number:</strong> {selectedPatient.insurancePolicyNumber}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="appointments">
                    <Card>
                      <CardHeader>
                        <CardTitle>Appointment History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500">Appointment history will be displayed here</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="billing">
                    <Card>
                      <CardHeader>
                        <CardTitle>Billing History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500">Billing history will be displayed here</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewDialog(false)
              if (selectedPatient) handleEdit(selectedPatient)
            }}>
              Edit Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedPatients.length} patient${selectedPatients.length === 1 ? '' : 's'}?`}
        description={
          <>
            You are about to permanently delete <strong>{selectedPatients.length}</strong> patient record{selectedPatients.length === 1 ? '' : 's'} along with their associated data. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Patients"
        variant="destructive"
      />
    </div>
  )
}

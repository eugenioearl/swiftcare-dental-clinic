
'use client'

import { formatDisplayName, getInitials } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Users, Search, UserPlus, Edit, Trash2, Download, Upload, Filter, 
  MoreVertical, Phone, Mail, Calendar, MapPin, FileText, Shield,
  Stethoscope, Briefcase, GraduationCap, Award, Clock,
  Eye, Settings, UserCheck, UserX, Building, Star
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface StaffMember {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: string
  isActive: boolean
  createdAt: string
  department?: string
  position?: string
  // Dentist specific
  dentist?: {
    id: string
    licenseNumber: string
    licenseState: string
    licenseExpiryDate?: string
    specialization?: string
    bio?: string
    education?: string
    certifications?: string
    yearsExperience?: number
    isActive: boolean
  }
  // Staff specific
  staff?: {
    id: string
    employeeId: string
    department: string
    position: string
    hireDate: string
    hourlyRate?: number
    supervisorId?: string
    isActive: boolean
  }
}

export default function ComprehensiveStaffManagement() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  
  // State management
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedStaffMember, setSelectedStaffMember] = useState<StaffMember | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    // User fields
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    role: 'staff' as string,
    
    // Common staff fields
    employeeId: '',
    department: '',
    position: '',
    hireDate: '',
    salary: '',
    
    // Dentist fields
    licenseNumber: '',
    licenseState: '',
    licenseExpiryDate: '',
    specialization: '',
    bio: '',
    education: '',
    certifications: '',
    yearsExperience: '',
    
    // Staff fields
    certification: '',
    skills: ''
  })

  // Departments list
  const departments = [
    'Clinical',
    'Front Office',
    'Administration',
    'Hygiene',
    'Radiology',
    'Laboratory',
    'Billing',
    'IT',
    'Marketing',
    'Operations'
  ]

  // Positions by role
  const positionsByRole = {
    dentist: ['General Dentist', 'Orthodontist', 'Periodontist', 'Endodontist', 'Oral Surgeon', 'Pediatric Dentist'],
    staff: ['Dental Assistant', 'Dental Hygienist', 'Lab Technician', 'Radiology Tech'],
    receptionist: ['Front Desk Receptionist', 'Patient Coordinator', 'Insurance Coordinator'],
    manager: ['Clinic Manager', 'Office Manager', 'Operations Manager', 'Practice Administrator']
  }

  // Fetch staff
  const fetchStaff = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { isActive: statusFilter === 'active' ? 'true' : 'false' })
      })

      const res = await fetch(`/api/staff?${params}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setStaff(data.data?.staff || [])
        setTotalPages(data.data?.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
      toast({
        title: "Error",
        description: "Failed to fetch staff members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Apply local filters and sorting
  useEffect(() => {
    let filtered = [...staff]

    // Apply filters
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(s => s.department === departmentFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortBy) {
        case 'name':
          aVal = formatDisplayName(a.firstName, a.lastName, '').toLowerCase()
          bVal = formatDisplayName(b.firstName, b.lastName, '').toLowerCase()
          break
        case 'role':
          aVal = a.role
          bVal = b.role
          break
        case 'department':
          aVal = a.department || ''
          bVal = b.department || ''
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

    setFilteredStaff(filtered)
  }, [staff, departmentFilter, sortBy, sortOrder])

  // Load data
  useEffect(() => {
    if (session?.user) {
      fetchStaff()
    }
  }, [session, currentPage, itemsPerPage, searchTerm, roleFilter, statusFilter])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        ...formData,
        hourlyRate: formData.salary ? parseFloat(formData.salary) : undefined,
        yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : undefined,
        hireDate: formData.hireDate || new Date().toISOString().split('T')[0]
      }

      const method = selectedStaffMember ? 'PUT' : 'POST'
      const url = selectedStaffMember ? `/api/staff/${selectedStaffMember.id}` : '/api/staff'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: `Staff member ${selectedStaffMember ? 'updated' : 'created'} successfully`,
        })
        setShowCreateDialog(false)
        resetForm()
        fetchStaff()
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save staff member')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save staff member",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '', firstName: '', lastName: '', phone: '', password: '', role: 'staff',
      employeeId: '', department: '', position: '', hireDate: '', salary: '',
      licenseNumber: '', licenseState: '', licenseExpiryDate: '', specialization: '',
      bio: '', education: '', certifications: '', yearsExperience: '',
      certification: '', skills: ''
    })
    setSelectedStaffMember(null)
  }

  // Handle edit
  const handleEdit = (staffMember: StaffMember) => {
    setSelectedStaffMember(staffMember)
    setFormData({
      email: staffMember.email,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      phone: staffMember.phone || '',
      password: '',
      role: staffMember.role,
      employeeId: staffMember.staff?.employeeId || '',
      department: staffMember.department || '',
      position: staffMember.position || '',
      hireDate: staffMember.staff?.hireDate ? format(new Date(staffMember.staff.hireDate), 'yyyy-MM-dd') : '',
      salary: staffMember.staff?.hourlyRate?.toString() || '',
      licenseNumber: staffMember.dentist?.licenseNumber || '',
      licenseState: staffMember.dentist?.licenseState || '',
      licenseExpiryDate: staffMember.dentist?.licenseExpiryDate ? format(new Date(staffMember.dentist.licenseExpiryDate), 'yyyy-MM-dd') : '',
      specialization: staffMember.dentist?.specialization || '',
      bio: staffMember.dentist?.bio || '',
      education: staffMember.dentist?.education || '',
      certifications: staffMember.dentist?.certifications || '',
      yearsExperience: staffMember.dentist?.yearsExperience?.toString() || '',
      certification: '',
      skills: ''
    })
    setShowCreateDialog(true)
  }

  // Handle view details
  const handleView = (staffMember: StaffMember) => {
    setSelectedStaffMember(staffMember)
    setShowViewDialog(true)
  }

  // Get role badge color
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'dentist': return 'default'
      case 'manager': return 'secondary'
      case 'receptionist': return 'outline'
      case 'staff': return 'outline'
      default: return 'outline'
    }
  }

  // Get department icon
  const getDepartmentIcon = (department: string) => {
    switch (department) {
      case 'Clinical': return <Stethoscope className="w-4 h-4" />
      case 'Administration': return <Briefcase className="w-4 h-4" />
      case 'Front Office': return <Building className="w-4 h-4" />
      default: return <Building className="w-4 h-4" />
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage clinic staff, roles, and permissions</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {selectedStaff.length > 0 && (
            <Button variant="destructive" size="sm" className="sm:size-default">
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete Selected ({selectedStaff.length})</span>
              <span className="sm:hidden ml-1">Del ({selectedStaff.length})</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="sm:size-default">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export Staff</span>
            <span className="sm:hidden ml-1">Export</span>
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true) }} size="sm" className="sm:size-default">
            <UserPlus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Staff Member</span>
            <span className="sm:hidden ml-1">Add Staff</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Staff</p>
                <p className="text-lg sm:text-2xl font-bold">{staff.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Dentists</p>
                <p className="text-lg sm:text-2xl font-bold">{staff.filter(s => s.role === 'dentist').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Building className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Support Staff</p>
                <p className="text-lg sm:text-2xl font-bold">{staff.filter(s => s.role === 'staff').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Active</p>
                <p className="text-lg sm:text-2xl font-bold">{staff.filter(s => s.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Managers</p>
                <p className="text-lg sm:text-2xl font-bold">{staff.filter(s => s.role === 'manager').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <div className="w-full sm:flex-1 sm:min-w-[260px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, employee ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="dentist">Dentists</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="receptionist">Receptionists</SelectItem>
                <SelectItem value="manager">Managers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Added</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="role">Role</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Staff Directory ({filteredStaff.length})</CardTitle>
            <div className="flex items-center gap-2">
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
        <CardContent className="p-3 sm:p-6">
          {filteredStaff.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop view: full table (xl and above) */}
              <div className="hidden xl:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedStaff.length === filteredStaff.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStaff(filteredStaff.map(s => s.id))
                            } else {
                              setSelectedStaff([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Role & Department</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Employment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staffMember) => (
                      <TableRow key={staffMember.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedStaff.includes(staffMember.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStaff([...selectedStaff, staffMember.id])
                              } else {
                                setSelectedStaff(selectedStaff.filter(id => id !== staffMember.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-primary">
                                {getInitials(staffMember.firstName, staffMember.lastName)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{formatDisplayName(staffMember.firstName, staffMember.lastName)}</p>
                              <p className="text-sm text-gray-500">
                                {staffMember.staff?.employeeId || `ID: ${staffMember.id.slice(0, 8)}`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Badge variant={getRoleBadgeVariant(staffMember.role)}>
                                {staffMember.role}
                              </Badge>
                            </div>
                            {staffMember.department && (
                              <div className="flex items-center text-sm text-gray-600">
                                {getDepartmentIcon(staffMember.department)}
                                <span className="ml-1">{staffMember.department}</span>
                              </div>
                            )}
                            {staffMember.position && (
                              <p className="text-xs text-gray-500">{staffMember.position}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {staffMember.email}
                            </div>
                            {staffMember.phone && (
                              <div className="flex items-center text-sm">
                                <Phone className="w-3 h-3 mr-1" />
                                {staffMember.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {staffMember.staff?.hireDate && (
                              <div className="flex items-center mb-1">
                                <Calendar className="w-3 h-3 mr-1" />
                                Hired: {format(new Date(staffMember.staff.hireDate), 'MMM yyyy')}
                              </div>
                            )}
                            {staffMember.dentist?.yearsExperience && (
                              <div className="flex items-center">
                                <Award className="w-3 h-3 mr-1" />
                                {staffMember.dentist.yearsExperience}+ years exp
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={staffMember.isActive ? 'default' : 'secondary'}>
                            {staffMember.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(staffMember)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(staffMember)}
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

              {/* Mobile/Tablet view: card list (no checkbox column) */}
              <div className="xl:hidden space-y-3">
                {filteredStaff.map((staffMember) => (
                  <div
                    key={staffMember.id}
                    className="border rounded-lg p-3 hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {getInitials(staffMember.firstName, staffMember.lastName)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm break-words">
                            {formatDisplayName(staffMember.firstName, staffMember.lastName)}
                          </p>
                          <Badge variant={getRoleBadgeVariant(staffMember.role)} className="text-[10px]">
                            {staffMember.role}
                          </Badge>
                          <Badge variant={staffMember.isActive ? 'default' : 'secondary'} className="text-[10px]">
                            {staffMember.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 break-all">
                          {staffMember.staff?.employeeId || `ID: ${staffMember.id.slice(0, 8)}`}
                        </p>
                        {(staffMember.department || staffMember.position) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1 text-xs text-gray-600">
                            {staffMember.department && (
                              <span className="inline-flex items-center">
                                {getDepartmentIcon(staffMember.department)}
                                <span className="ml-1">{staffMember.department}</span>
                              </span>
                            )}
                            {staffMember.position && (
                              <span className="text-gray-500">• {staffMember.position}</span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 space-y-0.5">
                          <p className="flex items-center text-xs text-gray-700 break-all">
                            <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                            {staffMember.email}
                          </p>
                          {staffMember.phone && (
                            <p className="flex items-center text-xs text-gray-700">
                              <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                              {staffMember.phone}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(staffMember)}
                            className="h-8 px-2 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(staffMember)}
                            className="h-8 px-2 text-xs"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <p className="text-xs sm:text-sm text-gray-600">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredStaff.length)} to {Math.min(currentPage * itemsPerPage, filteredStaff.length)} of {filteredStaff.length} staff members
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No staff members found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true) }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Staff Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Staff Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedStaffMember ? 'Edit Staff Member' : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription>
              {selectedStaffMember
                ? `Update details for ${formatDisplayName(selectedStaffMember.firstName, selectedStaffMember.lastName)}.`
                : 'Enter staff member information to create a new employee record.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <form onSubmit={handleSubmit} className="space-y-6 pr-4">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                  <TabsTrigger value="professional">Professional</TabsTrigger>
                  <TabsTrigger value="additional">Additional</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
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
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">
                        {selectedStaffMember ? 'New Password (optional)' : 'Password *'}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!selectedStaffMember}
                        placeholder={selectedStaffMember ? 'Leave blank to keep current password' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role *</Label>
                      <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dentist">Dentist</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="receptionist">Receptionist</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="employment" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department *</Label>
                      <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="position">Position *</Label>
                      <Select value={formData.position} onValueChange={(value) => setFormData({ ...formData, position: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          {positionsByRole[formData.role as keyof typeof positionsByRole]?.map(pos => (
                            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                          )) || <SelectItem value="General">General</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="hireDate">Hire Date</Label>
                      <Input
                        id="hireDate"
                        type="date"
                        value={formData.hireDate}
                        onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                      />
                    </div>
                    {formData.role !== 'dentist' && (
                      <div>
                        <Label htmlFor="salary">Hourly Rate ($)</Label>
                        <Input
                          id="salary"
                          type="number"
                          step="0.01"
                          value={formData.salary}
                          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="professional" className="space-y-4">
                  {formData.role === 'dentist' ? (
                    <div className="space-y-4">
                      <h4 className="font-medium">Dentist Professional Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <Label htmlFor="licenseNumber">License Number *</Label>
                          <Input
                            id="licenseNumber"
                            value={formData.licenseNumber}
                            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                            required={formData.role === 'dentist'}
                          />
                        </div>
                        <div>
                          <Label htmlFor="licenseState">License State *</Label>
                          <Input
                            id="licenseState"
                            value={formData.licenseState}
                            onChange={(e) => setFormData({ ...formData, licenseState: e.target.value })}
                            required={formData.role === 'dentist'}
                          />
                        </div>
                        <div>
                          <Label htmlFor="licenseExpiryDate">License Expiry Date</Label>
                          <Input
                            id="licenseExpiryDate"
                            type="date"
                            value={formData.licenseExpiryDate}
                            onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="yearsExperience">Years of Experience</Label>
                          <Input
                            id="yearsExperience"
                            type="number"
                            value={formData.yearsExperience}
                            onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="specialization">Specialization</Label>
                        <Input
                          id="specialization"
                          value={formData.specialization}
                          onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                          placeholder="e.g., General Dentistry, Orthodontics, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor="education">Education</Label>
                        <Textarea
                          id="education"
                          value={formData.education}
                          onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="certifications">Certifications</Label>
                        <Textarea
                          id="certifications"
                          value={formData.certifications}
                          onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="font-medium">Professional Information</h4>
                      <div className="text-sm text-gray-600">
                        <p>Additional professional information and certifications can be managed separately.</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="additional" className="space-y-4">
                  {formData.role === 'dentist' && (
                    <div>
                      <Label htmlFor="bio">Professional Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows={4}
                        placeholder="Professional biography for patient-facing materials..."
                      />
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <p>Additional information and notes can be added after the staff member is created.</p>
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
              {isSubmitting
                ? (selectedStaffMember ? 'Updating...' : 'Creating...')
                : (selectedStaffMember ? 'Update Staff Member' : 'Create Staff Member')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Staff Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Staff Member Details</DialogTitle>
            <DialogDescription>
              Complete staff member information and professional details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            {selectedStaffMember && (
              <div className="space-y-6 pr-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xl font-medium text-primary">
                        {getInitials(selectedStaffMember.firstName, selectedStaffMember.lastName)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {formatDisplayName(selectedStaffMember.firstName, selectedStaffMember.lastName)}
                      </h2>
                      <p className="text-gray-600">{selectedStaffMember.position} • {selectedStaffMember.department}</p>
                      <p className="text-sm text-gray-500">
                        Employee ID: {selectedStaffMember.staff?.employeeId || selectedStaffMember.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={selectedStaffMember.isActive ? 'default' : 'secondary'}>
                      {selectedStaffMember.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant={getRoleBadgeVariant(selectedStaffMember.role)} className="ml-2">
                      {selectedStaffMember.role}
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="professional">Professional</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Email</p>
                            <p>{selectedStaffMember.email}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Phone</p>
                            <p>{selectedStaffMember.phone || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Added</p>
                            <p>{format(new Date(selectedStaffMember.createdAt), 'MMMM dd, yyyy')}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Employment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Department</p>
                            <p>{selectedStaffMember.department}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Position</p>
                            <p>{selectedStaffMember.position}</p>
                          </div>
                          {selectedStaffMember.staff?.hireDate && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Hire Date</p>
                              <p>{format(new Date(selectedStaffMember.staff.hireDate), 'MMMM dd, yyyy')}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="professional" className="space-y-4">
                    {selectedStaffMember.dentist ? (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                              <Shield className="w-5 h-5 mr-2 text-blue-500" />
                              License Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-600">License Number</p>
                                <p>{selectedStaffMember.dentist.licenseNumber}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-600">License State</p>
                                <p>{selectedStaffMember.dentist.licenseState}</p>
                              </div>
                            </div>
                            {selectedStaffMember.dentist.licenseExpiryDate && (
                              <div>
                                <p className="text-sm font-medium text-gray-600">Expiry Date</p>
                                <p>{format(new Date(selectedStaffMember.dentist.licenseExpiryDate), 'MMMM dd, yyyy')}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {selectedStaffMember.dentist.specialization && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center">
                                <Stethoscope className="w-5 h-5 mr-2 text-green-500" />
                                Specialization
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p>{selectedStaffMember.dentist.specialization}</p>
                            </CardContent>
                          </Card>
                        )}

                        {selectedStaffMember.dentist.education && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center">
                                <GraduationCap className="w-5 h-5 mr-2 text-purple-500" />
                                Education
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="whitespace-pre-wrap">{selectedStaffMember.dentist.education}</p>
                            </CardContent>
                          </Card>
                        )}

                        {selectedStaffMember.dentist.certifications && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center">
                                <Award className="w-5 h-5 mr-2 text-orange-500" />
                                Certifications
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="whitespace-pre-wrap">{selectedStaffMember.dentist.certifications}</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Professional Information</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-gray-500">Additional professional information and certifications can be added through the employee profile system.</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="schedule">
                    <Card>
                      <CardHeader>
                        <CardTitle>Schedule & Availability</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500">Schedule management coming soon</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="performance">
                    <Card>
                      <CardHeader>
                        <CardTitle>Performance Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500">Performance tracking coming soon</p>
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
              if (selectedStaffMember) handleEdit(selectedStaffMember)
            }}>
              Edit Staff Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

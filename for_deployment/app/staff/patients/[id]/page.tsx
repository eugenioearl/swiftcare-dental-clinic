'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, User, Calendar, FileText, Activity, Upload, Stethoscope,
  Plus, Edit, Eye, Trash2, Search, Clock, AlertTriangle, Heart,
  Pill, Phone, Mail, MapPin, ChevronRight, Download, CheckCircle,
  XCircle, Loader2, ClipboardList, StickyNote, BarChart3, Save, X,
  FileImage, Shield
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useRouter, useParams } from 'next/navigation'

interface Patient {
  id: string
  patientNumber: string
  fullName: string | null
  mobileNumber: string | null
  emailDirect: string | null
  dateOfBirth: string | null
  gender: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  medicalHistory: string | null
  allergies: string | null
  currentMedications: string | null
  insuranceProvider: string | null
  insurancePolicyNumber: string | null
  insuranceGroupNumber: string | null
  occupation: string | null
  nationality: string | null
  remarks: string | null
  dentalAnxieties: string | null
  previousDentist: string | null
  pregnancyStatus: string | null
  bloodPressureHistory: string | null
  preferredLanguage: string
  communicationPreference: string | null
  isActive: boolean
  createdAt: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  } | null
}

interface TimelineItem {
  id: string
  type: 'visit' | 'procedure' | 'note' | 'chart' | 'upload'
  date: string
  title: string
  subtitle: string
  dentist: string | null
  status: string
  data: any
}

const typeIcons: Record<string, any> = {
  visit: Calendar,
  procedure: Stethoscope,
  note: StickyNote,
  chart: BarChart3,
  upload: Upload,
}

const typeColors: Record<string, string> = {
  visit: 'bg-blue-100 text-blue-700',
  procedure: 'bg-purple-100 text-purple-700',
  note: 'bg-yellow-100 text-yellow-700',
  chart: 'bg-green-100 text-green-700',
  upload: 'bg-orange-100 text-orange-700',
}

export default function PatientDetailPage() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [patient, setPatient] = useState<Patient | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [timelineFilter, setTimelineFilter] = useState('')
  const [timelineSearch, setTimelineSearch] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<any>({})
  const [savingProfile, setSavingProfile] = useState(false)

  // Dialog states
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [showProcedureDialog, setShowProcedureDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [detailItem, setDetailItem] = useState<TimelineItem | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  // Visit form
  const [visitForm, setVisitForm] = useState({
    visitDate: new Date().toISOString().slice(0, 16),
    appointmentType: '', attendingDentist: '', chiefComplaint: '',
    findings: '', diagnosis: '', treatmentDone: '', prescriptions: '',
    followUpInstructions: '', followUpDate: '', status: 'completed',
  })

  // Procedure form
  const [procedureForm, setProcedureForm] = useState({
    procedureType: '', procedureDate: new Date().toISOString().slice(0, 10),
    dentistName: '', teethInvolved: '', notesBefore: '', notesAfter: '',
    complications: '', followUpRecs: '', status: 'completed',
  })

  // Note form
  const [noteForm, setNoteForm] = useState({
    noteType: 'general', content: '', isInternal: false,
  })

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [editedExtraction, setEditedExtraction] = useState<any>(null)

  const fetchPatient = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}`)
      const data = await res.json()
      if (data.success) setPatient(data.data)
    } catch (err) {
      console.error('Fetch patient error:', err)
    }
  }, [patientId])

  const fetchTimeline = useCallback(async () => {
    try {
      const qp = new URLSearchParams()
      if (timelineFilter) qp.set('type', timelineFilter)
      if (timelineSearch) qp.set('search', timelineSearch)
      const res = await fetch(`/api/patients/${patientId}/timeline?${qp}`)
      const data = await res.json()
      if (data.success) setTimeline(data.data)
    } catch (err) {
      console.error('Fetch timeline error:', err)
    }
  }, [patientId, timelineFilter, timelineSearch])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchPatient(), fetchTimeline()])
      setLoading(false)
    }
    load()
  }, [fetchPatient, fetchTimeline])

  // Save profile
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Profile updated successfully' })
        setEditingProfile(false)
        fetchPatient()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error saving profile', variant: 'destructive' })
    }
    setSavingProfile(false)
  }

  // Create visit
  const handleCreateVisit = async () => {
    setDialogSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitForm),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Visit record created' })
        setShowVisitDialog(false)
        setVisitForm({ visitDate: new Date().toISOString().slice(0, 16), appointmentType: '', attendingDentist: '', chiefComplaint: '', findings: '', diagnosis: '', treatmentDone: '', prescriptions: '', followUpInstructions: '', followUpDate: '', status: 'completed' })
        fetchTimeline()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error creating visit', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Create procedure
  const handleCreateProcedure = async () => {
    setDialogSaving(true)
    try {
      const payload = {
        ...procedureForm,
        teethInvolved: procedureForm.teethInvolved ? procedureForm.teethInvolved.split(',').map((t: string) => t.trim()) : [],
      }
      const res = await fetch(`/api/patients/${patientId}/procedures`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Procedure record created' })
        setShowProcedureDialog(false)
        setProcedureForm({ procedureType: '', procedureDate: new Date().toISOString().slice(0, 10), dentistName: '', teethInvolved: '', notesBefore: '', notesAfter: '', complications: '', followUpRecs: '', status: 'completed' })
        fetchTimeline()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error creating procedure', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Create note
  const handleCreateNote = async () => {
    setDialogSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Clinical note created' })
        setShowNoteDialog(false)
        setNoteForm({ noteType: 'general', content: '', isInternal: false })
        fetchTimeline()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error creating note', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Smart upload
  const handleSmartUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      const res = await fetch(`/api/patients/${patientId}/smart-upload`, {
        method: 'POST', body: fd,
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: data.warning ? 'File uploaded (extraction failed)' : 'File uploaded & extracted' })
        setShowUploadDialog(false)
        setUploadFile(null)
        if (data.data?.extractedData && Object.keys(data.data.extractedData).length > 0) {
          setExtractedData(data.data.extractedData)
          setCurrentUploadId(data.data.id)
          setEditedExtraction(JSON.parse(JSON.stringify(data.data.extractedData)))
          setShowReviewDialog(true)
        }
        fetchTimeline()
      } else {
        toast({ title: 'Upload failed', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error uploading file', variant: 'destructive' })
    }
    setUploading(false)
  }

  // Save reviewed extraction
  const handleSaveExtraction = async () => {
    if (!currentUploadId) return
    setDialogSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload/${currentUploadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedData: editedExtraction, savedToRecords: true }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Extracted data saved to records' })
        setShowReviewDialog(false)
        fetchTimeline()
      }
    } catch {
      toast({ title: 'Error saving extraction', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  const startEditProfile = () => {
    if (!patient) return
    setProfileForm({
      medicalHistory: patient.medicalHistory || '',
      allergies: patient.allergies || '',
      currentMedications: patient.currentMedications || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
      emergencyContactRelationship: patient.emergencyContactRelationship || '',
      occupation: patient.occupation || '',
      nationality: patient.nationality || '',
      dentalAnxieties: patient.dentalAnxieties || '',
      previousDentist: patient.previousDentist || '',
      pregnancyStatus: patient.pregnancyStatus || '',
      bloodPressureHistory: patient.bloodPressureHistory || '',
      remarks: patient.remarks || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
    })
    setEditingProfile(true)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D9DA8]" />
        </div>
      </DashboardLayout>
    )
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-gray-500">Patient not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/staff/patients')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const patientName = patient.fullName || (patient.user ? `${patient.user.lastName}, ${patient.user.firstName}` : 'Unknown')
  const patientEmail = patient.emailDirect || patient.user?.email || ''
  const patientPhone = patient.mobileNumber || patient.user?.phone || ''

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/staff/patients')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#2D9DA8]/10 flex items-center justify-center">
                <User className="w-6 h-6 text-[#2D9DA8]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{patientName}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>#{patient.patientNumber}</span>
                  {patientEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{patientEmail}</span>}
                  {patientPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patientPhone}</span>}
                </div>
              </div>
            </div>
          </div>
          <Badge variant={patient.isActive ? 'default' : 'secondary'} className={patient.isActive ? 'bg-green-100 text-green-700' : ''}>
            {patient.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="medical">Medical Info</TabsTrigger>
            <TabsTrigger value="uploads">Smart Upload</TabsTrigger>
            <TabsTrigger value="profile" className="hidden lg:flex">Profile</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Quick Stats */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <p className="text-sm text-gray-500">Total Visits</p>
                      <p className="text-2xl font-bold">{timeline.filter(t => t.type === 'visit').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg"><Stethoscope className="w-5 h-5 text-purple-600" /></div>
                    <div>
                      <p className="text-sm text-gray-500">Procedures</p>
                      <p className="text-2xl font-bold">{timeline.filter(t => t.type === 'procedure').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg"><Upload className="w-5 h-5 text-orange-600" /></div>
                    <div>
                      <p className="text-sm text-gray-500">Documents</p>
                      <p className="text-2xl font-bold">{timeline.filter(t => t.type === 'upload').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Medical Alerts */}
            {(patient.allergies || patient.dentalAnxieties) && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" /> Medical Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {patient.allergies && (
                    <div><span className="text-xs font-medium text-red-600">Allergies:</span> <span className="text-sm">{patient.allergies}</span></div>
                  )}
                  {patient.dentalAnxieties && (
                    <div><span className="text-xs font-medium text-red-600">Dental Anxieties:</span> <span className="text-sm">{patient.dentalAnxieties}</span></div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Timeline */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowVisitDialog(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Visit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNoteDialog(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Note
                  </Button>
                  <Button size="sm" className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="w-4 h-4 mr-1" /> Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No records yet. Add a visit, note, or upload a document to get started.</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.slice(0, 5).map(item => {
                      const Icon = typeIcons[item.type] || FileText
                      return (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { setDetailItem(item); setShowDetailDialog(true) }}>
                          <div className={`p-2 rounded-lg ${typeColors[item.type] || 'bg-gray-100'}`}><Icon className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900 truncate">{item.title}</p>
                              <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                            </div>
                            {item.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{item.subtitle}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(parseISO(item.date), 'MMM dd, yyyy')}</span>
                              {item.dentist && <span>{item.dentist}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      )
                    })}
                    {timeline.length > 5 && (
                      <Button variant="ghost" className="w-full" onClick={() => setActiveTab('timeline')}>
                        View all {timeline.length} records <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-3 justify-between">
                  <div className="flex gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder="Search records..." value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="All types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="visit">Visits</SelectItem>
                        <SelectItem value="procedure">Procedures</SelectItem>
                        <SelectItem value="note">Notes</SelectItem>
                        <SelectItem value="chart">Charts</SelectItem>
                        <SelectItem value="upload">Uploads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowVisitDialog(true)}><Plus className="w-4 h-4 mr-1" />Visit</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowProcedureDialog(true)}><Plus className="w-4 h-4 mr-1" />Procedure</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNoteDialog(true)}><Plus className="w-4 h-4 mr-1" />Note</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No records found matching your criteria.</p>
                ) : (
                  <div className="space-y-2">
                    {timeline.map(item => {
                      const Icon = typeIcons[item.type] || FileText
                      return (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border hover:border-[#2D9DA8]/30 hover:bg-gray-50/50 cursor-pointer transition-all" onClick={() => { setDetailItem(item); setShowDetailDialog(true) }}>
                          <div className={`p-2 rounded-lg shrink-0 ${typeColors[item.type]}`}><Icon className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{item.title}</p>
                              <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                              <Badge variant="outline" className="text-xs">{item.status}</Badge>
                            </div>
                            {item.subtitle && <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span>{format(parseISO(item.date), 'MMM dd, yyyy h:mm a')}</span>
                              {item.dentist && <span>• {item.dentist}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDICAL INFO TAB */}
          <TabsContent value="medical" className="space-y-4">
            <div className="flex justify-end">
              {!editingProfile ? (
                <Button size="sm" variant="outline" onClick={startEditProfile}><Edit className="w-4 h-4 mr-1" />Edit Medical Info</Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
                  <Button size="sm" className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Medical History */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" />Medical History</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {editingProfile ? (
                    <Textarea value={profileForm.medicalHistory} onChange={e => setProfileForm({ ...profileForm, medicalHistory: e.target.value })} rows={4} placeholder="Medical conditions, past surgeries..." />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.medicalHistory || 'None reported'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Allergies */}
              <Card className={patient.allergies ? 'border-red-200' : ''}>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" />Allergies</CardTitle></CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <Textarea value={profileForm.allergies} onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })} rows={3} placeholder="Known allergies..." />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.allergies || 'None reported'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Current Medications */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Pill className="w-4 h-4 text-blue-500" />Current Medications</CardTitle></CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <Textarea value={profileForm.currentMedications} onChange={e => setProfileForm({ ...profileForm, currentMedications: e.target.value })} rows={3} />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.currentMedications || 'None reported'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Dental Anxieties */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-500" />Dental Anxieties</CardTitle></CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <Textarea value={profileForm.dentalAnxieties} onChange={e => setProfileForm({ ...profileForm, dentalAnxieties: e.target.value })} rows={3} />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.dentalAnxieties || 'None reported'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Blood Pressure */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-green-500" />Blood Pressure History</CardTitle></CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <Textarea value={profileForm.bloodPressureHistory} onChange={e => setProfileForm({ ...profileForm, bloodPressureHistory: e.target.value })} rows={3} />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.bloodPressureHistory || 'None reported'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-500" />Emergency Contact</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {editingProfile ? (
                    <>
                      <Input value={profileForm.emergencyContactName} onChange={e => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })} placeholder="Name" />
                      <Input value={profileForm.emergencyContactPhone} onChange={e => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })} placeholder="Phone" />
                      <Input value={profileForm.emergencyContactRelationship} onChange={e => setProfileForm({ ...profileForm, emergencyContactRelationship: e.target.value })} placeholder="Relationship" />
                    </>
                  ) : (
                    <div className="text-sm space-y-1">
                      <p><span className="text-gray-500">Name:</span> {patient.emergencyContactName || 'Not provided'}</p>
                      <p><span className="text-gray-500">Phone:</span> {patient.emergencyContactPhone || 'Not provided'}</p>
                      <p><span className="text-gray-500">Relation:</span> {patient.emergencyContactRelationship || 'Not provided'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Previous Dentist & Pregnancy */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Additional Info</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {editingProfile ? (
                    <>
                      <div><Label className="text-xs">Previous Dentist</Label><Input value={profileForm.previousDentist} onChange={e => setProfileForm({ ...profileForm, previousDentist: e.target.value })} /></div>
                      <div><Label className="text-xs">Pregnancy Status</Label><Input value={profileForm.pregnancyStatus} onChange={e => setProfileForm({ ...profileForm, pregnancyStatus: e.target.value })} /></div>
                      <div><Label className="text-xs">Occupation</Label><Input value={profileForm.occupation} onChange={e => setProfileForm({ ...profileForm, occupation: e.target.value })} /></div>
                      <div><Label className="text-xs">Nationality</Label><Input value={profileForm.nationality} onChange={e => setProfileForm({ ...profileForm, nationality: e.target.value })} /></div>
                    </>
                  ) : (
                    <div className="text-sm space-y-1">
                      <p><span className="text-gray-500">Previous Dentist:</span> {patient.previousDentist || 'N/A'}</p>
                      <p><span className="text-gray-500">Pregnancy Status:</span> {patient.pregnancyStatus || 'N/A'}</p>
                      <p><span className="text-gray-500">Occupation:</span> {patient.occupation || 'N/A'}</p>
                      <p><span className="text-gray-500">Nationality:</span> {patient.nationality || 'N/A'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Remarks */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Remarks</CardTitle></CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <Textarea value={profileForm.remarks} onChange={e => setProfileForm({ ...profileForm, remarks: e.target.value })} rows={3} />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.remarks || 'No remarks'}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SMART UPLOAD TAB */}
          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Smart Upload</CardTitle>
                  <CardDescription>Upload dental records, images, or documents for AI-powered extraction</CardDescription>
                </div>
                <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                {timeline.filter(t => t.type === 'upload').length === 0 ? (
                  <div className="text-center py-12">
                    <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No documents uploaded yet</p>
                    <p className="text-sm text-gray-400 mt-1">Upload dental records, x-rays, or prescriptions for AI extraction</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timeline.filter(t => t.type === 'upload').map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => { setDetailItem(item); setShowDetailDialog(true) }}>
                        <div className="p-2 bg-orange-100 rounded-lg"><Upload className="w-4 h-4 text-orange-600" /></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-gray-400">{format(parseISO(item.date), 'MMM dd, yyyy')}</p>
                        </div>
                        <Badge variant="outline" className={item.data?.extractionStatus === 'completed' ? 'text-green-600' : item.data?.extractionStatus === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                          {item.data?.extractionStatus === 'completed' ? <><CheckCircle className="w-3 h-3 mr-1" />Extracted</> : item.data?.extractionStatus === 'failed' ? <><XCircle className="w-3 h-3 mr-1" />Failed</> : <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</>}
                        </Badge>
                        {item.data?.savedToRecords && <Badge className="bg-green-100 text-green-700 text-xs">Saved</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Patient Profile</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Patient #:</span> <span className="font-medium">{patient.patientNumber}</span></div>
                  <div><span className="text-gray-500">Full Name:</span> <span className="font-medium">{patientName}</span></div>
                  <div><span className="text-gray-500">Date of Birth:</span> <span className="font-medium">{patient.dateOfBirth ? format(parseISO(patient.dateOfBirth), 'MMM dd, yyyy') : 'N/A'}</span></div>
                  <div><span className="text-gray-500">Gender:</span> <span className="font-medium capitalize">{patient.gender || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{patientEmail || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{patientPhone || 'N/A'}</span></div>
                  <div className="md:col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{[patient.address, patient.city, patient.state, patient.zipCode].filter(Boolean).join(', ') || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Insurance:</span> <span className="font-medium">{patient.insuranceProvider || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Policy #:</span> <span className="font-medium">{patient.insurancePolicyNumber || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Language:</span> <span className="font-medium">{patient.preferredLanguage}</span></div>
                  <div><span className="text-gray-500">Communication:</span> <span className="font-medium capitalize">{patient.communicationPreference || 'Email'}</span></div>
                  <div><span className="text-gray-500">Registered:</span> <span className="font-medium">{format(parseISO(patient.createdAt), 'MMM dd, yyyy')}</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ---- DIALOGS ---- */}

        {/* Visit Dialog */}
        <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Visit Record</DialogTitle>
              <DialogDescription>Record details of a patient visit</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Visit Date *</Label><Input type="datetime-local" value={visitForm.visitDate} onChange={e => setVisitForm({ ...visitForm, visitDate: e.target.value })} /></div>
              <div><Label>Type</Label><Input value={visitForm.appointmentType} onChange={e => setVisitForm({ ...visitForm, appointmentType: e.target.value })} placeholder="Checkup, Emergency, Follow-up..." /></div>
              <div><Label>Attending Dentist</Label><Input value={visitForm.attendingDentist} onChange={e => setVisitForm({ ...visitForm, attendingDentist: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={visitForm.status} onValueChange={v => setVisitForm({ ...visitForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Chief Complaint</Label><Textarea value={visitForm.chiefComplaint} onChange={e => setVisitForm({ ...visitForm, chiefComplaint: e.target.value })} rows={2} /></div>
              <div><Label>Findings</Label><Textarea value={visitForm.findings} onChange={e => setVisitForm({ ...visitForm, findings: e.target.value })} rows={2} /></div>
              <div><Label>Diagnosis</Label><Textarea value={visitForm.diagnosis} onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })} rows={2} /></div>
              <div className="md:col-span-2"><Label>Treatment Done</Label><Textarea value={visitForm.treatmentDone} onChange={e => setVisitForm({ ...visitForm, treatmentDone: e.target.value })} rows={2} /></div>
              <div><Label>Prescriptions</Label><Textarea value={visitForm.prescriptions} onChange={e => setVisitForm({ ...visitForm, prescriptions: e.target.value })} rows={2} /></div>
              <div><Label>Follow-up Instructions</Label><Textarea value={visitForm.followUpInstructions} onChange={e => setVisitForm({ ...visitForm, followUpInstructions: e.target.value })} rows={2} /></div>
              <div><Label>Follow-up Date</Label><Input type="date" value={visitForm.followUpDate} onChange={e => setVisitForm({ ...visitForm, followUpDate: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVisitDialog(false)}>Cancel</Button>
              <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleCreateVisit} disabled={dialogSaving}>
                {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save Visit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Procedure Dialog */}
        <Dialog open={showProcedureDialog} onOpenChange={setShowProcedureDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Procedure Record</DialogTitle>
              <DialogDescription>Record a dental procedure or surgery</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Procedure Type *</Label><Input value={procedureForm.procedureType} onChange={e => setProcedureForm({ ...procedureForm, procedureType: e.target.value })} placeholder="Root Canal, Extraction, Filling..." /></div>
              <div><Label>Date *</Label><Input type="date" value={procedureForm.procedureDate} onChange={e => setProcedureForm({ ...procedureForm, procedureDate: e.target.value })} /></div>
              <div><Label>Dentist</Label><Input value={procedureForm.dentistName} onChange={e => setProcedureForm({ ...procedureForm, dentistName: e.target.value })} /></div>
              <div><Label>Teeth Involved</Label><Input value={procedureForm.teethInvolved} onChange={e => setProcedureForm({ ...procedureForm, teethInvolved: e.target.value })} placeholder="14, 15, 21 (comma separated)" /></div>
              <div><Label>Pre-procedure Notes</Label><Textarea value={procedureForm.notesBefore} onChange={e => setProcedureForm({ ...procedureForm, notesBefore: e.target.value })} rows={2} /></div>
              <div><Label>Post-procedure Notes</Label><Textarea value={procedureForm.notesAfter} onChange={e => setProcedureForm({ ...procedureForm, notesAfter: e.target.value })} rows={2} /></div>
              <div><Label>Complications</Label><Textarea value={procedureForm.complications} onChange={e => setProcedureForm({ ...procedureForm, complications: e.target.value })} rows={2} /></div>
              <div><Label>Follow-up Recommendations</Label><Textarea value={procedureForm.followUpRecs} onChange={e => setProcedureForm({ ...procedureForm, followUpRecs: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProcedureDialog(false)}>Cancel</Button>
              <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleCreateProcedure} disabled={dialogSaving}>
                {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save Procedure
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Note Dialog */}
        <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Clinical Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Note Type</Label>
                <Select value={noteForm.noteType} onValueChange={v => setNoteForm({ ...noteForm, noteType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="progress">Progress Note</SelectItem>
                    <SelectItem value="treatment_plan">Treatment Plan</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content *</Label>
                <Textarea value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} rows={6} placeholder="Enter clinical note..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isInternal" checked={noteForm.isInternal} onChange={e => setNoteForm({ ...noteForm, isInternal: e.target.checked })} className="rounded" />
                <label htmlFor="isInternal" className="text-sm text-gray-600">Internal note (not visible to patient)</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleCreateNote} disabled={dialogSaving || !noteForm.content}>
                {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Smart Upload</DialogTitle>
              <DialogDescription>Upload a dental record, x-ray, prescription, or any document. AI will extract the data automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#2D9DA8] transition-colors">
                <input type="file" id="smartUploadInput" className="hidden"
                  accept="image/*,application/pdf,.txt,.doc,.docx"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                <label htmlFor="smartUploadInput" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">{uploadFile ? uploadFile.name : 'Click to select a file'}</p>
                  <p className="text-xs text-gray-400 mt-1">Images, PDFs, or text files</p>
                </label>
              </div>
              {uploadFile && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 truncate">{uploadFile.name}</span>
                  <span className="text-gray-400">{(uploadFile.size / 1024).toFixed(1)}KB</span>
                  <Button size="sm" variant="ghost" onClick={() => setUploadFile(null)}><X className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFile(null) }}>Cancel</Button>
              <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleSmartUpload} disabled={!uploadFile || uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processing...</> : <><Upload className="w-4 h-4 mr-1" />Upload & Extract</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extraction Review Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" /> Review Extracted Data
              </DialogTitle>
              <DialogDescription>AI extracted the following information. Review and edit before saving to patient records.</DialogDescription>
            </DialogHeader>
            {editedExtraction && (
              <div className="space-y-4">
                {Object.entries(editedExtraction).map(([key, value]) => {
                  if (value === null || value === undefined) return null
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  if (typeof value === 'object' && !Array.isArray(value)) {
                    return (
                      <Card key={key}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {Object.entries(value as Record<string, any>).map(([subKey, subVal]) => (
                            <div key={subKey}>
                              <Label className="text-xs">{subKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Label>
                              <Input value={String(subVal || '')} onChange={e => {
                                const updated = { ...editedExtraction }
                                updated[key] = { ...(updated[key] as any), [subKey]: e.target.value }
                                setEditedExtraction(updated)
                              }} />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )
                  }
                  if (Array.isArray(value)) {
                    return (
                      <div key={key}>
                        <Label className="text-xs">{label}</Label>
                        <Textarea value={JSON.stringify(value, null, 2)} onChange={e => {
                          try {
                            const updated = { ...editedExtraction }
                            updated[key] = JSON.parse(e.target.value)
                            setEditedExtraction(updated)
                          } catch { /* ignore invalid JSON while typing */ }
                        }} rows={3} className="font-mono text-xs" />
                      </div>
                    )
                  }
                  return (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input value={String(value)} onChange={e => {
                        const updated = { ...editedExtraction }
                        updated[key] = e.target.value
                        setEditedExtraction(updated)
                      }} />
                    </div>
                  )
                })}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Dismiss</Button>
              <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={handleSaveExtraction} disabled={dialogSaving}>
                {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save to Records
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail View Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {detailItem && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {(() => { const Icon = typeIcons[detailItem.type]; return <Icon className="w-5 h-5" /> })()}
                    {detailItem.title}
                  </DialogTitle>
                  <DialogDescription>
                    <Badge variant="outline" className="capitalize mr-2">{detailItem.type}</Badge>
                    {format(parseISO(detailItem.date), 'MMMM dd, yyyy h:mm a')}
                    {detailItem.dentist && ` • ${detailItem.dentist}`}
                  </DialogDescription>
                </DialogHeader>
                <Separator />
                <div className="space-y-3">
                  {detailItem.type === 'visit' && detailItem.data && (
                    <>
                      {detailItem.data.chiefComplaint && <div><Label className="text-xs text-gray-500">Chief Complaint</Label><p className="text-sm">{detailItem.data.chiefComplaint}</p></div>}
                      {detailItem.data.findings && <div><Label className="text-xs text-gray-500">Findings</Label><p className="text-sm">{detailItem.data.findings}</p></div>}
                      {detailItem.data.diagnosis && <div><Label className="text-xs text-gray-500">Diagnosis</Label><p className="text-sm">{detailItem.data.diagnosis}</p></div>}
                      {detailItem.data.treatmentDone && <div><Label className="text-xs text-gray-500">Treatment Done</Label><p className="text-sm">{detailItem.data.treatmentDone}</p></div>}
                      {detailItem.data.prescriptions && <div><Label className="text-xs text-gray-500">Prescriptions</Label><p className="text-sm">{detailItem.data.prescriptions}</p></div>}
                      {detailItem.data.followUpInstructions && <div><Label className="text-xs text-gray-500">Follow-up Instructions</Label><p className="text-sm">{detailItem.data.followUpInstructions}</p></div>}
                      {detailItem.data.followUpDate && <div><Label className="text-xs text-gray-500">Follow-up Date</Label><p className="text-sm">{format(parseISO(detailItem.data.followUpDate), 'MMM dd, yyyy')}</p></div>}
                    </>
                  )}
                  {detailItem.type === 'procedure' && detailItem.data && (
                    <>
                      {detailItem.data.teethInvolved?.length > 0 && <div><Label className="text-xs text-gray-500">Teeth Involved</Label><p className="text-sm">{detailItem.data.teethInvolved.join(', ')}</p></div>}
                      {detailItem.data.notesBefore && <div><Label className="text-xs text-gray-500">Pre-Procedure Notes</Label><p className="text-sm">{detailItem.data.notesBefore}</p></div>}
                      {detailItem.data.notesAfter && <div><Label className="text-xs text-gray-500">Post-Procedure Notes</Label><p className="text-sm">{detailItem.data.notesAfter}</p></div>}
                      {detailItem.data.complications && <div><Label className="text-xs text-gray-500">Complications</Label><p className="text-sm text-red-600">{detailItem.data.complications}</p></div>}
                      {detailItem.data.followUpRecs && <div><Label className="text-xs text-gray-500">Follow-up Recommendations</Label><p className="text-sm">{detailItem.data.followUpRecs}</p></div>}
                    </>
                  )}
                  {detailItem.type === 'note' && detailItem.data && (
                    <>
                      <div><Label className="text-xs text-gray-500">Note Type</Label><Badge variant="outline" className="capitalize">{detailItem.data.noteType}</Badge></div>
                      {detailItem.data.isInternal && <Badge className="bg-yellow-100 text-yellow-700">Internal Note</Badge>}
                      <div><Label className="text-xs text-gray-500">Content</Label><p className="text-sm whitespace-pre-wrap">{detailItem.data.content}</p></div>
                    </>
                  )}
                  {detailItem.type === 'upload' && detailItem.data && (
                    <>
                      <div><Label className="text-xs text-gray-500">File</Label><p className="text-sm">{detailItem.data.originalName} ({detailItem.data.mimeType})</p></div>
                      <div><Label className="text-xs text-gray-500">Size</Label><p className="text-sm">{detailItem.data.fileSize ? `${(detailItem.data.fileSize / 1024).toFixed(1)} KB` : 'N/A'}</p></div>
                      <div><Label className="text-xs text-gray-500">Extraction Status</Label><Badge variant="outline">{detailItem.data.extractionStatus}</Badge></div>
                      {detailItem.data.extractedData && Object.keys(detailItem.data.extractedData).length > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">Extracted Data</Label>
                          <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto mt-1">{JSON.stringify(detailItem.data.extractedData, null, 2)}</pre>
                        </div>
                      )}
                    </>
                  )}
                  {detailItem.type === 'chart' && detailItem.data && (
                    <>
                      <div><Label className="text-xs text-gray-500">Version</Label><p className="text-sm">v{detailItem.data.version}</p></div>
                      {detailItem.data.notes && <div><Label className="text-xs text-gray-500">Notes</Label><p className="text-sm">{detailItem.data.notes}</p></div>}
                      <div>
                        <Label className="text-xs text-gray-500">Chart Data</Label>
                        <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto mt-1">{JSON.stringify(detailItem.data.chartData, null, 2)}</pre>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

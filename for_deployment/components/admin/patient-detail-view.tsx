'use client'

import { formatPatientName, copyToClipboard } from '@/lib/utils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, User, Calendar, FileText, Activity, Upload, Stethoscope,
  Plus, Edit, Eye, Trash2, Search, Clock, AlertTriangle, Heart,
  Pill, Phone, Mail, MapPin, ChevronRight, Download, CheckCircle,
  Loader2, ClipboardList, StickyNote, Save, X,
  FileImage, Shield, Sparkles, Brain, TrendingUp, AlertCircle,
  ChevronDown, ChevronUp, History, LayoutDashboard, Package, Link2, QrCode,
  ChevronsUpDown, Check, DollarSign, Smile
} from 'lucide-react'
import PackageManager from './package-manager'
import PaymentPanel from './payment-panel'
import ConsentManager from './consent-manager'
// GeneralChart, OrthoChart moved to dental-chart-tab
import PatientStatsCard from './patient-stats-card'
import OperationalAlerts from './operational-alerts'
import TreatmentBuilder from './treatment-builder'
import TreatmentFlowTracker from './treatment-flow-tracker'
// TreatmentPlansManager moved to dental-chart-tab
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildDefaultChartData } from '@/components/dental-chart/professional-dental-chart'
import MissingDataCard from '@/components/patient/missing-data-card'
import FormsHistoryCard from '@/components/patient/forms-history-card'
import PatientInfoTab from './patient-info-tab'
import MedicalHistorySection from './medical-history-section'
import FormsConsentsSection from './forms-consents-section'
import TimelineDocsTab from './timeline-docs-tab'
import DentalChartTab from './dental-chart-tab'
import UploadDocsTab from './upload-docs-tab'
import ChartTimeline from './charting/chart-timeline'
import PatientAuditViewer from './patient-audit-viewer'
import { ProfilePictureUpload } from '@/components/ui/profile-picture-upload'

// ===============================
// TYPES
// ===============================
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
  updatedAt?: string
  // New fields
  middleName?: string | null
  preferredName?: string | null
  civilStatus?: string | null
  religion?: string | null
  province?: string | null
  previousDentalRemarks?: string | null
  medicalSafetyNotes?: string | null
  validIdType?: string | null
  validIdNumber?: string | null
  patientSignature?: string | null
  patientSignedAt?: string | null
  lastUpdatedById?: string | null
  lastUpdatedByName?: string | null
  lastUpdatedSection?: string | null
  medicalLastUpdatedAt?: string | null
  medicalLastUpdatedById?: string | null
  medicalLastUpdatedByName?: string | null
  profilePicture?: string | null
  profilePictureCloudPath?: string | null
  profilePictureUpdatedAt?: string | null
  user?: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null
  appointments?: any[]
}

interface TimelineItem {
  id: string
  type: string
  date: string
  title: string
  subtitle: string
  dentist: string | null
  status: string
  data: any
  updatedBy?: string | null
}

interface AISummary {
  patientName: string
  risk_level: string
  risk_factors: string[]
  key_dental_issues: string[]
  treatment_history_summary: string
  suggested_next_treatments: string[]
  follow_up_urgency: string
  notes: string
}

// ===============================
// HELPERS
// ===============================
const getPatientName = (p: Patient) =>
  formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, 'Unknown Patient')

const getAge = (dob: string | null) => {
  if (!dob) return null
  const birth = new Date(dob)
  const diff = Date.now() - birth.getTime()
  return Math.floor(diff / 31557600000)
}

const typeIcons: Record<string, any> = {
  visit: Calendar, procedure: Stethoscope, note: StickyNote, chart: Activity, upload: Upload, plan: ClipboardList,
}
const typeColors: Record<string, string> = {
  visit: 'bg-blue-100 text-blue-700',
  procedure: 'bg-purple-100 text-purple-700',
  note: 'bg-yellow-100 text-yellow-700',
  chart: 'bg-green-100 text-green-700',
  upload: 'bg-orange-100 text-orange-700',
  plan: 'bg-teal-100 text-teal-700',
}

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-red-100 text-red-700 border-red-200',
}

// ===============================
// VISIT HISTORY SUB-COMPONENT
// ===============================
function VisitHistorySection({ appointments, router, patientId }: { appointments: any[]; router: any; patientId: string }) {
  const [vhPage, setVhPage] = useState(0)
  const PAGE_SIZE = 5

  const now = new Date()
  const getDt = (a: any) => a.scheduledDatetime || a.dateTime || a.date
  const upcoming = appointments
    .filter((a: any) => { const d = getDt(a); return d && new Date(d) >= now && a.status !== 'CANCELLED' && a.status !== 'cancelled' })
    .sort((a: any, b: any) => new Date(getDt(a)).getTime() - new Date(getDt(b)).getTime())
  const past = appointments
    .filter((a: any) => { const d = getDt(a); return !d || new Date(d) < now || a.status === 'CANCELLED' || a.status === 'cancelled' })
    .sort((a: any, b: any) => new Date(getDt(b) || 0).getTime() - new Date(getDt(a) || 0).getTime())

  const allSorted = [...upcoming, ...past]
  const totalPages = Math.ceil(allSorted.length / PAGE_SIZE)
  const pageItems = allSorted.slice(vhPage * PAGE_SIZE, (vhPage + 1) * PAGE_SIZE)

  const isToday = (d: string) => {
    const dt = new Date(d)
    return dt.toDateString() === now.toDateString()
  }

  const statusBadge = (status: string) => {
    const s = (status || '').toLowerCase()
    const map: Record<string, string> = {
      'completed': 'bg-green-100 text-green-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'pending': 'bg-yellow-100 text-yellow-700',
      'pending_assignment': 'bg-yellow-100 text-yellow-700',
      'cancelled': 'bg-red-100 text-red-700',
      'rejected': 'bg-red-100 text-red-700',
      'no_show': 'bg-gray-100 text-gray-700',
      'checked_in': 'bg-teal-100 text-teal-700',
      'in_progress': 'bg-purple-100 text-purple-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  const getDentistName = (appt: any) => {
    if (appt.dentist?.user) {
      const u = appt.dentist.user
      return [u.lastName, u.firstName].filter(Boolean).join(', ') || '—'
    }
    return appt.dentistName || '—'
  }

  const getPurpose = (appt: any) => {
    return appt.service?.name || appt.reasonForVisit || (appt.appointmentType ? appt.appointmentType.replace(/_/g, ' ') : null) || '—'
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm inline-flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-600" />
          Visit History
        </h3>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => router.push(`/admin/appointments?patientId=${patientId}`)}>
          <Plus className="w-3 h-3" /> New Appointment
        </Button>
      </div>

      {allSorted.length === 0 ? (
        <p className="text-sm text-gray-400">No appointments recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase border-b">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Time</th>
                  <th className="text-left py-2 font-medium">Purpose</th>
                  <th className="text-left py-2 font-medium">Doctor</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((appt: any) => {
                  const dt = getDt(appt)
                  const dateStr = dt ? format(parseISO(typeof dt === 'string' ? dt : new Date(dt).toISOString()), 'MMM d, yyyy') : '—'
                  const timeStr = dt ? format(parseISO(typeof dt === 'string' ? dt : new Date(dt).toISOString()), 'h:mm a') : '—'
                  const today = dt ? isToday(typeof dt === 'string' ? dt : new Date(dt).toISOString()) : false
                  return (
                    <tr
                      key={appt.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/appointments?highlight=${appt.id}`)}
                    >
                      <td className="py-2 text-gray-800 font-medium whitespace-nowrap">
                        {dateStr}
                        {today && <Badge className="ml-1.5 text-[9px] px-1 py-0 bg-teal-500 text-white">Today</Badge>}
                      </td>
                      <td className="py-2 text-gray-600 whitespace-nowrap">{timeStr}</td>
                      <td className="py-2 text-gray-700">{getPurpose(appt)}</td>
                      <td className="py-2 text-gray-600">{getDentistName(appt)}</td>
                      <td className="py-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(appt.status)}`}>
                          {(appt.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t">
              <span className="text-xs text-gray-400">
                Page {vhPage + 1} of {totalPages} ({allSorted.length} appointments)
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={vhPage === 0} onClick={() => setVhPage(p => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs" disabled={vhPage >= totalPages - 1} onClick={() => setVhPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ===============================
// MAIN COMPONENT
// ===============================
export default function PatientDetailView({ patientId }: { patientId: string }) {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initial tab from ?tab= query param (enables Clinical <-> Workspace deep-linking)
  const initialTab = (() => {
    const t = searchParams?.get('tab')
    if (t && ['workspace', 'dental-chart', 'patient-info', 'upload-docs', 'analytics'].includes(t)) return t
    return 'workspace'
  })()

  // Core state
  const [patient, setPatient] = useState<Patient | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)

  // Sync tab to URL so reloads keep the active section
  useEffect(() => {
    if (!activeTab) return
    try {
      const url = new URL(window.location.href)
      const current = url.searchParams.get('tab')
      if (current !== activeTab) {
        url.searchParams.set('tab', activeTab)
        window.history.replaceState({}, '', url.toString())
      }
    } catch {
      // no-op
    }
  }, [activeTab])

  const [generatingIntake, setGeneratingIntake] = useState(false)

  const generateIntakeLink = async () => {
    setGeneratingIntake(true)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const url = `${window.location.origin}/intake/${data.token}`
      await copyToClipboard(url)
      toast({ title: 'Intake link copied!', description: 'Share this link with the patient to fill out their intake form.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to generate intake link', variant: 'destructive' })
    } finally {
      setGeneratingIntake(false)
    }
  }
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0)
  const [paymentPreselection, setPaymentPreselection] = useState<{ packageId: string; balance: number } | null>(null)

  // Timeline
  const [timelineFilter, setTimelineFilter] = useState('')
  const [timelineSearch, setTimelineSearch] = useState('')

  // Medical history editing
  const [editingMedical, setEditingMedical] = useState(false)
  const [medicalForm, setMedicalForm] = useState<any>({})
  const [savingMedical, setSavingMedical] = useState(false)

  // Dialog states
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [showProcedureDialog, setShowProcedureDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [detailItem, setDetailItem] = useState<TimelineItem | null>(null)
  const [dialogSaving, setDialogSaving] = useState(false)

  // AI Summary
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)

  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [saveOptions, setSaveOptions] = useState({ saveVisit: true, saveProcedures: true, saveNotes: true, saveMedicalHistory: true, saveToChart: false, savePatientInfo: true, savePatientId: true })
  const [savedResults, setSavedResults] = useState<any>(null)
  const [editedExtraction, setEditedExtraction] = useState<any>(null)

  // Documents list
  const [uploads, setUploads] = useState<any[]>([])

  // Forms
  const [visitForm, setVisitForm] = useState({
    visitDate: new Date().toISOString().slice(0, 16),
    appointmentType: '', attendingDentist: '', chiefComplaint: '',
    findings: '', diagnosis: '', treatmentDone: '', prescriptions: '',
    followUpInstructions: '', followUpDate: '', status: 'completed',
  })
  const [procedureForm, setProcedureForm] = useState({
    procedureType: '', procedureDate: new Date().toISOString().slice(0, 10),
    dentistName: '', teethInvolved: '', notesBefore: '', notesAfter: '',
    complications: '', followUpRecs: '', status: 'completed',
  })
  // Treatment catalog for Record Procedure combobox
  const [treatmentCatalog, setTreatmentCatalog] = useState<any[]>([])
  const [loadingTreatments, setLoadingTreatments] = useState(false)
  const [procedureTypeOpen, setProcedureTypeOpen] = useState(false)
  const [procedureTypeSearch, setProcedureTypeSearch] = useState('')
  const [noteForm, setNoteForm] = useState({
    noteType: 'general', content: '', isInternal: false,
  })

  // Dental history
  const [procedures, setProcedures] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [chartVersions, setChartVersions] = useState<any[]>([])

  // Patient aggregate stats (for analytics tab)
  const [patientStats, setPatientStats] = useState<any>(null)

  // ===============================
  // DATA FETCHING
  // ===============================
  const fetchPatient = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}`)
      const data = await res.json()
      if (data.success) setPatient(data.data)
    } catch (err) { console.error('Fetch patient error:', err) }
  }, [patientId])

  const fetchPatientProfilePicture = useCallback(async () => {
    if (!patientId) return
    try {
      const res = await fetch(`/api/patients/${patientId}/profile-picture`)
      if (res.ok) {
        const data = await res.json()
        setProfilePictureUrl(data.profilePictureUrl || null)
      }
    } catch (err) { console.error('Fetch patient profile picture error:', err) }
  }, [patientId])

  const fetchTimeline = useCallback(async () => {
    try {
      const qp = new URLSearchParams()
      if (timelineFilter && timelineFilter !== 'all') qp.set('type', timelineFilter)
      if (timelineSearch) qp.set('search', timelineSearch)
      qp.set('limit', '50')
      const res = await fetch(`/api/patients/${patientId}/timeline?${qp}`)
      const data = await res.json()
      if (data.success) setTimeline(data.data)
    } catch (err) { console.error('Fetch timeline error:', err) }
  }, [patientId, timelineFilter, timelineSearch])

  const fetchDentalData = useCallback(async () => {
    try {
      const [procRes, visitRes, chartRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/procedures`),
        fetch(`/api/patients/${patientId}/visits`),
        fetch(`/api/patients/${patientId}/charts`),
      ])
      const [procData, visitData, chartData] = await Promise.all([
        procRes.json(), visitRes.json(), chartRes.json(),
      ])
      if (procData.success) setProcedures(procData.data)
      if (visitData.success) setVisits(visitData.data)
      if (chartData.success) {
        if (chartData.data.length === 0) {
          // Auto-create default chart
          const defaultData = buildDefaultChartData()
          const createRes = await fetch(`/api/patients/${patientId}/charts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chartData: defaultData, notes: 'Initial chart — all teeth healthy' }),
          })
          const createData = await createRes.json()
          if (createData.success) setChartVersions([createData.data])
        } else {
          setChartVersions(chartData.data)
        }
      }
    } catch (err) { console.error('Fetch dental data error:', err) }
  }, [patientId])

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload`)
      const data = await res.json()
      if (data.success) setUploads(data.data)
    } catch (err) { console.error('Fetch uploads error:', err) }
  }, [patientId])

  const fetchPatientStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/stats`)
      if (!res.ok) return
      const data = await res.json()
      setPatientStats(data)
    } catch (err) { console.error('Fetch patient stats error:', err) }
  }, [patientId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchPatient(), fetchTimeline(), fetchDentalData(), fetchUploads(), fetchPatientStats(), fetchPatientProfilePicture()])
      setLoading(false)
    }
    load()
  }, [fetchPatient, fetchTimeline, fetchDentalData, fetchUploads, fetchPatientStats, fetchPatientProfilePicture])

  // Fetch treatment catalog when the Record Procedure dialog opens (once per session)
  useEffect(() => {
    if (!showProcedureDialog || treatmentCatalog.length > 0 || loadingTreatments) return
    const loadTreatments = async () => {
      setLoadingTreatments(true)
      try {
        const res = await fetch('/api/treatments')
        const data = await res.json()
        if (data?.success && data?.data?.treatments) {
          setTreatmentCatalog(data.data.treatments)
        }
      } catch (e) {
        console.error('Failed to load treatments catalog', e)
      }
      setLoadingTreatments(false)
    }
    loadTreatments()
  }, [showProcedureDialog, treatmentCatalog.length, loadingTreatments])

  // ===============================
  // ACTIONS
  // ===============================

  // Save medical history
  const handleSaveMedical = async () => {
    setSavingMedical(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicalForm),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Medical history updated' })
        setEditingMedical(false)
        fetchPatient()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSavingMedical(false)
  }

  // Add visit
  const handleAddVisit = async () => {
    setDialogSaving(true)
    try {
      const payload = {
        ...visitForm,
        attendingDentist: visitForm.attendingDentist || session?.user?.name || 'Staff',
      }
      const res = await fetch(`/api/patients/${patientId}/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Visit recorded' })
        setShowVisitDialog(false)
        setVisitForm({ visitDate: new Date().toISOString().slice(0, 16), appointmentType: '', attendingDentist: '', chiefComplaint: '', findings: '', diagnosis: '', treatmentDone: '', prescriptions: '', followUpInstructions: '', followUpDate: '', status: 'completed' })
        fetchTimeline()
        fetchDentalData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add visit', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Add procedure
  const handleAddProcedure = async () => {
    setDialogSaving(true)
    try {
      const payload = {
        ...procedureForm,
        teethInvolved: procedureForm.teethInvolved ? procedureForm.teethInvolved.split(',').map((t: string) => t.trim()) : [],
        dentistName: procedureForm.dentistName || session?.user?.name || 'Staff',
      }
      const res = await fetch(`/api/patients/${patientId}/procedures`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Procedure recorded' })
        setShowProcedureDialog(false)
        setProcedureForm({ procedureType: '', procedureDate: new Date().toISOString().slice(0, 10), dentistName: '', teethInvolved: '', notesBefore: '', notesAfter: '', complications: '', followUpRecs: '', status: 'completed' })
        fetchTimeline()
        fetchDentalData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add procedure', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Add note
  const handleAddNote = async () => {
    setDialogSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Note added' })
        setShowNoteDialog(false)
        setNoteForm({ noteType: 'general', content: '', isInternal: false })
        fetchTimeline()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  // Smart upload
  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await fetch(`/api/patients/${patientId}/smart-upload`, {
        method: 'POST', body: formData,
      })
      const data = await res.json()
      if (data.success) {
        const upload = data.data
        setCurrentUploadId(upload.id)
        if (upload.extractedData && Object.keys(upload.extractedData).length > 0) {
          setExtractedData(upload.extractedData)
          setEditedExtraction(upload.extractedData)
          setShowUploadDialog(false)
          setShowReviewDialog(true)
        } else {
          toast({ title: 'File uploaded', description: data.warning || 'File saved successfully' })
          setShowUploadDialog(false)
        }
        setUploadFile(null)
        fetchUploads()
        fetchTimeline()
      } else {
        toast({ title: 'Upload failed', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    }
    setUploading(false)
  }

  // Save reviewed extraction to actual records
  const handleSaveExtraction = async () => {
    if (!currentUploadId) return
    setDialogSaving(true)
    setSavedResults(null)
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload/${currentUploadId}/save-to-records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedData: editedExtraction, saveOptions }),
      })
      const data = await res.json()
      if (data.success) {
        setSavedResults(data.data)
        toast({ title: 'Data saved to patient records!' })
        fetchUploads()
        // Refresh patient data
        const pRes = await fetch(`/api/patients/${patientId}`)
        const pData = await pRes.json()
        if (pData.success) setPatient(pData.data)
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' })
    }
    setDialogSaving(false)
  }

  const closeSaveDialog = () => {
    setShowReviewDialog(false)
    setExtractedData(null)
    setEditedExtraction(null)
    setCurrentUploadId(null)
    setSavedResults(null)
    setSaveOptions({ saveVisit: true, saveProcedures: true, saveNotes: true, saveMedicalHistory: true, saveToChart: false, savePatientInfo: true, savePatientId: true })
  }

  // AI Summary
  const fetchAISummary = async () => {
    setLoadingAI(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/ai-summary`)
      const data = await res.json()
      if (data.success) {
        setAiSummary(data.data)
      } else {
        toast({ title: 'AI Summary failed', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'AI Summary failed', variant: 'destructive' })
    }
    setLoadingAI(false)
  }

  // ===============================
  // LOADING STATE
  // ===============================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-600">Patient not found</p>
        <Button variant="outline" onClick={() => router.push('/admin/patients')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
        </Button>
      </div>
    )
  }

  const name = getPatientName(patient)
  const age = getAge(patient.dateOfBirth)

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/patients')} className="self-start">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <ProfilePictureUpload
                currentPictureUrl={profilePictureUrl}
                firstName={patient.user?.firstName || patient.fullName?.split(' ')?.[0] || ''}
                lastName={patient.user?.lastName || patient.fullName?.split(' ')?.slice(-1)?.[0] || ''}
                onUploadSuccess={(url) => setProfilePictureUrl(url)}
                size="sm"
                editable
                uploadEndpoint={`/api/patients/${patient.id}/profile-picture`}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>#{patient.patientNumber}</span>
                {age !== null && <span>• {age} yrs</span>}
                {patient.gender && <span>• {patient.gender}</span>}
                <Badge variant={patient.isActive ? 'default' : 'secondary'} className="text-xs">
                  {patient.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Button size="sm" variant="outline" onClick={() => { setShowNoteDialog(true) }}>
            <StickyNote className="w-4 h-4 mr-1" /> Add Note
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowVisitDialog(true) }}>
            <Plus className="w-4 h-4 mr-1" /> Record Visit
          </Button>
          <Button size="sm" onClick={fetchAISummary} disabled={loadingAI} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700">
            {loadingAI ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
            AI Summary
          </Button>
        </div>
      </div>

      {/* AI Summary Card */}
      {aiSummary && (
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">AI Clinical Summary</h3>
              </div>
              <Badge className={riskColors[aiSummary.risk_level] || 'bg-gray-100 text-gray-700'}>
                Risk: {aiSummary.risk_level?.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {aiSummary.risk_factors?.length > 0 && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">⚠️ Risk Factors</p>
                  <ul className="space-y-0.5 text-gray-600">{aiSummary.risk_factors.map((r, i) => <li key={i}>• {r}</li>)}</ul>
                </div>
              )}
              {aiSummary.key_dental_issues?.length > 0 && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">🦷 Key Dental Issues</p>
                  <ul className="space-y-0.5 text-gray-600">{aiSummary.key_dental_issues.map((d, i) => <li key={i}>• {d}</li>)}</ul>
                </div>
              )}
              {aiSummary.treatment_history_summary && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">📋 Treatment Summary</p>
                  <p className="text-gray-600">{aiSummary.treatment_history_summary}</p>
                </div>
              )}
              {aiSummary.suggested_next_treatments?.length > 0 && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">💡 Suggested Next Steps</p>
                  <ul className="space-y-0.5 text-gray-600">{aiSummary.suggested_next_treatments.map((t, i) => <li key={i}>• {t}</li>)}</ul>
                </div>
              )}
            </div>
            {aiSummary.notes && (
              <p className="mt-3 text-sm text-purple-700 bg-purple-100/50 p-2 rounded">{aiSummary.notes}</p>
            )}
            <Button variant="ghost" size="sm" className="mt-2 text-gray-400" onClick={() => setAiSummary(null)}>
              <X className="w-3 h-3 mr-1" /> Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Contact Bar */}
      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
        {(patient.mobileNumber || patient.user?.phone) && (
          <a href={`tel:${patient.mobileNumber || patient.user?.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
            <Phone className="w-3.5 h-3.5" /> {patient.mobileNumber || patient.user?.phone}
          </a>
        )}
        {(patient.emailDirect || patient.user?.email) && (
          <span className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> {patient.emailDirect || patient.user?.email}
          </span>
        )}
        {patient.address && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {[patient.address, patient.city, patient.state].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto bg-white border h-auto p-1 gap-1">
          <TabsTrigger value="workspace" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><LayoutDashboard className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Workspace</span></TabsTrigger>
          <TabsTrigger value="patient-info" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><User className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Patient Info</span></TabsTrigger>
          <TabsTrigger value="dental-chart" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><Stethoscope className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Dental Chart</span></TabsTrigger>
          <TabsTrigger value="timeline" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><Clock className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Timeline</span></TabsTrigger>
          <TabsTrigger value="upload-docs" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><FileText className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Upload Docs</span></TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 min-w-fit text-xs sm:text-sm flex items-center justify-center gap-1 px-2 py-2"><TrendingUp className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Analytics</span></TabsTrigger>
        </TabsList>

        {/* ==================== WORKSPACE TAB ==================== */}
        <TabsContent value="workspace" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column — Guided Workflow + Timeline */}
            <div className="lg:col-span-4 space-y-4">
              {/* Treatment Flow Engine (Pre/During/Post) */}
              <TreatmentFlowTracker
                patientId={patientId}
                refreshKey={workspaceRefreshKey}
                onChanged={() => setWorkspaceRefreshKey(k => k + 1)}
                onOpenSection={(section) => {
                  const scrollToId = (id: string, delay = 0) => {
                    setTimeout(() => {
                      const el = document.getElementById(id)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, delay)
                  }
                  if (section === 'consent') {
                    setActiveTab('workspace')
                    scrollToId('consent-forms-section', 60)
                  } else if (section === 'package') {
                    setActiveTab('workspace')
                    scrollToId('packages-section', 60)
                  } else if (section === 'plan') {
                    setActiveTab('dental-chart')
                    scrollToId('treatment-plans-section', 80)
                  } else if (section === 'chart' || section === 'procedure' || section === 'clinical') {
                    setActiveTab('dental-chart')
                  } else if (section === 'patient-info') {
                    setActiveTab('patient-info')
                  } else if (section === 'appointments') {
                    setActiveTab('workspace')
                  } else if (section === 'forms') {
                    setActiveTab('upload-docs')
                  }
                }}
              />

              {/* Patient Snapshot (Analytics) */}
              <PatientStatsCard patientId={patientId} refreshKey={workspaceRefreshKey} />

              {/* Operational Alerts */}
              <OperationalAlerts
                patientId={patientId}
                refreshKey={workspaceRefreshKey}
                onAction={(type) => {
                  if (type === 'scroll_consent' || type === 'pending_consent') {
                    toast({ title: 'Consent needed', description: 'Scroll down to the Consent Forms section.' })
                  }
                }}
              />

              {/* Quick Info + Intake Link */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-gray-500">Quick Info</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-[#2D9DA8]"
                      onClick={generateIntakeLink}
                      disabled={generatingIntake}
                    >
                      {generatingIntake ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
                      Intake Link
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Allergies</span><span className="font-medium text-red-600">{patient.allergies || 'None'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Medications</span><span className="font-medium">{patient.currentMedications || 'None'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Insurance</span><span className="font-medium">{patient.insuranceProvider || 'None'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Appointments</span><span className="font-medium">{patient.appointments?.length || 0}</span></div>
                </CardContent>
              </Card>

              {/* Mini Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-gray-500">Recent Activity</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setActiveTab('dental-chart')}>
                      View All <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No activity yet</p>
                  ) : (
                    <div className="space-y-2">
                      {timeline.slice(0, 4).map(item => {
                        const Icon = typeIcons[item.type] || FileText
                        return (
                          <div key={item.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors" onClick={() => { setDetailItem(item); setShowDetailDialog(true) }}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${typeColors[item.type]}`}>
                              <Icon className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.title}</p>
                              <p className="text-gray-400 truncate">{format(parseISO(item.date), 'MMM d')}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column — Packages + Payment */}
            <div className="lg:col-span-8 space-y-4">
              {/* Package Manager */}
              <Card id="packages-section">
                <CardContent className="pt-4">
                  <PackageManager
                    key={workspaceRefreshKey}
                    patientId={patientId}
                    onPackageChanged={() => setWorkspaceRefreshKey(k => k + 1)}
                    onRecordPayment={(packageId, balance) => {
                      setPaymentPreselection({ packageId, balance })
                    }}
                  />
                </CardContent>
              </Card>

              {/* Payment Panel */}
              <Card id="payments-section">
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-[#22B573]" />
                    Payments
                  </h3>
                  <PaymentPanel
                    key={`payments-${workspaceRefreshKey}`}
                    patientId={patientId}
                    preselectedPackageId={paymentPreselection?.packageId || null}
                    preselectedBalance={paymentPreselection?.balance}
                    onPaymentRecorded={() => {
                      setPaymentPreselection(null)
                      setWorkspaceRefreshKey(k => k + 1)
                    }}
                  />
                </CardContent>
              </Card>

              {/* Consent Forms */}
              <Card id="consent-forms-section">
                <CardContent className="pt-4">
                  <ConsentManager
                    key={`consent-${workspaceRefreshKey}`}
                    patientId={patientId}
                    onConsentChanged={() => setWorkspaceRefreshKey(k => k + 1)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ==================== PATIENT INFO TAB ==================== */}
        <TabsContent value="patient-info" className="space-y-4">
          {/* Patient Profile */}
          <PatientInfoTab
            patient={patient}
            patientId={patientId}
            procedures={procedures}
            visits={visits}
            uploads={uploads}
            onRefresh={fetchPatient}
          />

          {/* Medical History */}
          <MedicalHistorySection
            patient={patient}
            patientId={patientId}
            onRefresh={fetchPatient}
            onTimelineRefresh={fetchTimeline}
          />

          {/* Forms & Consents */}
          <FormsConsentsSection patientId={patient.id} />
        </TabsContent>

        {/* ==================== ANALYTICS TAB ==================== */}
        <TabsContent value="analytics" className="space-y-4">
          {(() => {
            const procCounts: Record<string, number> = {}
            const monthlyVisits: Record<string, number> = {}
            const dentistCounts: Record<string, number> = {}
            let totalSpent = 0

            // Aggregate procedure data
            procedures.forEach((pr: any) => {
              const name = pr.procedureName || 'Unknown'
              procCounts[name] = (procCounts[name] || 0) + 1
              if (pr.cost) totalSpent += parseFloat(pr.cost) || 0
              if (pr.dentistName) dentistCounts[pr.dentistName] = (dentistCounts[pr.dentistName] || 0) + 1
            })

            // Aggregate visit data
            visits.forEach((vr: any) => {
              const monthKey = vr.visitDate ? format(parseISO(vr.visitDate), 'MMM yyyy') : 'Unknown'
              monthlyVisits[monthKey] = (monthlyVisits[monthKey] || 0) + 1
              if (vr.dentistName) dentistCounts[vr.dentistName] = (dentistCounts[vr.dentistName] || 0) + 1
            })

            const topProcedures = Object.entries(procCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
            const maxProcCount = topProcedures.length > 0 ? topProcedures[0][1] : 1
            const recentMonths = Object.entries(monthlyVisits).slice(-6)
            const maxMonthVisits = recentMonths.length > 0 ? Math.max(...recentMonths.map(r => r[1])) : 1
            const topDentists = Object.entries(dentistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

            const totalVisits = visits.length
            const totalProcedures = procedures.length
            const totalAppointments = (patient?.appointments || []).length
            const completedAppts = (patient?.appointments || []).filter((a: any) => a.status === 'COMPLETED').length
            const cancelledAppts = (patient?.appointments || []).filter((a: any) => a.status === 'CANCELLED').length
            const noShowRate = totalAppointments > 0 ? Math.round((cancelledAppts / totalAppointments) * 100) : 0
            const complianceRate = totalAppointments > 0 ? Math.round((completedAppts / totalAppointments) * 100) : 0

            return (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Visits', value: totalVisits, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Procedures Done', value: totalProcedures, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Compliance Rate', value: `${complianceRate}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Total Spent', value: `₱${totalSpent.toLocaleString()}`, color: 'text-amber-600', bg: 'bg-amber-50' },
                  ].map(stat => (
                    <Card key={stat.label} className={`p-4 ${stat.bg} border-none`}>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    </Card>
                  ))}
                </div>

                {/* Procedure frequency chart */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Procedure Frequency</h3>
                  {topProcedures.length === 0 ? (
                    <p className="text-sm text-gray-400">No procedures recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {topProcedures.map(([name, count]) => (
                        <div key={name} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32 truncate flex-shrink-0">{name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: `${Math.max((count / maxProcCount) * 100, 15)}%` }}>
                              <span className="text-[10px] font-bold text-white">{count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Visit pattern & dentist breakdown */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Visit Pattern (by Month)</h3>
                    {recentMonths.length === 0 ? (
                      <p className="text-sm text-gray-400">No visits recorded yet.</p>
                    ) : (
                      <div className="flex items-end gap-1 h-28">
                        {recentMonths.map(([month, count]) => (
                          <div key={month} className="flex-1 flex flex-col items-center">
                            <span className="text-[10px] font-medium text-gray-600 mb-1">{count}</span>
                            <div className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm" style={{ height: `${Math.max((count / maxMonthVisits) * 100, 10)}%` }} />
                            <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">{month.slice(0, 3)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Treating Dentists</h3>
                    {topDentists.length === 0 ? (
                      <p className="text-sm text-gray-400">No dentist data available.</p>
                    ) : (
                      <div className="space-y-2">
                        {topDentists.map(([name, count]) => (
                          <div key={name} className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">{name}</span>
                            <Badge variant="secondary">{count} {count === 1 ? 'visit' : 'visits'}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                {/* Appointment stats */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Appointment Statistics</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{totalAppointments}</p>
                      <p className="text-xs text-gray-500">Total Booked</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{completedAppts}</p>
                      <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">{noShowRate}%</p>
                      <p className="text-xs text-gray-500">Cancellation Rate</p>
                    </div>
                  </div>
                </Card>

                {/* Treatment plans analytics */}
                {patientStats?.treatmentPlans && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm inline-flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-teal-600" />
                        Treatment Plans
                      </h3>
                      <Badge variant="outline" className="text-xs">{patientStats.treatmentPlans.total} total</Badge>
                    </div>

                    {patientStats.treatmentPlans.total === 0 ? (
                      <p className="text-sm text-gray-400">No treatment plans yet. Create one from the Clinical tab.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="p-3 bg-teal-50 rounded-lg">
                            <p className="text-xs text-gray-600">Active</p>
                            <p className="text-xl font-bold text-teal-700">{patientStats.treatmentPlans.active}</p>
                          </div>
                          <div className="p-3 bg-yellow-50 rounded-lg">
                            <p className="text-xs text-gray-600">Awaiting Approval</p>
                            <p className="text-xl font-bold text-yellow-700">{patientStats.treatmentPlans.awaitingApproval}</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-600">Completed</p>
                            <p className="text-xl font-bold text-green-700">{patientStats.treatmentPlans.completed}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600">Cancelled</p>
                            <p className="text-xl font-bold text-gray-700">{patientStats.treatmentPlans.cancelled}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-600">Avg Completion</p>
                            <p className="text-lg font-bold text-blue-700">{patientStats.treatmentPlans.averageCompletion}%</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <p className="text-xs text-gray-600">Avg Duration</p>
                            <p className="text-lg font-bold text-purple-700">
                              {patientStats.treatmentPlans.averageDurationDays > 0
                                ? `${patientStats.treatmentPlans.averageDurationDays} days`
                                : '—'}
                            </p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="text-xs text-gray-600">Est. Total Value</p>
                            <p className="text-lg font-bold text-amber-700">
                              ₱{Number(patientStats.treatmentPlans.estimatedTotal || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {patientStats.treatmentPlans.actualTotal > 0 && (
                          <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t">
                            <span>Actual cost billed:</span>
                            <span className="font-semibold text-gray-900">
                              ₱{Number(patientStats.treatmentPlans.actualTotal).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )}

                {/* ===== VISIT HISTORY ===== */}
                <VisitHistorySection appointments={patient?.appointments || []} router={router} patientId={patientId} />
              </>
            )
          })()}
        </TabsContent>

        {/* ==================== DENTAL CHART TAB ==================== */}
        <TabsContent value="dental-chart" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h2 className="text-lg font-semibold">Dental Chart</h2>
            <Button size="sm" variant="outline" onClick={() => router.push(`/admin/chart?patientId=${patientId}`)}>
              <Edit className="w-4 h-4 mr-1" /> Open Full Editor
            </Button>
          </div>
          <DentalChartTab
            patientId={patientId}
            chartVersions={chartVersions}
            refreshKey={workspaceRefreshKey}
            onRefresh={() => {
              setWorkspaceRefreshKey(k => k + 1)
              fetchDentalData()
            }}
          />
        </TabsContent>

        {/* ==================== TIMELINE TAB ==================== */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Chart Timeline
              </h2>
              <p className="text-sm text-gray-500">Chronological record of visits, procedures, diagnoses, payments and sub-procedures.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setActiveTab('dental-chart')}>
              <Stethoscope className="w-4 h-4 mr-1" /> Open Dental Chart
            </Button>
          </div>
          <ChartTimeline
            patientId={patientId}
            refreshKey={workspaceRefreshKey}
            onChanged={() => {
              setWorkspaceRefreshKey(k => k + 1)
              fetchDentalData()
            }}
            onViewOnChart={() => setActiveTab('dental-chart')}
          />

          {/* Wave 3b: Field-level audit viewer */}
          <PatientAuditViewer patientId={patientId} refreshKey={workspaceRefreshKey} />
        </TabsContent>

        {/* ==================== UPLOAD DOCS TAB ==================== */}
        <TabsContent value="upload-docs" className="space-y-4">
          <UploadDocsTab
            patientId={patientId}
            uploads={uploads}
            fetchUploads={fetchUploads}
            onReviewUpload={(upload: any) => {
              setCurrentUploadId(upload.id)
              setExtractedData(upload.extractedData)
              setEditedExtraction(upload.extractedData)
              setShowReviewDialog(true)
            }}
            onOcrReviewFields={(fields: Record<string, any>, _ocrText: string, upload: any) => {
              // Reuse the existing review-and-save dialog with OCR-detected fields.
              // Nothing is saved until the user explicitly clicks "Save to Records".
              setCurrentUploadId(upload.id)
              setExtractedData(fields)
              setEditedExtraction(fields)
              setShowReviewDialog(true)
            }}
          />
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}

      {/* Add Visit Dialog */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Visit</DialogTitle>
            <DialogDescription>Record a patient visit with diagnosis and treatment details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Visit Date/Time</Label><Input type="datetime-local" value={visitForm.visitDate} onChange={e => setVisitForm({ ...visitForm, visitDate: e.target.value })} /></div>
            <div><Label className="text-xs">Visit Type</Label>
              <Select value={visitForm.appointmentType} onValueChange={v => setVisitForm({ ...visitForm, appointmentType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="x_ray">X-Ray</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label className="text-xs">Attending Dentist</Label><Input value={visitForm.attendingDentist} onChange={e => setVisitForm({ ...visitForm, attendingDentist: e.target.value })} placeholder="Dr. Name" /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Chief Complaint</Label><Textarea value={visitForm.chiefComplaint} onChange={e => setVisitForm({ ...visitForm, chiefComplaint: e.target.value })} placeholder="Patient's main concern..." rows={2} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Findings</Label><Textarea value={visitForm.findings} onChange={e => setVisitForm({ ...visitForm, findings: e.target.value })} placeholder="Clinical findings..." rows={2} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Diagnosis</Label><Textarea value={visitForm.diagnosis} onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })} placeholder="Diagnosis..." rows={2} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Treatment Done</Label><Textarea value={visitForm.treatmentDone} onChange={e => setVisitForm({ ...visitForm, treatmentDone: e.target.value })} placeholder="Treatment performed..." rows={2} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Prescriptions</Label><Textarea value={visitForm.prescriptions} onChange={e => setVisitForm({ ...visitForm, prescriptions: e.target.value })} placeholder="Medications prescribed..." rows={2} /></div>
            <div><Label className="text-xs">Follow-up Instructions</Label><Textarea value={visitForm.followUpInstructions} onChange={e => setVisitForm({ ...visitForm, followUpInstructions: e.target.value })} placeholder="Instructions..." rows={2} /></div>
            <div><Label className="text-xs">Follow-up Date</Label><Input type="date" value={visitForm.followUpDate} onChange={e => setVisitForm({ ...visitForm, followUpDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisitDialog(false)}>Cancel</Button>
            <Button onClick={handleAddVisit} disabled={dialogSaving}>
              {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Procedure Dialog */}
      <Dialog open={showProcedureDialog} onOpenChange={setShowProcedureDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Procedure</DialogTitle>
            <DialogDescription>Log a dental procedure with tooth-specific details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">Procedure Type</Label>
              <Popover open={procedureTypeOpen} onOpenChange={setProcedureTypeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={procedureTypeOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={procedureForm.procedureType ? '' : 'text-muted-foreground'}>
                      {procedureForm.procedureType || 'Search procedure or type custom…'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search procedure..."
                      value={procedureTypeSearch}
                      onValueChange={setProcedureTypeSearch}
                    />
                    <CommandList>
                      {loadingTreatments ? (
                        <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
                        </div>
                      ) : (
                        (() => {
                          const q = procedureTypeSearch.trim().toLowerCase()
                          const filtered = q
                            ? treatmentCatalog.filter((t: any) =>
                                t.name?.toLowerCase().includes(q) ||
                                t.treatmentCode?.toLowerCase().includes(q) ||
                                t.category?.toLowerCase().includes(q)
                              )
                            : treatmentCatalog
                          const grouped: Record<string, any[]> = {}
                          for (const t of filtered) {
                            const cat = t.category || 'General'
                            if (!grouped[cat]) grouped[cat] = []
                            grouped[cat].push(t)
                          }
                          const categories = Object.keys(grouped).sort()
                          const exactMatch = treatmentCatalog.some((t: any) =>
                            t.name?.toLowerCase() === q
                          )
                          const canAddCustom = q.length > 0 && !exactMatch
                          return (
                            <>
                              {filtered.length === 0 && !canAddCustom && (
                                <CommandEmpty>No procedures found.</CommandEmpty>
                              )}
                              {categories.map(cat => (
                                <CommandGroup key={cat} heading={cat}>
                                  {grouped[cat].map((t: any) => (
                                    <CommandItem
                                      key={t.id}
                                      value={t.name}
                                      onSelect={() => {
                                        setProcedureForm({ ...procedureForm, procedureType: t.name })
                                        setProcedureTypeOpen(false)
                                        setProcedureTypeSearch('')
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          procedureForm.procedureType === t.name ? 'opacity-100' : 'opacity-0'
                                        }`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm">{t.name}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                          {t.treatmentCode && <span className="font-mono">{t.treatmentCode}</span>}
                                          {t.baseCost != null && (
                                            <span>₱{Number(t.baseCost).toLocaleString()}</span>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                              {canAddCustom && (
                                <>
                                  {categories.length > 0 && <CommandSeparator />}
                                  <CommandGroup heading="Custom">
                                    <CommandItem
                                      value={`__custom_${procedureTypeSearch}`}
                                      onSelect={() => {
                                        setProcedureForm({
                                          ...procedureForm,
                                          procedureType: procedureTypeSearch.trim(),
                                        })
                                        setProcedureTypeOpen(false)
                                        setProcedureTypeSearch('')
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      <span>
                                        Use custom:{' '}
                                        <span className="font-semibold">&quot;{procedureTypeSearch.trim()}&quot;</span>
                                      </span>
                                    </CommandItem>
                                  </CommandGroup>
                                </>
                              )}
                            </>
                          )
                        })()
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {procedureForm.procedureType && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{procedureForm.procedureType}</span>
                  <button
                    type="button"
                    className="ml-2 underline hover:text-foreground"
                    onClick={() => setProcedureForm({ ...procedureForm, procedureType: '' })}
                  >
                    clear
                  </button>
                </div>
              )}
            </div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={procedureForm.procedureDate} onChange={e => setProcedureForm({ ...procedureForm, procedureDate: e.target.value })} /></div>
            <div><Label className="text-xs">Dentist</Label><Input value={procedureForm.dentistName} onChange={e => setProcedureForm({ ...procedureForm, dentistName: e.target.value })} placeholder="Dr. Name" /></div>
            <div><Label className="text-xs">Teeth Involved (comma-separated)</Label><Input value={procedureForm.teethInvolved} onChange={e => setProcedureForm({ ...procedureForm, teethInvolved: e.target.value })} placeholder="e.g., 14, 15, 36" /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Pre-op Notes</Label><Textarea value={procedureForm.notesBefore} onChange={e => setProcedureForm({ ...procedureForm, notesBefore: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Post-op Notes</Label><Textarea value={procedureForm.notesAfter} onChange={e => setProcedureForm({ ...procedureForm, notesAfter: e.target.value })} rows={2} /></div>
            <div><Label className="text-xs">Complications</Label><Textarea value={procedureForm.complications} onChange={e => setProcedureForm({ ...procedureForm, complications: e.target.value })} rows={2} /></div>
            <div><Label className="text-xs">Follow-up Recommendations</Label><Textarea value={procedureForm.followUpRecs} onChange={e => setProcedureForm({ ...procedureForm, followUpRecs: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcedureDialog(false)}>Cancel</Button>
            <Button onClick={handleAddProcedure} disabled={dialogSaving || !procedureForm.procedureType}>
              {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Procedure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Clinical Note</DialogTitle>
            <DialogDescription>Add a note with diagnosis, recommendation, or follow-up tag.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Note Type</Label>
              <Select value={noteForm.noteType} onValueChange={v => setNoteForm({ ...noteForm, noteType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="diagnosis">Diagnosis</SelectItem>
                  <SelectItem value="recommendation">Recommendation</SelectItem>
                  <SelectItem value="follow_up">Follow-up Needed</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="warning">Warning/Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Content</Label><Textarea value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Write your clinical note..." rows={5} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="internalNote" checked={noteForm.isInternal} onChange={e => setNoteForm({ ...noteForm, isInternal: e.target.checked })} className="rounded" />
              <Label htmlFor="internalNote" className="text-xs cursor-pointer">Internal note (staff only)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={dialogSaving || !noteForm.content.trim()}>
              {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Smart Document Upload</DialogTitle>
            <DialogDescription>Upload x-rays, dental records, or handwritten notes. AI will automatically extract data for review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer" onClick={() => document.getElementById('file-upload-input')?.click()}>
              {uploadFile ? (
                <div className="space-y-2">
                  <FileImage className="w-10 h-10 text-primary mx-auto" />
                  <p className="font-medium text-sm">{uploadFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setUploadFile(null) }}>
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Click or drag & drop to upload</p>
                  <p className="text-xs text-gray-400">Supports: Images (JPG, PNG), PDFs, Text files</p>
                </div>
              )}
              <input id="file-upload-input" type="file" className="hidden" accept="image/*,.pdf,.txt,.doc,.docx" onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]) }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFile(null) }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Scanning...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Upload & Scan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Extracted Data Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={(open) => { if (!open) closeSaveDialog() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-600" /> Review Extracted Data</DialogTitle>
            <DialogDescription>{savedResults ? 'Data has been saved to the patient\'s records.' : 'AI extracted the following data. Review, select what to save, and confirm.'}</DialogDescription>
          </DialogHeader>

          {savedResults ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-green-800 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Successfully Saved</p>
                {savedResults.visitRecord && <p className="text-sm text-green-700">✓ Visit record created (Date: {savedResults.visitRecord.visitDate?.slice(0,10)})</p>}
                {savedResults.procedureRecords?.length > 0 && <p className="text-sm text-green-700">✓ {savedResults.procedureRecords.length} procedure(s) recorded</p>}
                {savedResults.clinicalNotes?.length > 0 && <p className="text-sm text-green-700">✓ {savedResults.clinicalNotes.length} clinical note(s) added</p>}
                {savedResults.medicalHistoryUpdated && <p className="text-sm text-green-700">✓ Medical history updated</p>}
                {savedResults.dentalChartVersion && <p className="text-sm text-green-700">✓ Dental chart version created</p>}
                {savedResults.uploadMarked && <p className="text-sm text-green-700">✓ Upload marked as processed</p>}
              </div>
              <DialogFooter>
                <Button onClick={closeSaveDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {/* Save Options */}
              <Card className="p-4 bg-blue-50/50 border-blue-200">
                <p className="font-medium text-sm mb-3 text-blue-800">Save Options — Choose what to create:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'savePatientInfo', label: 'Auto-fill Patient Info' },
                    { key: 'savePatientId', label: 'Save Valid ID Details' },
                    { key: 'saveVisit', label: 'Create Visit Record' },
                    { key: 'saveProcedures', label: 'Save Procedures' },
                    { key: 'saveNotes', label: 'Add Clinical Notes' },
                    { key: 'saveMedicalHistory', label: 'Update Medical History' },
                    { key: 'saveToChart', label: 'Update Dental Chart' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={(saveOptions as any)[opt.key]} onChange={e => setSaveOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-blue-700/70 mt-2 italic">Existing patient fields are never overwritten — only empty fields will be filled.</p>
              </Card>

              {/* Editable extraction fields */}
              {editedExtraction && (
                <div className="space-y-3">
                  {Object.entries(editedExtraction).map(([key, value]: [string, any]) => {
                    if (value === null || value === undefined) return null
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    if (typeof value === 'object' && !Array.isArray(value)) {
                      return (
                        <Card key={key} className="p-3">
                          <p className="font-medium text-sm mb-2">{label}</p>
                          {Object.entries(value).map(([subKey, subVal]: [string, any]) => (
                            <div key={subKey} className="mb-2">
                              <Label className="text-xs">{subKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Label>
                              <Input value={subVal || ''} onChange={e => {
                                const updated = { ...editedExtraction }
                                updated[key] = { ...updated[key], [subKey]: e.target.value }
                                setEditedExtraction(updated)
                              }} />
                            </div>
                          ))}
                        </Card>
                      )
                    }
                    if (Array.isArray(value)) {
                      return (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Textarea value={value.join(', ')} onChange={e => {
                            const updated = { ...editedExtraction }
                            updated[key] = e.target.value.split(',').map((s: string) => s.trim())
                            setEditedExtraction(updated)
                          }} rows={2} />
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
                <Button variant="outline" onClick={closeSaveDialog}>Cancel</Button>
                <Button onClick={handleSaveExtraction} disabled={dialogSaving}>
                  {dialogSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />} Confirm & Save to Records
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailItem && (() => { const Icon = typeIcons[detailItem.type] || FileText; return <div className={`w-6 h-6 rounded-full flex items-center justify-center ${typeColors[detailItem.type]}`}><Icon className="w-3 h-3" /></div> })()}
              {detailItem?.title}
            </DialogTitle>
            <DialogDescription>
              {detailItem ? `${format(parseISO(detailItem.date), 'MMMM d, yyyy h:mm a')}${detailItem.dentist ? ` • ${detailItem.dentist}` : ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailItem?.data && (
            <div className="space-y-3 text-sm">
              {Object.entries(detailItem.data).map(([key, val]: [string, any]) => {
                if (['id', 'patientId', 'createdBy', 'updatedAt', 'dentistId', 'updatedById', 'visitRecordId', 'uploadedBy', 'reviewedBy', 'cloudStoragePath', 'fileName', 'previousVersion', 'authorId'].includes(key)) return null
                if (val === null || val === undefined || val === '') return null
                if (key === 'chartData' && typeof val === 'object' && val !== null) {
                  const toothNames: Record<string, string> = {
                    '11':'Upper Right Central Incisor','12':'Upper Right Lateral Incisor','13':'Upper Right Canine','14':'Upper Right 1st Premolar','15':'Upper Right 2nd Premolar','16':'Upper Right 1st Molar','17':'Upper Right 2nd Molar','18':'Upper Right 3rd Molar',
                    '21':'Upper Left Central Incisor','22':'Upper Left Lateral Incisor','23':'Upper Left Canine','24':'Upper Left 1st Premolar','25':'Upper Left 2nd Premolar','26':'Upper Left 1st Molar','27':'Upper Left 2nd Molar','28':'Upper Left 3rd Molar',
                    '31':'Lower Left Central Incisor','32':'Lower Left Lateral Incisor','33':'Lower Left Canine','34':'Lower Left 1st Premolar','35':'Lower Left 2nd Premolar','36':'Lower Left 1st Molar','37':'Lower Left 2nd Molar','38':'Lower Left 3rd Molar',
                    '41':'Lower Right Central Incisor','42':'Lower Right Lateral Incisor','43':'Lower Right Canine','44':'Lower Right 1st Premolar','45':'Lower Right 2nd Premolar','46':'Lower Right 1st Molar','47':'Lower Right 2nd Molar','48':'Lower Right 3rd Molar',
                  }
                  const affectedTeeth = Object.entries(val).filter(([_, tooth]: [string, any]) => {
                    if (!tooth || typeof tooth !== 'object') return false
                    const hasSurface = tooth.surfaces && Object.values(tooth.surfaces).some((s: any) => s !== null && s !== '')
                    const hasWhole = tooth.wholeTooth !== null && tooth.wholeTooth !== '' && tooth.wholeTooth !== undefined
                    const hasNotes = Array.isArray(tooth.notes) && tooth.notes.length > 0
                    return hasSurface || hasWhole || hasNotes
                  })
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-gray-500 mb-2">Dental Chart Summary</p>
                      {affectedTeeth.length === 0 ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <p className="text-green-700 font-medium text-sm">All teeth healthy — no findings recorded</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400">{affectedTeeth.length} {affectedTeeth.length === 1 ? 'tooth' : 'teeth'} with findings</p>
                          {affectedTeeth.map(([num, tooth]: [string, any]) => {
                            const surfaces = tooth.surfaces ? Object.entries(tooth.surfaces).filter(([_, v]: [string, any]) => v !== null && v !== '').map(([s, v]: [string, any]) => `${s}: ${v}`) : []
                            return (
                              <div key={num} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2D9DA8] text-white text-xs font-bold">{num}</span>
                                  <span className="font-medium text-sm text-gray-800">{toothNames[num] || `Tooth #${num}`}</span>
                                </div>
                                {tooth.wholeTooth && (
                                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 capitalize">{tooth.wholeTooth}</span>
                                )}
                                {surfaces.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {surfaces.map((s: string, i: number) => (
                                      <span key={i} className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 capitalize">{s}</span>
                                    ))}
                                  </div>
                                )}
                                {tooth.notes && tooth.notes.length > 0 && (
                                  <p className="mt-1.5 text-xs text-gray-600 italic">{tooth.notes.join('; ')}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }
                if (key === 'extractedData' || key === 'confidenceScores') {
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>
                    </div>
                  )
                }
                if (Array.isArray(val)) {
                  if (val.length === 0) return null
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <p>{val.join(', ')}</p>
                    </div>
                  )
                }
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500">{label}</p>
                    <p className="text-gray-900">{typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
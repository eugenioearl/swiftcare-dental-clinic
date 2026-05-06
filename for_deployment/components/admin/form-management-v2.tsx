'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, FileText, GripVertical, X, Copy, ShieldCheck, Loader2, ArrowUp, ArrowDown, GitBranch, ArrowUpCircle, Eye, EyeOff, GitCompare, History, Users, Pen, CheckCircle, RotateCcw } from 'lucide-react'
import { ConsentBodyTemplateCard } from '@/components/admin/consent-body-template-card'
import { useConfirm } from '@/components/providers/confirm-provider'

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'signature' | 'number' | 'email' | 'tel'
  label: string
  required?: boolean
  options?: string[]
  placeholder?: string
  helpText?: string
  patientField?: string
}

type RequirementStage = 'check_in' | 'before_procedure' | 'before_payment' | 'discharge'
type FormStatus = 'draft' | 'active' | 'inactive' | 'archived'

interface ClinicServiceLite {
  id: string
  name: string
  displayName?: string | null
  category?: string | null
  isOfficial?: boolean
  isActive?: boolean
}

interface PackageTemplateLite {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
}

interface FormTemplate {
  id: string
  key: string
  familyKey?: string | null
  title: string
  description: string | null
  category: string
  fields: FormField[]
  requiredForAppointmentTypes: string[] | null
  requiredForTreatmentIds: string[] | null
  requiredForTreatmentCategories: string[] | null
  requiredForServiceIds: string[] | null
  requiredForPackageTemplateIds: string[] | null
  requirementStages?: RequirementStage[] | null
  requiredAlways: boolean
  isActive: boolean
  isSystem: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  version?: number
  status?: FormStatus
  supersedesId?: string | null
  minorOnly?: boolean
  adultOnly?: boolean
  requiresGuardian?: boolean
  effectiveDate?: string | null
}

interface FormFamily {
  familyKey: string
  title: string
  category: string
  description: string | null
  isSystem: boolean
  requiredAlways: boolean
  activeVersion: FormTemplate | null
  draftVersion: FormTemplate | null
  versions: FormTemplate[]
}

const REQUIREMENT_STAGES: { value: RequirementStage; label: string; desc: string }[] = [
  { value: 'check_in', label: 'Check-in', desc: 'Before the appointment starts' },
  { value: 'before_procedure', label: 'Before Procedure', desc: 'Right before treatment begins' },
  { value: 'before_payment', label: 'Before Payment', desc: 'Prior to payment collection' },
  { value: 'discharge', label: 'Discharge', desc: 'At the end of the visit' },
]

const STATUS_COLORS: Record<FormStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  archived: 'bg-slate-100 text-slate-700 border-slate-200',
}

interface Treatment {
  id: string
  treatmentCode: string
  name: string
  category: string
  isActive: boolean
}

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'intake', label: 'Intake', color: 'bg-blue-100 text-blue-800' },
  { value: 'medical', label: 'Medical History', color: 'bg-green-100 text-green-800' },
  { value: 'consent', label: 'Consent', color: 'bg-purple-100 text-purple-800' },
  { value: 'financial', label: 'Financial', color: 'bg-amber-100 text-amber-800' },
  { value: 'data_completion', label: 'Data Completion', color: 'bg-rose-100 text-rose-800' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' },
]

const APPT_TYPES = ['consultation', 'cleaning', 'xray', 'extraction', 'root_canal', 'implant', 'surgery', 'emergency', 'procedure', 'followup', 'orthodontic']

const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown (single)' },
  { value: 'radio', label: 'Radio (single)' },
  { value: 'checkbox', label: 'Checkbox (agree/yes)' },
  { value: 'signature', label: 'Signature' },
]

const PATIENT_FIELD_OPTIONS = [
  { value: 'none', label: 'None (do not sync)' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'fullName', label: 'Full Name' },
  { value: 'mobileNumber', label: 'Mobile Number' },
  { value: 'emailDirect', label: 'Email' },
  { value: 'dateOfBirth', label: 'Date of Birth' },
  { value: 'gender', label: 'Gender' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'emergencyContactName', label: 'Emergency Contact Name' },
  { value: 'emergencyContactPhone', label: 'Emergency Contact Phone' },
  { value: 'emergencyContactRelationship', label: 'Emergency Contact Relationship' },
  { value: 'medicalHistory', label: 'Medical History' },
  { value: 'currentMedications', label: 'Current Medications' },
  { value: 'allergies', label: 'Allergies' },
  { value: 'pregnancyStatus', label: 'Pregnancy Status' },
  { value: 'dentalAnxieties', label: 'Dental Anxieties' },
]

function catLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label || v
}
function catColor(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.color || 'bg-gray-100 text-gray-800'
}

export default function FormManagementV2() {
  const { confirm } = useConfirm()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [families, setFamilies] = useState<FormFamily[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [services, setServices] = useState<ClinicServiceLite[]>([])
  const [packageTemplates, setPackageTemplates] = useState<PackageTemplateLite[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FormTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<FormTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  // Versioning UI state
  const [viewingFamily, setViewingFamily] = useState<FormFamily | null>(null)
  const [compareA, setCompareA] = useState<FormTemplate | null>(null)
  const [compareB, setCompareB] = useState<FormTemplate | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [creatingDraftFrom, setCreatingDraftFrom] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [tRes, fRes, trRes, svRes, ptRes] = await Promise.all([
        fetch('/api/form-templates'),
        fetch('/api/form-templates?groupBy=family'),
        fetch('/api/treatments?isActive=true'),
        fetch('/api/admin/services'),
        fetch('/api/package-templates'),
      ])
      if (!tRes.ok) throw new Error('Failed to load templates')
      const data = await tRes.json()
      setTemplates(data.templates || [])
      if (fRes.ok) {
        const fd = await fRes.json()
        setFamilies(fd.families || [])
      }
      if (trRes.ok) {
        const td = await trRes.json()
        setTreatments(td?.data?.treatments || [])
      }
      if (svRes.ok) {
        const sd = await svRes.json()
        const list = Array.isArray(sd?.data) ? sd.data : (Array.isArray(sd) ? sd : [])
        setServices(list)
      }
      if (ptRes.ok) {
        const pd = await ptRes.json()
        const list = Array.isArray(pd?.data) ? pd.data : (Array.isArray(pd) ? pd : [])
        setPackageTemplates(list)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  // Create a draft new version from an existing template
  const createNewVersion = async (sourceId: string) => {
    setCreatingDraftFrom(sourceId)
    try {
      const res = await fetch(`/api/form-templates/${sourceId}/new-version`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create new version')
      }
      const data = await res.json()
      toast.success(`Draft v${data.template?.version} created`)
      await load()
      // Immediately open it for editing
      setIsNew(false)
      setEditing(data.template)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create new version')
    }
    setCreatingDraftFrom(null)
  }

  // Promote a draft version to active (archives the previous active automatically)
  const promoteVersion = async (t: FormTemplate) => {
    const ok = await confirm({
      title: `Promote v${t.version} to active?`,
      description: `This will archive the currently active version of "${t.title}".`,
      confirmLabel: 'Promote',
      variant: 'warning',
    })
    if (!ok) return
    setPromotingId(t.id)
    try {
      const res = await fetch(`/api/form-templates/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', isActive: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Promotion failed')
      }
      toast.success(`v${t.version} is now active`)
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Promotion failed')
    }
    setPromotingId(null)
  }

  const openCompare = (a: FormTemplate, b: FormTemplate) => {
    setCompareA(a)
    setCompareB(b)
    setCompareOpen(true)
  }

  useEffect(() => {
    load()
  }, [])

  // Unique treatment categories for quick category-based rules
  const treatmentCategories = Array.from(
    new Set(treatments.map((t) => t.category).filter(Boolean))
  ).sort()

  // Group treatments by category for UI grouping
  const treatmentsByCategory = treatments.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, Treatment[]>)

  const getTreatmentName = (id: string) => treatments.find((t) => t.id === id)?.name || id

  const startCreate = () => {
    setIsNew(true)
    setShowPreview(false)
    setEditing({
      id: '',
      key: '',
      familyKey: '',
      title: '',
      description: '',
      category: 'consent',
      fields: [{ id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true }],
      requiredForAppointmentTypes: [],
      requiredForTreatmentIds: [],
      requiredForTreatmentCategories: [],
      requiredForServiceIds: [],
      requiredForPackageTemplateIds: [],
      requirementStages: ['check_in'],
      requiredAlways: false,
      isActive: true,
      isSystem: false,
      displayOrder: 100,
      createdAt: '',
      updatedAt: '',
      version: 1,
      status: 'active',
      minorOnly: false,
      adultOnly: false,
      requiresGuardian: false,
    })
  }

  const startEdit = (t: FormTemplate) => {
    setIsNew(false)
    setShowPreview(false)
    setEditing(JSON.parse(JSON.stringify(t)))
  }

  const startDuplicate = (t: FormTemplate) => {
    setIsNew(true)
    setShowPreview(false)
    const copy = JSON.parse(JSON.stringify(t)) as FormTemplate
    copy.id = ''
    copy.key = ''
    copy.title = `${t.title} (Copy)`
    copy.isSystem = false
    setEditing(copy)
  }

  const save = async () => {
    if (!editing) return
    if (!editing.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (editing.fields.length === 0) {
      toast.error('At least one field is required')
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        title: editing.title,
        description: editing.description,
        category: editing.category,
        fields: editing.fields,
        requiredForAppointmentTypes: editing.requiredForAppointmentTypes?.length
          ? editing.requiredForAppointmentTypes
          : null,
        requiredForTreatmentIds: editing.requiredForTreatmentIds?.length
          ? editing.requiredForTreatmentIds
          : null,
        requiredForTreatmentCategories: editing.requiredForTreatmentCategories?.length
          ? editing.requiredForTreatmentCategories
          : null,
        requiredForServiceIds: editing.requiredForServiceIds?.length
          ? editing.requiredForServiceIds
          : null,
        requiredForPackageTemplateIds: editing.requiredForPackageTemplateIds?.length
          ? editing.requiredForPackageTemplateIds
          : null,
        requirementStages: editing.requirementStages || [],
        requiredAlways: editing.requiredAlways,
        isActive: editing.isActive,
        displayOrder: editing.displayOrder,
        minorOnly: editing.minorOnly || false,
        adultOnly: editing.adultOnly || false,
        requiresGuardian: editing.requiresGuardian || false,
      }
      if (editing.status) payload.status = editing.status
      if (isNew && editing.familyKey) payload.familyKey = editing.familyKey
      const url = isNew ? '/api/form-templates' : `/api/form-templates/${editing.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      toast.success(isNew ? 'Template created' : 'Template updated')
      setEditing(null)
      setIsNew(false)
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      const res = await fetch(`/api/form-templates/${deleting.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Delete failed')
      }
      toast.success('Template deleted')
      setDeleting(null)
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    }
  }

  const toggleActive = async (t: FormTemplate) => {
    try {
      const res = await fetch(`/api/form-templates/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !t.isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(!t.isActive ? 'Activated' : 'Deactivated')
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Forms &amp; Auto-Attach Rules</h2>
          <p className="text-muted-foreground">
            Configure dynamic form templates and auto-attach rules. Rules can target appointment types, individual
            procedures, treatment categories, clinic services, and package templates — one form can mix and match
            any of these. Duplicates (by title) are prevented automatically during generation.
          </p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-900 space-y-1">
              <p className="font-medium">How auto-attach works</p>
              <p>
                When staff clicks &quot;Auto-Attach Forms&quot; during check-in, the system evaluates the appointment and includes
                every template that matches <span className="font-semibold">any</span> of the rules below:
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li><span className="font-medium">Required always</span> — included on every check-in.</li>
                <li><span className="font-medium">Appointment type</span> — included when the appointment type matches.</li>
                <li><span className="font-medium">Treatment</span> — included when the appointment has specific treatments linked.</li>
                <li><span className="font-medium">Treatment category</span> — included when any appointment treatment belongs to one of the selected categories (e.g. <em>surgical</em>).</li>
              </ul>
              <p className="mt-1">If multiple rules match the same template, the form is attached <span className="font-semibold">only once</span> — no duplicates.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConsentBodyTemplateCard />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : families.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. Click &quot;New Template&quot; to create your first form.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {families.map((fam) => {
            // Display the active version if it exists; else the most recent draft; else the most recent in family
            const t: FormTemplate = fam.activeVersion || fam.draftVersion || fam.versions[0]
            if (!t) return null
            const versionCount = fam.versions.length
            return (
            <Card key={fam.familyKey} className={t.status === 'archived' || (!t.isActive && t.status !== 'draft') ? 'opacity-70' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base truncate">{t.title}</CardTitle>
                      {t.isSystem && (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="w-3 h-3" /> System
                        </Badge>
                      )}
                      <Badge variant="outline" className={STATUS_COLORS[(t.status || 'active') as FormStatus]}>
                        {(t.status || 'active').toUpperCase()}
                      </Badge>
                      {t.version ? (
                        <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800">v{t.version}</Badge>
                      ) : null}
                      {versionCount > 1 && (
                        <Badge variant="outline" className="gap-1">
                          <GitBranch className="w-3 h-3" /> {versionCount} versions
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 mt-1">{t.description || 'No description'}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge className={catColor(t.category)}>{catLabel(t.category)}</Badge>
                  {t.requiredAlways && <Badge className="bg-red-100 text-red-800 border-red-200">Required Always</Badge>}
                  <Badge variant="outline">{t.fields?.length || 0} fields</Badge>
                  {t.minorOnly && <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">Minors Only</Badge>}
                  {t.adultOnly && <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200">Adults Only</Badge>}
                  {t.requiresGuardian && <Badge variant="outline" className="bg-pink-50 text-pink-800 border-pink-200">Guardian Sig</Badge>}
                  {(t.requirementStages || []).map((s) => (
                    <Badge key={s} variant="outline" className="text-xs bg-teal-50 text-teal-800 border-teal-200">
                      {REQUIREMENT_STAGES.find((x) => x.value === s)?.label || s}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {t.requiredForAppointmentTypes && t.requiredForAppointmentTypes.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">Auto-attach for appointment types:</div>
                    <div className="flex flex-wrap gap-1">
                      {t.requiredForAppointmentTypes.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-800">
                          {a.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {t.requiredForTreatmentCategories && t.requiredForTreatmentCategories.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">Auto-attach for treatment categories:</div>
                    <div className="flex flex-wrap gap-1">
                      {t.requiredForTreatmentCategories.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-800">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {t.requiredForTreatmentIds && t.requiredForTreatmentIds.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">Auto-attach for treatments:</div>
                    <div className="flex flex-wrap gap-1">
                      {t.requiredForTreatmentIds.slice(0, 4).map((id) => (
                        <Badge key={id} variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-800">
                          {getTreatmentName(id)}
                        </Badge>
                      ))}
                      {t.requiredForTreatmentIds.length > 4 && (
                        <Badge variant="outline" className="text-xs">+{t.requiredForTreatmentIds.length - 4} more</Badge>
                      )}
                    </div>
                  </div>
                )}
                {t.requiredForPackageTemplateIds && t.requiredForPackageTemplateIds.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">Auto-attach for package templates:</div>
                    <div className="flex flex-wrap gap-1">
                      {t.requiredForPackageTemplateIds.slice(0, 4).map((id) => {
                        const pt = packageTemplates.find((p) => p.id === id)
                        return (
                          <Badge key={id} variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-800">
                            {pt?.name || id}
                          </Badge>
                        )
                      })}
                      {t.requiredForPackageTemplateIds.length > 4 && (
                        <Badge variant="outline" className="text-xs">+{t.requiredForPackageTemplateIds.length - 4} more</Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => startEdit(t)} className="gap-1">
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startDuplicate(t)} className="gap-1">
                    <Copy className="w-3 h-3" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createNewVersion(t.id)}
                    disabled={creatingDraftFrom === t.id}
                    className="gap-1 text-[#2D9DA8] border-[#2D9DA8]/30 hover:bg-[#2D9DA8]/5"
                    title="Create a new draft version based on this template"
                  >
                    {creatingDraftFrom === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                    New Version
                  </Button>
                  {versionCount > 1 && (
                    <Button size="sm" variant="outline" onClick={() => setViewingFamily(fam)} className="gap-1">
                      <History className="w-3 h-3" /> Versions ({versionCount})
                    </Button>
                  )}
                  {t.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => promoteVersion(t)}
                      disabled={promotingId === t.id}
                      className="gap-1 bg-[#22B573] hover:bg-[#1ea069] text-white"
                      title="Activate this draft (archives the current active version)"
                    >
                      {promotingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                      Promote
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setDeleting(t)} className="text-red-600 hover:text-red-700 gap-1 ml-auto">
                    <Trash2 className="w-3 h-3" /> {(t.isSystem || versionCount > 1) ? 'Archive' : 'Delete'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      {/* Family Versions Dialog */}
      <Dialog open={!!viewingFamily} onOpenChange={(o) => !o && setViewingFamily(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#2D9DA8]" />
              Version History: {viewingFamily?.title}
            </DialogTitle>
            <DialogDescription>
              View, edit, promote, or compare any version of this form. Draft versions can be promoted to active (which archives the current active version).
            </DialogDescription>
          </DialogHeader>
          {viewingFamily && (
            <div className="space-y-3">
              {viewingFamily.versions.map((v) => (
                <Card key={v.id} className={v.status === 'archived' ? 'opacity-75' : ''}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">Version {v.version}</span>
                          <Badge variant="outline" className={STATUS_COLORS[(v.status || 'active') as FormStatus]}>
                            {(v.status || 'active').toUpperCase()}
                          </Badge>
                          {v.effectiveDate && (
                            <Badge variant="outline" className="text-xs">
                              Effective {new Date(v.effectiveDate).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {v.fields?.length || 0} field{v.fields?.length !== 1 ? 's' : ''} · Created {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => { setViewingFamily(null); startEdit(v) }} className="gap-1">
                          <Edit className="w-3 h-3" /> Edit
                        </Button>
                        {viewingFamily.activeVersion && v.id !== viewingFamily.activeVersion.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCompare(viewingFamily.activeVersion!, v)}
                            className="gap-1"
                          >
                            <GitCompare className="w-3 h-3" /> Compare to Active
                          </Button>
                        )}
                        {v.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => promoteVersion(v)}
                            disabled={promotingId === v.id}
                            className="gap-1 bg-[#22B573] hover:bg-[#1ea069] text-white"
                          >
                            {promotingId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                            Promote
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFamily(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Compare Dialog */}
      <Dialog open={compareOpen} onOpenChange={(o) => { if (!o) { setCompareOpen(false); setCompareA(null); setCompareB(null) } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#2D9DA8]" />
              Compare Versions
            </DialogTitle>
            <DialogDescription>
              Side-by-side comparison. Differences are highlighted.
            </DialogDescription>
          </DialogHeader>
          {compareA && compareB && (
            <VersionDiff a={compareA} b={compareB} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCompareOpen(false); setCompareA(null); setCompareB(null) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'New Form Template' : `Edit: ${editing?.title}`}</DialogTitle>
            <DialogDescription>
              Define fields below. Mark a field as signable to collect a patient signature. Patient Field mapping lets form responses auto-update the patient record.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Title *</Label>
                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input type="number" value={editing.displayOrder} onChange={(e) => setEditing({ ...editing, displayOrder: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Required on every appointment</Label>
                    <p className="text-xs text-muted-foreground">When enabled, this form is auto-selected for every check-in.</p>
                  </div>
                  <Switch checked={editing.requiredAlways} onCheckedChange={(v) => setEditing({ ...editing, requiredAlways: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Template Active</Label>
                    <p className="text-xs text-muted-foreground">Inactive templates are hidden from staff.</p>
                  </div>
                  <Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v, status: v ? 'active' : 'inactive' })} />
                </div>

                {/* Versioning info */}
                {!isNew && (editing.version || editing.status) && (
                  <div className="grid md:grid-cols-3 gap-3 p-3 rounded-md bg-blue-50/60 border border-blue-200">
                    <div>
                      <Label className="text-xs">Version</Label>
                      <div className="text-sm font-medium">v{editing.version || 1}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={editing.status || 'active'}
                        onValueChange={(v) => setEditing({ ...editing, status: v as FormStatus, isActive: v === 'active' })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active (publish now)</SelectItem>
                          <SelectItem value="inactive">Inactive (hidden)</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Effective Date</Label>
                      <Input
                        type="date"
                        className="h-8"
                        value={editing.effectiveDate ? editing.effectiveDate.slice(0, 10) : ''}
                        onChange={(e) => setEditing({ ...editing, effectiveDate: e.target.value || null })}
                      />
                    </div>
                  </div>
                )}

                {/* Requirement stages */}
                <div>
                  <Label>When should this form be collected? (requirement stages)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pick one or more stages when staff will be prompted to attach this form during the patient journey.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {REQUIREMENT_STAGES.map((s) => {
                      const list = editing.requirementStages || []
                      const checked = list.includes(s.value)
                      return (
                        <label key={s.value} className="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-muted">
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            onCheckedChange={(v) => {
                              const current = editing.requirementStages || []
                              const updated = v ? [...current, s.value] : current.filter((x) => x !== s.value)
                              setEditing({ ...editing, requirementStages: updated })
                            }}
                          />
                          <div>
                            <div className="font-medium">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.desc}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Age gating + guardian */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-muted hover:border-blue-300">
                    <Checkbox
                      checked={!!editing.minorOnly}
                      onCheckedChange={(v) => setEditing({ ...editing, minorOnly: !!v, ...(v ? { adultOnly: false } : {}) })}
                    />
                    <div className="leading-tight">
                      <div className="font-medium">Minors only</div>
                      <div className="text-[10px] text-muted-foreground">Patient under 18</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-muted hover:border-blue-300">
                    <Checkbox
                      checked={!!editing.adultOnly}
                      onCheckedChange={(v) => setEditing({ ...editing, adultOnly: !!v, ...(v ? { minorOnly: false } : {}) })}
                    />
                    <div className="leading-tight">
                      <div className="font-medium">Adults only</div>
                      <div className="text-[10px] text-muted-foreground">Patient 18 or older</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-muted hover:border-blue-300">
                    <Checkbox
                      checked={!!editing.requiresGuardian}
                      onCheckedChange={(v) => setEditing({ ...editing, requiresGuardian: !!v })}
                    />
                    <div className="leading-tight">
                      <div className="font-medium">Guardian signature required</div>
                      <div className="text-[10px] text-muted-foreground">Minors need a parent/guardian signature</div>
                    </div>
                  </label>
                </div>

                <div>
                  <Label>Auto-attach rule: appointment types</Label>
                  <p className="text-xs text-muted-foreground mb-2">Select which appointment types should automatically include this form.</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {APPT_TYPES.map((t) => {
                      const list = editing.requiredForAppointmentTypes || []
                      const checked = list.includes(t)
                      return (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const current = editing.requiredForAppointmentTypes || []
                              const updated = v ? [...current, t] : current.filter((x) => x !== t)
                              setEditing({ ...editing, requiredForAppointmentTypes: updated })
                            }}
                          />
                          <span>{t.replace(/_/g, ' ')}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Treatment categories rule */}
                <div>
                  <Label>Auto-attach rule: treatment categories</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select categories — the form will auto-attach when the appointment includes any treatment in any selected category.
                    Useful for umbrella rules (e.g. one consent covers every &quot;surgical&quot; treatment).
                  </p>
                  {treatmentCategories.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">
                      No treatment categories found. Add treatments in the Treatments section first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {treatmentCategories.map((cat) => {
                        const list = editing.requiredForTreatmentCategories || []
                        const checked = list.includes(cat)
                        return (
                          <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const current = editing.requiredForTreatmentCategories || []
                                const updated = v ? [...current, cat] : current.filter((x) => x !== cat)
                                setEditing({ ...editing, requiredForTreatmentCategories: updated })
                              }}
                            />
                            <span className="capitalize">{cat}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Specific treatments rule */}
                <div>
                  <Label>Auto-attach rule: specific treatments / procedures</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pick individual treatments — the form will auto-attach when the appointment has any of them linked.
                    Use this for precise rules like &quot;Dental Implant Consent for Dental Implant only&quot;.
                  </p>
                  {treatments.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">
                      No treatments found. Add treatments in the Treatments section first.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto border rounded-md p-3 bg-white">
                      {Object.entries(treatmentsByCategory)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([cat, items]) => (
                          <div key={cat}>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 capitalize">
                              {cat}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {items.map((tr) => {
                                const list = editing.requiredForTreatmentIds || []
                                const checked = list.includes(tr.id)
                                return (
                                  <label
                                    key={tr.id}
                                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1.5 py-1 rounded"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        const current = editing.requiredForTreatmentIds || []
                                        const updated = v
                                          ? [...current, tr.id]
                                          : current.filter((x) => x !== tr.id)
                                        setEditing({ ...editing, requiredForTreatmentIds: updated })
                                      }}
                                    />
                                    <span className="truncate">{tr.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                      {tr.treatmentCode}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Clinic Service rule */}
                <div>
                  <Label>Auto-attach rule: clinic services</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select official clinic services (e.g. Orthodontics, Root Canal). The form will auto-attach when a
                    patient books or is scheduled for any of these services. This is the cleanest way to tie consents
                    to your published offerings.
                  </p>
                  {services.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">
                      No services found. Create services in the Services section first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border rounded-md p-3 bg-white">
                      {services
                        .slice()
                        .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
                        .map((s) => {
                          const list = editing.requiredForServiceIds || []
                          const checked = list.includes(s.id)
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1.5 py-1 rounded"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const current = editing.requiredForServiceIds || []
                                  const updated = v
                                    ? [...current, s.id]
                                    : current.filter((x) => x !== s.id)
                                  setEditing({ ...editing, requiredForServiceIds: updated })
                                }}
                              />
                              <span className="truncate">{s.displayName || s.name}</span>
                              {s.isOfficial && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-auto shrink-0 border-[#2D9DA8]/40 text-[#2D9DA8]">
                                  Official
                                </Badge>
                              )}
                            </label>
                          )
                        })}
                    </div>
                  )}
                </div>

                {/* Package Template rule */}
                <div>
                  <Label>Auto-attach rule: package templates</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select package templates (reusable bundles of procedures). When a patient's package is generated
                    from any of these templates, this form will be auto-attached during consent generation.
                    This is the most precise way to tie specific consents to specific procedure packages.
                  </p>
                  {packageTemplates.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">
                      No package templates found. Create them under Package Templates.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border rounded-md p-3 bg-white">
                      {packageTemplates
                        .slice()
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .map((p) => {
                          const list = editing.requiredForPackageTemplateIds || []
                          const checked = list.includes(p.id)
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1.5 py-1 rounded"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const current = editing.requiredForPackageTemplateIds || []
                                  const updated = v
                                    ? [...current, p.id]
                                    : current.filter((x) => x !== p.id)
                                  setEditing({ ...editing, requiredForPackageTemplateIds: updated })
                                }}
                              />
                              <span className="truncate">{p.name}</span>
                            </label>
                          )
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Fields builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base">Fields</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newField: FormField = {
                        id: `field_${Date.now()}`,
                        type: 'text',
                        label: 'New Field',
                        required: false,
                      }
                      setEditing({ ...editing, fields: [...editing.fields, newField] })
                    }}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Field
                  </Button>
                </div>
                <div className="space-y-3">
                  {editing.fields.map((f, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start gap-2 mb-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground mt-2" />
                        <div className="flex-1 grid md:grid-cols-3 gap-2">
                          <Input placeholder="Field ID (e.g. allergies)" value={f.id} onChange={(e) => {
                            const fields = [...editing.fields]
                            fields[idx] = { ...f, id: e.target.value }
                            setEditing({ ...editing, fields })
                          }} />
                          <Input placeholder="Label" value={f.label} onChange={(e) => {
                            const fields = [...editing.fields]
                            fields[idx] = { ...f, label: e.target.value }
                            setEditing({ ...editing, fields })
                          }} />
                          <Select value={f.type} onValueChange={(v: any) => {
                            const fields = [...editing.fields]
                            fields[idx] = { ...f, type: v }
                            setEditing({ ...editing, fields })
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" size="icon" variant="ghost" disabled={idx === 0} onClick={() => {
                            const fields = [...editing.fields]
                            ;[fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]]
                            setEditing({ ...editing, fields })
                          }}>
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" disabled={idx === editing.fields.length - 1} onClick={() => {
                            const fields = [...editing.fields]
                            ;[fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]]
                            setEditing({ ...editing, fields })
                          }}>
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => {
                            setEditing({ ...editing, fields: editing.fields.filter((_, i) => i !== idx) })
                          }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 pl-6">
                        <Input placeholder="Placeholder (optional)" value={f.placeholder || ''} onChange={(e) => {
                          const fields = [...editing.fields]
                          fields[idx] = { ...f, placeholder: e.target.value }
                          setEditing({ ...editing, fields })
                        }} />
                        <Input placeholder="Help text (optional)" value={f.helpText || ''} onChange={(e) => {
                          const fields = [...editing.fields]
                          fields[idx] = { ...f, helpText: e.target.value }
                          setEditing({ ...editing, fields })
                        }} />
                        {(f.type === 'select' || f.type === 'radio') && (
                          <div className="md:col-span-2">
                            <Input
                              placeholder="Options (comma-separated, e.g. Yes,No,Maybe)"
                              value={(f.options || []).join(',')}
                              onChange={(e) => {
                                const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                                const fields = [...editing.fields]
                                fields[idx] = { ...f, options: opts }
                                setEditing({ ...editing, fields })
                              }}
                            />
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <Label className="text-xs">Sync to Patient Field</Label>
                          <Select value={f.patientField || 'none'} onValueChange={(v) => {
                            const fields = [...editing.fields]
                            fields[idx] = { ...f, patientField: v === 'none' ? undefined : v }
                            setEditing({ ...editing, fields })
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              {PATIENT_FIELD_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <label className="flex items-center gap-2 text-sm col-span-2">
                          <Checkbox checked={!!f.required} onCheckedChange={(v) => {
                            const fields = [...editing.fields]
                            fields[idx] = { ...f, required: !!v }
                            setEditing({ ...editing, fields })
                          }} />
                          Required
                        </label>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Preview Panel */}
          {showPreview && editing && (
            <div className="border-t pt-4 mt-2">
              <FormPreviewPanel title={editing.title} description={editing.description || ''} fields={editing.fields} requiresGuardian={!!editing.requiresGuardian} />
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2 mr-auto"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Preview Form'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isNew ? 'Create' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleting?.isSystem ? 'Archive System Template?' : 'Delete Template?'}
            </DialogTitle>
            <DialogDescription>
              {deleting?.isSystem
                ? `"${deleting?.title}" is a system template. It will be archived and hidden from active use, but kept for audit history. You can restore it later if needed.`
                : `Are you sure you want to delete "${deleting?.title}"? This cannot be undone. Previously signed forms using this template will remain intact.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>
              {deleting?.isSystem ? 'Archive' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ────────────────────────────────────────────────────────────────────────────
// Form Preview Panel — shows how the form will look to patients
// ────────────────────────────────────────────────────────────────────────────
function FormPreviewPanel({ title, description, fields, requiresGuardian }: {
  title: string; description: string; fields: FormField[]; requiresGuardian: boolean
}) {
  const safeFields = Array.isArray(fields) ? fields : []

  const renderField = (field: FormField, idx: number) => {
    const label = field.label || `Field ${idx + 1}`
    const req = field.required

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="w-full h-20 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">
              {field.placeholder || 'Enter details...'}
            </div>
          </div>
        )
      case 'select':
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 flex items-center justify-between">
              <span>{field.placeholder || 'Select an option'}</span>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            {field.options && field.options.length > 0 && (
              <div className="mt-1 text-xs text-gray-400">Options: {field.options.join(', ')}</div>
            )}
          </div>
        )
      case 'radio':
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="flex flex-wrap gap-2">
              {(field.options && field.options.length > 0 ? field.options : ['Option 1', 'Option 2']).map((opt, oi) => (
                <span key={oi} className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${oi === 0 ? 'bg-[#2D9DA8]/10 border-[#2D9DA8] text-[#2D9DA8]' : 'bg-white border-gray-300 text-gray-600'}`}>
                  {opt}
                </span>
              ))}
            </div>
          </div>
        )
      case 'checkbox':
        return (
          <div key={field.id || idx}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-4 w-4 rounded border border-gray-300 bg-white flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</span>
                {field.helpText && <p className="text-xs text-gray-500 mt-0.5">{field.helpText}</p>}
              </div>
            </div>
          </div>
        )
      case 'signature':
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="w-full h-28 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <Pen className="h-5 w-5 mx-auto text-gray-400 mb-1" />
                <span className="text-xs text-gray-400">Sign here</span>
              </div>
            </div>
          </div>
        )
      case 'date':
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 flex items-center justify-between">
              <span>mm/dd/yyyy</span>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>
        )
      default: // text, number, email, tel
        return (
          <div key={field.id || idx}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}{req && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>}
            <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">
              {field.placeholder || `Enter ${field.type === 'email' ? 'email address' : field.type === 'tel' ? 'phone number' : field.type === 'number' ? 'number' : 'text'}...`}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-[#2D9DA8]" />
        <span className="text-sm font-semibold text-[#2D9DA8]">Patient Preview</span>
        <span className="text-xs text-gray-400 ml-auto">This is how patients will see the form</span>
      </div>

      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
        {/* Header */}
        <div className="bg-[#2D9DA8] px-5 py-4 text-white">
          <h3 className="text-base font-semibold">{title || 'Untitled Form'}</h3>
          {description && <p className="text-sm text-white/80 mt-0.5">{description}</p>}
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          {safeFields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No fields added yet. Add fields above to see the preview.</p>
          ) : (
            safeFields.map((f, i) => renderField(f, i))
          )}

          {/* Guardian Signature Section */}
          {requiresGuardian && (
            <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
              <div className="flex items-center gap-1.5 mb-3">
                <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium text-gray-700">Guardian / Parent Signature</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Guardian Full Name</label>
                  <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">Enter guardian name...</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Relationship to Patient</label>
                  <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">e.g. Parent, Legal Guardian</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Guardian Signature</label>
                  <div className="w-full h-20 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <Pen className="h-4 w-4 mx-auto text-gray-400 mb-0.5" />
                      <span className="text-xs text-gray-400">Sign here</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons (decorative) */}
        <div className="px-5 py-3 bg-gray-50 border-t flex gap-2">
          <div className="flex-1 rounded-md bg-[#2D9DA8] py-2 text-center text-sm font-medium text-white">
            Submit Form
          </div>
        </div>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────────────────────────────────
// Version Diff — side-by-side comparison of two template versions.
// Shows title/category/settings differences + a per-field diff (added / removed / changed).
// ────────────────────────────────────────────────────────────────────────────
function VersionDiff({ a, b }: { a: FormTemplate; b: FormTemplate }) {
  // Build a map of fields by id (falling back to label) for accurate diff
  const aFields = Array.isArray(a.fields) ? a.fields : []
  const bFields = Array.isArray(b.fields) ? b.fields : []
  const aFieldKey = (f: FormField) => f.id || f.label
  const bFieldKey = (f: FormField) => f.id || f.label
  const aById = new Map<string, FormField>()
  const bById = new Map<string, FormField>()
  aFields.forEach((f) => aById.set(aFieldKey(f), f))
  bFields.forEach((f) => bById.set(bFieldKey(f), f))

  const allKeys = Array.from(new Set([...Array.from(aById.keys()), ...Array.from(bById.keys())]))
  const added: FormField[] = []
  const removed: FormField[] = []
  const changed: { key: string; a: FormField; b: FormField; diffs: string[] }[] = []
  const unchanged: FormField[] = []

  for (const k of allKeys) {
    const af = aById.get(k)
    const bf = bById.get(k)
    if (!af && bf) { added.push(bf); continue }
    if (af && !bf) { removed.push(af); continue }
    if (af && bf) {
      const diffs: string[] = []
      if (af.label !== bf.label) diffs.push(`label: "${af.label}" → "${bf.label}"`)
      if (af.type !== bf.type) diffs.push(`type: ${af.type} → ${bf.type}`)
      if (!!af.required !== !!bf.required) diffs.push(`required: ${!!af.required} → ${!!bf.required}`)
      const aOpts = (af.options || []).join(',')
      const bOpts = (bf.options || []).join(',')
      if (aOpts !== bOpts) diffs.push(`options changed`)
      if ((af.helpText || '') !== (bf.helpText || '')) diffs.push(`help text changed`)
      if ((af.placeholder || '') !== (bf.placeholder || '')) diffs.push(`placeholder changed`)
      if ((af.patientField || '') !== (bf.patientField || '')) diffs.push(`patient sync changed`)
      if (diffs.length > 0) changed.push({ key: k, a: af, b: bf, diffs })
      else unchanged.push(af)
    }
  }

  const settingsDiffs: { label: string; a: string; b: string }[] = []
  const addSetting = (label: string, av: any, bv: any) => {
    const as = JSON.stringify(av ?? null)
    const bs = JSON.stringify(bv ?? null)
    if (as !== bs) settingsDiffs.push({ label, a: as, b: bs })
  }
  addSetting('Title', a.title, b.title)
  addSetting('Category', a.category, b.category)
  addSetting('Description', a.description, b.description)
  addSetting('Required Always', a.requiredAlways, b.requiredAlways)
  addSetting('Requirement Stages', a.requirementStages || [], b.requirementStages || [])
  addSetting('Minor Only', !!a.minorOnly, !!b.minorOnly)
  addSetting('Adult Only', !!a.adultOnly, !!b.adultOnly)
  addSetting('Requires Guardian', !!a.requiresGuardian, !!b.requiresGuardian)
  addSetting('Required for Appointment Types', a.requiredForAppointmentTypes || [], b.requiredForAppointmentTypes || [])
  addSetting('Required for Treatments', a.requiredForTreatmentIds || [], b.requiredForTreatmentIds || [])
  addSetting('Required for Treatment Categories', a.requiredForTreatmentCategories || [], b.requiredForTreatmentCategories || [])
  addSetting('Required for Clinic Services', a.requiredForServiceIds || [], b.requiredForServiceIds || [])
  addSetting('Required for Package Templates', a.requiredForPackageTemplateIds || [], b.requiredForPackageTemplateIds || [])

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
          <div className="text-xs text-blue-700 mb-1">Version A (baseline)</div>
          <div className="font-medium">v{a.version} — {a.title}</div>
          <div className="text-xs text-muted-foreground">
            Status: {a.status || 'active'} · {(a.fields || []).length} fields · {new Date(a.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200">
          <div className="text-xs text-emerald-700 mb-1">Version B (compare)</div>
          <div className="font-medium">v{b.version} — {b.title}</div>
          <div className="text-xs text-muted-foreground">
            Status: {b.status || 'active'} · {(b.fields || []).length} fields · {new Date(b.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Settings differences */}
      <div>
        <div className="text-sm font-semibold mb-2">Settings</div>
        {settingsDiffs.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-2 rounded-md bg-muted/40">No differences in settings.</div>
        ) : (
          <div className="space-y-1.5">
            {settingsDiffs.map((d, i) => (
              <div key={i} className="grid md:grid-cols-3 gap-2 text-xs border rounded-md p-2">
                <div className="font-medium">{d.label}</div>
                <div className="bg-blue-50 px-2 py-1 rounded text-blue-900 break-all">A: {d.a}</div>
                <div className="bg-emerald-50 px-2 py-1 rounded text-emerald-900 break-all">B: {d.b}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fields differences */}
      <div>
        <div className="text-sm font-semibold mb-2">Fields</div>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-xs font-medium text-red-700 mb-1">Removed from B ({removed.length})</div>
            {removed.length === 0 ? (
              <div className="text-muted-foreground italic px-2 py-1">None</div>
            ) : (
              <ul className="space-y-1">
                {removed.map((f, i) => (
                  <li key={i} className="px-2 py-1 rounded bg-red-50 border border-red-200">
                    <span className="font-medium">{f.label}</span> <span className="text-muted-foreground">({f.type})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-700 mb-1">Added in B ({added.length})</div>
            {added.length === 0 ? (
              <div className="text-muted-foreground italic px-2 py-1">None</div>
            ) : (
              <ul className="space-y-1">
                {added.map((f, i) => (
                  <li key={i} className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200">
                    <span className="font-medium">{f.label}</span> <span className="text-muted-foreground">({f.type})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Changed fields */}
      <div>
        <div className="text-sm font-semibold mb-2">Changed Fields ({changed.length})</div>
        {changed.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-3 py-2 rounded-md bg-muted/40">No field-level changes.</div>
        ) : (
          <div className="space-y-2">
            {changed.map((c, i) => (
              <div key={i} className="border rounded-md p-3 bg-amber-50 border-amber-200">
                <div className="font-medium text-xs mb-1">{c.a.label || c.key}</div>
                <ul className="text-xs list-disc pl-5 text-amber-900 space-y-0.5">
                  {c.diffs.map((d, j) => <li key={j}>{d}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {unchanged.length > 0 && (
        <div className="text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted/30 border">
          {unchanged.length} field{unchanged.length !== 1 ? 's' : ''} unchanged.
        </div>
      )}
    </div>
  )
}
'use client'

import { formatDentistName } from '@/lib/utils'
import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'
import {
  FileText,
  Download,
  Filter,
  Eye,
  Settings2,
  FileSpreadsheet,
  FileType,
  Loader2,
  Table as TableIcon,
  LayoutList,
  Calendar,
} from 'lucide-react'

type ReportField = {
  key: string
  label: string
  defaultOn?: boolean
  group?: string
}

type ReportTypeDef = {
  id: string
  name: string
  description: string
  category: string
  supportsDateRange: boolean
  supportsDentistFilter: boolean
  supportsStatusFilter?: boolean
  statusOptions?: { value: string; label: string }[]
  fields: ReportField[]
  summaryFields?: ReportField[]
}

const REPORT_TYPES: ReportTypeDef[] = [
  {
    id: 'appointments',
    name: 'Appointments Report',
    description: 'Complete list of appointments with patient, dentist, service and status details.',
    category: 'Operations',
    supportsDateRange: true,
    supportsDentistFilter: true,
    supportsStatusFilter: true,
    statusOptions: [
      { value: 'all', label: 'All statuses' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'checked_in', label: 'Checked In' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'no_show', label: 'No Show' },
    ],
    fields: [
      { key: 'appointmentNumber', label: 'Appointment #', defaultOn: true },
      { key: 'scheduledDate', label: 'Date', defaultOn: true },
      { key: 'scheduledTime', label: 'Time', defaultOn: true },
      { key: 'patientName', label: 'Patient Name', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #', defaultOn: true },
      { key: 'patientPhone', label: 'Patient Phone' },
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'appointmentType', label: 'Type', defaultOn: true },
      { key: 'serviceName', label: 'Service' },
      { key: 'duration', label: 'Duration (min)' },
      { key: 'status', label: 'Status', defaultOn: true },
      { key: 'notes', label: 'Notes' },
      { key: 'createdAt', label: 'Booked On' },
    ],
  },
  {
    id: 'patients',
    name: 'Patients Report',
    description: 'Patient registry with demographics, contact info and visit history.',
    category: 'Patient Analytics',
    supportsDateRange: true,
    supportsDentistFilter: false,
    fields: [
      { key: 'patientNumber', label: 'Patient #', defaultOn: true },
      { key: 'fullName', label: 'Full Name', defaultOn: true },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'age', label: 'Age', defaultOn: true },
      { key: 'gender', label: 'Gender', defaultOn: true },
      { key: 'email', label: 'Email', defaultOn: true },
      { key: 'mobileNumber', label: 'Mobile Number', defaultOn: true },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'emergencyContactName', label: 'Emergency Contact' },
      { key: 'emergencyContactPhone', label: 'Emergency Phone' },
      { key: 'allergies', label: 'Allergies' },
      { key: 'medicalHistory', label: 'Medical History' },
      { key: 'insuranceProvider', label: 'Insurance Provider' },
      { key: 'totalVisits', label: 'Total Visits' },
      { key: 'lastVisit', label: 'Last Visit' },
      { key: 'registeredAt', label: 'Registered On', defaultOn: true },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Revenue Report',
    description: 'Invoices, payments, outstanding balances and revenue totals.',
    category: 'Financial',
    supportsDateRange: true,
    supportsDentistFilter: true,
    supportsStatusFilter: true,
    statusOptions: [
      { value: 'all', label: 'All statuses' },
      { value: 'pending', label: 'Pending' },
      { value: 'paid', label: 'Paid' },
      { value: 'partial', label: 'Partial' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    fields: [
      { key: 'invoiceNumber', label: 'Invoice #', defaultOn: true },
      { key: 'issueDate', label: 'Issue Date', defaultOn: true },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'patientName', label: 'Patient', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'taxAmount', label: 'Tax' },
      { key: 'discountAmount', label: 'Discount' },
      { key: 'totalAmount', label: 'Total', defaultOn: true },
      { key: 'amountPaid', label: 'Paid', defaultOn: true },
      { key: 'balanceDue', label: 'Balance Due', defaultOn: true },
      { key: 'status', label: 'Status', defaultOn: true },
    ],
  },
  {
    id: 'procedures',
    name: 'Procedures & Treatments Report',
    description: 'Procedures performed with counts and dentist attribution.',
    category: 'Clinical',
    supportsDateRange: true,
    supportsDentistFilter: true,
    fields: [
      { key: 'date', label: 'Date', defaultOn: true },
      { key: 'patientName', label: 'Patient', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #' },
      { key: 'procedureCode', label: 'Code' },
      { key: 'procedureName', label: 'Procedure', defaultOn: true },
      { key: 'toothNumber', label: 'Tooth #' },
      { key: 'surface', label: 'Surface' },
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'cost', label: 'Cost' },
      { key: 'status', label: 'Status', defaultOn: true },
    ],
  },
  {
    id: 'dentist-performance',
    name: 'Dentist Performance Report',
    description: 'Per-dentist appointment counts and completion rates.',
    category: 'Operations',
    supportsDateRange: true,
    supportsDentistFilter: false,
    fields: [
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'specialization', label: 'Specialization', defaultOn: true },
      { key: 'totalAppointments', label: 'Total Appointments', defaultOn: true },
      { key: 'completed', label: 'Completed', defaultOn: true },
      { key: 'cancelled', label: 'Cancelled' },
      { key: 'noShow', label: 'No Show' },
      { key: 'completionRate', label: 'Completion Rate', defaultOn: true },
      { key: 'avgAppointmentDuration', label: 'Avg Duration (min)' },
    ],
  },
]

type Filters = {
  startDate?: string
  endDate?: string
  dentistId?: string
  status?: string
}

export default function ReportGenerator() {
  const [selectedType, setSelectedType] = useState<string>('appointments')
  const [mode, setMode] = useState<'detailed' | 'summary'>('detailed')
  const [filters, setFilters] = useState<Filters>(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dentistId: 'all',
      status: 'all',
    }
  })
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [dentists, setDentists] = useState<Array<{ id: string; name: string }>>([])
  const [previewData, setPreviewData] = useState<{
    rows: any[]
    totalCount: number
    sample: boolean
    summary: any
    mode: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState<string>('')

  const currentType = useMemo(() => REPORT_TYPES.find(r => r.id === selectedType)!, [selectedType])

  // Initialize selected fields when type changes
  useEffect(() => {
    const defaults = currentType.fields.filter(f => f.defaultOn).map(f => f.key)
    setSelectedFields(defaults)
    setPreviewData(null)
  }, [selectedType, currentType])

  // Fetch dentists once
  useEffect(() => {
    fetch('/api/dentists')
      .then(r => r.ok ? r.json() : { dentists: [] })
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.dentists || [])
        setDentists(
          arr.map((d: any) => ({
            id: d.id,
            name: d.user ? formatDentistName(d.user.firstName, d.user.lastName) : (d.name || 'Dentist'),
          }))
        )
      })
      .catch(() => setDentists([]))
  }, [])

  const loadPreview = async () => {
    setPreviewLoading(true)
    setPreviewData(null)
    try {
      const res = await fetch('/api/reports/v2/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selectedType,
          filters,
          fields: selectedFields,
          mode,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Preview failed' }))
        throw new Error(err.error || 'Preview failed')
      }
      const data = await res.json()
      setPreviewData(data)
    } catch (err: any) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' })
    } finally {
      setPreviewLoading(false)
    }
  }

  const exportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(format)
    try {
      const res = await fetch('/api/reports/v2/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selectedType,
          filters,
          fields: selectedFields,
          mode,
          format,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(err.error || 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv'
      a.download = `${currentType.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Export complete', description: `Downloaded ${a.download}` })
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' })
    } finally {
      setExporting('')
    }
  }

  const toggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAllFields = () => setSelectedFields(currentType.fields.map(f => f.key))
  const clearAllFields = () => setSelectedFields([])

  const previewHeaders = useMemo(() => {
    if (!previewData) return []
    if (previewData.mode === 'summary' && previewData.summary) {
      return ['Metric', 'Value']
    }
    return currentType.fields.filter(f => selectedFields.includes(f.key)).map(f => f.label)
  }, [previewData, currentType, selectedFields])

  const previewRows = useMemo(() => {
    if (!previewData) return []
    if (previewData.mode === 'summary' && previewData.summary) {
      const out: any[][] = []
      for (const [k, v] of Object.entries(previewData.summary)) {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
        if (typeof v === 'object' && v !== null) {
          out.push([label, ''])
          for (const [sk, sv] of Object.entries(v as any)) {
            out.push([`  \u2022 ${sk}`, String(sv)])
          }
        } else {
          out.push([label, String(v ?? '')])
        }
      }
      return out
    }
    const cols = currentType.fields.filter(f => selectedFields.includes(f.key))
    return previewData.rows.map(r => cols.map(c => String(r[c.key] ?? '')))
  }, [previewData, currentType, selectedFields])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Report Generator</h2>
          <p className="text-sm text-gray-600 mt-1">Build, preview, and export custom reports across your practice.</p>
        </div>
      </div>

      {/* Step 1: Select report type */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#2D9DA8]" /> 1. Choose a report
          </CardTitle>
          <CardDescription>Select what you want to analyze.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                  selectedType === t.id
                    ? 'border-[#2D9DA8] bg-[#2D9DA8]/5 ring-2 ring-[#2D9DA8]/20'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                </div>
                <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{t.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Configure */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[#2D9DA8]" /> 2. Configure
          </CardTitle>
          <CardDescription>Pick filters, mode, and columns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode */}
          <div>
            <Label className="text-sm font-medium">Report Mode</Label>
            <Tabs value={mode} onValueChange={v => setMode(v as any)} className="mt-2">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="detailed">
                  <LayoutList className="h-4 w-4 mr-2" /> Detailed (rows)
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <TableIcon className="h-4 w-4 mr-2" /> Summary (aggregate)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Separator />

          {/* Filters */}
          <div>
            <Label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentType.supportsDateRange && (
                <>
                  <div>
                    <Label className="text-xs text-gray-600">Start Date</Label>
                    <Input
                      type="date"
                      value={filters.startDate ?? ''}
                      onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">End Date</Label>
                    <Input
                      type="date"
                      value={filters.endDate ?? ''}
                      onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                    />
                  </div>
                </>
              )}
              {currentType.supportsDentistFilter && (
                <div>
                  <Label className="text-xs text-gray-600">Dentist</Label>
                  <Select
                    value={filters.dentistId || 'all'}
                    onValueChange={v => setFilters({ ...filters, dentistId: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dentists</SelectItem>
                      {dentists.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {currentType.supportsStatusFilter && currentType.statusOptions && (
                <div>
                  <Label className="text-xs text-gray-600">Status</Label>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={v => setFilters({ ...filters, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentType.statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Columns (detailed only) */}
          {mode === 'detailed' && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <TableIcon className="h-4 w-4" /> Columns to include
                    <span className="text-xs text-gray-500 font-normal">({selectedFields.length} selected)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={selectAllFields}>Select all</Button>
                    <Button type="button" size="sm" variant="outline" onClick={clearAllFields}>Clear</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg border">
                  {currentType.fields.map(f => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1 transition-colors"
                    >
                      <Checkbox
                        checked={selectedFields.includes(f.key)}
                        onCheckedChange={() => toggleField(f.key)}
                      />
                      <span className="text-gray-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Preview & Export */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-[#2D9DA8]" /> 3. Preview & export
          </CardTitle>
          <CardDescription>Preview the first 100 rows, then export.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={loadPreview}
              disabled={previewLoading || (mode === 'detailed' && selectedFields.length === 0)}
              className="bg-[#2D9DA8] hover:bg-[#2D9DA8]/90"
            >
              {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview
            </Button>
            <Button onClick={() => exportReport('csv')} disabled={!!exporting || (mode === 'detailed' && selectedFields.length === 0)} variant="outline">
              {exporting === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              CSV
            </Button>
            <Button onClick={() => exportReport('xlsx')} disabled={!!exporting || (mode === 'detailed' && selectedFields.length === 0)} variant="outline">
              {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Excel
            </Button>
            <Button onClick={() => exportReport('pdf')} disabled={!!exporting || (mode === 'detailed' && selectedFields.length === 0)} variant="outline">
              {exporting === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileType className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {mode === 'detailed' && selectedFields.length === 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Select at least one column to enable preview &amp; export.
            </div>
          )}

          {previewLoading && (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading preview...
            </div>
          )}

          {previewData && !previewLoading && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">{previewData.mode === 'summary' ? 'Summary' : 'Detailed'}</Badge>
                <span>
                  {previewData.mode === 'summary'
                    ? `Summary ready`
                    : `${previewData.totalCount} total records`}
                  {previewData.sample ? ' (showing first 100)' : ''}
                </span>
                {filters.startDate && filters.endDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {filters.startDate} \u2192 {filters.endDate}
                  </span>
                )}
              </div>

              {previewRows.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500 bg-gray-50 rounded border border-dashed">
                  No records match the current filters.
                </div>
              ) : (
                <ScrollArea className="max-h-[500px] rounded-lg border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-[#2D9DA8] text-white sticky top-0">
                      <tr>
                        {previewHeaders.map((h, i) => (
                          <th key={i} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {r.map((c: any, j: number) => (
                            <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[260px] truncate" title={String(c ?? '')}>
                              {String(c ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

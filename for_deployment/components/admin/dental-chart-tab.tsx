'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { formatDentistName } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// Tabs removed — using ChartTimeline instead
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import {
  Loader2, Search, ChevronLeft, ChevronRight, FileText, Smile, Plus,
  CalendarPlus, Package, Save, Undo2, Trash2, X, Calendar,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import ProfessionalDentalChart, { ChartData, buildDefaultChartData, DentalChartType } from '@/components/dental-chart/professional-dental-chart'
import ToothAnatomyViews from '@/components/dental-chart/tooth-anatomy-views'
// ChartTimeline moved to dedicated Timeline tab in patient-detail-view.tsx
import TreatmentPlansManager from './treatment-plans-manager'

// ─── FDI Tooth Numbers by dentition type ──────────────────────────────────
const PERMANENT_UJ = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const PERMANENT_LJ = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const PRIMARY_UJ = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
const PRIMARY_LJ = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

function getUJTeeth(chartType: DentalChartType) {
  if (chartType === 'primary') return PRIMARY_UJ
  if (chartType === 'mixed') return [...PRIMARY_UJ, ...PERMANENT_UJ]
  return PERMANENT_UJ
}
function getLJTeeth(chartType: DentalChartType) {
  if (chartType === 'primary') return PRIMARY_LJ
  if (chartType === 'mixed') return [...PRIMARY_LJ, ...PERMANENT_LJ]
  return PERMANENT_LJ
}

// ─── Condition/Procedure definitions (from Molarsoft) ────────────────
const PROPERTIES = [
  { key: 'missing', label: 'Missing', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { key: 'impacted', label: 'Impacted', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { key: 'diastema', label: 'Diastema', color: 'bg-purple-50 text-purple-700 border-purple-300' },
  { key: 'supernumerary', label: 'Supernumerary', color: 'bg-amber-50 text-amber-700 border-amber-300' },
]

const CONDITIONS = [
  { key: 'caries', label: 'Caries', color: 'bg-red-50 text-red-700 border-red-300' },
  { key: 'fracture', label: 'Fracture', color: 'bg-orange-50 text-orange-700 border-orange-300' },
  { key: 'abscess', label: 'Abscess', color: 'bg-rose-50 text-rose-700 border-rose-300' },
  { key: 'periodontal', label: 'Periodontal', color: 'bg-pink-50 text-pink-700 border-pink-300' },
  { key: 'sensitivity', label: 'Sensitivity', color: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { key: 'custom', label: 'Custom Condition', color: 'bg-slate-50 text-slate-700 border-slate-300' },
]

const PROCEDURES = [
  { key: 'restoration', label: 'Restoration', color: 'bg-teal-50 text-teal-700 border-teal-300' },
  { key: 'extraction', label: 'Extraction', color: 'bg-red-50 text-red-700 border-red-300' },
  { key: 'root_canal', label: 'Root Canal', color: 'bg-orange-50 text-orange-700 border-orange-300' },
  { key: 'crown', label: 'Crown', color: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  { key: 'scaling', label: 'Scaling', color: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { key: 'custom', label: 'Custom Procedure', color: 'bg-slate-50 text-slate-700 border-slate-300' },
]

const SURFACES = [
  { key: 'B', label: 'Buccal' },
  { key: 'D', label: 'Distal' },
  { key: 'O', label: 'Occlusal' },
  { key: 'M', label: 'Mesial' },
  { key: 'L', label: 'Lingual' },
  { key: 'P', label: 'Palatal' },
]

const SEVERITY_OPTIONS = ['Unknown', 'Mild', 'Moderate', 'Severe']
const MATERIALS = ['Unspecified', 'Composite', 'Amalgam', 'Glass Ionomer', 'Ceramic', 'Gold', 'Porcelain']

interface DentalChartTabProps {
  patientId: string
  chartVersions: any[]
  refreshKey: number
  onRefresh: () => void
}

interface ToothAction {
  id?: string
  toothNumber: number
  actionCategory: 'property' | 'condition' | 'procedure'
  actionType: string
  date: string
  surfaces: string[]
  severity?: string
  material?: string
  title?: string
  notes: string
  doneBy: string
  status: 'draft' | 'saved'
}

export default function DentalChartTab({ patientId, chartVersions, refreshKey, onRefresh }: DentalChartTabProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { data: session } = useSession() || {}
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [activePanelCategory, setActivePanelCategory] = useState<string | null>(null)
  const [searchActions, setSearchActions] = useState('')
  const [toothActions, setToothActions] = useState<ToothAction[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [savingAction, setSavingAction] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0)
  const [chartType, setChartType] = useState<DentalChartType>('permanent')
  const chartRef = useRef<HTMLDivElement>(null)

  // Derived FDI arrays based on chart type
  const ujTeeth = getUJTeeth(chartType)
  const ljTeeth = getLJTeeth(chartType)

  // Scroll to chart and select tooth (for "View on charts" link)
  const scrollToChartAndSelect = useCallback((toothNum: number) => {
    setSelectedTooth(toothNum)
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Current form state for active panel
  const [form, setForm] = useState<Partial<ToothAction>>({})

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  // Fetch dentists once
  useEffect(() => {
    fetch('/api/dentists?limit=100').then(r => r.json()).then(data => {
      const list = data.data?.dentists || data.dentists || []
      setDentists(list.map((d: any) => ({ id: d.id, name: formatDentistName(d.user?.firstName, d.user?.lastName) })))
    }).catch(() => {})
  }, [])

  // Load tooth-specific chart entries when tooth is selected
  const loadToothData = useCallback(async (toothNum: number) => {
    setLoadingActions(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries?chartType=general`)
      const data = await res.json()
      if (data.success) {
        const filtered = (data.data || []).filter((e: any) => {
          const tn = e.toothNumber?.toString().trim()
          return tn === String(toothNum)
        })
        const mapped: ToothAction[] = filtered.map((e: any) => ({
          id: e.id,
          toothNumber: toothNum,
          actionCategory: e.diagnosis ? 'condition' : 'procedure',
          actionType: e.diagnosis || e.procedureName || 'Entry',
          date: e.visitDate,
          surfaces: e.surface ? e.surface.split(',').map((s: string) => s.trim()) : [],
          notes: e.notes || '',
          doneBy: e.dentistName || '',
          status: 'saved' as const,
        }))
        setToothActions(mapped)
      }
    } catch { /* ignore */ }
    finally { setLoadingActions(false) }
  }, [patientId])

  useEffect(() => {
    if (selectedTooth) {
      loadToothData(selectedTooth)
      setActivePanel(null)
      setActivePanelCategory(null)
    }
  }, [selectedTooth, loadToothData])

  const openActionPanel = (category: string, type: string) => {
    setActivePanel(type)
    setActivePanelCategory(category)
    const defaultDoneBy = session?.user?.name || ''
    setForm({
      toothNumber: selectedTooth || 0,
      actionCategory: category as any,
      actionType: type,
      date: format(currentDate, 'yyyy-MM-dd'),
      surfaces: [],
      severity: category === 'condition' ? 'Unknown' : undefined,
      material: category === 'procedure' && (type === 'restoration' || type === 'crown') ? 'Unspecified' : undefined,
      title: type === 'custom' ? '' : undefined,
      notes: '',
      doneBy: defaultDoneBy,
      status: 'draft',
    })
  }

  const toggleSurface = (s: string) => {
    setForm(prev => {
      const surfaces = prev.surfaces || []
      return { ...prev, surfaces: surfaces.includes(s) ? surfaces.filter(x => x !== s) : [...surfaces, s] }
    })
  }

  const handleSaveAction = async () => {
    if (!selectedTooth || !activePanel) return
    setSavingAction(true)
    try {
      // Save as a chart entry with tooth number
      const procedureName = activePanelCategory === 'procedure'
        ? (form.title || activePanel.replace('_', ' '))
        : null
      const diagnosis = activePanelCategory === 'condition' || activePanelCategory === 'property'
        ? (form.title || activePanel.replace('_', ' '))
        : null

      const surfaceStr = (form.surfaces || []).join(',')
      const noteParts = []
      if (form.severity && form.severity !== 'Unknown') noteParts.push(`Severity: ${form.severity}`)
      if (form.material && form.material !== 'Unspecified') noteParts.push(`Material: ${form.material}`)
      if (form.notes) noteParts.push(form.notes)

      const res = await fetch(`/api/patients/${patientId}/chart-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartType: 'general',
          visitDate: new Date(form.date || currentDate).toISOString(),
          toothNumber: String(selectedTooth),
          surface: surfaceStr || null,
          diagnosis: diagnosis ? `${diagnosis.charAt(0).toUpperCase()}${diagnosis.slice(1)}` : null,
          procedureName: procedureName ? `${procedureName.charAt(0).toUpperCase()}${procedureName.slice(1)}` : null,
          notes: noteParts.join(' | ') || null,
          amountCharged: 0,
          amountPaid: 0,
          dentistName: form.doneBy || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast({ title: 'Saved', description: `${activePanelCategory === 'procedure' ? 'Procedure' : 'Condition'} recorded for Tooth ${selectedTooth}` })
      setActivePanel(null)
      setActivePanelCategory(null)
      loadToothData(selectedTooth)
      setWorkspaceRefreshKey(k => k + 1)
      onRefresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSavingAction(false)
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    const ok = await confirm({
      title: 'Delete chart entry?',
      description: 'This action cannot be undone. The chart entry will be permanently removed.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${actionId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Deleted' })
      if (selectedTooth) loadToothData(selectedTooth)
      setWorkspaceRefreshKey(k => k + 1)
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'Could not delete', variant: 'destructive' })
    }
  }

  const navigateDate = (dir: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + dir)
    setCurrentDate(d)
  }

  // Filter items by search
  const filterBySearch = <T extends { key: string; label: string }>(items: T[]): T[] => {
    if (!searchActions) return items
    return items.filter(i => i.label.toLowerCase().includes(searchActions.toLowerCase()))
  }

  return (
    <div className="space-y-4">
      {/* ═══ Tooth Grid Navigator (Molarsoft-style) ═══ */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-3">
          {/* Date Navigator + Breadcrumb */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Dentition</span>
              {selectedTooth && (
                <>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <span className="text-sm font-semibold text-[#2D9DA8]">Tooth {selectedTooth}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(-7)}>
                <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="text-xs px-2 py-1 rounded-md hover:bg-gray-100 flex items-center gap-1.5"
              >
                <Calendar className="w-3 h-3" />
                {format(currentDate, 'MMM d, yyyy')}
                {isToday && <Badge className="bg-green-100 text-green-700 text-[9px] px-1 py-0 ml-1">Today</Badge>}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(1)}>
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(7)}>
                <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
              </Button>
            </div>
          </div>

          {/* Tooth Grid (synced with chart type) */}
          <div className="space-y-1">
            {/* Upper Jaw */}
            <div className="flex items-center gap-0">
              <span className="text-xs font-bold text-[#5B5FC7] w-8 shrink-0">UJ</span>
              <div className="flex gap-0 flex-1 overflow-x-auto">
                {ujTeeth.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTooth(selectedTooth === t ? null : t)}
                    className={`min-w-[32px] py-1.5 text-xs font-medium text-center transition-all border-b-2 ${
                      selectedTooth === t
                        ? 'text-[#5B5FC7] border-[#5B5FC7] bg-indigo-50 font-bold'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    style={{ width: `${100 / ujTeeth.length}%` }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Lower Jaw */}
            <div className="flex items-center gap-0">
              <span className="text-xs font-bold text-[#5B5FC7] w-8 shrink-0">LJ</span>
              <div className="flex gap-0 flex-1 overflow-x-auto">
                {ljTeeth.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTooth(selectedTooth === t ? null : t)}
                    className={`min-w-[32px] py-1.5 text-xs font-medium text-center transition-all border-t-2 ${
                      selectedTooth === t
                        ? 'text-[#5B5FC7] border-[#5B5FC7] bg-indigo-50 font-bold'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    style={{ width: `${100 / ljTeeth.length}%` }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Visual Dental Chart (always visible, synced selection) ═══ */}
      <div ref={chartRef}>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Visual Dental Chart</h3>
              {chartVersions.length > 0 && (
                <Badge variant="outline" className="text-[10px]">v{chartVersions[0]?.version}</Badge>
              )}
            </div>
            <ProfessionalDentalChart
              patientId={patientId}
              editable={false}
              initialChartData={chartVersions.length > 0 ? (chartVersions[0].chartData as ChartData) : null}
              compact={true}
              externalSelectedTooth={selectedTooth}
              onToothSelect={(t) => setSelectedTooth(t)}
              onChartTypeChange={(ct) => setChartType(ct)}
            />
          </CardContent>
        </Card>
      </div>

      {/* ═══ Per-Tooth Action Workspace (Molarsoft-style) ═══ */}
      {selectedTooth && (
        <div className="flex gap-4">
          {/* Left: Tooth Anatomy Views */}
          <div className="w-20 shrink-0 hidden md:block">
            <ToothAnatomyViews
              toothNumber={selectedTooth}
              selectedSurfaces={form.surfaces || []}
              onSurfaceClick={(s) => toggleSurface(s)}
            />
          </div>

          {/* Right: Action Workspace */}
          <Card className="border-0 shadow-sm flex-1 min-w-0">
          <CardContent className="pt-4">
            {/* Search Actions */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search actions..."
                value={searchActions}
                onChange={e => setSearchActions(e.target.value)}
                className="pl-9 text-sm border-gray-200"
              />
            </div>

            {/* Active inline form */}
            {activePanel ? (
              <div className="space-y-4">
                {/* Panel Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setActivePanel(null); setActivePanelCategory(null) }} className="text-[#5B5FC7] hover:underline text-sm font-medium flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                    </button>
                    <span className="text-sm font-semibold capitalize">
                      {form.title !== undefined && activePanel === 'custom'
                        ? (activePanelCategory === 'condition' ? 'New Condition' : 'New Procedure')
                        : activePanel.replace('_', ' ')}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-gray-500">Draft</Badge>
                  </div>
                </div>

                {/* Inline Form */}
                <div className="space-y-4 max-w-2xl">
                  {/* Teeth */}
                  {(activePanel === 'custom' || activePanel === 'diastema') && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Teeth *</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">T{selectedTooth}</Badge>
                        <span className="text-[10px] text-gray-400">Show All ▾</span>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-start gap-8">
                    <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Date *</Label>
                    <div className="flex-1 relative">
                      <Input
                        type="date"
                        value={form.date || format(currentDate, 'yyyy-MM-dd')}
                        onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                        className="text-sm"
                      />
                      {isToday && <Badge className="absolute right-10 top-1/2 -translate-y-1/2 bg-green-100 text-green-700 text-[9px] px-1.5 py-0">Today</Badge>}
                    </div>
                  </div>

                  {/* Title (for custom) */}
                  {activePanel === 'custom' && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Title *</Label>
                      <Input
                        placeholder={activePanelCategory === 'condition' ? 'condition title...' : 'procedure title...'}
                        value={form.title || ''}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        className="flex-1 text-sm"
                      />
                    </div>
                  )}

                  {/* Surfaces */}
                  {(activePanelCategory === 'condition' || activePanelCategory === 'procedure') && activePanel !== 'missing' && activePanel !== 'impacted' && activePanel !== 'diastema' && activePanel !== 'supernumerary' && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Surfaces</Label>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2">
                          {SURFACES.map(s => (
                            <button
                              key={s.key}
                              onClick={() => toggleSurface(s.key)}
                              className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                                (form.surfaces || []).includes(s.key)
                                  ? 'bg-[#5B5FC7] text-white border-[#5B5FC7]'
                                  : 'text-gray-500 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Is Impacted toggle */}
                  {activePanel === 'impacted' && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Is impacted</Label>
                      <div className="flex items-center gap-2">
                        <button className="text-xs px-3 py-1.5 rounded-md border text-gray-400 border-gray-200">No</button>
                        <button className="text-xs px-3 py-1.5 rounded-md border bg-[#5B5FC7] text-white border-[#5B5FC7]">Yes</button>
                      </div>
                    </div>
                  )}

                  {/* Severity (conditions) */}
                  {activePanelCategory === 'condition' && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Severity *</Label>
                      <Select value={form.severity || 'Unknown'} onValueChange={v => setForm(prev => ({ ...prev, severity: v }))}>
                        <SelectTrigger className="flex-1 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Material (restoration/crown) */}
                  {activePanelCategory === 'procedure' && (activePanel === 'restoration' || activePanel === 'crown') && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Material *</Label>
                      <Select value={form.material || 'Unspecified'} onValueChange={v => setForm(prev => ({ ...prev, material: v }))}>
                        <SelectTrigger className="flex-1 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="flex items-start gap-8">
                    <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Notes</Label>
                    <Textarea
                      placeholder="enter notes..."
                      value={form.notes || ''}
                      onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="flex-1 text-sm resize-y"
                    />
                  </div>

                  {/* Treatments */}
                  <div className="flex items-start gap-8">
                    <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Treatments</Label>
                    <Input
                      placeholder="e.g. Composite filling, Crown prep..."
                      value={(form as any).treatments || ''}
                      onChange={e => setForm(prev => ({ ...prev, treatments: e.target.value } as any))}
                      className="flex-1 text-sm"
                    />
                  </div>

                  {/* Treated At */}
                  <div className="flex items-start gap-8">
                    <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Treated At</Label>
                    <Input
                      type="date"
                      placeholder="mm/dd/yyyy"
                      className="flex-1 text-sm"
                    />
                  </div>

                  {/* Done By (for procedures) */}
                  {(activePanelCategory === 'procedure' || activePanelCategory === 'condition') && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Done by</Label>
                      <Input
                        value={form.doneBy || ''}
                        onChange={e => setForm(prev => ({ ...prev, doneBy: e.target.value }))}
                        placeholder="Dentist name"
                        className="flex-1 text-sm"
                      />
                    </div>
                  )}

                  {/* Conditions link (for procedures) */}
                  {activePanelCategory === 'procedure' && (
                    <div className="flex items-start gap-8">
                      <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Conditions</Label>
                      <Input
                        placeholder="e.g. Caries, Fracture..."
                        value={(form as any).conditions || ''}
                        onChange={e => setForm(prev => ({ ...prev, conditions: e.target.value } as any))}
                        className="flex-1 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setActivePanel(null); setActivePanelCategory(null) }}>
                    <Undo2 className="w-3 h-3" /> Undo changes
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1 bg-[#5B5FC7] hover:bg-[#4B4FB7]"
                    onClick={handleSaveAction}
                    disabled={savingAction}
                  >
                    {savingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save changes
                  </Button>
                </div>
              </div>
            ) : (
              /* ═══ Category Panels (Properties / Conditions / Procedures) ═══ */
              <div className="space-y-5">
                {/* Properties */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                    <span className="text-sm font-semibold text-gray-700">Properties</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filterBySearch(PROPERTIES).map(p => (
                      <button
                        key={p.key}
                        onClick={() => openActionPanel('property', p.key)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${p.color}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-4 bg-red-400 rounded-full" />
                    <span className="text-sm font-semibold text-gray-700">Conditions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filterBySearch(CONDITIONS).map(c => (
                      <button
                        key={c.key}
                        onClick={() => openActionPanel('condition', c.key)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${c.color}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Procedures */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-4 bg-blue-400 rounded-full" />
                    <span className="text-sm font-semibold text-gray-700">Procedures</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filterBySearch(PROCEDURES).map(pr => (
                      <button
                        key={pr.key}
                        onClick={() => openActionPanel('procedure', pr.key)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${pr.color}`}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Existing entries for this tooth */}
                {loadingActions ? (
                  <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>
                ) : toothActions.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">History for Tooth {selectedTooth}</h4>
                    <div className="space-y-1.5">
                      {toothActions.map((a, i) => (
                        <div key={a.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {a.actionCategory === 'procedure' ? '🔧' : a.actionCategory === 'condition' ? '🔴' : '📋'}
                            </Badge>
                            <span className="text-xs font-medium">{a.actionType}</span>
                            {a.surfaces.length > 0 && <span className="text-[10px] text-gray-400">{a.surfaces.join(', ')}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">{format(parseISO(a.date), 'MMM d, yyyy')}</span>
                            {a.id && (
                              <button onClick={() => handleDeleteAction(a.id!)} className="text-red-400 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* ═══ Chart Timeline moved to its own "Timeline" tab. ═══ */}

      {/* ═══ Treatment Plans ═══ */}
      <div id="treatment-plans-section">
        <TreatmentPlansManager patientId={patientId} patientName={undefined} />
      </div>

      {/* ═══ Chart Version History ═══ */}
      {chartVersions.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-2">Chart Version History ({chartVersions.length})</h4>
            <div className="space-y-1.5">
              {chartVersions.map((chart: any) => (
                <div key={chart.id} className="flex items-center justify-between border rounded-lg p-2.5 bg-gray-50">
                  <div>
                    <p className="font-medium text-xs">v{chart.version}</p>
                    <p className="text-[11px] text-gray-500">{format(parseISO(chart.createdAt), 'MMM d, yyyy')}{chart.updatedByName ? ` • ${chart.updatedByName}` : ''}</p>
                    {chart.notes && <p className="text-xs text-gray-600 mt-0.5">{chart.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

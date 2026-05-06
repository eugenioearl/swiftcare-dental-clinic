'use client'

import { useState, useMemo, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useSession } from '@/components/auth/custom-session-provider'
import {
  Search, Calendar, Stethoscope, StickyNote, Upload, FileText,
  History, FileImage, Plus, User, MessageCircle,
  Pencil, Image as ImageIcon, ChevronDown, Loader2, MoreHorizontal,
  ClipboardList, Activity, CheckCircle, ArrowRight, Eye
} from 'lucide-react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'

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

interface TimelineDocsTabProps {
  patientId: string
  uploads: any[]
  timeline: TimelineItem[]
  timelineFilter: string
  setTimelineFilter: (v: string) => void
  timelineSearch: string
  setTimelineSearch: (v: string) => void
  fetchTimeline: () => void
  fetchDentalData: () => void
  fetchUploads: () => void
  onReviewUpload: (upload: any) => void
}

const ACTIVITY_TYPES = [
  { key: 'all', label: '+ Add activity', icon: Plus },
  { key: 'visit', label: 'Concern', icon: MessageCircle },
  { key: 'procedure', label: 'Procedure', icon: Stethoscope },
  { key: 'note', label: 'Note', icon: Pencil },
  { key: 'upload', label: 'Files', icon: ImageIcon },
  { key: 'chart', label: 'Chart', icon: Activity },
]

const NEW_POST_ACTIVITIES = [
  { key: 'visit', label: 'Concern', icon: MessageCircle, description: "The reason for the visit, usually stated in the patient's own words.", color: 'border-blue-200 hover:bg-blue-50' },
  { key: 'diagnosis', label: 'Diagnosis', icon: Stethoscope, description: 'The identified condition or problem that needs to be treated.', color: 'border-purple-200 hover:bg-purple-50' },
  { key: 'procedure', label: 'Procedure', icon: ClipboardList, description: "The activity performed as part of the patient's care.", color: 'border-green-200 hover:bg-green-50' },
  { key: 'note', label: 'Note', icon: Pencil, description: "Any other piece of information relevant to the patient's care.", color: 'border-yellow-200 hover:bg-yellow-50' },
  { key: 'upload', label: 'Files', icon: ImageIcon, description: 'Attachment for images, videos, x-rays, reports, and other files.', color: 'border-orange-200 hover:bg-orange-50' },
]

function LastUpdatedStamp({ name }: { name: string | null | undefined }) {
  if (!name) return null
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 justify-end">
      <span>Last updated by {name}</span>
      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
        <User className="w-3 h-3 text-indigo-500" />
      </div>
    </div>
  )
}

export default function TimelineDocsTab({
  patientId, uploads, timeline, timelineFilter, setTimelineFilter,
  timelineSearch, setTimelineSearch, fetchTimeline, fetchDentalData, fetchUploads, onReviewUpload,
}: TimelineDocsTabProps) {
  const { toast } = useToast()
  const { data: session } = useSession() || {}
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showNewPost, setShowNewPost] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [saving, setSaving] = useState<string | null>(null)

  // Inline form states
  const [concernText, setConcernText] = useState('')
  const [diagnosisRows, setDiagnosisRows] = useState([{ tooth: '', surface: '', diagnosis: '' }])
  const [procedureRows, setProcedureRows] = useState([{ tooth: '', surface: '', procedure: '', doctor: '' }])
  const [noteText, setNoteText] = useState('')
  const [uploading, setUploading] = useState(false)

  // Group timeline by date, then by type
  const dateGroups = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? timeline
      : timeline.filter(item => item.type === activeFilter)

    const searchFiltered = timelineSearch
      ? filtered.filter(item =>
          item.title.toLowerCase().includes(timelineSearch.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(timelineSearch.toLowerCase())
        )
      : filtered

    const map = new Map<string, TimelineItem[]>()
    for (const item of searchFiltered) {
      const dateKey = item.date ? format(parseISO(item.date), 'yyyy-MM-dd') : 'unknown'
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(item)
    }

    const groups: { date: string; items: TimelineItem[]; byType: Record<string, TimelineItem[]> }[] = []
    for (const [date, items] of map) {
      const byType: Record<string, TimelineItem[]> = {}
      for (const item of items) {
        if (!byType[item.type]) byType[item.type] = []
        byType[item.type].push(item)
      }
      groups.push({ date, items, byType })
    }
    return groups
  }, [timeline, activeFilter, timelineSearch])

  const handleFilterChange = (key: string) => {
    setActiveFilter(key)
    if (key === 'all') setTimelineFilter('')
    else setTimelineFilter(key)
  }

  // ===== INLINE SAVE HANDLERS =====

  const saveConcern = async () => {
    if (!concernText.trim()) return
    setSaving('concern')
    try {
      const res = await fetch(`/api/patients/${patientId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate: new Date().toISOString(),
          chiefComplaint: concernText,
          attendingDentist: session?.user?.name || 'Staff',
          status: 'completed',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Concern saved' })
        setConcernText('')
        fetchTimeline()
        fetchDentalData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(null)
  }

  const saveDiagnosis = async (row: { tooth: string; surface: string; diagnosis: string }, idx: number) => {
    if (!row.diagnosis.trim()) return
    setSaving(`diag-${idx}`)
    try {
      const res = await fetch(`/api/patients/${patientId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate: new Date().toISOString(),
          diagnosis: `${row.tooth ? `Tooth ${row.tooth}` : ''}${row.surface ? ` (${row.surface})` : ''}: ${row.diagnosis}`.trim(),
          attendingDentist: session?.user?.name || 'Staff',
          status: 'completed',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Diagnosis saved' })
        setDiagnosisRows(prev => {
          const next = [...prev]
          next[idx] = { tooth: '', surface: '', diagnosis: '' }
          return next
        })
        fetchTimeline()
        fetchDentalData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(null)
  }

  const saveProcedure = async (row: { tooth: string; surface: string; procedure: string; doctor: string }, idx: number) => {
    if (!row.procedure.trim()) return
    setSaving(`proc-${idx}`)
    try {
      const res = await fetch(`/api/patients/${patientId}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureType: row.procedure,
          procedureDate: new Date().toISOString().slice(0, 10),
          teethInvolved: row.tooth ? row.tooth.split(',').map(t => t.trim()) : [],
          dentistName: row.doctor || session?.user?.name || 'Staff',
          status: 'completed',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Procedure saved' })
        setProcedureRows(prev => {
          const next = [...prev]
          next[idx] = { tooth: '', surface: '', procedure: '', doctor: '' }
          return next
        })
        fetchTimeline()
        fetchDentalData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(null)
  }

  const saveNote = async () => {
    if (!noteText.trim()) return
    setSaving('note')
    try {
      const res = await fetch(`/api/patients/${patientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteType: 'general', content: noteText, isInternal: false }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Note saved' })
        setNoteText('')
        fetchTimeline()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/patients/${patientId}/smart-upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'File uploaded', description: data.data?.extractionStatus === 'processing' ? 'AI is extracting data...' : 'Upload complete' })
        fetchTimeline()
        fetchUploads()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleNewPostAction = (key: string) => {
    setShowNewPost(false)
    // Scroll to the relevant section
    const el = document.getElementById(`section-${key}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Latest updater per type from timeline data
  const getLastUpdater = (type: string) => {
    const items = timeline.filter(t => t.type === type)
    return items[0]?.updatedBy || items[0]?.dentist || null
  }

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === 'unknown') return { label: 'Unknown Date', badge: undefined }
    try {
      const d = parseISO(dateStr)
      if (isToday(d)) return { label: format(d, 'd MMM yyyy'), badge: 'Today' }
      if (isYesterday(d)) return { label: format(d, 'd MMM yyyy'), badge: 'Yesterday' }
      return { label: format(d, 'd MMM yyyy'), badge: undefined }
    } catch { return { label: dateStr, badge: undefined } }
  }

  // Sections order & config
  const SECTIONS = [
    { key: 'visit', label: 'Concern', timelineType: 'visit' },
    { key: 'diagnosis', label: 'Diagnosis', timelineType: 'visit' },
    { key: 'procedure', label: 'Procedures', timelineType: 'procedure' },
    { key: 'upload', label: 'Files', timelineType: 'upload' },
    { key: 'note', label: 'Notes', timelineType: 'note' },
  ]

  return (
    <div className="space-y-4">
      {/* Top Bar: Search + New */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search dental records..."
            value={timelineSearch}
            onChange={e => setTimelineSearch(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-200"
          />
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5" onClick={() => setShowNewPost(true)}>
          <FileText className="w-4 h-4" /> New
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </Button>
      </div>

      {/* Date-grouped charting workspace */}
      {dateGroups.length === 0 && !timeline.length ? (
        // Empty state with inline forms
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">{format(new Date(), 'd MMM yyyy')}</span>
            <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] font-semibold px-2">Today</Badge>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Activity type pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {ACTIVITY_TYPES.map(at => {
              const Icon = at.icon
              return (
                <button key={at.key} onClick={() => handleFilterChange(at.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeFilter === at.key ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{at.label}
                </button>
              )
            })}
          </div>

          {renderInlineSections({}, null)}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Show today's inline workspace first */}
          {(() => {
            const todayKey = format(new Date(), 'yyyy-MM-dd')
            const todayGroup = dateGroups.find(g => g.date === todayKey)
            const otherGroups = dateGroups.filter(g => g.date !== todayKey)

            return (
              <>
                {/* Today's workspace */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700">{format(new Date(), 'd MMM yyyy')}</span>
                    <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] font-semibold px-2">Today</Badge>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {ACTIVITY_TYPES.map(at => {
                      const Icon = at.icon
                      return (
                        <button key={at.key} onClick={() => handleFilterChange(at.key)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeFilter === at.key ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-gray-500 hover:bg-gray-100'
                          }`}>
                          <Icon className="w-3.5 h-3.5" />{at.label}
                        </button>
                      )
                    })}
                  </div>

                  {renderInlineSections(todayGroup?.byType || {}, todayGroup)}
                </div>

                {/* Past dates - read-only summary */}
                {otherGroups.map(group => {
                  const { label, badge } = formatDateLabel(group.date)
                  return (
                    <div key={group.date}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                        {badge && <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] font-semibold px-2">{badge}</Badge>}
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      {renderPastDateSections(group)}
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {/* Uploads pending review */}
      {uploads.some(u => u.extractedData && !u.savedToRecords) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">📋 Uploads pending review</p>
          <div className="space-y-2">
            {uploads.filter(u => u.extractedData && !u.savedToRecords).map(upload => (
              <div key={upload.id} className="flex items-center justify-between bg-white rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileImage className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm truncate">{upload.originalName}</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-shrink-0" onClick={() => onReviewUpload(upload)}>
                  <Eye className="w-3 h-3 mr-1" /> Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />

      {/* New Post Sheet */}
      <Sheet open={showNewPost} onOpenChange={setShowNewPost}>
        <SheetContent className="w-[400px] sm:w-[450px]">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-indigo-700">New Post</SheetTitle>
            <SheetDescription>Describe the patient care activity.</SheetDescription>
          </SheetHeader>
          <div className="space-y-1">
            <div className="flex items-center gap-3 px-2 py-3 border-b">
              <span className="text-sm font-medium text-gray-500 w-16">Date</span>
              <div className="flex-1 border rounded-lg px-3 py-2 text-sm flex items-center justify-between bg-gray-50">
                <span>{format(new Date(), 'MMMM d, yyyy')}</span>
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="px-2 py-3"><span className="text-sm font-medium text-gray-500">Activity</span></div>
            <div className="space-y-1">
              {NEW_POST_ACTIVITIES.map(act => {
                const Icon = act.icon
                return (
                  <button key={act.key} onClick={() => handleNewPostAction(act.key)}
                    className={`w-full flex items-start gap-4 px-4 py-4 rounded-lg border ${act.color} transition-colors text-left`}>
                    <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{act.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{act.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )

  // ===== INLINE SECTIONS FOR TODAY (editable) =====
  function renderInlineSections(byType: Record<string, TimelineItem[]>, group: any) {
    const shouldShow = (key: string) => activeFilter === 'all' || activeFilter === key

    return (
      <div className="space-y-5 ml-1">
        {/* ===== CONCERN ===== */}
        {shouldShow('visit') && (
          <div id="section-visit" className="border-b pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Concern</p>
              <LastUpdatedStamp name={getLastUpdater('visit')} />
            </div>
            {/* Existing concerns */}
            {(byType.visit || []).filter(i => i.data?.chiefComplaint).map(item => (
              <div key={item.id} className="bg-gray-50 rounded p-3 mb-2 text-sm text-gray-700">
                {item.data.chiefComplaint}
                <span className="text-[10px] text-gray-400 ml-2">{format(parseISO(item.date), 'h:mm a')}</span>
              </div>
            ))}
            {/* Inline input */}
            <div className="relative">
              <Textarea
                placeholder="Enter concern..."
                value={concernText}
                onChange={e => setConcernText(e.target.value)}
                rows={2}
                className="bg-white border-gray-200 text-sm resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveConcern() }}
              />
              {concernText.trim() && (
                <Button size="sm" className="absolute bottom-2 right-2 h-7 text-xs" onClick={saveConcern} disabled={saving === 'concern'}>
                  {saving === 'concern' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ===== DIAGNOSIS (chart) ===== */}
        {shouldShow('diagnosis') && (
          <div id="section-diagnosis" className="border-b pb-4">
            {/* Existing diagnoses from visits */}
            {(() => {
              const diagItems = (byType.visit || []).filter(i => i.data?.diagnosis)
              return (
                <>
                  {diagItems.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Diagnosis (chart)</p>
                        <LastUpdatedStamp name={getLastUpdater('visit')} />
                      </div>
                      <table className="w-full text-sm">
                        <thead><tr className="border-b">
                          <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-20">Tooth</th>
                          <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-24">Surface</th>
                          <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700">Diagnosis</th>
                          <th className="w-8"></th>
                        </tr></thead>
                        <tbody>
                          {diagItems.map(item => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2 text-sm font-mono">{item.data?.teethInvolved || ''}</td>
                              <td className="py-2 px-2 text-sm text-gray-500">{item.data?.surface || ''}</td>
                              <td className="py-2 px-2 text-sm">{item.data.diagnosis}</td>
                              <td className="py-2 px-1">
                                <button className="text-gray-300 hover:text-gray-500"><MoreHorizontal className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Inline add diagnosis */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Diagnosis</p>
                <LastUpdatedStamp name={getLastUpdater('visit')} />
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-20">Tooth</th>
                  <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-24">Surface</th>
                  <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700">Diagnosis</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody>
                  {diagnosisRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1 px-1"><Input value={row.tooth} onChange={e => { const next = [...diagnosisRows]; next[idx] = { ...row, tooth: e.target.value }; setDiagnosisRows(next) }} placeholder="tooth numbers..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" /></td>
                      <td className="py-1 px-1"><Input value={row.surface} onChange={e => { const next = [...diagnosisRows]; next[idx] = { ...row, surface: e.target.value }; setDiagnosisRows(next) }} placeholder="tooth surface/s..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" /></td>
                      <td className="py-1 px-1"><Input value={row.diagnosis} onChange={e => { const next = [...diagnosisRows]; next[idx] = { ...row, diagnosis: e.target.value }; setDiagnosisRows(next) }} placeholder="diagnosis..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" onKeyDown={e => { if (e.key === 'Enter') saveDiagnosis(row, idx) }} /></td>
                      <td className="py-1 px-1">
                        {row.diagnosis.trim() && (
                          <button onClick={() => saveDiagnosis(row, idx)} className="text-green-500 hover:text-green-700" disabled={saving === `diag-${idx}`}>
                            {saving === `diag-${idx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setDiagnosisRows(prev => [...prev, { tooth: '', surface: '', diagnosis: '' }])} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1 mx-auto py-1">
                <Plus className="w-3 h-3" /> Add diagnosis
              </button>
            </div>
          </div>
        )}

        {/* ===== PROCEDURES ===== */}
        {shouldShow('procedure') && (
          <div id="section-procedure" className="border-b pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Procedures</p>
              <LastUpdatedStamp name={getLastUpdater('procedure')} />
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-20">Tooth</th>
                <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700 w-24">Surface</th>
                <th className="text-left py-1.5 px-2 text-xs font-bold text-gray-700">Procedure</th>
                <th className="text-right py-1.5 px-2 text-xs font-bold text-gray-700 w-36">Doctor</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {/* Existing procedures */}
                {(byType.procedure || []).map(item => {
                  const teeth = item.data?.teethInvolved
                  const toothStr = Array.isArray(teeth) ? teeth.join(', ') : (teeth || '')
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 text-sm font-mono">{toothStr}</td>
                      <td className="py-2 px-2 text-sm text-gray-500">{item.data?.surface || ''}</td>
                      <td className="py-2 px-2 text-sm">{item.title}</td>
                      <td className="py-2 px-2 text-sm text-right text-gray-600">{item.dentist || item.data?.dentistName || ''}</td>
                      <td className="py-2 px-1"><button className="text-gray-300 hover:text-gray-500"><MoreHorizontal className="w-4 h-4" /></button></td>
                    </tr>
                  )
                })}
                {/* Inline add rows */}
                {procedureRows.map((row, idx) => (
                  <tr key={`new-${idx}`} className="border-b border-gray-100">
                    <td className="py-1 px-1"><Input value={row.tooth} onChange={e => { const next = [...procedureRows]; next[idx] = { ...row, tooth: e.target.value }; setProcedureRows(next) }} placeholder="tooth numbers..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" /></td>
                    <td className="py-1 px-1"><Input value={row.surface} onChange={e => { const next = [...procedureRows]; next[idx] = { ...row, surface: e.target.value }; setProcedureRows(next) }} placeholder="tooth surface/s..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" /></td>
                    <td className="py-1 px-1"><Input value={row.procedure} onChange={e => { const next = [...procedureRows]; next[idx] = { ...row, procedure: e.target.value }; setProcedureRows(next) }} placeholder="procedure..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300" /></td>
                    <td className="py-1 px-1"><Input value={row.doctor} onChange={e => { const next = [...procedureRows]; next[idx] = { ...row, doctor: e.target.value }; setProcedureRows(next) }} placeholder="select a doctor..." className="h-8 text-xs border-0 bg-transparent px-1 placeholder:text-gray-300 text-right" onKeyDown={e => { if (e.key === 'Enter') saveProcedure(row, idx) }} /></td>
                    <td className="py-1 px-1">
                      {row.procedure.trim() && (
                        <button onClick={() => saveProcedure(row, idx)} className="text-green-500 hover:text-green-700" disabled={saving === `proc-${idx}`}>
                          {saving === `proc-${idx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setProcedureRows(prev => [...prev, { tooth: '', surface: '', procedure: '', doctor: '' }])} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1 mx-auto py-1">
              <Plus className="w-3 h-3" /> Add procedure
            </button>
          </div>
        )}

        {/* ===== FILES ===== */}
        {shouldShow('upload') && (
          <div id="section-upload" className="border-b pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Files</p>
              <LastUpdatedStamp name={getLastUpdater('upload')} />
            </div>
            {/* Existing files */}
            {(byType.upload || []).length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {(byType.upload || []).map(item => (
                  <div key={item.id} className="border rounded p-2 text-center hover:bg-gray-50">
                    {item.data?.mimeType?.startsWith('image/') ? <FileImage className="w-6 h-6 text-blue-400 mx-auto" /> : <FileText className="w-6 h-6 text-orange-400 mx-auto" />}
                    <p className="text-[10px] text-gray-500 truncate mt-1">{item.data?.originalName || item.title}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Upload area */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-6 h-6 text-gray-400 animate-spin" /> : <Plus className="w-6 h-6 text-gray-400" />}
            </button>
          </div>
        )}

        {/* ===== NOTES ===== */}
        {shouldShow('note') && (
          <div id="section-note" className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</p>
              <LastUpdatedStamp name={getLastUpdater('note')} />
            </div>
            {/* Existing notes */}
            {(byType.note || []).map(item => (
              <div key={item.id} className="bg-gray-50 rounded p-3 mb-2 text-sm text-gray-700 whitespace-pre-wrap">
                {item.data?.content || item.subtitle || item.title}
                <span className="text-[10px] text-gray-400 ml-2">{format(parseISO(item.date), 'h:mm a')}</span>
              </div>
            ))}
            {/* Inline input */}
            <div className="relative">
              <Textarea
                placeholder="Enter notes..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                className="bg-white border-gray-200 text-sm resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNote() }}
              />
              {noteText.trim() && (
                <Button size="sm" className="absolute bottom-2 right-2 h-7 text-xs" onClick={saveNote} disabled={saving === 'note'}>
                  {saving === 'note' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== PAST DATE SECTIONS (read-only) =====
  function renderPastDateSections(group: { date: string; items: TimelineItem[]; byType: Record<string, TimelineItem[]> }) {
    const TYPES = ['visit', 'procedure', 'chart', 'note', 'upload', 'form', 'audit', 'plan']
    const TYPE_LABELS: Record<string, string> = {
      visit: 'Concern / Visit', procedure: 'Procedures', chart: 'Chart',
      note: 'Notes', upload: 'Files', form: 'Forms', audit: 'Changes', plan: 'Plans',
    }

    return (
      <div className="space-y-3 ml-1">
        {TYPES.filter(t => group.byType[t]?.length).map(typeKey => {
          const items = group.byType[typeKey]
          const updater = items[0]?.updatedBy || items[0]?.dentist

          return (
            <div key={typeKey} className="border-b pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{TYPE_LABELS[typeKey] || typeKey}</p>
                <LastUpdatedStamp name={updater} />
              </div>

              {/* Visits - show concern + diagnosis */}
              {typeKey === 'visit' && (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="text-sm text-gray-700">
                      {item.data?.chiefComplaint && <div className="bg-gray-50 rounded p-2 mb-1"><span className="text-[10px] text-gray-400 uppercase">Concern:</span> {item.data.chiefComplaint}</div>}
                      {item.data?.diagnosis && <div className="bg-gray-50 rounded p-2 mb-1"><span className="text-[10px] text-gray-400 uppercase">Diagnosis:</span> {item.data.diagnosis}</div>}
                      {item.data?.treatmentDone && <div className="bg-gray-50 rounded p-2"><span className="text-[10px] text-gray-400 uppercase">Treatment:</span> {item.data.treatmentDone}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Procedures - table */}
              {typeKey === 'procedure' && (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-1 px-2 text-xs font-bold text-gray-700 w-20">Tooth</th><th className="text-left py-1 px-2 text-xs font-bold text-gray-700 w-24">Surface</th><th className="text-left py-1 px-2 text-xs font-bold text-gray-700">Procedure</th><th className="text-right py-1 px-2 text-xs font-bold text-gray-700 w-36">Doctor</th></tr></thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-1.5 px-2 font-mono text-xs">{Array.isArray(item.data?.teethInvolved) ? item.data.teethInvolved.join(', ') : (item.data?.teethInvolved || '')}</td>
                        <td className="py-1.5 px-2 text-gray-500">{item.data?.surface || ''}</td>
                        <td className="py-1.5 px-2">{item.title}</td>
                        <td className="py-1.5 px-2 text-right text-gray-600">{item.dentist || item.data?.dentistName || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Notes */}
              {typeKey === 'note' && items.map(item => (
                <div key={item.id} className="bg-gray-50 rounded p-2 mb-1 text-sm text-gray-700 whitespace-pre-wrap">{item.data?.content || item.subtitle || item.title}</div>
              ))}

              {/* Files */}
              {typeKey === 'upload' && (
                <div className="flex gap-2 flex-wrap">
                  {items.map(item => (
                    <div key={item.id} className="border rounded p-2 text-center w-20">
                      {item.data?.mimeType?.startsWith('image/') ? <FileImage className="w-5 h-5 text-blue-400 mx-auto" /> : <FileText className="w-5 h-5 text-orange-400 mx-auto" />}
                      <p className="text-[9px] text-gray-500 truncate mt-0.5">{item.data?.originalName || item.title}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Audit */}
              {typeKey === 'audit' && items.map(item => (
                <div key={item.id} className="text-sm text-gray-600 mb-1">
                  {item.title}
                  {item.data?.changes && Array.isArray(item.data.changes) && (
                    <div className="mt-1 space-y-0.5">
                      {item.data.changes.slice(0, 2).map((c: any, i: number) => (
                        <div key={i} className="text-xs flex items-center gap-1">
                          <span className="font-medium text-gray-500">{c.field}:</span>
                          <span className="text-red-400 line-through">{c.old || '(empty)'}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className="text-green-600">{c.new || '(empty)'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Forms */}
              {typeKey === 'form' && items.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm mb-1">
                  <span>{item.title}</span>
                  {item.data?.hasSignature && <Badge className="bg-green-100 text-green-700 border-0 text-[10px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Signed</Badge>}
                </div>
              ))}

              {/* Chart / Plans fallback */}
              {(typeKey === 'chart' || typeKey === 'plan') && items.map(item => (
                <div key={item.id} className="text-sm text-gray-700 mb-1">{item.title}{item.subtitle ? ` — ${item.subtitle}` : ''}</div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }
}

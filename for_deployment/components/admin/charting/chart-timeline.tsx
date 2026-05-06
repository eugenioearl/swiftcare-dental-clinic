'use client'

import React from 'react'
import { formatDentistName } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import {
  Plus, Loader2, CalendarPlus, Package, ExternalLink, MoreHorizontal,
  Trash2, ChevronDown, ChevronUp, FileText, Stethoscope, Pencil, Check, X, History,
  CornerDownRight, Info, User as UserIcon, Calendar, Clock, DollarSign, Hash, Activity,
  Clipboard, AlertCircle, MousePointerClick, PenLine, Eraser, Eye, Wallet,
} from 'lucide-react'
import { format, parseISO, isToday as isTodayFn } from 'date-fns'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import SignaturePad from '@/components/digital-signature/signature-pad'
import { ImageLightbox } from '@/components/ui/image-lightbox'

// ─── Types ────────────────────────────────────────────────
interface ChartEntry {
  id: string
  chartType: string
  entryNumber: number
  visitDate: string
  toothNumber: string | null
  surface: string | null
  diagnosis: string | null
  procedureName: string | null
  treatmentId: string | null
  wire: string | null
  notes: string | null
  amountCharged: number | string
  amountPaid: number | string
  runningBalance: number | string
  dentistName: string | null
  nextVisitDate: string | null
  nextVisitNotes: string | null
  autoAppointmentId: string | null
  packageId: string | null
  deductedFromPackage: boolean
  parentEntryId: string | null
  status: string
  createdAt: string
  lastEditedBy: string | null
  editHistory: any[] | null
  patientSignature?: string | null
  signedAt?: string | null
  signedByName?: string | null
}

interface EditForm {
  toothNumber: string
  surface: string
  diagnosis: string
  procedureName: string
  wire: string
  notes: string
  amountCharged: string
  amountPaid: string
  dentistName: string
}

interface TreatmentOption {
  id: string
  name: string
  treatmentCode: string
  baseCost: number | string
  category: string
  procedureType?: string | null
}

interface PatientPackage {
  id: string
  packageNumber: string
  title: string
  status: string
  totalAmount: number | string
  paidAmount: number | string
  balanceDue: number | string
}

interface ChartTimelineProps {
  patientId: string
  refreshKey?: number
  onChanged?: () => void
  onViewOnChart?: (toothNumber: number) => void
}

interface ProcedureNode {
  parent: ChartEntry
  children: ChartEntry[]
}

interface DateGroup {
  date: string
  diagnoses: ChartEntry[]
  procedureNodes: ProcedureNode[]
  notes: ChartEntry[]
}

// ─── Ortho procedures ────────────────────────────────────
const COMMON_ORTHO_PROCEDURES = [
  'Adjustment', 'Rebond', 'Wire Change', 'Elastic Change', 'Power Chain',
  'Bracket Replacement', 'Archwire Replacement', 'Ligature Tie',
  'Band Cementation', 'Debonding', 'Retainer Fitting', 'Consultation',
  'Records / Impressions', 'Bonding (Initial)', 'Spring Placement', 'Separator Placement',
]

// ─── Render a single procedure row (parent or child) ────────────
function renderProcedureRow(
  e: ChartEntry,
  isChild: boolean,
  isEditing: boolean,
  editForm: EditForm,
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>,
  startEdit: (entry: ChartEntry) => void,
  cancelEdit: () => void,
  saveEdit: (entryId: string) => Promise<void>,
  savingEdit: boolean,
  handleDelete: (entryId: string) => Promise<void>,
  onViewOnChart?: (toothNumber: number) => void,
  openAddDialog?: (type: 'general' | 'ortho', parent?: ChartEntry | null) => Promise<void>,
  childCount: number = 0,
  onRowClick?: (entry: ChartEntry) => void,
  onSign?: (entry: ChartEntry) => void,
  onViewSignature?: (src: string, label: string) => void,
) {
  const stopProp = (ev: React.MouseEvent) => ev.stopPropagation()
  return (
    <tr
      key={e.id}
      onClick={() => !isEditing && onRowClick?.(e)}
      className={`group transition-colors ${!isEditing ? 'cursor-pointer' : ''} ${
        isEditing
          ? 'bg-indigo-50/30'
          : isChild
            ? 'bg-gradient-to-r from-purple-50/30 to-transparent hover:from-purple-100/60'
            : 'hover:bg-indigo-50/40'
      }`}
      title={!isEditing ? 'Click to view / edit full details' : undefined}
    >
      <td className="px-3 py-2">
        {isEditing ? (
          <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.toothNumber} onChange={ev => setEditForm(p => ({ ...p, toothNumber: ev.target.value }))} />
        ) : (
          <div className="flex items-center gap-1">
            {isChild && <CornerDownRight className="w-3 h-3 text-purple-400" />}
            <span className={`${isChild ? 'text-gray-500 pl-1' : 'text-gray-700'}`}>{e.toothNumber || '—'}</span>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {isEditing ? (
          <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.surface} onChange={ev => setEditForm(p => ({ ...p, surface: ev.target.value }))} />
        ) : (
          <span className="text-gray-500">{e.surface || (e.wire ? `Wire: ${e.wire}` : '—')}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {isEditing ? (
          <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.procedureName} onChange={ev => setEditForm(p => ({ ...p, procedureName: ev.target.value }))} />
        ) : (
          <HoverCard openDelay={200} closeDelay={80}>
            <HoverCardTrigger asChild>
              <div className={`flex items-center gap-1.5 cursor-default ${isChild ? 'pl-3' : ''}`}>
                {isChild && (
                  <Badge className="bg-purple-100 text-purple-700 text-[9px] px-1 py-0 border border-purple-200 font-semibold">
                    Add-on
                  </Badge>
                )}
                <span className={`${isChild ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                  {e.procedureName}
                </span>
                {e.chartType === 'ortho' && <Badge className="bg-purple-50 text-purple-600 text-[9px] px-1 py-0 border border-purple-200">Ortho</Badge>}
                {e.deductedFromPackage && <Badge className="bg-amber-50 text-amber-600 text-[9px] px-1 py-0 border border-amber-200">Pkg</Badge>}
                {e.autoAppointmentId && <Badge className="bg-blue-50 text-blue-600 text-[9px] px-1 py-0 border border-blue-200">Next ✓</Badge>}
                {childCount > 0 && !isChild && (
                  <Badge className="bg-indigo-100 text-indigo-700 text-[9px] px-1 py-0 border border-indigo-200">
                    +{childCount} add-on{childCount > 1 ? 's' : ''}
                  </Badge>
                )}
                <Info className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 text-xs" side="right" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="font-semibold text-sm text-gray-900">{e.procedureName}</div>
                  <Badge className={`text-[9px] ${e.chartType === 'ortho' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {e.chartType === 'ortho' ? 'Ortho' : 'General'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-gray-400">Entry:</span> <span className="font-semibold text-gray-700">#{e.entryNumber}</span></div>
                  <div><span className="text-gray-400">Date:</span> <span className="text-gray-700">{format(parseISO(e.visitDate), 'dd MMM yyyy, HH:mm')}</span></div>
                  {e.toothNumber && <div><span className="text-gray-400">Tooth:</span> <span className="text-gray-700">{e.toothNumber}</span></div>}
                  {e.surface && <div><span className="text-gray-400">Surface:</span> <span className="text-gray-700">{e.surface}</span></div>}
                  {e.wire && <div className="col-span-2"><span className="text-gray-400">Wire:</span> <span className="text-gray-700">{e.wire}</span></div>}
                  {e.diagnosis && <div className="col-span-2"><span className="text-gray-400">Diagnosis:</span> <span className="text-gray-700">{e.diagnosis}</span></div>}
                  {e.dentistName && <div className="col-span-2"><span className="text-gray-400">Dentist:</span> <span className="text-gray-700">{e.dentistName}</span></div>}
                </div>
                {e.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-[10px] text-gray-400 mb-1">Notes</div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">{e.notes}</p>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[11px]">
                  <span className="text-gray-500">Charged:</span>
                  <span className="font-semibold text-gray-800">₱{Number(e.amountCharged).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-500">Paid:</span>
                  <span className="font-semibold text-emerald-600">₱{Number(e.amountPaid).toLocaleString()}</span>
                </div>
                {e.deductedFromPackage && (
                  <div className="bg-amber-50 text-amber-700 rounded px-2 py-1 text-[10px] flex items-center gap-1">
                    <Package className="w-3 h-3" /> Paid via package deduction
                  </div>
                )}
                {isChild && (
                  <div className="bg-purple-50 text-purple-700 rounded px-2 py-1 text-[10px] flex items-center gap-1">
                    <CornerDownRight className="w-3 h-3" /> Add-on sub-procedure (separate payment)
                  </div>
                )}
                {e.lastEditedBy && (
                  <div className="text-[10px] text-gray-400 pt-1 italic">Last edited by {e.lastEditedBy}</div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </td>
      <td className="px-3 py-2">
        {isEditing ? (
          <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.dentistName} onChange={ev => setEditForm(p => ({ ...p, dentistName: ev.target.value }))} />
        ) : (
          <span className="text-gray-500 truncate">{e.dentistName || '—'}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {isEditing ? (
          <input type="number" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-right" value={editForm.amountCharged} onChange={ev => setEditForm(p => ({ ...p, amountCharged: ev.target.value }))} />
        ) : (
          <span className={`${isChild ? 'text-gray-500' : 'text-gray-700'}`}>₱{Number(e.amountCharged).toLocaleString()}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {isEditing ? (
          <input type="number" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-right" value={editForm.amountPaid} onChange={ev => setEditForm(p => ({ ...p, amountPaid: ev.target.value }))} />
        ) : (
          <span className="text-green-600">₱{Number(e.amountPaid).toLocaleString()}</span>
        )}
      </td>
      <td className="px-3 py-2" onClick={stopProp}>
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {isEditing ? (
            <>
              <button onClick={(ev) => { stopProp(ev); saveEdit(e.id) }} disabled={savingEdit} className="text-green-600 hover:text-green-800">
                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={(ev) => { stopProp(ev); cancelEdit() }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              {!isChild && openAddDialog && (
                <button
                  onClick={(ev) => { stopProp(ev); openAddDialog(e.chartType as 'general' | 'ortho', e) }}
                  className="text-[10px] text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-0.5 px-1"
                  title="Add a sub-procedure under this entry"
                >
                  <Plus className="w-2.5 h-2.5" /> Add-on
                </button>
              )}
              {/* Patient Signature — thumbnail if signed, button if not */}
              {e.patientSignature ? (
                <button
                  onClick={(ev) => { stopProp(ev); onViewSignature?.(e.patientSignature!, `Entry #${e.entryNumber} · ${e.procedureName || e.chartType}`) }}
                  className="flex items-center gap-1 border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 rounded px-1 py-0.5 transition-colors group/sig"
                  title={e.signedByName ? `Signed by ${e.signedByName}. Click to enlarge.` : 'Signed. Click to enlarge.'}
                >
                  <img
                    src={e.patientSignature}
                    alt="Patient signature"
                    className="h-5 w-10 object-contain bg-white rounded-sm"
                  />
                  <Eye className="w-2.5 h-2.5 text-emerald-600 opacity-0 group-hover/sig:opacity-100 transition-opacity" />
                </button>
              ) : onSign ? (
                <button
                  onClick={(ev) => { stopProp(ev); onSign(e) }}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-0.5 px-1 border border-dashed border-emerald-300 rounded hover:bg-emerald-50"
                  title="Request patient signature for this entry"
                >
                  <PenLine className="w-2.5 h-2.5" /> Sign
                </button>
              ) : null}
              {e.toothNumber && onViewOnChart && (
                <button onClick={(ev) => { stopProp(ev); onViewOnChart(Number(e.toothNumber)) }} className="text-[10px] text-[#5B5FC7] hover:underline flex items-center gap-0.5" title="View tooth on dental chart">
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
              <button onClick={(ev) => { stopProp(ev); onRowClick?.(e) }} className="text-gray-300 hover:text-[#5B5FC7] ml-0.5" title="Open full details / edit"><Pencil className="w-3 h-3" /></button>
              <button onClick={(ev) => { stopProp(ev); handleDelete(e.id) }} className="text-gray-300 hover:text-red-500" title="Delete entry"><Trash2 className="w-3 h-3" /></button>
            </>
          )}
        </div>
        {!isEditing && e.signedByName && (
          <div className="text-[9px] text-emerald-600 text-right mt-0.5 truncate" title={`Signed by ${e.signedByName}`}>
            ✓ {e.signedByName}
          </div>
        )}
        {!isEditing && e.lastEditedBy && (
          <div className="text-[9px] text-gray-400 text-right mt-0.5">edited by {e.lastEditedBy}</div>
        )}
      </td>
    </tr>
  )
}

export default function ChartTimeline({ patientId, refreshKey, onChanged, onViewOnChart }: ChartTimelineProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { data: session } = useSession() || {}
  const [allEntries, setAllEntries] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [treatments, setTreatments] = useState<TreatmentOption[]>([])
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [allPackages, setAllPackages] = useState<PatientPackage[]>([])
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [addType, setAddType] = useState<'general' | 'ortho'>('general')
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ toothNumber: '', surface: '', diagnosis: '', procedureName: '', wire: '', notes: '', amountCharged: '', amountPaid: '', dentistName: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // ─── Detail dialog state ─────────────────────────────────
  const [detailEntry, setDetailEntry] = useState<ChartEntry | null>(null)
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailForm, setDetailForm] = useState<EditForm>({ toothNumber: '', surface: '', diagnosis: '', procedureName: '', wire: '', notes: '', amountCharged: '', amountPaid: '', dentistName: '' })
  const [showHistory, setShowHistory] = useState(false)

  // ─── Patient signature state ─────────────────────────────
  const [signatureEntry, setSignatureEntry] = useState<ChartEntry | null>(null)
  const [signatureData, setSignatureData] = useState<string>('')
  const [signatureName, setSignatureName] = useState<string>('')
  const [signatureSaving, setSignatureSaving] = useState(false)
  const [signatureViewer, setSignatureViewer] = useState<{ src: string; label: string } | null>(null)

  const openSignature = (entry: ChartEntry) => {
    setSignatureEntry(entry)
    setSignatureData(entry.patientSignature || '')
    setSignatureName(entry.signedByName || '')
  }
  const closeSignature = () => {
    setSignatureEntry(null)
    setSignatureData('')
    setSignatureName('')
  }
  const saveSignature = async () => {
    if (!signatureEntry || !signatureData) return
    setSignatureSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${signatureEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientSignature: signatureData, signedByName: signatureName || null }),
      })
      if (!res.ok) throw new Error('Failed to save signature')
      toast({ title: 'Signed', description: signatureName ? `Signed by ${signatureName}.` : 'Patient signature saved.' })
      // Sync local state so the detail dialog and thumbnails update immediately
      await fetchEntries()
      if (detailEntry && detailEntry.id === signatureEntry.id) {
        setDetailEntry({ ...detailEntry, patientSignature: signatureData, signedByName: signatureName || null, signedAt: new Date().toISOString() })
      }
      closeSignature()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not save signature', variant: 'destructive' })
    } finally {
      setSignatureSaving(false)
    }
  }
  const clearSignature = async (entry: ChartEntry) => {
    const ok = await confirm({
      title: 'Remove patient signature?',
      description: 'The patient signature on this chart entry will be cleared.',
      confirmLabel: 'Remove Signature',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientSignature: null, signedByName: null }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Signature cleared', description: 'Patient signature removed.' })
      await fetchEntries()
      if (detailEntry && detailEntry.id === entry.id) {
        setDetailEntry({ ...detailEntry, patientSignature: null, signedByName: null, signedAt: null })
      }
    } catch {
      toast({ title: 'Error', description: 'Could not clear signature', variant: 'destructive' })
    }
  }

  const openDetail = (entry: ChartEntry) => {
    setDetailEntry(entry)
    setDetailEditing(false)
    setShowHistory(false)
    setDetailForm({
      toothNumber: entry.toothNumber || '',
      surface: entry.surface || '',
      diagnosis: entry.diagnosis || '',
      procedureName: entry.procedureName || '',
      wire: entry.wire || '',
      notes: entry.notes || '',
      amountCharged: String(Number(entry.amountCharged) || 0),
      amountPaid: String(Number(entry.amountPaid) || 0),
      dentistName: entry.dentistName || '',
    })
  }

  const closeDetail = () => {
    setDetailEntry(null)
    setDetailEditing(false)
    setShowHistory(false)
  }

  const enterDetailEdit = () => {
    if (!detailEntry) return
    setDetailForm({
      toothNumber: detailEntry.toothNumber || '',
      surface: detailEntry.surface || '',
      diagnosis: detailEntry.diagnosis || '',
      procedureName: detailEntry.procedureName || '',
      wire: detailEntry.wire || '',
      notes: detailEntry.notes || '',
      amountCharged: String(Number(detailEntry.amountCharged) || 0),
      amountPaid: String(Number(detailEntry.amountPaid) || 0),
      dentistName: detailEntry.dentistName || '',
    })
    setDetailEditing(true)
  }

  const saveDetailEdit = async () => {
    if (!detailEntry) return
    setDetailSaving(true)
    try {
      const editorName = session?.user?.name || 'Unknown'
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${detailEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...detailForm, editedBy: editorName }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      if (data.message === 'No changes detected') {
        toast({ title: 'No changes', description: 'Nothing was modified.' })
      } else {
        toast({ title: 'Updated', description: `Entry updated by ${editorName}` })
      }
      // Refresh entries, then update the currently open detail entry
      await fetchEntries()
      if (data.data) {
        setDetailEntry({ ...detailEntry, ...data.data, chartType: detailEntry.chartType })
      }
      setDetailEditing(false)
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setDetailSaving(false)
    }
  }

  const deleteDetailEntry = async () => {
    if (!detailEntry) return
    const ok = await confirm({
      title: 'Delete chart entry?',
      description: 'This action cannot be undone. The chart entry will be permanently removed.',
      confirmLabel: 'Delete Entry',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${detailEntry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Deleted', description: 'Chart entry removed.' })
      closeDetail()
      await fetchEntries()
      onChanged?.()
    } catch {
      toast({ title: 'Error', description: 'Could not delete', variant: 'destructive' })
    }
  }

  const startEdit = (entry: ChartEntry) => {
    setEditingId(entry.id)
    setEditForm({
      toothNumber: entry.toothNumber || '',
      surface: entry.surface || (entry.wire ? `Wire: ${entry.wire}` : ''),
      diagnosis: entry.diagnosis || '',
      procedureName: entry.procedureName || '',
      wire: entry.wire || '',
      notes: entry.notes || '',
      amountCharged: String(Number(entry.amountCharged) || 0),
      amountPaid: String(Number(entry.amountPaid) || 0),
      dentistName: entry.dentistName || '',
    })
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (entryId: string) => {
    setSavingEdit(true)
    try {
      const editorName = session?.user?.name || 'Unknown'
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, editedBy: editorName }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      if (data.message === 'No changes detected') {
        toast({ title: 'No changes', description: 'Nothing was modified.' })
      } else {
        toast({ title: 'Updated', description: `Entry updated by ${editorName}` })
      }
      setEditingId(null)
      await fetchEntries()
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  const defaultForm = {
    chartType: 'general' as 'general' | 'ortho',
    visitDate: new Date().toISOString().slice(0, 16),
    toothNumber: '',
    surface: '',
    diagnosis: '',
    procedureName: '',
    treatmentId: '',
    customProcedure: '',
    wire: '',
    notes: '',
    amountCharged: '',
    amountPaid: '',
    dentistId: '',
    dentistName: '',
    nextVisitDate: '',
    nextVisitNotes: '',
    autoCreateAppointment: false,
    deductFromPackage: false,
    packageId: '',
    packageDeductionAmount: '',
    parentEntryId: '',
  }
  const [form, setForm] = useState(defaultForm)
  // Parent entry reference (for add-on dialog header)
  const [parentForAddOn, setParentForAddOn] = useState<ChartEntry | null>(null)

  // ─── Fetch all packages for balance computation (any status) ─
  const fetchAllPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (res.ok) {
        const data = await res.json()
        setAllPackages(data.packages || [])
      }
    } catch { /* ignore */ }
  }, [patientId])

  // ─── Fetch all entries (both general + ortho) ────────────
  const fetchEntries = useCallback(async () => {
    try {
      const [genRes, orthoRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/chart-entries?chartType=general`),
        fetch(`/api/patients/${patientId}/chart-entries?chartType=ortho`),
      ])
      const genData = await genRes.json()
      const orthoData = await orthoRes.json()
      const combined = [
        ...((genData.success ? genData.data : []) as ChartEntry[]).map(e => ({ ...e, chartType: 'general' })),
        ...((orthoData.success ? orthoData.data : []) as ChartEntry[]).map(e => ({ ...e, chartType: 'ortho' })),
      ]
      combined.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
      setAllEntries(combined)
      // Always refresh packages too (balance could change after any chart save/delete)
      fetchAllPackages()
      // Auto-expand today
      const todayKey = format(new Date(), 'yyyy-MM-dd')
      setExpandedDates(prev => {
        const next = new Set(prev)
        next.add(todayKey)
        if (combined.length > 0) {
          next.add(format(parseISO(combined[0].visitDate), 'yyyy-MM-dd'))
        }
        return next
      })
    } catch (e) { console.error('Fetch chart entries error:', e) }
    finally { setLoading(false) }
  }, [patientId, fetchAllPackages])

  useEffect(() => { fetchEntries() }, [fetchEntries, refreshKey])

  // ─── Group entries by date + nest child procedures under parents ──
  const dateGroups: DateGroup[] = (() => {
    const map = new Map<string, { diagnoses: ChartEntry[]; procedures: ChartEntry[]; notes: ChartEntry[] }>()
    allEntries.forEach(e => {
      const dateKey = format(parseISO(e.visitDate), 'yyyy-MM-dd')
      if (!map.has(dateKey)) map.set(dateKey, { diagnoses: [], procedures: [], notes: [] })
      const group = map.get(dateKey)!
      if (e.diagnosis && !e.procedureName) {
        group.diagnoses.push(e)
      } else if (e.procedureName) {
        group.procedures.push(e)
      } else {
        group.notes.push(e)
      }
    })
    return Array.from(map.entries()).map(([date, data]) => {
      // Build procedure nodes: top-level (parent) rows + their children
      const procList = data.procedures
      const parents = procList.filter(p => !p.parentEntryId)
      const orphans = procList.filter(p => p.parentEntryId && !parents.find(pp => pp.id === p.parentEntryId))
      // Orphan add-ons (parent may be on different date — still render as top-level)
      const topLevel = [...parents, ...orphans]
      const procedureNodes: ProcedureNode[] = topLevel.map(p => ({
        parent: p,
        children: procList
          .filter(c => c.parentEntryId === p.id)
          .sort((a, b) => a.entryNumber - b.entryNumber),
      }))
      return { date, diagnoses: data.diagnoses, procedureNodes, notes: data.notes }
    })
  })()

  // ─── Stats ─────────────────────────────────────────────
  // Chart timeline figures: count only non-package-deduction payments as chart-paid,
  // because package deductions are already accounted for inside the package balance.
  const totalCharged = allEntries.reduce((s, e) => s + Number(e.amountCharged), 0)
  const totalPaid = allEntries.reduce((s, e) => s + Number(e.amountPaid), 0)
  const chartBalance = totalCharged - totalPaid

  // Package aggregate figures: only include non-cancelled, non-draft packages.
  const activePackages = allPackages.filter(p =>
    !['cancelled', 'draft'].includes((p.status || '').toLowerCase())
  )
  const packagesTotalAmount = activePackages.reduce((s, p) => s + Number(p.totalAmount || 0), 0)
  const packagesPaid = activePackages.reduce((s, p) => s + Number(p.paidAmount || 0), 0)
  const packagesBalance = activePackages.reduce((s, p) => s + Number(p.balanceDue || 0), 0)

  // Grand total across chart + packages
  const grandCharged = totalCharged + packagesTotalAmount
  const grandPaid = totalPaid + packagesPaid
  const grandBalance = chartBalance + packagesBalance

  // ─── Toggle date expansion ─────────────────────────────
  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // ─── Open add dialog ──────────────────────────────────
  const openAddDialog = async (type: 'general' | 'ortho', parent: ChartEntry | null = null) => {
    setAddType(type)
    setParentForAddOn(parent)
    // If adding an add-on under a parent, pre-fill visitDate + dentist + disable package deduction
    if (parent) {
      setForm({
        ...defaultForm,
        chartType: type,
        visitDate: parent.visitDate.slice(0, 16),
        dentistId: '',
        dentistName: parent.dentistName || '',
        toothNumber: parent.toothNumber || '',
        parentEntryId: parent.id,
      })
    } else {
      setForm({ ...defaultForm, chartType: type })
    }
    setShowAdd(true)
    // Fetch treatments (filter by procedureType for ortho)
    try {
      const url = type === 'ortho'
        ? '/api/treatments?procedureType=ortho&limit=500'
        : '/api/treatments?limit=500'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const list = data.data?.treatments || data.data || data.treatments || []
        setTreatments(Array.isArray(list) ? list : [])
      }
    } catch { /* ignore */ }
    if (dentists.length === 0) {
      try {
        const res = await fetch('/api/dentists?limit=100')
        if (res.ok) {
          const data = await res.json()
          const list = data.data?.dentists || data.dentists || []
          setDentists(list.map((d: any) => ({
            id: d.id,
            name: formatDentistName(d.user?.firstName, d.user?.lastName),
          })))
        }
      } catch { /* ignore */ }
    }
    // Load active packages with remaining balance (available for both parent entries and add-ons)
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (res.ok) {
        const data = await res.json()
        setPackages((data.packages || []).filter(
          (p: any) => ['active', 'in_progress'].includes(p.status) && Number(p.balanceDue) > 0
        ))
      }
    } catch { /* ignore */ }
  }

  const handleTreatmentSelect = (treatmentId: string) => {
    if (treatmentId === '__custom__') {
      setForm(prev => ({ ...prev, treatmentId: '', procedureName: '' }))
      return
    }
    const t = treatments.find(tr => tr.id === treatmentId)
    if (t) {
      setForm(prev => ({
        ...prev,
        treatmentId: t.id,
        procedureName: t.name,
        amountCharged: prev.amountCharged || String(Number(t.baseCost)),
      }))
    }
  }

  const handleDentistSelect = (dentistId: string) => {
    const d = dentists.find(dd => dd.id === dentistId)
    setForm(prev => ({ ...prev, dentistId, dentistName: d?.name || '' }))
  }

  // ─── Save entry ────────────────────────────────────────
  const handleSave = async () => {
    if (!form.visitDate) {
      toast({ title: 'Error', description: 'Visit date is required', variant: 'destructive' })
      return
    }
    if (form.autoCreateAppointment && !form.nextVisitDate) {
      toast({ title: 'Error', description: 'Next visit date required when auto-create is on', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const procedureName = form.chartType === 'ortho' && form.procedureName === '__custom__'
        ? form.customProcedure
        : form.procedureName

      const body: any = {
        chartType: form.chartType,
        visitDate: form.visitDate,
        notes: form.notes || null,
        amountCharged: form.amountCharged || 0,
        amountPaid: form.amountPaid || 0,
        dentistId: form.dentistId || null,
        dentistName: form.dentistName || null,
        nextVisitDate: form.nextVisitDate || null,
        nextVisitNotes: form.nextVisitNotes || null,
        autoCreateAppointment: form.autoCreateAppointment,
        deductFromPackage: form.deductFromPackage,
        packageId: form.packageId || null,
        packageDeductionAmount: form.deductFromPackage
          ? (Number(form.packageDeductionAmount) || Number(form.amountPaid) || 0)
          : 0,
        parentEntryId: form.parentEntryId || null,
      }

      if (form.chartType === 'general') {
        body.toothNumber = form.toothNumber || null
        body.surface = form.surface || null
        body.diagnosis = form.diagnosis || null
        body.procedureName = form.procedureName || null
        body.treatmentId = form.treatmentId || null
      } else {
        body.procedureName = procedureName || 'Ortho Visit'
        body.wire = form.wire || null
      }

      const res = await fetch(`/api/patients/${patientId}/chart-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      toast({ title: 'Saved', description: 'Chart entry recorded.' })
      setShowAdd(false)
      await fetchEntries()
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete entry ──────────────────────────────────────
  const handleDelete = async (entryId: string) => {
    const ok = await confirm({
      title: 'Delete chart entry?',
      description: 'This action cannot be undone. The chart entry will be permanently removed.',
      confirmLabel: 'Delete Entry',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries/${entryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Deleted' })
      await fetchEntries()
      onChanged?.()
    } catch {
      toast({ title: 'Error', description: 'Could not delete', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[#5B5FC7]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Chart Timeline</span>
          <Badge variant="outline" className="text-[10px]">{allEntries.length} entries</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openAddDialog('general')} className="text-xs gap-1 border-[#5B5FC7] text-[#5B5FC7] hover:bg-indigo-50">
            <Plus className="w-3 h-3" /> General
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAddDialog('ortho')} className="text-xs gap-1 border-purple-500 text-purple-600 hover:bg-purple-50">
            <Plus className="w-3 h-3" /> Ortho
          </Button>
        </div>
      </div>

      {/* ─── Summary Block: Chart · Packages · Grand Total ───── */}
      {(allEntries.length > 0 || activePackages.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
          {/* Chart Timeline balance */}
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Chart Timeline</span>
            </div>
            <div className="flex items-baseline justify-between text-[11px] text-gray-600">
              <span>Charged</span>
              <span className="font-semibold text-gray-700">₱{totalCharged.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between text-[11px] text-gray-600">
              <span>Paid</span>
              <span className="font-semibold text-emerald-700">₱{totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-indigo-100 mt-1 pt-1">
              <span className="text-gray-700 font-medium">Balance</span>
              <span className={`font-bold ${chartBalance > 0 ? 'text-red-600' : chartBalance < 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                ₱{Math.abs(chartBalance).toLocaleString()}
                {chartBalance > 0 ? ' due' : chartBalance < 0 ? ' credit' : ''}
              </span>
            </div>
          </div>

          {/* Packages balance */}
          <div className="border border-amber-100 bg-amber-50/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                Packages {activePackages.length > 0 ? `(${activePackages.length})` : ''}
              </span>
            </div>
            {activePackages.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic mt-1">No active packages</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between text-[11px] text-gray-600">
                  <span>Total</span>
                  <span className="font-semibold text-gray-700">₱{packagesTotalAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] text-gray-600">
                  <span>Paid</span>
                  <span className="font-semibold text-emerald-700">₱{packagesPaid.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs border-t border-amber-100 mt-1 pt-1">
                  <span className="text-gray-700 font-medium">Balance</span>
                  <span className={`font-bold ${packagesBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₱{packagesBalance.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Grand Total */}
          <div className="border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-teal-700" />
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">Grand Total</span>
            </div>
            <div className="flex items-baseline justify-between text-[11px] text-gray-600">
              <span>Charged</span>
              <span className="font-semibold text-gray-700">₱{grandCharged.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between text-[11px] text-gray-600">
              <span>Paid</span>
              <span className="font-semibold text-emerald-700">₱{grandPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm border-t border-teal-200 mt-1 pt-1">
              <span className="text-gray-800 font-semibold">Balance</span>
              <span className={`font-extrabold ${grandBalance > 0 ? 'text-red-600' : grandBalance < 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                ₱{Math.abs(grandBalance).toLocaleString()}
                {grandBalance > 0 ? ' due' : grandBalance < 0 ? ' credit' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Empty State ────────────────────────────────────── */}
      {allEntries.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg py-12 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">No chart entries yet</p>
          <p className="text-xs text-gray-400 mt-1">Add a General or Ortho entry to start the timeline</p>
        </div>
      )}

      {/* ─── Date Groups (Molarsoft-style) ──────────────────── */}
      {dateGroups.map(group => {
        const isExpanded = expandedDates.has(group.date)
        const isToday = isTodayFn(parseISO(group.date))
        const procedureParents = group.procedureNodes.map(n => n.parent)
        const procedureChildren = group.procedureNodes.flatMap(n => n.children)
        const entryCount = group.diagnoses.length + procedureParents.length + procedureChildren.length + group.notes.length
        const allGroupEntries = [...group.diagnoses, ...procedureParents, ...procedureChildren, ...group.notes]
        const lastUpdatedBy = allGroupEntries.length > 0 ? allGroupEntries[0].dentistName : null

        return (
          <div key={group.date} className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
            {/* Date Header */}
            <button
              onClick={() => toggleDate(group.date)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {format(parseISO(group.date), 'dd MMM yyyy')}
                </span>
                {isToday && (
                  <Badge className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0">Today</Badge>
                )}
                <span className="text-[10px] text-gray-400">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div className="flex items-center gap-3">
                {lastUpdatedBy && (
                  <span className="text-[10px] text-gray-400">Last updated by {lastUpdatedBy}</span>
                )}
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* ── Diagnosis Section ──────────────────── */}
                {group.diagnoses.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full bg-red-400" />
                      <span className="text-xs font-semibold text-gray-600">Diagnosis</span>
                    </div>
                    <div className="border border-gray-100 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-20">Tooth</th>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-24">Surface</th>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500">Diagnosis</th>
                            <th className="px-3 py-1.5 text-right font-medium text-gray-500 w-16">Charged</th>
                            <th className="px-3 py-1.5 text-right font-medium text-gray-500 w-16">Paid</th>
                            <th className="px-3 py-1.5 w-28"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.diagnoses.map(e => {
                            const isEditing = editingId === e.id
                            const stopProp = (ev: React.MouseEvent) => ev.stopPropagation()
                            return (
                              <tr
                                key={e.id}
                                onClick={() => !isEditing && openDetail(e)}
                                className={`${!isEditing ? 'cursor-pointer' : ''} ${isEditing ? 'bg-indigo-50/30' : 'hover:bg-indigo-50/40'} transition-colors`}
                                title={!isEditing ? 'Click to view / edit full details' : undefined}
                              >
                                <td className="px-3 py-2">
                                  {isEditing ? <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.toothNumber} onChange={ev => setEditForm(p => ({ ...p, toothNumber: ev.target.value }))} /> : <span className="text-gray-700">{e.toothNumber || '—'}</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {isEditing ? <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.surface} onChange={ev => setEditForm(p => ({ ...p, surface: ev.target.value }))} /> : <span className="text-gray-500">{e.surface || '—'}</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {isEditing ? <input className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" value={editForm.diagnosis} onChange={ev => setEditForm(p => ({ ...p, diagnosis: ev.target.value }))} /> : <span className="text-gray-800">{e.diagnosis}</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? <input type="number" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-right" value={editForm.amountCharged} onChange={ev => setEditForm(p => ({ ...p, amountCharged: ev.target.value }))} /> : <span className="text-gray-600">₱{Number(e.amountCharged).toLocaleString()}</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? <input type="number" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-right" value={editForm.amountPaid} onChange={ev => setEditForm(p => ({ ...p, amountPaid: ev.target.value }))} /> : <span className="text-green-600">₱{Number(e.amountPaid).toLocaleString()}</span>}
                                </td>
                                <td className="px-3 py-2" onClick={stopProp}>
                                  <div className="flex items-center justify-end gap-1">
                                    {isEditing ? (
                                      <>
                                        <button onClick={(ev) => { stopProp(ev); saveEdit(e.id) }} disabled={savingEdit} className="text-green-600 hover:text-green-800">
                                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button onClick={(ev) => { stopProp(ev); cancelEdit() }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        {e.toothNumber && (
                                          <button onClick={(ev) => { stopProp(ev); onViewOnChart?.(Number(e.toothNumber)) }} className="text-[10px] text-[#5B5FC7] hover:underline flex items-center gap-0.5" title="View tooth on dental chart">
                                            <ExternalLink className="w-2.5 h-2.5" /> View on charts
                                          </button>
                                        )}
                                        <button onClick={(ev) => { stopProp(ev); openDetail(e) }} className="text-gray-300 hover:text-[#5B5FC7] ml-0.5" title="Open full details / edit"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={(ev) => { stopProp(ev); handleDelete(e.id) }} className="text-gray-300 hover:text-red-500" title="Delete entry"><Trash2 className="w-3 h-3" /></button>
                                      </>
                                    )}
                                  </div>
                                  {!isEditing && e.lastEditedBy && (
                                    <div className="text-[9px] text-gray-400 text-right mt-0.5">edited by {e.lastEditedBy}</div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Procedures Section (nested) ─────────────────── */}
                {group.procedureNodes.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full bg-blue-400" />
                      <span className="text-xs font-semibold text-gray-600">Procedures</span>
                      <span className="text-[10px] text-gray-400">(Click a row to view / edit all details • click "+ Add-on" to bundle sub-procedures)</span>
                    </div>
                    <div className="border border-gray-100 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-20">Tooth</th>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-24">Surface</th>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500">Procedure</th>
                            <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-32">Dentist</th>
                            <th className="px-3 py-1.5 text-right font-medium text-gray-500 w-16">Charged</th>
                            <th className="px-3 py-1.5 text-right font-medium text-gray-500 w-16">Paid</th>
                            <th className="px-3 py-1.5 w-36"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.procedureNodes.map(node => {
                            const allChildCharged = node.children.reduce((s, c) => s + Number(c.amountCharged), 0)
                            const allChildPaid = node.children.reduce((s, c) => s + Number(c.amountPaid), 0)
                            const totalCharged = Number(node.parent.amountCharged) + allChildCharged
                            const totalPaid = Number(node.parent.amountPaid) + allChildPaid
                            return (
                              <React.Fragment key={node.parent.id}>
                                {renderProcedureRow(
                                  node.parent, false, editingId === node.parent.id,
                                  editForm, setEditForm, startEdit, cancelEdit, saveEdit,
                                  savingEdit, handleDelete, onViewOnChart, openAddDialog,
                                  node.children.length, openDetail,
                                  openSignature,
                                  (src, label) => setSignatureViewer({ src, label }),
                                )}
                                {/* Child (Add-on) rows */}
                                {node.children.map(child => renderProcedureRow(
                                  child, true, editingId === child.id,
                                  editForm, setEditForm, startEdit, cancelEdit, saveEdit,
                                  savingEdit, handleDelete, onViewOnChart, openAddDialog,
                                  0, openDetail,
                                  openSignature,
                                  (src, label) => setSignatureViewer({ src, label }),
                                ))}
                                {/* Totals row if there are children */}
                                {node.children.length > 0 && (
                                  <tr className="bg-gradient-to-r from-purple-50/40 to-indigo-50/40">
                                    <td colSpan={4} className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right">
                                      Visit Total (parent + {node.children.length} add-on{node.children.length > 1 ? 's' : ''}):
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-700">
                                      ₱{totalCharged.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-emerald-700">
                                      ₱{totalPaid.toLocaleString()}
                                    </td>
                                    <td></td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Notes Section ──────────────────────── */}
                {group.notes.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full bg-gray-400" />
                      <span className="text-xs font-semibold text-gray-600">Notes</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.notes.map(e => {
                        const isEditing = editingId === e.id
                        const stopProp = (ev: React.MouseEvent) => ev.stopPropagation()
                        return (
                          <div
                            key={e.id}
                            onClick={() => !isEditing && openDetail(e)}
                            className={`flex items-start justify-between rounded-md px-3 py-2 transition-colors ${!isEditing ? 'cursor-pointer' : ''} ${isEditing ? 'bg-indigo-50/30 border border-indigo-200' : 'bg-gray-50 hover:bg-indigo-50/40'}`}
                            title={!isEditing ? 'Click to view / edit full details' : undefined}
                          >
                            <div className="flex-1 mr-2">
                              {isEditing ? (
                                <input className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white" value={editForm.notes} onChange={ev => setEditForm(p => ({ ...p, notes: ev.target.value }))} />
                              ) : (
                                <>
                                  <p className="text-xs text-gray-700">{e.notes || 'No notes'}</p>
                                  {e.dentistName && <p className="text-[10px] text-gray-400 mt-0.5">{e.dentistName}</p>}
                                  {e.lastEditedBy && <p className="text-[9px] text-gray-400 mt-0.5">edited by {e.lastEditedBy}</p>}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5" onClick={stopProp}>
                              {isEditing ? (
                                <>
                                  <button onClick={(ev) => { stopProp(ev); saveEdit(e.id) }} disabled={savingEdit} className="text-green-600 hover:text-green-800">
                                    {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={(ev) => { stopProp(ev); cancelEdit() }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={(ev) => { stopProp(ev); openDetail(e) }} className="text-gray-300 hover:text-[#5B5FC7]" title="Open full details / edit"><Pencil className="w-3 h-3" /></button>
                                  <button onClick={(ev) => { stopProp(ev); handleDelete(e.id) }} className="text-gray-300 hover:text-red-500" title="Delete entry"><Trash2 className="w-3 h-3" /></button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ─── Entry Detail / Edit Dialog ─────────────────────── */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => { if (!open) closeDetail() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailEntry && (() => {
            const parent = detailEntry.parentEntryId
              ? allEntries.find(x => x.id === detailEntry.parentEntryId)
              : null
            const children = allEntries.filter(x => x.parentEntryId === detailEntry.id)
            const isOrtho = detailEntry.chartType === 'ortho'
            const history = Array.isArray(detailEntry.editHistory) ? detailEntry.editHistory : []
            const balance = Number(detailEntry.amountCharged) - Number(detailEntry.amountPaid)
            return (
              <>
                <DialogHeader className="pb-2 border-b border-gray-100">
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    {parent && <CornerDownRight className="w-5 h-5 text-purple-500" />}
                    <span className="truncate">
                      {detailEntry.procedureName || detailEntry.diagnosis || `Note #${detailEntry.entryNumber}`}
                    </span>
                    <Badge className={`text-[10px] ${isOrtho ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                      {isOrtho ? 'Ortho' : 'General'}
                    </Badge>
                    {parent && <Badge className="bg-purple-100 text-purple-700 text-[10px] border-purple-200">Add-on</Badge>}
                    {detailEntry.deductedFromPackage && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] border-amber-200 flex items-center gap-0.5">
                        <Package className="w-2.5 h-2.5" /> Package
                      </Badge>
                    )}
                    {detailEntry.status === 'amended' && (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] border-blue-200">Amended</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Entry #{detailEntry.entryNumber}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(parseISO(detailEntry.visitDate), 'dd MMM yyyy')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(parseISO(detailEntry.visitDate), 'HH:mm')}</span>
                    {detailEntry.dentistName && (
                      <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {detailEntry.dentistName}</span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                {/* Parent / Children context banners */}
                {parent && (
                  <div className="rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1 text-purple-700 font-semibold mb-0.5">
                      <CornerDownRight className="w-3.5 h-3.5" /> Add-on under: {parent.procedureName}
                    </div>
                    <div className="text-[11px] text-purple-700/80 flex flex-wrap gap-x-3">
                      <span>Parent #{parent.entryNumber}</span>
                      <span>{format(parseISO(parent.visitDate), 'dd MMM yyyy, HH:mm')}</span>
                      {parent.dentistName && <span>Dr. {parent.dentistName}</span>}
                      <button
                        onClick={() => openDetail(parent)}
                        className="underline hover:text-purple-900 ml-auto"
                      >Open parent →</button>
                    </div>
                  </div>
                )}
                {children.length > 0 && (
                  <div className="rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-indigo-700 font-semibold">
                        <Activity className="w-3.5 h-3.5" /> Has {children.length} add-on sub-procedure{children.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {children.map(c => (
                        <button
                          key={c.id}
                          onClick={() => openDetail(c)}
                          className="block w-full text-left text-[11px] text-indigo-700 hover:bg-indigo-100/60 rounded px-1.5 py-0.5 transition-colors"
                        >
                          <span className="font-medium">#{c.entryNumber}</span> · {c.procedureName}
                          <span className="float-right">₱{Number(c.amountCharged).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Fields Grid ─────────────────────────────── */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
                  {/* Tooth # */}
                  <div>
                    <Label className="text-[11px] text-gray-500">Tooth #</Label>
                    {detailEditing ? (
                      <Input value={detailForm.toothNumber} onChange={e => setDetailForm(p => ({ ...p, toothNumber: e.target.value }))} placeholder="e.g. 14, 36" className="text-sm h-8 mt-1" />
                    ) : (
                      <div className="text-sm text-gray-800 mt-1 flex items-center gap-2">
                        {detailEntry.toothNumber || <span className="text-gray-400">—</span>}
                        {detailEntry.toothNumber && onViewOnChart && (
                          <button
                            onClick={() => onViewOnChart(Number(detailEntry.toothNumber))}
                            className="text-[10px] text-[#5B5FC7] hover:underline flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> View on chart
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Surface */}
                  <div>
                    <Label className="text-[11px] text-gray-500">Surface</Label>
                    {detailEditing ? (
                      <Select value={detailForm.surface || 'none'} onValueChange={v => setDetailForm(p => ({ ...p, surface: v === 'none' ? '' : v }))}>
                        <SelectTrigger className="text-sm h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="M">Mesial (M)</SelectItem>
                          <SelectItem value="D">Distal (D)</SelectItem>
                          <SelectItem value="O">Occlusal (O)</SelectItem>
                          <SelectItem value="B">Buccal (B)</SelectItem>
                          <SelectItem value="L">Lingual (L)</SelectItem>
                          <SelectItem value="MOD">MOD</SelectItem>
                          <SelectItem value="DO">DO</SelectItem>
                          <SelectItem value="MO">MO</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-gray-800 mt-1">{detailEntry.surface || <span className="text-gray-400">—</span>}</div>
                    )}
                  </div>

                  {/* Procedure Name */}
                  <div className="col-span-2">
                    <Label className="text-[11px] text-gray-500">Procedure</Label>
                    {detailEditing ? (
                      <Input value={detailForm.procedureName} onChange={e => setDetailForm(p => ({ ...p, procedureName: e.target.value }))} placeholder="Procedure name" className="text-sm h-8 mt-1" />
                    ) : (
                      <div className="text-sm text-gray-800 mt-1 font-medium">{detailEntry.procedureName || <span className="text-gray-400">—</span>}</div>
                    )}
                  </div>

                  {/* Diagnosis (general only) */}
                  {(detailEntry.diagnosis || detailEditing) && !isOrtho && (
                    <div className="col-span-2">
                      <Label className="text-[11px] text-gray-500">Diagnosis / Findings</Label>
                      {detailEditing ? (
                        <Input value={detailForm.diagnosis} onChange={e => setDetailForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="Findings / diagnosis" className="text-sm h-8 mt-1" />
                      ) : (
                        <div className="text-sm text-gray-800 mt-1">{detailEntry.diagnosis || <span className="text-gray-400">—</span>}</div>
                      )}
                    </div>
                  )}

                  {/* Wire (ortho only) */}
                  {(isOrtho || detailEntry.wire) && (
                    <div className="col-span-2">
                      <Label className="text-[11px] text-gray-500">Wire</Label>
                      {detailEditing ? (
                        <Input value={detailForm.wire} onChange={e => setDetailForm(p => ({ ...p, wire: e.target.value }))} placeholder="e.g. .016 NiTi upper" className="text-sm h-8 mt-1" />
                      ) : (
                        <div className="text-sm text-gray-800 mt-1">{detailEntry.wire || <span className="text-gray-400">—</span>}</div>
                      )}
                    </div>
                  )}

                  {/* Dentist */}
                  <div className="col-span-2">
                    <Label className="text-[11px] text-gray-500">Dentist</Label>
                    {detailEditing ? (
                      <Input value={detailForm.dentistName} onChange={e => setDetailForm(p => ({ ...p, dentistName: e.target.value }))} placeholder="Dr. Name" className="text-sm h-8 mt-1" />
                    ) : (
                      <div className="text-sm text-gray-800 mt-1">{detailEntry.dentistName || <span className="text-gray-400">—</span>}</div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="col-span-2">
                    <Label className="text-[11px] text-gray-500">Notes</Label>
                    {detailEditing ? (
                      <Textarea value={detailForm.notes} onChange={e => setDetailForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Additional notes..." className="text-sm mt-1 resize-y" />
                    ) : (
                      <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap bg-gray-50 rounded-md p-2 min-h-[36px]">
                        {detailEntry.notes || <span className="text-gray-400">No notes</span>}
                      </div>
                    )}
                  </div>

                  {/* Amounts */}
                  <div>
                    <Label className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Charged (₱)</Label>
                    {detailEditing ? (
                      <Input type="number" min={0} value={detailForm.amountCharged} onChange={e => setDetailForm(p => ({ ...p, amountCharged: e.target.value }))} className="text-sm h-8 mt-1" />
                    ) : (
                      <div className="text-sm font-semibold text-gray-800 mt-1">₱{Number(detailEntry.amountCharged).toLocaleString()}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Paid (₱)</Label>
                    {detailEditing ? (
                      <Input type="number" min={0} value={detailForm.amountPaid} onChange={e => setDetailForm(p => ({ ...p, amountPaid: e.target.value }))} className="text-sm h-8 mt-1" />
                    ) : (
                      <div className="text-sm font-semibold text-emerald-600 mt-1">₱{Number(detailEntry.amountPaid).toLocaleString()}</div>
                    )}
                  </div>

                  {/* Running Balance */}
                  {!detailEditing && (
                    <div className="col-span-2 flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                      <span className="text-xs text-gray-500">Entry Balance</span>
                      <span className={`text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₱{Math.abs(balance).toLocaleString()}
                        {balance > 0 ? ' due' : balance < 0 ? ' credit' : ' settled'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Patient Signature Section ──────────────────── */}
                {!detailEditing && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <PenLine className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-semibold text-gray-700">Patient Signature</span>
                        {detailEntry.patientSignature && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px] border-emerald-200">Signed</Badge>
                        )}
                      </div>
                      {detailEntry.patientSignature ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => openSignature(detailEntry)}
                            className="h-6 px-2 text-[10px] text-[#5B5FC7]"
                          >
                            <Pencil className="w-2.5 h-2.5 mr-1" /> Re-sign
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => clearSignature(detailEntry)}
                            className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-50"
                          >
                            <Eraser className="w-2.5 h-2.5 mr-1" /> Clear
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openSignature(detailEntry)}
                          className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <PenLine className="w-3 h-3 mr-1" /> Request Signature
                        </Button>
                      )}
                    </div>
                    {detailEntry.patientSignature ? (
                      <div className="bg-white border border-emerald-200 rounded-md p-2 flex flex-col sm:flex-row gap-3 items-start">
                        <button
                          onClick={() => setSignatureViewer({ src: detailEntry.patientSignature!, label: `Entry #${detailEntry.entryNumber} · ${detailEntry.procedureName || detailEntry.chartType}` })}
                          className="shrink-0 group relative bg-gray-50 rounded border border-gray-100 hover:border-emerald-300 transition-colors"
                          title="Click to enlarge"
                        >
                          <img
                            src={detailEntry.patientSignature}
                            alt="Patient signature"
                            className="h-24 w-48 object-contain"
                          />
                          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Eye className="w-4 h-4 text-emerald-700" />
                          </div>
                        </button>
                        <div className="flex-1 text-[11px] text-gray-600 space-y-0.5">
                          {detailEntry.signedByName && (
                            <div><span className="text-gray-400">Signed by:</span> <span className="font-medium text-gray-800">{detailEntry.signedByName}</span></div>
                          )}
                          {detailEntry.signedAt && (
                            <div><span className="text-gray-400">Signed at:</span> <span className="text-gray-700">{format(parseISO(detailEntry.signedAt), 'dd MMM yyyy, HH:mm')}</span></div>
                          )}
                          <div className="text-[10px] text-gray-400 italic mt-1">Click the signature to enlarge.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-md border border-dashed border-gray-200 px-3 py-3 text-[11px] text-gray-500 text-center">
                        No patient signature yet. Request one to acknowledge this entry.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Meta info (non-editable) ──────────────── */}
                {!detailEditing && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-1.5">
                    {detailEntry.nextVisitDate && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        <CalendarPlus className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-500">Next visit:</span>
                        <span className="font-medium">{format(parseISO(detailEntry.nextVisitDate), 'dd MMM yyyy, HH:mm')}</span>
                        {detailEntry.nextVisitNotes && <span className="text-gray-500">— {detailEntry.nextVisitNotes}</span>}
                        {detailEntry.autoAppointmentId && (
                          <Badge className="bg-blue-50 text-blue-600 text-[9px] px-1 py-0 border border-blue-200 ml-auto">Auto-booked</Badge>
                        )}
                      </div>
                    )}
                    {detailEntry.packageId && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        <Package className="w-3 h-3 text-amber-500" />
                        <span className="text-gray-500">Package:</span>
                        <code className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">{detailEntry.packageId.slice(0, 8)}…</code>
                        {detailEntry.deductedFromPackage && <span className="text-amber-600 text-[10px]">(deducted)</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Created {format(parseISO(detailEntry.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                      {detailEntry.lastEditedBy && <span>· Last edited by <span className="font-medium text-gray-500">{detailEntry.lastEditedBy}</span></span>}
                    </div>
                  </div>
                )}

                {/* ── Edit History (collapsible) ────────────── */}
                {!detailEditing && history.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <button
                      onClick={() => setShowHistory(s => !s)}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                    >
                      <History className="w-3 h-3" />
                      {showHistory ? 'Hide' : 'Show'} edit history ({history.length})
                      {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showHistory && (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                        {history.slice().reverse().map((h: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded-md px-2.5 py-1.5 text-[11px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-gray-700">{h.editedBy || 'Unknown'}</span>
                              <span className="text-[10px] text-gray-400">{h.editedAt ? format(parseISO(h.editedAt), 'dd MMM yyyy, HH:mm') : ''}</span>
                            </div>
                            <div className="space-y-0.5">
                              {Object.keys(h.after || {}).map(field => (
                                <div key={field} className="flex items-start gap-1 text-[10px]">
                                  <span className="text-gray-500 w-20 shrink-0">{field}:</span>
                                  <span className="text-red-500 line-through truncate">{String(h.before?.[field] ?? '—')}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-emerald-600 font-medium truncate">{String(h.after[field] ?? '—')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Footer actions ────────────────────────── */}
                <DialogFooter className="pt-3 border-t border-gray-100 mt-3 flex-col sm:flex-row gap-2 sm:gap-0">
                  {detailEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setDetailEditing(false)} className="text-gray-500" disabled={detailSaving}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveDetailEdit} disabled={detailSaving} className="bg-[#5B5FC7] hover:bg-[#4B4FB7] text-white">
                        {detailSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        <Check className="w-3.5 h-3.5 mr-1" /> Save Changes
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={deleteDetailEntry} className="text-red-500 hover:bg-red-50 hover:text-red-600 sm:mr-auto">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={closeDetail}>
                          Close
                        </Button>
                        <Button size="sm" onClick={enterDetailEdit} className="bg-[#5B5FC7] hover:bg-[#4B4FB7] text-white">
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      </div>
                    </>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Add Entry Dialog ───────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setParentForAddOn(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {parentForAddOn
                ? <><CornerDownRight className="w-5 h-5 text-purple-600" /> Add-on Sub-procedure</>
                : addType === 'general'
                  ? <><FileText className="w-5 h-5 text-[#5B5FC7]" /> New General Entry</>
                  : <><Stethoscope className="w-5 h-5 text-purple-600" /> New Ortho Entry</>
              }
            </DialogTitle>
            <DialogDescription>
              {parentForAddOn
                ? 'Add a sub-procedure bundled to the same visit. It creates its own payment record — ideal for extras like anesthesia or polishing.'
                : 'Quick encode — fills visit record, procedure, and payment automatically.'}
            </DialogDescription>
          </DialogHeader>

          {/* Parent context banner (only for add-ons) */}
          {parentForAddOn && (
            <div className="rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs">
              <div className="flex items-center gap-1 text-purple-700 font-semibold mb-1">
                <CornerDownRight className="w-3.5 h-3.5" /> Under: {parentForAddOn.procedureName}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-purple-700/80">
                <span>Entry #{parentForAddOn.entryNumber}</span>
                <span>{format(parseISO(parentForAddOn.visitDate), 'dd MMM yyyy, HH:mm')}</span>
                {parentForAddOn.toothNumber && <span>Tooth: {parentForAddOn.toothNumber}</span>}
                {parentForAddOn.dentistName && <span>Dr. {parentForAddOn.dentistName}</span>}
              </div>
            </div>
          )}

          {/* Type toggle */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
            <button
              onClick={() => { setAddType('general'); setForm(prev => ({ ...prev, chartType: 'general' })) }}
              className={`text-xs px-3 py-1 rounded-md transition-all ${
                addType === 'general' ? 'bg-white shadow-sm text-[#5B5FC7] font-medium' : 'text-gray-500'
              }`}
            >General</button>
            <button
              onClick={() => { setAddType('ortho'); setForm(prev => ({ ...prev, chartType: 'ortho' })) }}
              className={`text-xs px-3 py-1 rounded-md transition-all ${
                addType === 'ortho' ? 'bg-white shadow-sm text-purple-600 font-medium' : 'text-gray-500'
              }`}
            >Ortho</button>
          </div>

          <div className="space-y-3">
            {/* Date */}
            <div className="flex items-start gap-6">
              <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Date *</Label>
              <Input type="datetime-local" value={form.visitDate} onChange={e => setForm({ ...form, visitDate: e.target.value })} className="flex-1 text-sm" />
            </div>

            {addType === 'general' ? (
              /* ── General Fields ─────────────────── */
              <>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Tooth #</Label>
                  <Input placeholder="e.g. 14, 36" value={form.toothNumber} onChange={e => setForm({ ...form, toothNumber: e.target.value })} className="flex-1 text-sm" />
                </div>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Surface</Label>
                  <Select value={form.surface || 'none'} onValueChange={v => setForm({ ...form, surface: v === 'none' ? '' : v })}>
                    <SelectTrigger className="flex-1 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="M">Mesial (M)</SelectItem>
                      <SelectItem value="D">Distal (D)</SelectItem>
                      <SelectItem value="O">Occlusal (O)</SelectItem>
                      <SelectItem value="B">Buccal (B)</SelectItem>
                      <SelectItem value="L">Lingual (L)</SelectItem>
                      <SelectItem value="MOD">MOD</SelectItem>
                      <SelectItem value="DO">DO</SelectItem>
                      <SelectItem value="MO">MO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Diagnosis</Label>
                  <Input placeholder="Findings / diagnosis" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} className="flex-1 text-sm" />
                </div>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Procedure</Label>
                  <div className="flex-1 space-y-1">
                    <Select value={form.treatmentId || '__custom__'} onValueChange={handleTreatmentSelect}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select or type custom" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="__custom__">Custom / Free text</SelectItem>
                        {treatments.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name} ({t.treatmentCode}) — ₱{Number(t.baseCost).toLocaleString()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!form.treatmentId && (
                      <Input placeholder="Type procedure name" value={form.procedureName} onChange={e => setForm({ ...form, procedureName: e.target.value })} className="text-sm" />
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* ── Ortho Fields ──────────────────── */
              <>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Procedure</Label>
                  <div className="flex-1 space-y-1">
                    <Select
                      value={form.treatmentId || (form.procedureName === '__custom__' ? '__custom__' : (form.procedureName ? `__name__${form.procedureName}` : '__select__'))}
                      onValueChange={v => {
                        if (v === '__select__') {
                          setForm(prev => ({ ...prev, treatmentId: '', procedureName: '', amountCharged: prev.amountCharged }))
                        } else if (v === '__custom__') {
                          setForm(prev => ({ ...prev, treatmentId: '', procedureName: '__custom__' }))
                        } else if (v.startsWith('__name__')) {
                          const name = v.replace('__name__', '')
                          setForm(prev => ({ ...prev, treatmentId: '', procedureName: name }))
                        } else {
                          // Treatment catalog selection
                          const t = treatments.find(tr => tr.id === v)
                          if (t) {
                            setForm(prev => ({
                              ...prev,
                              treatmentId: t.id,
                              procedureName: t.name,
                              amountCharged: prev.amountCharged || String(Number(t.baseCost)),
                            }))
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="__select__">— Select —</SelectItem>
                        {treatments.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50/60 border-b border-purple-100">
                              From Ortho Catalog
                            </div>
                            {treatments.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} ({t.treatmentCode}) — ₱{Number(t.baseCost).toLocaleString()}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-t border-b border-gray-100">
                          Common Ortho Procedures
                        </div>
                        {COMMON_ORTHO_PROCEDURES.map(p => <SelectItem key={p} value={`__name__${p}`}>{p}</SelectItem>)}
                        <SelectItem value="__custom__">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.procedureName === '__custom__' && (
                      <Input placeholder="Type procedure" value={form.customProcedure} onChange={e => setForm({ ...form, customProcedure: e.target.value })} className="text-sm" />
                    )}
                    {treatments.length === 0 && (
                      <p className="text-[10px] text-gray-400">
                        Tip: add procedures to <span className="font-semibold">Procedures → Ortho Catalog</span> to see them listed here.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Wire</Label>
                  <Input placeholder="e.g. .016 NiTi upper" value={form.wire} onChange={e => setForm({ ...form, wire: e.target.value })} className="flex-1 text-sm" />
                </div>
              </>
            )}

            {/* Shared: Dentist */}
            <div className="flex items-start gap-6">
              <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Dentist</Label>
              <Select value={form.dentistId || '__none__'} onValueChange={v => v === '__none__' ? setForm(prev => ({ ...prev, dentistId: '', dentistName: '' })) : handleDentistSelect(v)}>
                <SelectTrigger className="flex-1 text-sm"><SelectValue placeholder="Select dentist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {dentists.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Shared: Notes */}
            <div className="flex items-start gap-6">
              <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Notes</Label>
              <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="flex-1 text-sm resize-y" />
            </div>

            {/* Shared: Amounts */}
            <div className="flex items-start gap-6">
              <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Charged (₱)</Label>
              <Input type="number" placeholder="0" value={form.amountCharged} onChange={e => setForm({ ...form, amountCharged: e.target.value })} className="flex-1 text-sm" min={0} />
            </div>
            <div className="flex items-start gap-6">
              <Label className="text-xs font-medium text-gray-600 w-24 pt-2">Paid (₱)</Label>
              <Input type="number" placeholder="0" value={form.amountPaid} onChange={e => setForm({ ...form, amountPaid: e.target.value })} className="flex-1 text-sm" min={0} />
            </div>

            {/* Package Deduction — always visible for General, Ortho, and Add-ons */}
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-600" /> Deduct from Package
                </Label>
                <Switch
                  checked={form.deductFromPackage}
                  disabled={packages.length === 0}
                  onCheckedChange={v => setForm(prev => ({
                    ...prev,
                    deductFromPackage: v,
                    packageId: v ? prev.packageId : '',
                    packageDeductionAmount: v ? (prev.packageDeductionAmount || prev.amountPaid || '') : '',
                  }))}
                />
              </div>
              {packages.length === 0 ? (
                <p className="text-[11px] text-amber-700 italic">
                  No active packages with remaining balance for this patient.
                </p>
              ) : form.deductFromPackage ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-gray-600 mb-1 block">Select Package</Label>
                    <Select value={form.packageId || '__none__'} onValueChange={v => setForm(prev => ({ ...prev, packageId: v === '__none__' ? '' : v }))}>
                      <SelectTrigger className="text-sm bg-white">
                        <SelectValue placeholder="Select package..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Select package —</SelectItem>
                        {packages.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title} ({p.packageNumber}) — Bal: ₱{Number(p.balanceDue).toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.packageId && (() => {
                      const pkg = packages.find(p => p.id === form.packageId)
                      return pkg ? (
                        <div className="text-[10px] text-amber-700 mt-1 flex gap-3">
                          <span>Total: ₱{Number(pkg.totalAmount).toLocaleString()}</span>
                          <span>Paid: ₱{Number(pkg.paidAmount).toLocaleString()}</span>
                          <span className="font-semibold">Balance: ₱{Number(pkg.balanceDue).toLocaleString()}</span>
                        </div>
                      ) : null
                    })()}
                  </div>
                  {/* NEW: explicit deduction amount (can differ from amountPaid) */}
                  <div>
                    <Label className="text-[10px] text-gray-600 mb-1 block">Deduction Amount (₱)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={`Default: ₱${form.amountPaid || 0}`}
                      value={form.packageDeductionAmount}
                      onChange={e => setForm(prev => ({ ...prev, packageDeductionAmount: e.target.value }))}
                      className="text-sm bg-white"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      How much to deduct from the package balance. If left blank, defaults to Paid amount.
                      {form.packageId && (() => {
                        const pkg = packages.find(p => p.id === form.packageId)
                        const amt = Number(form.packageDeductionAmount) || 0
                        const bal = pkg ? Number(pkg.balanceDue) : 0
                        if (pkg && amt > bal) {
                          return <span className="text-red-600 font-semibold block">⚠ Exceeds package balance (₱{bal.toLocaleString()})</span>
                        }
                        return null
                      })()}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Next Visit */}
            <div className="border-t pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold flex items-center gap-1"><CalendarPlus className="w-3.5 h-3.5" /> Next Visit</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Auto-create appointment</span>
                  <Switch checked={form.autoCreateAppointment} onCheckedChange={v => setForm({ ...form, autoCreateAppointment: v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date & Time</Label>
                  <Input type="datetime-local" value={form.nextVisitDate} onChange={e => setForm({ ...form, nextVisitDate: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Purpose</Label>
                  <Input placeholder="Follow-up notes" value={form.nextVisitNotes} onChange={e => setForm({ ...form, nextVisitNotes: e.target.value })} className="text-sm" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={addType === 'general' ? 'bg-[#5B5FC7] hover:bg-[#4B4FB7]' : 'bg-purple-600 hover:bg-purple-700'}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Patient Signature Dialog ───────────────────────── */}
      <Dialog open={!!signatureEntry} onOpenChange={(open) => { if (!open) closeSignature() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-emerald-600" /> Patient Signature
            </DialogTitle>
            <DialogDescription>
              {signatureEntry ? (
                <>Entry #{signatureEntry.entryNumber} · {signatureEntry.procedureName || signatureEntry.chartType} · {format(parseISO(signatureEntry.visitDate), 'dd MMM yyyy')}</>
              ) : 'Capture patient signature'}
            </DialogDescription>
          </DialogHeader>

          {signatureEntry && (
            <div className="space-y-3 pt-1">
              <div className="rounded-md bg-emerald-50/60 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-800 space-y-0.5">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {signatureEntry.toothNumber && <span><span className="text-emerald-600">Tooth:</span> {signatureEntry.toothNumber}</span>}
                  {signatureEntry.procedureName && <span><span className="text-emerald-600">Procedure:</span> {signatureEntry.procedureName}</span>}
                  {signatureEntry.dentistName && <span><span className="text-emerald-600">Dentist:</span> {signatureEntry.dentistName}</span>}
                </div>
                <div className="text-[10px] text-emerald-700/80 pt-0.5">
                  By signing, the patient acknowledges this entry.
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Signed by (patient name)</Label>
                <Input
                  value={signatureName}
                  onChange={e => setSignatureName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="text-sm h-8"
                />
              </div>

              <div>
                <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Signature</Label>
                <div className="flex justify-center">
                  <SignaturePad
                    key={signatureEntry.id}
                    width={460}
                    height={180}
                    initialSignature={signatureData}
                    onSignature={setSignatureData}
                  />
                </div>
                <p className="text-[10px] text-gray-400 italic text-center mt-1">
                  Sign above using mouse or finger. Tap the refresh icon to clear.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={closeSignature} disabled={signatureSaving}>
              Cancel
            </Button>
            <Button
              onClick={saveSignature}
              disabled={signatureSaving || !signatureData}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {signatureSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Check className="w-4 h-4 mr-1" /> Save Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Signature Lightbox (enlarge) ────────────────────── */}
      <ImageLightbox
        src={signatureViewer?.src || null}
        alt={signatureViewer?.label || 'Patient signature'}
        open={!!signatureViewer}
        onClose={() => setSignatureViewer(null)}
        downloadable={true}
      />
    </div>
  )
}
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useSession } from '@/components/auth/custom-session-provider'
import {
  Plus, Save, X, Loader2, AlertTriangle, Pill, Heart,
  Clock, Eye, Trash2, Edit, ChevronDown, ChevronUp,
  Shield, Baby, Stethoscope, AlertCircle, StickyNote
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface MedicalHistorySectionProps {
  patient: any
  patientId: string
  onRefresh: () => void
  onTimelineRefresh?: () => void
}

interface AllergyItem { name: string; comments: string }
interface ConditionItem { name: string; comments: string }
interface MedicationItem { name: string; dose: string; frequency: string; comments: string }

export default function MedicalHistorySection({ patient, patientId, onRefresh, onTimelineRefresh }: MedicalHistorySectionProps) {
  const { toast } = useToast()
  const { data: session } = useSession() || {}
  const [saving, setSaving] = useState(false)
  const [showOtherFields, setShowOtherFields] = useState(false)

  // Structured lists
  const [allergies, setAllergies] = useState<AllergyItem[]>(() => {
    const list = patient.allergiesList as AllergyItem[] | null
    return Array.isArray(list) ? list : []
  })
  const [conditions, setConditions] = useState<ConditionItem[]>(() => {
    const list = patient.conditionsList as ConditionItem[] | null
    return Array.isArray(list) ? list : []
  })
  const [medications, setMedications] = useState<MedicationItem[]>(() => {
    const list = patient.medicationsList as MedicationItem[] | null
    return Array.isArray(list) ? list : []
  })

  // New-row forms
  const [newAllergy, setNewAllergy] = useState<AllergyItem>({ name: '', comments: '' })
  const [showNewAllergy, setShowNewAllergy] = useState(false)
  const [newCondition, setNewCondition] = useState<ConditionItem>({ name: '', comments: '' })
  const [showNewCondition, setShowNewCondition] = useState(false)
  const [newMed, setNewMed] = useState<MedicationItem>({ name: '', dose: '', frequency: '', comments: '' })
  const [showNewMed, setShowNewMed] = useState(false)

  // Other medical fields (legacy free-text)
  const [otherFields, setOtherFields] = useState({
    dentalAnxieties: patient.dentalAnxieties || '',
    pregnancyStatus: patient.pregnancyStatus || '',
    bloodPressureHistory: patient.bloodPressureHistory || '',
    medicalSafetyNotes: patient.medicalSafetyNotes || '',
    previousDentist: patient.previousDentist || '',
    previousDentalRemarks: patient.previousDentalRemarks || '',
    remarks: patient.remarks || '',
  })
  const [editingOther, setEditingOther] = useState(false)

  const addAllergy = () => {
    if (!newAllergy.name.trim()) return
    setAllergies(prev => [...prev, { name: newAllergy.name.trim(), comments: newAllergy.comments.trim() }])
    setNewAllergy({ name: '', comments: '' })
    setShowNewAllergy(false)
  }
  const removeAllergy = (idx: number) => setAllergies(prev => prev.filter((_, i) => i !== idx))

  const addCondition = () => {
    if (!newCondition.name.trim()) return
    setConditions(prev => [...prev, { name: newCondition.name.trim(), comments: newCondition.comments.trim() }])
    setNewCondition({ name: '', comments: '' })
    setShowNewCondition(false)
  }
  const removeCondition = (idx: number) => setConditions(prev => prev.filter((_, i) => i !== idx))

  const addMedication = () => {
    if (!newMed.name.trim()) return
    setMedications(prev => [...prev, { name: newMed.name.trim(), dose: newMed.dose.trim(), frequency: newMed.frequency.trim(), comments: newMed.comments.trim() }])
    setNewMed({ name: '', dose: '', frequency: '', comments: '' })
    setShowNewMed(false)
  }
  const removeMedication = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx))

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const payload: any = {
        allergiesList: allergies,
        conditionsList: conditions,
        medicationsList: medications,
        _updateSection: 'medical',
      }
      if (editingOther) {
        Object.assign(payload, otherFields)
      }
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Medical history updated' })
        setEditingOther(false)
        onRefresh()
        onTimelineRefresh?.()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(false)
  }

  const SectionHeader = ({ title, icon: Icon, count, accentColor, critical }: { title: string; icon: any; count: number; accentColor: string; critical?: boolean }) => (
    <div className={`flex items-center gap-2 px-4 py-2.5 border-l-4 ${accentColor} bg-gray-50/50`}>
      <Icon className="w-4 h-4 text-gray-500" />
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{count}</Badge>
      {critical && count > 0 && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">CRITICAL</Badge>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">Medical History</h2>
          {patient.medicalLastUpdatedByName && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated by {patient.medicalLastUpdatedByName}
              {patient.medicalLastUpdatedAt && ` \u2022 ${formatDistanceToNow(parseISO(patient.medicalLastUpdatedAt), { addSuffix: true })}`}
            </span>
          )}
        </div>
        <Button size="sm" className="bg-[#5B5FC7] hover:bg-[#4B4FB7] text-xs gap-1.5" onClick={handleSaveAll} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save All
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">

        {/* ===== ALLERGIES ===== */}
        <SectionHeader title="Allergies" icon={AlertTriangle} count={allergies.length} accentColor="border-l-red-400" critical />
        <div className="px-4 py-2">
          {allergies.length === 0 && !showNewAllergy ? (
            <p className="text-xs text-gray-400 italic py-1">No allergies recorded</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase">
                  <th className="text-left py-1 font-medium">Name</th>
                  <th className="text-left py-1 font-medium">Comments</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {allergies.map((a, i) => (
                  <tr key={i} className="border-t border-gray-50 group">
                    <td className="py-1.5 text-red-700 font-medium">{a.name}</td>
                    <td className="py-1.5 text-gray-600">{a.comments || '—'}</td>
                    <td className="py-1.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500" onClick={() => removeAllergy(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {showNewAllergy ? (
            <div className="flex items-end gap-2 mt-2 pb-1">
              <div className="flex-1">
                <Label className="text-[10px] text-gray-400">Name</Label>
                <Input className="h-8 text-sm" placeholder="e.g. Penicillin" value={newAllergy.name} onChange={e => setNewAllergy({ ...newAllergy, name: e.target.value })} />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] text-gray-400">Comments</Label>
                <Input className="h-8 text-sm" placeholder="Reaction details..." value={newAllergy.comments} onChange={e => setNewAllergy({ ...newAllergy, comments: e.target.value })} />
              </div>
              <Button size="sm" className="h-8 px-3 bg-[#5B5FC7] hover:bg-[#4B4FB7]" onClick={addAllergy}><Plus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowNewAllergy(false); setNewAllergy({ name: '', comments: '' }) }}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-xs text-[#5B5FC7] mt-1 h-7 px-2 gap-1" onClick={() => setShowNewAllergy(true)}>
              <Plus className="w-3 h-3" /> Add Allergy
            </Button>
          )}
        </div>

        {/* ===== CONDITIONS ===== */}
        <SectionHeader title="Pre-existing Conditions" icon={Heart} count={conditions.length} accentColor="border-l-yellow-400" />
        <div className="px-4 py-2">
          {conditions.length === 0 && !showNewCondition ? (
            <p className="text-xs text-gray-400 italic py-1">No conditions recorded</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase">
                  <th className="text-left py-1 font-medium">Condition</th>
                  <th className="text-left py-1 font-medium">Comments</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50 group">
                    <td className="py-1.5 font-medium text-gray-800">{c.name}</td>
                    <td className="py-1.5 text-gray-600">{c.comments || '—'}</td>
                    <td className="py-1.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500" onClick={() => removeCondition(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {showNewCondition ? (
            <div className="flex items-end gap-2 mt-2 pb-1">
              <div className="flex-1">
                <Label className="text-[10px] text-gray-400">Condition</Label>
                <Input className="h-8 text-sm" placeholder="e.g. Diabetes Type 2" value={newCondition.name} onChange={e => setNewCondition({ ...newCondition, name: e.target.value })} />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] text-gray-400">Comments</Label>
                <Input className="h-8 text-sm" placeholder="Details..." value={newCondition.comments} onChange={e => setNewCondition({ ...newCondition, comments: e.target.value })} />
              </div>
              <Button size="sm" className="h-8 px-3 bg-[#5B5FC7] hover:bg-[#4B4FB7]" onClick={addCondition}><Plus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowNewCondition(false); setNewCondition({ name: '', comments: '' }) }}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-xs text-[#5B5FC7] mt-1 h-7 px-2 gap-1" onClick={() => setShowNewCondition(true)}>
              <Plus className="w-3 h-3" /> Add Condition
            </Button>
          )}
        </div>

        {/* ===== MEDICATIONS ===== */}
        <SectionHeader title="Current Medications" icon={Pill} count={medications.length} accentColor="border-l-blue-400" />
        <div className="px-4 py-2">
          {medications.length === 0 && !showNewMed ? (
            <p className="text-xs text-gray-400 italic py-1">No medications recorded</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase">
                  <th className="text-left py-1 font-medium">Medication</th>
                  <th className="text-left py-1 font-medium">Dose</th>
                  <th className="text-left py-1 font-medium">Frequency</th>
                  <th className="text-left py-1 font-medium">Comments</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m, i) => (
                  <tr key={i} className="border-t border-gray-50 group">
                    <td className="py-1.5 font-medium text-gray-800">{m.name}</td>
                    <td className="py-1.5 text-gray-600">{m.dose || '—'}</td>
                    <td className="py-1.5 text-gray-600">{m.frequency || '—'}</td>
                    <td className="py-1.5 text-gray-600">{m.comments || '—'}</td>
                    <td className="py-1.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500" onClick={() => removeMedication(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {showNewMed ? (
            <div className="flex items-end gap-2 mt-2 pb-1 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <Label className="text-[10px] text-gray-400">Medication</Label>
                <Input className="h-8 text-sm" placeholder="e.g. Metformin" value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} />
              </div>
              <div className="w-24">
                <Label className="text-[10px] text-gray-400">Dose</Label>
                <Input className="h-8 text-sm" placeholder="500mg" value={newMed.dose} onChange={e => setNewMed({ ...newMed, dose: e.target.value })} />
              </div>
              <div className="w-28">
                <Label className="text-[10px] text-gray-400">Frequency</Label>
                <Input className="h-8 text-sm" placeholder="2x daily" value={newMed.frequency} onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-[10px] text-gray-400">Comments</Label>
                <Input className="h-8 text-sm" placeholder="Notes..." value={newMed.comments} onChange={e => setNewMed({ ...newMed, comments: e.target.value })} />
              </div>
              <Button size="sm" className="h-8 px-3 bg-[#5B5FC7] hover:bg-[#4B4FB7]" onClick={addMedication}><Plus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowNewMed(false); setNewMed({ name: '', dose: '', frequency: '', comments: '' }) }}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-xs text-[#5B5FC7] mt-1 h-7 px-2 gap-1" onClick={() => setShowNewMed(true)}>
              <Plus className="w-3 h-3" /> Add Medication
            </Button>
          )}
        </div>
      </div>

      {/* ===== OTHER MEDICAL FIELDS (collapsible) ===== */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setShowOtherFields(!showOtherFields)}
        >
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Other Medical Notes</span>
          </div>
          {showOtherFields ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showOtherFields && (
          <div className="px-4 pb-4 space-y-3 border-t">
            <div className="flex justify-end pt-2">
              {!editingOther ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400 hover:text-gray-700" onClick={() => setEditingOther(true)}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingOther(false)}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" className="h-7 px-3 text-xs bg-[#5B5FC7] hover:bg-[#4B4FB7]" onClick={handleSaveAll} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
            {([
              { key: 'dentalAnxieties', label: 'Dental Anxieties', icon: Shield, placeholder: 'Needle phobia, dental drill anxiety...' },
              { key: 'pregnancyStatus', label: 'Pregnancy Status', icon: Baby, placeholder: 'N/A, Pregnant, Trimester...' },
              { key: 'bloodPressureHistory', label: 'Blood Pressure History', icon: Heart, placeholder: 'BP readings and history...' },
              { key: 'medicalSafetyNotes', label: 'Medical Safety Notes', icon: AlertCircle, placeholder: 'Anticoagulant therapy, bleeding disorders...' },
              { key: 'previousDentist', label: 'Previous Dentist', icon: Stethoscope, placeholder: 'Name of previous dentist...' },
              { key: 'previousDentalRemarks', label: 'Previous Dental Remarks', icon: StickyNote, placeholder: 'History from previous dental care...' },
              { key: 'remarks', label: 'General Remarks', icon: StickyNote, placeholder: 'Any other notes...' },
            ] as const).map(f => {
              const Icon = f.icon
              const val = (otherFields as any)[f.key]
              return (
                <div key={f.key} className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 w-40 shrink-0 pt-2">
                    <Icon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">{f.label}</span>
                  </div>
                  {editingOther ? (
                    <Textarea
                      value={val}
                      onChange={e => setOtherFields({ ...otherFields, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={2}
                      className="text-sm flex-1 resize-y"
                    />
                  ) : (
                    <p className={`text-sm flex-1 ${val ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                      {val || 'None reported'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

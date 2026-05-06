'use client'

import { formatDentistName } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Plus, Loader2, Stethoscope, Calendar, FileText, DollarSign,
  CalendarPlus, Hash, Package,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface ChartEntry {
  id: string
  entryNumber: number
  visitDate: string
  toothNumber: string | null
  surface: string | null
  diagnosis: string | null
  procedureName: string | null
  notes: string | null
  amountCharged: number | string
  amountPaid: number | string
  dentistName: string | null
  nextVisitDate: string | null
  nextVisitNotes: string | null
  autoAppointmentId: string | null
  status: string
  createdAt: string
}

interface TreatmentOption {
  id: string
  name: string
  treatmentCode: string
  baseCost: number | string
  category: string
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

interface GeneralChartProps {
  patientId: string
  refreshKey?: number
  onChanged?: () => void
}

export default function GeneralChart({ patientId, refreshKey, onChanged }: GeneralChartProps) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [treatments, setTreatments] = useState<TreatmentOption[]>([])
  const [dentists, setDentists] = useState<{ id: string; name: string }[]>([])
  const [packages, setPackages] = useState<PatientPackage[]>([])

  const defaultForm = {
    visitDate: new Date().toISOString().slice(0, 16),
    toothNumber: '',
    surface: '',
    diagnosis: '',
    procedureName: '',
    treatmentId: '',
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
  }
  const [form, setForm] = useState(defaultForm)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/chart-entries?chartType=general`)
      const data = await res.json()
      if (data.success) setEntries(data.data)
    } catch (e) { console.error('Fetch chart entries error:', e) }
    finally { setLoading(false) }
  }, [patientId])

  useEffect(() => { fetchEntries() }, [fetchEntries, refreshKey])

  // Fetch treatments + dentists when dialog opens
  const openAddDialog = async () => {
    setForm(defaultForm)
    setShowAdd(true)
    if (treatments.length === 0) {
      try {
        const res = await fetch('/api/treatments?limit=500')
        if (res.ok) {
          const data = await res.json()
          const list = data.data?.treatments || data.data || data.treatments || []
          setTreatments(Array.isArray(list) ? list : [])
        }
      } catch { /* ignore */ }
    }
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
    // Fetch active packages
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (res.ok) {
        const data = await res.json()
        const activePackages = (data.packages || []).filter(
          (p: any) => ['active', 'in_progress'].includes(p.status) && Number(p.balanceDue) > 0
        )
        setPackages(activePackages)
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
      const res = await fetch(`/api/patients/${patientId}/chart-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, chartType: 'general', deductFromPackage: form.deductFromPackage, packageId: form.packageId || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      toast({ title: 'Entry saved', description: 'Chart entry recorded and synced.' })
      setShowAdd(false)
      await fetchEntries()
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const totalCharged = entries.reduce((s, e) => s + Number(e.amountCharged), 0)
  const totalPaid = entries.reduce((s, e) => s + Number(e.amountPaid), 0)

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2D9DA8]" /> General Chart
          </h3>
          <Badge variant="outline">{entries.length} entries</Badge>
        </div>
        <Button size="sm" onClick={openAddDialog} className="bg-[#2D9DA8] hover:bg-[#258a93]">
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </Button>
      </div>

      {/* Summary */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <div className="text-[10px] text-blue-600 font-medium">Entries</div>
            <div className="font-bold text-blue-700">{entries.length}</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-center">
            <div className="text-[10px] text-teal-600 font-medium">Total Charged</div>
            <div className="font-bold text-teal-700">₱{totalCharged.toLocaleString()}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <div className="text-[10px] text-green-600 font-medium">Total Paid</div>
            <div className="font-bold text-green-700">₱{totalPaid.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#2D9DA8]" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No chart entries yet</p>
            <p className="text-xs mt-1">Click &quot;Add Entry&quot; to record your first visit</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tooth</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Diagnosis</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Procedure</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Dentist</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Charged</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Paid</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 text-xs">{e.entryNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{format(parseISO(e.visitDate), 'MMM d, yyyy')}</td>
                    <td className="px-3 py-2">
                      {e.toothNumber && <Badge variant="outline" className="text-[10px]">{e.toothNumber}{e.surface ? ` (${e.surface})` : ''}</Badge>}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[150px] truncate">{e.diagnosis || '—'}</td>
                    <td className="px-3 py-2 text-xs font-medium max-w-[150px] truncate">{e.procedureName || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 truncate">{e.dentistName || '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">₱{Number(e.amountCharged).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs text-green-700">₱{Number(e.amountPaid).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">
                      {e.notes || ''}
                      {e.autoAppointmentId && <Badge className="ml-1 bg-blue-100 text-blue-700 text-[9px] px-1 py-0">Next Visit ✓</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Entry Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2D9DA8]" /> New General Chart Entry
            </DialogTitle>
            <DialogDescription>Quick encode — fills visit record, procedure, and payment automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Row 1: Date + Tooth */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Visit Date *</Label>
                <Input type="datetime-local" value={form.visitDate} onChange={e => setForm({ ...form, visitDate: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Tooth #</Label>
                <Input placeholder="e.g. 14, 36" value={form.toothNumber} onChange={e => setForm({ ...form, toothNumber: e.target.value })} className="text-sm" />
              </div>
            </div>

            {/* Row 2: Surface + Diagnosis */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Surface</Label>
                <Select value={form.surface || 'none'} onValueChange={v => setForm({ ...form, surface: v === 'none' ? '' : v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="—" /></SelectTrigger>
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
              <div>
                <Label className="text-xs">Diagnosis</Label>
                <Input placeholder="Findings / diagnosis" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} className="text-sm" />
              </div>
            </div>

            {/* Procedure */}
            <div>
              <Label className="text-xs">Procedure</Label>
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
                <Input placeholder="Type procedure name" value={form.procedureName} onChange={e => setForm({ ...form, procedureName: e.target.value })} className="mt-1 text-sm" />
              )}
            </div>

            {/* Dentist */}
            <div>
              <Label className="text-xs">Dentist</Label>
              <Select value={form.dentistId || '__none__'} onValueChange={v => v === '__none__' ? setForm(prev => ({ ...prev, dentistId: '', dentistName: '' })) : handleDentistSelect(v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select dentist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {dentists.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount Charged (₱)</Label>
                <Input type="number" placeholder="0" value={form.amountCharged} onChange={e => setForm({ ...form, amountCharged: e.target.value })} className="text-sm" min={0} />
              </div>
              <div>
                <Label className="text-xs">Amount Paid (₱)</Label>
                <Input type="number" placeholder="0" value={form.amountPaid} onChange={e => setForm({ ...form, amountPaid: e.target.value })} className="text-sm" min={0} />
              </div>
            </div>

            {/* Package Deduction */}
            {packages.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600" /> Deduct from Package
                  </Label>
                  <Switch
                    checked={form.deductFromPackage}
                    onCheckedChange={v => setForm(prev => ({ ...prev, deductFromPackage: v, packageId: v ? prev.packageId : '' }))}
                  />
                </div>
                {form.deductFromPackage && (
                  <div>
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
                )}
              </div>
            )}

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
            <Button onClick={handleSave} disabled={saving} className="bg-[#2D9DA8] hover:bg-[#258a93]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import {
  Plus, Trash2, Search, Stethoscope, CheckCircle, AlertCircle,
  Loader2, DollarSign, Shield, ChevronDown, ChevronUp, Edit2, Save, X
} from 'lucide-react'

interface Treatment {
  id: string
  treatmentCode: string
  name: string
  category: string
  baseCost: number | string
  estimatedDurationMinutes: number
}

interface PackageItem {
  id: string
  treatmentId: string | null
  procedureName: string
  toothNumber: string | null
  surface: string | null
  quantity: number
  unitCost: number
  adjustedCost: number
  coverageType: string
  coveredAmount: number
  patientCost: number
  status: string
  notes: string | null
  treatment?: Treatment | null
}

interface CoverageResult {
  isCovered: boolean
  coverageType: string
  bestCoverage: any
  allMatches: any[]
}

interface TreatmentBuilderProps {
  patientId: string
  packageId?: string
  onItemsChanged?: () => void
  items?: PackageItem[]
  readOnly?: boolean
}

const coverageBadge = (type: string) => {
  switch (type) {
    case 'fully_covered': return <Badge className="bg-green-100 text-green-700 border-green-200"><Shield className="w-3 h-3 mr-1" />Covered</Badge>
    case 'partially_covered': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Shield className="w-3 h-3 mr-1" />Partial</Badge>
    default: return <Badge variant="outline" className="text-gray-500">Not Covered</Badge>
  }
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600'
  }
  return <Badge className={colors[status] || 'bg-gray-100 text-gray-600'}>{status.replace('_', ' ')}</Badge>
}

export default function TreatmentBuilder({ patientId, packageId, onItemsChanged, items: externalItems, readOnly }: TreatmentBuilderProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [items, setItems] = useState<PackageItem[]>(externalItems || [])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [filteredTreatments, setFilteredTreatments] = useState<Treatment[]>([])
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [coverageCache, setCoverageCache] = useState<Record<string, CoverageResult>>({})
  const [checkingCoverage, setCheckingCoverage] = useState(false)
  const [adding, setAdding] = useState(false)

  // Load all treatments catalog
  useEffect(() => {
    fetch('/api/treatments?isActive=true')
      .then(r => r.json())
      .then(resp => {
        const data = resp.data || resp
        const flat = data.groupedTreatments
          ? Object.values(data.groupedTreatments).flat() as Treatment[]
          : data.treatments || []
        setTreatments(flat)
      })
      .catch(console.error)
  }, [])

  // Sync external items
  useEffect(() => {
    if (externalItems) setItems(externalItems)
  }, [externalItems])

  // Filter treatments by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTreatments(treatments.slice(0, 20))
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredTreatments(
      treatments.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.treatmentCode.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      ).slice(0, 20)
    )
  }, [searchQuery, treatments])

  // Check coverage for a treatment
  const checkCoverage = useCallback(async (treatmentId: string, procedureName: string) => {
    const key = treatmentId || procedureName
    if (coverageCache[key]) return coverageCache[key]

    setCheckingCoverage(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/coverage-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatmentId, procedureName })
      })
      const data = await res.json()
      setCoverageCache(prev => ({ ...prev, [key]: data }))
      return data as CoverageResult
    } catch {
      return null
    } finally {
      setCheckingCoverage(false)
    }
  }, [patientId, coverageCache])

  // Add procedure from treatment catalog
  const addProcedure = async (treatment: Treatment) => {
    if (readOnly || !packageId) return
    setAdding(true)

    // Check coverage first
    const coverage = await checkCoverage(treatment.id, treatment.name)

    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${packageId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentId: treatment.id,
          procedureName: treatment.name,
          unitCost: Number(treatment.baseCost),
          adjustedCost: Number(treatment.baseCost),
          quantity: 1,
          coverageType: coverage?.coverageType || 'not_covered',
          coveredAmount: coverage?.bestCoverage?.coveredAmount || 0
        })
      })

      if (!res.ok) throw new Error('Failed to add')
      const data = await res.json()

      setItems(prev => [...prev, data.item])
      setShowSearch(false)
      setSearchQuery('')
      onItemsChanged?.()
      toast({ title: 'Procedure added', description: `${treatment.name} added to package` })
    } catch {
      toast({ title: 'Error', description: 'Failed to add procedure', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  // Add custom procedure
  const addCustomProcedure = async () => {
    if (readOnly || !packageId || !searchQuery.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${packageId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureName: searchQuery.trim(),
          unitCost: 0,
          quantity: 1
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setItems(prev => [...prev, data.item])
      setShowSearch(false)
      setSearchQuery('')
      onItemsChanged?.()
      toast({ title: 'Custom procedure added' })
    } catch {
      toast({ title: 'Error', description: 'Failed to add', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  // Remove item
  const removeItem = async (itemId: string) => {
    if (readOnly || !packageId) return
    const ok = await confirm({
      title: 'Remove procedure?',
      description: 'This procedure will be removed from the treatment package.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${packageId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      })
      if (!res.ok) throw new Error('Failed')
      setItems(prev => prev.filter(i => i.id !== itemId))
      onItemsChanged?.()
      toast({ title: 'Procedure removed' })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' })
    }
  }

  // Start editing
  const startEdit = (item: PackageItem) => {
    setEditingItemId(item.id)
    setEditForm({
      unitCost: Number(item.unitCost),
      quantity: item.quantity,
      toothNumber: item.toothNumber || '',
      surface: item.surface || '',
      notes: item.notes || ''
    })
  }

  // Save edit
  const saveEdit = async (itemId: string) => {
    if (!packageId) return
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${packageId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, ...editForm })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setItems(prev => prev.map(i => i.id === itemId ? data.item : i))
      setEditingItemId(null)
      onItemsChanged?.()
      toast({ title: 'Procedure updated' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' })
    }
  }

  // Calculate totals
  const totalAmount = items.reduce((s, i) => s + Number(i.adjustedCost), 0)
  const totalCovered = items.reduce((s, i) => s + Number(i.coveredAmount), 0)
  const patientPayable = Math.max(0, totalAmount - totalCovered)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#2D9DA8]" />
            Treatment Builder
          </CardTitle>
          {!readOnly && (
            <Button
              size="sm"
              variant={showSearch ? 'secondary' : 'default'}
              onClick={() => setShowSearch(!showSearch)}
              className={!showSearch ? 'bg-[#2D9DA8] hover:bg-[#258a93]' : ''}
            >
              {showSearch ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {showSearch ? 'Cancel' : 'Add Procedure'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search & Add */}
        {showSearch && (
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search procedures by name or code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTreatments.map(t => (
                <button
                  key={t.id}
                  onClick={() => addProcedure(t)}
                  disabled={adding}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-white border border-transparent hover:border-gray-200 transition-colors text-left text-sm"
                >
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{t.treatmentCode}</span>
                    <span className="text-gray-400 ml-2 text-xs">• {t.category}</span>
                  </div>
                  <span className="font-medium text-[#2D9DA8]">₱{Number(t.baseCost).toLocaleString()}</span>
                </button>
              ))}
              {filteredTreatments.length === 0 && searchQuery.trim() && (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500 mb-2">No matching treatments found</p>
                  <Button size="sm" variant="outline" onClick={addCustomProcedure} disabled={adding}>
                    <Plus className="w-3 h-3 mr-1" />Add "{searchQuery}" as custom procedure
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items List */}
        {items.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No procedures added yet</p>
            {!readOnly && <p className="text-xs mt-1">Click "Add Procedure" to start building</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                {editingItemId === item.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <div className="font-medium text-sm">{item.procedureName}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Unit Cost (₱)</Label>
                        <Input
                          type="number"
                          value={editForm.unitCost}
                          onChange={e => setEditForm({ ...editForm, unitCost: Number(e.target.value) })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          value={editForm.quantity}
                          onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                          className="h-8 text-sm"
                          min={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tooth #</Label>
                        <Input
                          value={editForm.toothNumber}
                          onChange={e => setEditForm({ ...editForm, toothNumber: e.target.value })}
                          className="h-8 text-sm"
                          placeholder="e.g. 11, 21"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Surface</Label>
                        <Input
                          value={editForm.surface}
                          onChange={e => setEditForm({ ...editForm, surface: e.target.value })}
                          className="h-8 text-sm"
                          placeholder="e.g. Mesial"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingItemId(null)}>
                        <X className="w-3 h-3 mr-1" />Cancel
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(item.id)} className="bg-[#22B573] hover:bg-[#1da066]">
                        <Save className="w-3 h-3 mr-1" />Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.procedureName}</span>
                        {coverageBadge(item.coverageType)}
                        {statusBadge(item.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {item.toothNumber && <span>Tooth #{item.toothNumber}</span>}
                        {item.surface && <span>• {item.surface}</span>}
                        {item.quantity > 1 && <span>• Qty: {item.quantity}</span>}
                        {item.treatment?.treatmentCode && <span>• {item.treatment.treatmentCode}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <div className="text-right">
                        <div className="font-semibold text-sm">₱{Number(item.adjustedCost).toLocaleString()}</div>
                        {Number(item.coveredAmount) > 0 && (
                          <div className="text-xs text-green-600">-₱{Number(item.coveredAmount).toLocaleString()} covered</div>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(item)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeItem(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-medium">₱{totalAmount.toLocaleString()}</span>
            </div>
            {totalCovered > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Coverage</span>
                <span className="text-green-600">-₱{totalCovered.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>Patient Payable</span>
              <span className="text-[#2D9DA8]">₱{patientPayable.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

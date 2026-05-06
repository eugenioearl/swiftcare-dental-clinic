'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, X, Loader2 } from 'lucide-react'

const CATEGORIES = [
  'Preventive', 'Restorative', 'Cosmetic', 'Orthodontics', 'Periodontics',
  'Endodontics', 'Oral Surgery', 'Prosthodontics', 'Pediatric', 'Diagnostic',
  'Emergency', 'Other'
]

interface CreatedProcedure {
  id: string
  treatmentCode: string
  name: string
  description: string | null
  category: string
  baseCost: string | number
}

interface InlineProcedureCreatorProps {
  onCreated: (procedure: CreatedProcedure) => void
  onCancel: () => void
}

export function InlineProcedureCreator({ onCreated, onCancel }: InlineProcedureCreatorProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    treatmentCode: '',
    name: '',
    description: '',
    category: 'Preventive',
    baseCost: 0,
    estimatedDurationMinutes: 30,
  })

  const handleCreate = async () => {
    if (!form.treatmentCode.trim() || !form.name.trim()) {
      toast({ title: 'Code and name are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          treatmentCode: form.treatmentCode.toUpperCase().trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: true,
          requiresAnesthesia: false,
          requiresFollowup: false,
          isSurgical: false,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create procedure')
      }
      const data = await res.json()
      toast({ title: 'Procedure created', description: `${form.name} added to catalog` })
      onCreated(data.data)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-[#2D9DA8]/40 rounded-lg p-4 bg-[#2D9DA8]/5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#2D9DA8]">Create New Procedure</h4>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Code *</Label>
          <Input
            placeholder="e.g. FILL-01"
            value={form.treatmentCode}
            onChange={e => setForm({ ...form, treatmentCode: e.target.value.toUpperCase() })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Procedure Name *</Label>
        <Input
          placeholder="e.g. Composite Filling"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea
          placeholder="Brief description of the procedure..."
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Standard Price (₱) *</Label>
          <Input
            type="number"
            min={0}
            value={form.baseCost}
            onChange={e => setForm({ ...form, baseCost: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Duration (min)</Label>
          <Input
            type="number"
            min={15}
            max={480}
            value={form.estimatedDurationMinutes}
            onChange={e => setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onCancel} className="h-8">Cancel</Button>
        <Button size="sm" onClick={handleCreate} disabled={saving} className="h-8 bg-[#2D9DA8] hover:bg-[#2D9DA8]/90">
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
          {saving ? 'Creating...' : 'Create & Add'}
        </Button>
      </div>
    </div>
  )
}

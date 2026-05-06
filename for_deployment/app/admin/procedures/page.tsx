'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { Plus, Pencil, Trash2, Search, Syringe, Clock, DollarSign, Tag, Filter, Stethoscope, Activity } from 'lucide-react'

interface Procedure {
  id: string
  treatmentCode: string
  name: string
  description: string | null
  category: string
  procedureType: 'general' | 'ortho'
  baseCost: string | number
  estimatedDurationMinutes: number
  requiresAnesthesia: boolean
  requiresFollowup: boolean
  isSurgical: boolean
  isActive: boolean
}

const CATEGORIES = [
  'Preventive',
  'Restorative',
  'Cosmetic',
  'Orthodontics',
  'Periodontics',
  'Endodontics',
  'Oral Surgery',
  'Prosthodontics',
  'Pediatric',
  'Diagnostic',
  'Emergency',
  'Other'
]

const defaultForm = {
  treatmentCode: '',
  name: '',
  description: '',
  category: 'Preventive',
  procedureType: 'general' as 'general' | 'ortho',
  baseCost: 0,
  estimatedDurationMinutes: 30,
  requiresAnesthesia: false,
  requiresFollowup: false,
  isSurgical: false,
  isActive: true
}

export default function AdminProceduresPage() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [activeProcType, setActiveProcType] = useState<'general' | 'ortho'>('general')

  const fetchProcedures = useCallback(async () => {
    try {
      const res = await fetch(`/api/treatments?isActive=${showInactive ? 'all' : 'true'}`)
      if (res.ok) {
        const data = await res.json()
        setProcedures(data.data?.treatments || [])
      }
    } catch (err) {
      console.error('Error fetching procedures:', err)
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => { fetchProcedures() }, [fetchProcedures])

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin'

  if (!session?.user || !['admin', 'super_admin', 'dentist'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Procedures">
        <div className="text-center py-16">
          <p className="text-gray-600">Access denied.</p>
        </div>
      </DashboardLayout>
    )
  }

  const openCreate = () => {
    setEditingId(null)
    // Pre-select procedure type matching the current tab and category accordingly
    setForm({
      ...defaultForm,
      procedureType: activeProcType,
      category: activeProcType === 'ortho' ? 'Orthodontics' : 'Preventive',
    })
    setShowDialog(true)
  }

  const openEdit = (p: Procedure) => {
    setEditingId(p.id)
    setForm({
      treatmentCode: p.treatmentCode,
      name: p.name,
      description: p.description || '',
      category: p.category,
      procedureType: (p.procedureType || 'general') as 'general' | 'ortho',
      baseCost: Number(p.baseCost),
      estimatedDurationMinutes: p.estimatedDurationMinutes,
      requiresAnesthesia: p.requiresAnesthesia || false,
      requiresFollowup: p.requiresFollowup || false,
      isSurgical: p.isSurgical || false,
      isActive: p.isActive
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.treatmentCode || !form.name || !form.category) {
      toast({ title: 'Missing fields', description: 'Code, name, and category are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/treatments/${editingId}` : '/api/treatments'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      toast({ title: editingId ? 'Procedure updated' : 'Procedure created' })
      setShowDialog(false)
      fetchProcedures()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Deactivate procedure?',
      description: 'This procedure will be hidden from new selections but remains in historical records.',
      confirmLabel: 'Deactivate',
      variant: 'warning',
    })
    if (!ok) return
    try {
      await fetch(`/api/treatments/${id}`, { method: 'DELETE' })
      toast({ title: 'Procedure deactivated' })
      fetchProcedures()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to deactivate', variant: 'destructive' })
    }
  }

  // Determine procedure type (fall back to 'general' for legacy records without type)
  const getProcType = (p: Procedure): 'general' | 'ortho' =>
    p.procedureType === 'ortho' ? 'ortho' : 'general'

  const filtered = procedures.filter(p => {
    const s = search.toLowerCase()
    const matchSearch = !s || p.name.toLowerCase().includes(s) || p.treatmentCode.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s)
    const matchCat = catFilter === 'all' || p.category === catFilter
    const matchType = getProcType(p) === activeProcType
    return matchSearch && matchCat && matchType
  })

  const typeCounts = {
    general: procedures.filter(p => getProcType(p) === 'general').length,
    ortho: procedures.filter(p => getProcType(p) === 'ortho').length,
  }

  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {} as Record<string, Procedure[]>)

  return (
    <DashboardLayout title="Procedures">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Procedures Catalog</h1>
            <p className="text-gray-600">Manage dental procedures with standard pricing</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="bg-[#2D9DA8] hover:bg-[#2D9DA8]/90">
              <Plus className="w-4 h-4 mr-2" /> Add Procedure
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search procedures..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#2D9DA8]">{procedures.filter(p => p.isActive).length}</div>
              <p className="text-xs text-gray-600">Active Procedures</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#22B573]">{new Set(procedures.map(p => p.category)).size}</div>
              <p className="text-xs text-gray-600">Categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                ₱{procedures.length > 0 ? Math.round(procedures.reduce((s, p) => s + Number(p.baseCost), 0) / procedures.length).toLocaleString() : 0}
              </div>
              <p className="text-xs text-gray-600">Avg Price</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{procedures.filter(p => p.isSurgical).length}</div>
              <p className="text-xs text-gray-600">Surgical</p>
            </CardContent>
          </Card>
        </div>

        {/* Procedure Type Tabs */}
        <Tabs value={activeProcType} onValueChange={(v) => setActiveProcType(v as 'general' | 'ortho')}>
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-[#2D9DA8] data-[state=active]:text-white">
              <Stethoscope className="w-4 h-4" />
              General
              <Badge variant="secondary" className="ml-1">{typeCounts.general}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ortho" className="gap-2 data-[state=active]:bg-[#5B5FC7] data-[state=active]:text-white">
              <Activity className="w-4 h-4" />
              Orthodontics
              <Badge variant="secondary" className="ml-1">{typeCounts.ortho}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4 space-y-6">
            {/* Content is same as Ortho - uses same filtered list */}
          </TabsContent>
          <TabsContent value="ortho" className="mt-4 space-y-6">
            {/* Content is same as General - uses same filtered list */}
          </TabsContent>
        </Tabs>

        {/* Procedures by Category (filtered by current procedure type) */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading procedures...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Syringe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No {activeProcType === 'ortho' ? 'orthodontic' : 'general'} procedures found</p>
              {isAdmin && <Button onClick={openCreate} variant="outline" className="mt-4">Add First {activeProcType === 'ortho' ? 'Ortho' : 'General'} Procedure</Button>}
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" /> {category}
                <Badge variant="secondary" className="ml-1">{items.length}</Badge>
              </h3>
              <div className="grid gap-3">
                {items.map(p => (
                  <Card key={p.id} className={`transition-all hover:shadow-md ${!p.isActive ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{p.name}</h4>
                            <Badge variant="outline" className="text-xs font-mono">{p.treatmentCode}</Badge>
                            {p.isSurgical && <Badge className="bg-red-100 text-red-800 text-xs">Surgical</Badge>}
                            {p.requiresAnesthesia && <Badge className="bg-yellow-100 text-yellow-800 text-xs">Anesthesia</Badge>}
                            {!p.isActive && <Badge className="bg-gray-100 text-gray-800 text-xs">Inactive</Badge>}
                          </div>
                          {p.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</p>}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.estimatedDurationMinutes} min</span>
                            {p.requiresFollowup && <span className="text-blue-600">Follow-up needed</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#22B573]">₱{Number(p.baseCost).toLocaleString()}</div>
                            <p className="text-xs text-gray-500">Standard Price</p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {p.isActive && (
                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(p.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Procedure' : 'Add New Procedure'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Procedure Type *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, procedureType: 'general' })}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 transition-all text-sm font-medium ${
                    form.procedureType === 'general'
                      ? 'border-[#2D9DA8] bg-[#2D9DA8]/10 text-[#2D9DA8]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" /> General
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, procedureType: 'ortho', category: form.category === 'Preventive' ? 'Orthodontics' : form.category })}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 transition-all text-sm font-medium ${
                    form.procedureType === 'ortho'
                      ? 'border-[#5B5FC7] bg-[#5B5FC7]/10 text-[#5B5FC7]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Activity className="w-4 h-4" /> Orthodontics
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {form.procedureType === 'ortho'
                  ? 'Orthodontic procedures (braces, aligners, retainers) - tracked separately for ortho programs'
                  : 'Standard dental procedures (fillings, cleanings, extractions, etc.)'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code *</Label>
                <Input
                  placeholder="e.g. FILL-01"
                  value={form.treatmentCode}
                  onChange={e => setForm({ ...form, treatmentCode: e.target.value.toUpperCase() })}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Composite Filling"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the procedure..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Standard Price (₱) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.baseCost}
                  onChange={e => setForm({ ...form, baseCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  value={form.estimatedDurationMinutes}
                  onChange={e => setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requiresAnesthesia} onChange={e => setForm({ ...form, requiresAnesthesia: e.target.checked })} className="rounded" />
                Requires Anesthesia
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requiresFollowup} onChange={e => setForm({ ...form, requiresFollowup: e.target.checked })} className="rounded" />
                Requires Follow-up
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isSurgical} onChange={e => setForm({ ...form, isSurgical: e.target.checked })} className="rounded" />
                Surgical Procedure
              </label>
            </div>
            {editingId && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                Active
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#2D9DA8] hover:bg-[#2D9DA8]/90">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

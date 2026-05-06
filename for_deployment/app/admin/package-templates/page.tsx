'use client'

import { formatDisplayName } from '@/lib/utils'
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
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import {
  Plus, Pencil, Trash2, Search, Package, X, GripVertical, ChevronDown, ChevronUp, Syringe
} from 'lucide-react'
import { InlineProcedureCreator } from '@/components/procedures/inline-procedure-creator'

interface Treatment {
  id: string
  treatmentCode: string
  name: string
  description: string | null
  category: string
  baseCost: string | number
}

interface TemplateProcedure {
  id?: string
  treatmentId: string
  overridePrice: number | null
  sortOrder: number
  treatment: Treatment
}

interface PackageTemplate {
  id: string
  name: string
  description: string | null
  isActive: boolean
  procedures: TemplateProcedure[]
  createdBy: { firstName: string; lastName: string } | null
  createdAt: string
}

export default function PackageTemplatesPage() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [allTreatments, setAllTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formProcedures, setFormProcedures] = useState<{ treatmentId: string; overridePrice: number | null; sortOrder: number }[]>([])
  const [procSearch, setProcSearch] = useState('')
  const [showNewProcForm, setShowNewProcForm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [tplRes, trtRes] = await Promise.all([
        fetch('/api/package-templates'),
        fetch('/api/treatments?isActive=true')
      ])
      if (tplRes.ok) {
        const d = await tplRes.json()
        setTemplates(d.data || [])
      }
      if (trtRes.ok) {
        const d = await trtRes.json()
        setAllTreatments(d.data?.treatments || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin'

  if (!session?.user || !['admin', 'super_admin', 'dentist'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Treatment Packages">
        <div className="text-center py-16"><p className="text-gray-600">Access denied.</p></div>
      </DashboardLayout>
    )
  }

  const openCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormDesc('')
    setFormProcedures([])
    setProcSearch('')
    setShowNewProcForm(false)
    setShowDialog(true)
  }

  const openEdit = (t: PackageTemplate) => {
    setEditingId(t.id)
    setFormName(t.name)
    setFormDesc(t.description || '')
    setFormProcedures(t.procedures.map(p => ({
      treatmentId: p.treatmentId,
      overridePrice: p.overridePrice !== null && p.overridePrice !== undefined ? Number(p.overridePrice) : null,
      sortOrder: p.sortOrder
    })))
    setProcSearch('')
    setShowNewProcForm(false)
    setShowDialog(true)
  }

  const addProcedure = (t: Treatment) => {
    if (formProcedures.some(p => p.treatmentId === t.id)) {
      toast({ title: 'Already added', variant: 'destructive' })
      return
    }
    setFormProcedures([...formProcedures, {
      treatmentId: t.id,
      overridePrice: null,
      sortOrder: formProcedures.length
    }])
    setProcSearch('')
  }

  const handleNewProcCreated = (proc: any) => {
    // Add to allTreatments list and auto-add to package
    setAllTreatments(prev => [...prev, proc])
    setFormProcedures(prev => [...prev, {
      treatmentId: proc.id,
      overridePrice: null,
      sortOrder: prev.length
    }])
    setShowNewProcForm(false)
  }

  const removeProcedure = (treatmentId: string) => {
    setFormProcedures(formProcedures.filter(p => p.treatmentId !== treatmentId).map((p, i) => ({ ...p, sortOrder: i })))
  }

  const updatePrice = (treatmentId: string, price: string) => {
    setFormProcedures(formProcedures.map(p =>
      p.treatmentId === treatmentId
        ? { ...p, overridePrice: price === '' ? null : Number(price) }
        : p
    ))
  }

  const getTotal = (procs: { treatmentId: string; overridePrice: number | null }[]) => {
    return procs.reduce((sum, p) => {
      const t = allTreatments.find(t => t.id === p.treatmentId)
      const price = p.overridePrice !== null ? p.overridePrice : Number(t?.baseCost || 0)
      return sum + price
    }, 0)
  }

  const getTemplateTotal = (tpl: PackageTemplate) => {
    return tpl.procedures.reduce((sum, p) => {
      const price = p.overridePrice !== null && p.overridePrice !== undefined ? Number(p.overridePrice) : Number(p.treatment.baseCost)
      return sum + price
    }, 0)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Package name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        procedures: formProcedures.map((p, i) => ({
          treatmentId: p.treatmentId,
          overridePrice: p.overridePrice !== null ? p.overridePrice : undefined,
          sortOrder: i
        }))
      }
      const url = editingId ? `/api/package-templates/${editingId}` : '/api/package-templates'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      toast({ title: editingId ? 'Package updated' : 'Package created' })
      setShowDialog(false)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Deactivate package template?',
      description: 'This template will be hidden from new selections, but existing patient packages remain unchanged.',
      confirmLabel: 'Deactivate',
      variant: 'warning',
    })
    if (!ok) return
    try {
      await fetch(`/api/package-templates/${id}`, { method: 'DELETE' })
      toast({ title: 'Package deactivated' })
      fetchData()
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }

  const filteredTemplates = templates.filter(t => {
    const s = search.toLowerCase()
    return !s || t.name.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s)
  })

  const availableTreatments = allTreatments.filter(t => {
    const alreadyAdded = formProcedures.some(p => p.treatmentId === t.id)
    const matchSearch = !procSearch || t.name.toLowerCase().includes(procSearch.toLowerCase()) || t.treatmentCode.toLowerCase().includes(procSearch.toLowerCase())
    return !alreadyAdded && matchSearch
  })

  return (
    <DashboardLayout title="Treatment Packages">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Treatment Package Templates</h1>
            <p className="text-gray-600">Create reusable treatment packages with bundled procedures</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="bg-[#22B573] hover:bg-[#22B573]/90">
              <Plus className="w-4 h-4 mr-2" /> Create Package
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search packages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading packages...</div>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No package templates yet</p>
              {isAdmin && <Button onClick={openCreate} variant="outline" className="mt-4">Create First Package</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTemplates.map(tpl => {
              const isExpanded = expandedId === tpl.id
              const total = getTemplateTotal(tpl)
              return (
                <Card key={tpl.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-0">
                    {/* Header Row */}
                    <div
                      className="flex items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#22B573]/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[#22B573]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight break-words">{tpl.name}</h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                            <span>{tpl.procedures.length} procedure{tpl.procedures.length !== 1 ? 's' : ''}</span>
                            {tpl.createdBy && <span className="hidden sm:inline">• by {formatDisplayName(tpl.createdBy.firstName, tpl.createdBy.lastName)}</span>}
                          </div>
                          {/* Mobile-only price below name */}
                          <div className="sm:hidden mt-1">
                            <span className="text-sm font-bold text-[#22B573] whitespace-nowrap">₱{total.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-500 ml-1">total</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {/* Desktop-only price column */}
                        <div className="hidden sm:block text-right">
                          <div className="text-base sm:text-lg font-bold text-[#22B573] whitespace-nowrap">₱{total.toLocaleString()}</div>
                          <p className="text-[10px] sm:text-xs text-gray-500">Package Total</p>
                        </div>
                        {isAdmin && (
                          <div className="hidden sm:flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(tpl.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                      </div>
                    </div>
                    {/* Mobile-only edit/delete row */}
                    {isAdmin && (
                      <div className="sm:hidden flex justify-end gap-1 px-3 pb-3 -mt-1 border-t pt-2" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)} className="h-8 px-2 text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 h-8 px-2 text-xs" onClick={() => handleDelete(tpl.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    )}

                    {/* Expanded Procedures */}
                    {isExpanded && (
                      <div className="border-t">
                        {tpl.description && (
                          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600">{tpl.description}</div>
                        )}
                        <div className="divide-y">
                          {tpl.procedures.map((p, i) => {
                            const hasOverride = p.overridePrice !== null && p.overridePrice !== undefined
                            const price = hasOverride ? Number(p.overridePrice) : Number(p.treatment.baseCost)
                            return (
                              <div key={p.treatment.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-gray-400 w-6">{i + 1}.</span>
                                  <div>
                                    <p className="font-medium text-sm text-gray-900">{p.treatment.name}</p>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px]">{p.treatment.treatmentCode}</Badge>
                                      <span className="text-xs text-gray-500">{p.treatment.category}</span>
                                    </div>
                                    {p.treatment.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.treatment.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-sm">₱{price.toLocaleString()}</p>
                                  {hasOverride && (
                                    <p className="text-[10px] text-gray-400 line-through">₱{Number(p.treatment.baseCost).toLocaleString()}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 font-semibold text-sm">
                          <span>Total Package Price</span>
                          <span className="text-[#22B573] text-lg">₱{total.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Package Template' : 'Create Package Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>Package Name *</Label>
              <Input
                placeholder="e.g. Complete Denture Package"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this package includes..."
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                rows={2}
              />
            </div>

            {/* Add Procedures */}
            <div>
              <Label className="mb-2 block">Procedures in Package</Label>

              {showNewProcForm ? (
                <InlineProcedureCreator
                  onCreated={handleNewProcCreated}
                  onCancel={() => setShowNewProcForm(false)}
                />
              ) : (
                <>
                  {/* Search and add */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search procedures to add..."
                      value={procSearch}
                      onChange={e => setProcSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Available procedures dropdown */}
                  {procSearch && availableTreatments.length > 0 && (
                    <div className="border rounded-lg mb-3 max-h-48 overflow-y-auto bg-white shadow-lg">
                      {availableTreatments.slice(0, 10).map(t => (
                        <button
                          key={t.id}
                          onClick={() => addProcedure(t)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left text-sm"
                        >
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-gray-500">{t.treatmentCode} • {t.category}</p>
                          </div>
                          <span className="text-[#22B573] font-semibold">₱{Number(t.baseCost).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create new procedure button */}
                  <button
                    type="button"
                    onClick={() => setShowNewProcForm(true)}
                    className="flex items-center gap-2 text-sm text-[#2D9DA8] hover:text-[#22B573] font-medium mb-3 transition-colors"
                  >
                    <Syringe className="w-4 h-4" />
                    <span>Create New Procedure</span>
                  </button>
                </>
              )}

              {/* Selected procedures list */}
              {formProcedures.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No procedures added yet</p>
                  <p className="text-xs">Search above to add procedures</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formProcedures.map((fp, idx) => {
                    const t = allTreatments.find(t => t.id === fp.treatmentId)
                    if (!t) return null
                    return (
                      <div key={fp.treatmentId} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                        <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.treatmentCode} • Standard: ₱{Number(t.baseCost).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-28">
                            <Input
                              type="number"
                              min={0}
                              placeholder={Number(t.baseCost).toString()}
                              value={fp.overridePrice !== null ? fp.overridePrice : ''}
                              onChange={e => updatePrice(fp.treatmentId, e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <Button size="sm" variant="ghost" className="text-red-500 h-8 w-8 p-0" onClick={() => removeProcedure(fp.treatmentId)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Total */}
                  <div className="flex justify-between items-center px-3 py-2 bg-[#22B573]/10 rounded-lg">
                    <span className="font-semibold text-sm">Package Total</span>
                    <span className="text-lg font-bold text-[#22B573]">₱{getTotal(formProcedures).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#22B573] hover:bg-[#22B573]/90">
                {saving ? 'Saving...' : editingId ? 'Update Package' : 'Create Package'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

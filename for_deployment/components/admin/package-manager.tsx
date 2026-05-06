'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { useSession } from '@/components/auth/custom-session-provider'
import {
  Package, Plus, Loader2, ChevronRight, Calendar, DollarSign,
  CheckCircle, Clock, AlertCircle, FileText, MoreVertical, Trash2, Play, Archive,
  RefreshCw, Shield, Copy, LayoutTemplate, X, Unlock, RotateCcw
} from 'lucide-react'
import TreatmentBuilder from './treatment-builder'

interface PackageData {
  id: string
  packageNumber: string
  title: string
  description: string | null
  status: string
  totalAmount: number | string
  coveredAmount: number | string
  patientPayable: number | string
  paidAmount: number | string
  balanceDue: number | string
  notes: string | null
  startDate: string | null
  expectedEndDate: string | null
  completedDate: string | null
  createdAt: string
  items: any[]
  payments: any[]
  createdBy: { id: string; firstName: string; lastName: string } | null
}

interface TemplateData {
  id: string
  name: string
  description: string | null
  procedures: {
    id: string
    treatmentId: string
    overridePrice: number | string | null
    sortOrder: number
    treatment: {
      id: string
      name: string
      treatmentCode: string
      baseCost: number | string
      category: string
    }
  }[]
}

interface PackageManagerProps {
  patientId: string
  onPackageChanged?: () => void
  onRecordPayment?: (packageId: string, balanceDue: number) => void
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  draft: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: FileText, label: 'Draft' },
  active: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Play, label: 'Active' },
  in_progress: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock, label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-600 border-red-200', icon: AlertCircle, label: 'Cancelled' },
}

export default function PackageManager({ patientId, onPackageChanged, onRecordPayment }: PackageManagerProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { data: session } = useSession() || {}
  const role = (session?.user as any)?.role || ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const [packages, setPackages] = useState<PackageData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [revising, setRevising] = useState<string | null>(null)

  // Templates
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    notes: '',
    coverageActivation: 'on_signature',
  })
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [previewItems, setPreviewItems] = useState<{ treatmentId: string; procedureName: string; code: string; unitCost: number; quantity: number }[]>([])

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPackages(data.packages || [])
    } catch {
      console.error('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { fetchPackages() }, [fetchPackages])

  // Fetch templates when create dialog opens
  const openCreateDialog = async () => {
    setShowCreate(true)
    setSelectedTemplateId(null)
    setPreviewItems([])
    setCreateForm({ title: '', description: '', notes: '', coverageActivation: 'on_signature' })
    if (templates.length === 0) {
      setTemplatesLoading(true)
      try {
        const res = await fetch('/api/package-templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.data || [])
        }
      } catch { /* ignore */ }
      setTemplatesLoading(false)
    }
  }

  // Apply template to create form
  const applyTemplate = (tplId: string) => {
    if (tplId === '__blank__') {
      setSelectedTemplateId(null)
      setPreviewItems([])
      setCreateForm(prev => ({ ...prev, title: '', description: '' }))
      return
    }
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setSelectedTemplateId(tpl.id)
    setCreateForm(prev => ({
      ...prev,
      title: tpl.name,
      description: tpl.description || '',
    }))
    setPreviewItems(
      tpl.procedures.map(p => ({
        treatmentId: p.treatmentId,
        procedureName: p.treatment.name,
        code: p.treatment.treatmentCode,
        unitCost: p.overridePrice !== null && p.overridePrice !== undefined
          ? Number(p.overridePrice)
          : Number(p.treatment.baseCost),
        quantity: 1,
      }))
    )
  }

  const removePreviewItem = (idx: number) => {
    setPreviewItems(prev => prev.filter((_, i) => i !== idx))
  }

  const updatePreviewItemCost = (idx: number, cost: number) => {
    setPreviewItems(prev => prev.map((item, i) => i === idx ? { ...item, unitCost: cost } : item))
  }

  const previewTotal = previewItems.reduce((s, p) => s + (p.unitCost * p.quantity), 0)

  const createPackage = async () => {
    if (!createForm.title.trim()) {
      toast({ title: 'Error', description: 'Package title is required', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const items = previewItems.map((p, idx) => ({
        treatmentId: p.treatmentId,
        procedureName: p.procedureName,
        quantity: p.quantity,
        unitCost: p.unitCost,
        adjustedCost: p.unitCost * p.quantity,
        coverageType: 'not_covered',
        coveredAmount: 0,
        patientCost: p.unitCost * p.quantity,
        sortOrder: idx,
        notes: p.code ? `Code: ${p.code}` : null,
      }))

      const res = await fetch(`/api/patients/${patientId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          items,
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPackages(prev => [data.package, ...prev])
      setShowCreate(false)
      setExpandedId(data.package.id)
      onPackageChanged?.()
      toast({ title: 'Package created', description: `${data.package.packageNumber} — ${data.package.title}` })
    } catch {
      toast({ title: 'Error', description: 'Failed to create package', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (pkgId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${pkgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Failed')
      await fetchPackages()
      onPackageChanged?.()
      toast({ title: `Package ${newStatus}` })
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const deletePackage = async (pkgId: string) => {
    const ok = await confirm({
      title: 'Delete treatment package?',
      description: 'This action cannot be undone. All package data and associated procedures will be permanently removed.',
      confirmLabel: 'Delete Package',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${pkgId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      setPackages(prev => prev.filter(p => p.id !== pkgId))
      onPackageChanged?.()
      toast({ title: 'Package deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Admin override: reopen a completed/cancelled package back to active
  const reopenPackage = async (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId)
    const isCompleted = pkg?.status === 'completed'
    const ok = await confirm({
      title: 'Reopen this package?',
      description: isCompleted
        ? 'This will revert the package from Completed back to Active. The completion date will be cleared and you can edit, add, or remove procedures again.'
        : 'This will revert the package from Cancelled back to Active. You can edit, add, or remove procedures again.',
      confirmLabel: 'Reopen Package',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${pkgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      await fetchPackages()
      onPackageChanged?.()
      toast({ title: 'Package reopened', description: 'It is now active and can be edited.' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to reopen package', variant: 'destructive' })
    }
  }

  const revisePackage = async (pkgId: string) => {
    setRevising(pkgId)
    try {
      const res = await fetch(`/api/patients/${patientId}/packages/${pkgId}/revise`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      const data = await res.json()
      toast({ title: 'Revision created', description: `${data.revised.packageNumber} created as revision. Original cancelled.` })
      await fetchPackages()
      setExpandedId(data.revised.id)
      onPackageChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setRevising(null)
    }
  }

  const activePackage = packages.find(p => ['active', 'in_progress'].includes(p.status))

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-[#2D9DA8]" />
          Treatment Packages
          <Badge variant="outline" className="ml-1">{packages.length}</Badge>
        </h3>
        <Button size="sm" onClick={openCreateDialog} className="bg-[#2D9DA8] hover:bg-[#258a93]">
          <Plus className="w-3 h-3 mr-1" />New Package
        </Button>
      </div>

      {/* Active Package Highlight */}
      {activePackage && (
        <div className="bg-gradient-to-r from-[#2D9DA8]/5 to-[#22B573]/5 border border-[#2D9DA8]/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700">Active Package</Badge>
              <span className="font-medium text-sm">{activePackage.title}</span>
            </div>
            <span className="text-xs text-gray-500">{activePackage.packageNumber}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="font-semibold text-sm">₱{Number(activePackage.totalAmount).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Paid</div>
              <div className="font-semibold text-sm text-green-600">₱{Number(activePackage.paidAmount).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Balance</div>
              <div className="font-semibold text-sm text-[#2D9DA8]">₱{Number(activePackage.balanceDue).toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-[#22B573] h-1.5 rounded-full transition-all"
                style={{
                  width: `${Number(activePackage.patientPayable) > 0
                    ? Math.min(100, (Number(activePackage.paidAmount) / Number(activePackage.patientPayable)) * 100)
                    : 0}%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Packages List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[#2D9DA8]" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No treatment packages yet</p>
          <p className="text-xs mt-1">Create a package to group procedures and track payments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map(pkg => {
            const sc = statusConfig[pkg.status] || statusConfig.draft
            const Icon = sc.icon
            const isExpanded = expandedId === pkg.id
            return (
              <div key={pkg.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{pkg.title}</div>
                      <div className="text-xs text-gray-500">{pkg.packageNumber} • {pkg.items.length} procedures</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={sc.color}>{sc.label}</Badge>
                    <span className="font-semibold text-sm">₱{Number(pkg.patientPayable).toLocaleString()}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-gray-50/50 p-3 space-y-3">
                    {/* Admin override notice for locked packages */}
                    {isAdmin && (pkg.status === 'completed' || pkg.status === 'cancelled') && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <Unlock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          <strong>Admin override active.</strong> You can edit, reopen, or delete this {pkg.status} package.
                        </span>
                      </div>
                    )}

                    {/* Treatment Builder */}
                    <TreatmentBuilder
                      patientId={patientId}
                      packageId={pkg.id}
                      items={pkg.items}
                      readOnly={!isAdmin && (pkg.status === 'completed' || pkg.status === 'cancelled')}
                      onItemsChanged={fetchPackages}
                    />

                    {/* Payment Summary */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white rounded-lg p-2 border">
                        <div className="text-xs text-gray-500">Paid</div>
                        <div className="font-semibold text-green-600">₱{Number(pkg.paidAmount).toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <div className="text-xs text-gray-500">Balance Due</div>
                        <div className="font-semibold text-[#2D9DA8]">₱{Number(pkg.balanceDue).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {pkg.status === 'draft' && (
                        <>
                          <Button size="sm" onClick={() => updateStatus(pkg.id, 'active')} className="bg-[#2D9DA8] hover:bg-[#258a93]">
                            <Play className="w-3 h-3 mr-1" />Activate
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deletePackage(pkg.id)}>
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </>
                      )}
                      {['active', 'in_progress'].includes(pkg.status) && (
                        <>
                          {Number(pkg.balanceDue) > 0 && onRecordPayment && (
                            <Button size="sm" onClick={() => onRecordPayment(pkg.id, Number(pkg.balanceDue))} className="bg-[#22B573] hover:bg-[#1da066]">
                              <DollarSign className="w-3 h-3 mr-1" />Record Payment
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => revisePackage(pkg.id)} disabled={revising === pkg.id}>
                            {revising === pkg.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                            Revise
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(pkg.id, 'completed')}>
                            <CheckCircle className="w-3 h-3 mr-1" />Complete
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => updateStatus(pkg.id, 'cancelled')}>
                            Cancel
                          </Button>
                          {/* Admin can also delete active/in-progress packages */}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => deletePackage(pkg.id)} title="Admin override: delete this package">
                              <Trash2 className="w-3 h-3 mr-1" />Delete
                            </Button>
                          )}
                        </>
                      )}
                      {/* Admin overrides for completed/cancelled packages */}
                      {isAdmin && (pkg.status === 'completed' || pkg.status === 'cancelled') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#2D9DA8] text-[#2D9DA8] hover:bg-[#2D9DA8]/10"
                            onClick={() => reopenPackage(pkg.id)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reopen
                          </Button>
                          {Number(pkg.balanceDue) > 0 && onRecordPayment && (
                            <Button size="sm" onClick={() => onRecordPayment(pkg.id, Number(pkg.balanceDue))} className="bg-[#22B573] hover:bg-[#1da066]">
                              <DollarSign className="w-3 h-3 mr-1" />Record Payment
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => deletePackage(pkg.id)}
                            title="Admin override: delete this package"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog — Enhanced with Template Selection */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#2D9DA8]" />
              Create Treatment Package
            </DialogTitle>
            <DialogDescription>Pick a template to auto-populate procedures, or start from blank.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <Label className="text-sm font-medium">Start from Template</Label>
              {templatesLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
                </div>
              ) : templates.length > 0 ? (
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate('__blank__')}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                      !selectedTemplateId ? 'border-[#2D9DA8] bg-[#2D9DA8]/5 ring-1 ring-[#2D9DA8]/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Blank Package</p>
                      <p className="text-xs text-gray-500">Start empty, add procedures later</p>
                    </div>
                  </button>
                  {templates.map(tpl => {
                    const total = tpl.procedures.reduce((s, p) => {
                      const cost = p.overridePrice !== null && p.overridePrice !== undefined ? Number(p.overridePrice) : Number(p.treatment.baseCost)
                      return s + cost
                    }, 0)
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          selectedTemplateId === tpl.id ? 'border-[#2D9DA8] bg-[#2D9DA8]/5 ring-1 ring-[#2D9DA8]/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <LayoutTemplate className="w-4 h-4 text-[#22B573] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{tpl.name}</p>
                            <span className="text-xs font-semibold text-[#22B573] whitespace-nowrap">₱{total.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-gray-500">{tpl.procedures.length} procedures</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">No templates available. You can create them in Admin → Package Templates.</p>
              )}
            </div>

            {/* Pre-populated procedures preview */}
            {previewItems.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Procedures ({previewItems.length})</Label>
                <div className="mt-1.5 space-y-1 max-h-44 overflow-y-auto">
                  {previewItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{item.procedureName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.code}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs">₱</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.unitCost}
                          onChange={e => updatePreviewItemCost(idx, e.target.value === '' ? 0 : Number(e.target.value))}
                          className="h-7 w-24 text-xs text-right"
                        />
                        <button type="button" onClick={() => removePreviewItem(idx)} className="text-red-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-xs text-gray-500">{previewItems.length} procedures</span>
                  <span className="text-sm font-semibold text-[#22B573]">Total: ₱{previewTotal.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Title & Description */}
            <div>
              <Label>Package Title *</Label>
              <Input
                placeholder="e.g., Orthodontic Treatment Plan"
                value={createForm.title}
                onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the treatment plan..."
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Coverage Activation</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={createForm.coverageActivation}
                onChange={e => setCreateForm({ ...createForm, coverageActivation: e.target.value })}
              >
                <option value="on_signature">On Consent Signature</option>
                <option value="on_downpayment">On Downpayment</option>
                <option value="on_full_payment">On Full Payment</option>
                <option value="immediate">Immediate (on activation)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">When should coverage deductions become effective</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal notes..."
                value={createForm.notes}
                onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createPackage} disabled={creating} className="bg-[#2D9DA8] hover:bg-[#258a93]">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create{previewItems.length > 0 ? ` (${previewItems.length} procedures)` : ' Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

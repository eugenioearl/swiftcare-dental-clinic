'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { Plus, Pencil, Trash2, Clock, Globe, Package, Tag, Layers, ShieldCheck, CalendarDays, Stethoscope, FileText, Star, Check, Power } from 'lucide-react'

interface ClinicService {
  id: string
  name: string
  displayName?: string | null
  description: string | null
  category?: string | null
  tagalog?: string | null
  duration: number
  isActive: boolean
  websiteVisible: boolean
  isOfficial: boolean
  sortOrder: number
  estimatedPrice?: string | number | null
  priceMin?: string | number | null
  priceMax?: string | number | null
  priceDisplay?: string | null
  showPrice?: boolean
  imageUrl?: string | null
  linkedTreatmentIds?: string[] | null
  linkedPackageTemplateIds?: string[] | null
  linkedFormTemplateKeys?: string[] | null
  defaultAppointmentType?: string | null
  defaultPlanTitle?: string | null
  defaultPlanPhases?: any[] | null
}

interface Treatment { id: string; name: string; treatmentCode: string; category: string; baseCost: number }
interface PackageTemplate { id: string; name: string; isActive: boolean }
interface FormTemplateLite { key: string; title: string; category: string }

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'x_ray', label: 'X-Ray' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
]

const SERVICE_CATEGORIES = [
  'Diagnostic', 'Preventive', 'Restorative', 'Endodontic', 'Oral Surgery',
  'Orthodontic', 'Prosthodontic', 'Cosmetic', 'Pediatric', 'Periodontic',
]

const emptyForm = () => ({
  name: '',
  displayName: '',
  description: '',
  category: 'Preventive',
  tagalog: '',
  duration: 30,
  isActive: true,
  websiteVisible: true,
  estimatedPrice: '' as number | string,
  priceMin: '' as number | string,
  priceMax: '' as number | string,
  priceDisplay: '',
  showPrice: true,
  imageUrl: '',
  linkedTreatmentIds: [] as string[],
  linkedPackageTemplateIds: [] as string[],
  linkedFormTemplateKeys: [] as string[],
  defaultAppointmentType: 'consultation',
  defaultPlanTitle: '',
})

export default function AdminServicesPage() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [services, setServices] = useState<ClinicService[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [packages, setPackages] = useState<PackageTemplate[]>([])
  const [formTemplates, setFormTemplates] = useState<FormTemplateLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingService, setEditingService] = useState<ClinicService | null>(null)
  const [formData, setFormData] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchServices = useCallback(async () => {
    try {
      const [svcRes, txRes, pkRes, ftRes] = await Promise.all([
        fetch('/api/admin/services'),
        fetch('/api/treatments'),
        fetch('/api/package-templates'),
        fetch('/api/form-templates'),
      ])
      if (svcRes.ok) {
        const d = await svcRes.json()
        setServices(d.data?.services || [])
      }
      if (txRes.ok) {
        const d = await txRes.json()
        const list = d.data?.treatments || d.treatments || []
        setTreatments(list.map((t: any) => ({
          id: t.id,
          name: t.name,
          treatmentCode: t.treatmentCode || '',
          category: t.category || '',
          baseCost: Number(t.baseCost || 0),
        })))
      }
      if (pkRes.ok) {
        const d = await pkRes.json()
        const list = d.data?.packageTemplates || d.packageTemplates || d.data || []
        setPackages(list.map((p: any) => ({ id: p.id, name: p.name, isActive: !!p.isActive })))
      }
      if (ftRes.ok) {
        const d = await ftRes.json()
        const list = d.data?.templates || d.templates || []
        setFormTemplates(list.map((t: any) => ({ key: t.key, title: t.title, category: t.category || '' })))
      }
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user && ['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      fetchServices()
    }
  }, [session, fetchServices])

  const openNew = () => {
    setEditingService(null)
    setFormData(emptyForm())
    setShowDialog(true)
  }

  const openEdit = (service: ClinicService) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      displayName: service.displayName || '',
      description: service.description || '',
      category: service.category || 'Preventive',
      tagalog: service.tagalog || '',
      duration: service.duration,
      isActive: service.isActive,
      websiteVisible: service.websiteVisible,
      estimatedPrice: service.estimatedPrice ? String(service.estimatedPrice) : '',
      priceMin: service.priceMin ? String(service.priceMin) : '',
      priceMax: service.priceMax ? String(service.priceMax) : '',
      priceDisplay: service.priceDisplay || '',
      showPrice: service.showPrice !== false,
      imageUrl: service.imageUrl || '',
      linkedTreatmentIds: service.linkedTreatmentIds || [],
      linkedPackageTemplateIds: service.linkedPackageTemplateIds || [],
      linkedFormTemplateKeys: service.linkedFormTemplateKeys || [],
      defaultAppointmentType: service.defaultAppointmentType || 'consultation',
      defaultPlanTitle: service.defaultPlanTitle || '',
    })
    setShowDialog(true)
  }

  const toggleArr = (arr: string[], v: string): string[] =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Service name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = '/api/admin/services'
      const method = editingService ? 'PATCH' : 'POST'
      const payload: any = {
        ...formData,
        estimatedPrice: formData.estimatedPrice === '' ? undefined : Number(formData.estimatedPrice),
        priceMin: formData.priceMin === '' ? undefined : Number(formData.priceMin),
        priceMax: formData.priceMax === '' ? undefined : Number(formData.priceMax),
        duration: Number(formData.duration) || 30,
      }
      const body = editingService
        ? { id: editingService.id, ...payload }
        : { ...payload, sortOrder: services.length }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast({ title: 'Success', description: editingService ? 'Service updated' : 'Service created' })
        fetchServices()
        setShowDialog(false)
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to save', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (service: ClinicService) => {
    const isOfficial = !!service.isOfficial
    const ok = await confirm({
      title: isOfficial ? `Deactivate "${service.name}"?` : `Delete "${service.name}"?`,
      description: isOfficial
        ? `Official services are hidden from booking but preserved for history.`
        : `This service will be permanently removed. This action cannot be undone.`,
      confirmLabel: isOfficial ? 'Deactivate' : 'Delete',
      variant: isOfficial ? 'warning' : 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch('/api/admin/services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id })
      })
      if (res.ok) {
        const d = await res.json()
        toast({ title: 'Done', description: d.message || 'Service updated' })
        fetchServices()
      } else {
        toast({ title: 'Error', description: 'Failed to remove service', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' })
    }
  }

  const handleToggle = async (service: ClinicService) => {
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, isActive: !service.isActive })
      })
      if (res.ok) {
        toast({ title: 'Updated', description: `Service ${service.isActive ? 'disabled' : 'enabled'}` })
        fetchServices()
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Clinic Services">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Clinic Services">
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#2D9DA8]" />
              Clinic Services
            </h1>
            <p className="text-gray-500 text-sm">The official clinic offering layer — visible on website, used for booking, and connected to procedures, packages, forms and treatment plans.</p>
          </div>
          <Button onClick={openNew} className="bg-[#2D9DA8] hover:bg-[#258a94] text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Service
          </Button>
        </div>

        <Card className="border-0 bg-gradient-to-br from-teal-50 to-white shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-teal-600" /><span className="text-gray-700"><b>{services.filter(s => s.isOfficial).length}</b> official services</span></div>
              <div className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-600" /><span className="text-gray-700"><b>{services.filter(s => s.websiteVisible && s.isActive).length}</b> visible on website</span></div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /><span className="text-gray-700"><b>{services.filter(s => s.isActive).length}</b> active for booking</span></div>
            </div>
            <p className="text-xs text-gray-500 pt-1">Service prices are <b>estimates</b> shown on the website. Final quotes stay editable during treatment planning.</p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {services.map((service) => {
            const linkedProcCount = (service.linkedTreatmentIds || []).length
            const linkedPkgCount = (service.linkedPackageTemplateIds || []).length
            const linkedFormCount = (service.linkedFormTemplateKeys || []).length
            const priceLabel = service.priceDisplay ||
              (service.estimatedPrice ? `Starting at ₱${Number(service.estimatedPrice).toLocaleString()}` : '—')
            return (
              <Card key={service.id} className={`border shadow-sm transition ${!service.isActive ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{service.displayName || service.name}</h3>
                        {service.tagalog && <span className="text-xs text-gray-400 italic">({service.tagalog})</span>}
                        {service.isOfficial && (
                          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100"><Star className="w-3 h-3 mr-0.5" />Official</Badge>
                        )}
                        <Badge className={service.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-100'}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {service.websiteVisible ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Globe className="w-3 h-3 mr-0.5" />On website</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">Hidden</Badge>
                        )}
                        {service.category && <Badge variant="outline" className="text-xs"><Tag className="w-3 h-3 mr-0.5" />{service.category}</Badge>}
                      </div>
                      {service.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                      )}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{service.duration} min</span>
                        <span className="flex items-center gap-1 font-medium text-gray-700">{priceLabel}</span>
                        <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" />{linkedProcCount} procedures</span>
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{linkedPkgCount} packages</span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{linkedFormCount} forms</span>
                        {service.defaultAppointmentType && (
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{service.defaultAppointmentType}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(service)} title={service.isActive ? 'Disable' : 'Enable'} className="h-9 w-9 p-0">
                        <Power className={`w-4 h-4 ${service.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(service)} className="h-9 w-9 p-0">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-9 w-9 p-0" onClick={() => handleDelete(service)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {services.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No services configured yet. Add your first service.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add/Edit Service Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="general" className="mt-2">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs sm:text-sm">Pricing</TabsTrigger>
                <TabsTrigger value="linkages" className="text-xs sm:text-sm">Linkages</TabsTrigger>
                <TabsTrigger value="planning" className="text-xs sm:text-sm">Planning</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Service Name *</label>
                    <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Oral Prophylaxis (Linis)" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Display Name</label>
                    <Input value={formData.displayName} onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))} placeholder="Short name shown on booking" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <select value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                      className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                      {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tagalog Name</label>
                    <Input value={formData.tagalog} onChange={e => setFormData(f => ({ ...f, tagalog: e.target.value }))} placeholder="e.g., Linis" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Customer-facing description (shows on website + booking)" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Duration (minutes)</label>
                    <Input type="number" value={formData.duration} onChange={e => setFormData(f => ({ ...f, duration: parseInt(e.target.value) || 30 }))} min={5} max={480} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Service Image</label>
                    <div className="flex gap-2 items-start mt-1">
                      {formData.imageUrl ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={formData.imageUrl.startsWith('/') || formData.imageUrl.startsWith('http') ? formData.imageUrl : `/api/admin/services/image-preview?key=${encodeURIComponent(formData.imageUrl)}`}
                            alt="preview"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      ) : null}
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            const fd = new FormData()
                            fd.append('file', f)
                            try {
                              const res = await fetch('/api/admin/services/upload-image', { method: 'POST', body: fd })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Upload failed')
                              setFormData(prev => ({ ...prev, imageUrl: data.cloudStoragePath }))
                              toast({ title: 'Image uploaded', description: 'Click Save to apply.' })
                            } catch (err: any) {
                              toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
                            } finally {
                              e.target.value = ''
                            }
                          }}
                          className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#2D9DA8]/10 file:text-[#2D9DA8] hover:file:bg-[#2D9DA8]/20 cursor-pointer"
                        />
                        <Input
                          value={formData.imageUrl}
                          onChange={e => setFormData(f => ({ ...f, imageUrl: e.target.value }))}
                          placeholder="or paste URL: /services/your-image.jpg"
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">JPG / PNG / WebP, max 5MB</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-sm">Active for booking</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.websiteVisible} onChange={e => setFormData(f => ({ ...f, websiteVisible: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-sm">Website visible</span>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 py-4">
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-3 text-xs text-amber-800">
                    ℹ️ Service price is a <b>sample / estimate</b> shown on the website &amp; booking. Final pricing remains editable during treatment planning — use procedure or package pricing for actual quotes.
                  </CardContent>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Estimated Price (₱)</label>
                    <Input type="number" value={formData.estimatedPrice} onChange={e => setFormData(f => ({ ...f, estimatedPrice: e.target.value }))} placeholder="e.g., 2000" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price Min (₱)</label>
                    <Input type="number" value={formData.priceMin} onChange={e => setFormData(f => ({ ...f, priceMin: e.target.value }))} placeholder="optional" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price Max (₱)</label>
                    <Input type="number" value={formData.priceMax} onChange={e => setFormData(f => ({ ...f, priceMax: e.target.value }))} placeholder="optional" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Price Display Label</label>
                  <Input value={formData.priceDisplay} onChange={e => setFormData(f => ({ ...f, priceDisplay: e.target.value }))} placeholder="e.g., Starting at ₱2,000  or  ₱8,000 – ₱15,000" />
                  <p className="text-xs text-gray-500 mt-1">If empty, the system auto-generates “Starting at ₱{'{estimated}'}”.</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showPrice}
                      onChange={e => setFormData(f => ({ ...f, showPrice: e.target.checked }))}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Show price on public website</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        When off, prices are hidden on the public landing page / booking site. Staff &amp; admins still see full pricing in admin views.
                      </p>
                    </div>
                  </label>
                </div>
                </div>
              </TabsContent>

              <TabsContent value="linkages" className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-1.5"><Stethoscope className="w-4 h-4 text-purple-600" />Linked Procedures ({formData.linkedTreatmentIds.length})</label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                    {treatments.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-white rounded cursor-pointer">
                        <input type="checkbox" className="w-4 h-4"
                          checked={formData.linkedTreatmentIds.includes(t.id)}
                          onChange={() => setFormData(f => ({ ...f, linkedTreatmentIds: toggleArr(f.linkedTreatmentIds, t.id) }))} />
                        <span className="font-mono text-xs text-gray-500">{t.treatmentCode}</span>
                        <span>{t.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">₱{t.baseCost.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-1.5"><Package className="w-4 h-4 text-emerald-600" />Linked Package Templates ({formData.linkedPackageTemplateIds.length})</label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                    {packages.filter(p => p.isActive).map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-white rounded cursor-pointer">
                        <input type="checkbox" className="w-4 h-4"
                          checked={formData.linkedPackageTemplateIds.includes(p.id)}
                          onChange={() => setFormData(f => ({ ...f, linkedPackageTemplateIds: toggleArr(f.linkedPackageTemplateIds, p.id) }))} />
                        <span>{p.name}</span>
                      </label>
                    ))}
                    {packages.length === 0 && <p className="text-xs text-gray-400 p-2">No package templates yet.</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-amber-600" />Required Forms ({formData.linkedFormTemplateKeys.length})</label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                    {formTemplates.map(f => (
                      <label key={f.key} className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-white rounded cursor-pointer">
                        <input type="checkbox" className="w-4 h-4"
                          checked={formData.linkedFormTemplateKeys.includes(f.key)}
                          onChange={() => setFormData(fd => ({ ...fd, linkedFormTemplateKeys: toggleArr(fd.linkedFormTemplateKeys, f.key) }))} />
                        <span>{f.title}</span>
                        <span className="text-xs text-gray-400 ml-auto">{f.category}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">When an appointment uses this service, these forms are auto-attached on check-in. Dedup is applied — the same form won’t be created twice.</p>
                </div>
              </TabsContent>

              <TabsContent value="planning" className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Default Appointment Type</label>
                  <select value={formData.defaultAppointmentType} onChange={e => setFormData(f => ({ ...f, defaultAppointmentType: e.target.value }))}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                    {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">When this service is booked, the new appointment is created with this type by default.</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Default Treatment Plan Title</label>
                  <Input value={formData.defaultPlanTitle} onChange={e => setFormData(f => ({ ...f, defaultPlanTitle: e.target.value }))} placeholder="e.g., Root Canal + Restoration Plan" />
                  <p className="text-xs text-gray-500 mt-1">If set, patient planning can use this as a suggested starting plan title. Phase templates can be configured at the database level.</p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#2D9DA8] hover:bg-[#258a94] text-white">
                {saving ? 'Saving...' : editingService ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
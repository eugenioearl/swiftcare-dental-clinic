'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  LayoutDashboard, Image as ImageIcon, Megaphone, Building2, Save, Loader2,
  Plus, Pencil, Trash2, Eye, EyeOff, Pin, AlertCircle, Info, CheckCircle,
  AlertTriangle, Upload, X, Calendar, Clock, Users, FileText, Stethoscope,
  Bell, Shield, Search, ChevronRight, ExternalLink, TrendingUp, Settings,
} from 'lucide-react'
import Image from 'next/image'

// ─── Types ───
export interface Announcement {
  id: string
  title: string
  subtitle: string | null
  content: string
  calloutText: string | null
  type: string
  placement: string[]
  displayMode?: string | null
  isActive: boolean
  isPinned: boolean
  startDate: string | null
  endDate: string | null
  imageUrl: string | null
  cloudStoragePath: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemSettingMap {
  [key: string]: string
}

export const PLACEMENT_OPTIONS = [
  { value: 'homepage', label: 'Homepage / Landing Page' },
  { value: 'dashboard', label: 'Admin Dashboard' },
  { value: 'staff_dashboard', label: 'Staff Dashboard' },
  { value: 'login', label: 'Login Page' },
  { value: 'patient_forms', label: 'Patient Forms' },
  { value: 'admin', label: 'Admin Panel' },
  { value: 'queue_monitor', label: 'Queue Monitor' },
]

export const TYPE_OPTIONS = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-800', icon: Info },
  { value: 'warning', label: 'Warning', color: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
  { value: 'success', label: 'Success', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800', icon: AlertCircle },
]

export const DISPLAY_MODE_OPTIONS = [
  {
    value: 'banner',
    label: 'Banner',
    desc: 'Full-width image, no cropping. Best for posters, schedules, and text-heavy images.',
  },
  {
    value: 'standard',
    label: 'Standard',
    desc: 'Small thumbnail + text side-by-side. Good for short notices.',
  },
  {
    value: 'text_only',
    label: 'Text Only',
    desc: 'No image, just text. Best for quick alerts.',
  },
]

export function BrandingTab({ settings, onSettingsChange }: { settings: SystemSettingMap; onSettingsChange: () => void }) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clinic info settings editable here
  const [clinicName, setClinicName] = useState('')
  const [tagline, setTagline] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  useEffect(() => {
    setClinicName(settings.clinic_name || '')
    setTagline(settings.branding_tagline || '')
    setLogoPreview(settings.branding_logo_url || null)
  }, [settings])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File too large (max 5MB)', variant: 'destructive' })
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast({ title: 'Error', description: 'Only JPG, PNG, WebP, SVG allowed', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const res = await fetch('/api/admin/branding/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setLogoPreview(data.url)
      onSettingsChange()
      toast({ title: 'Logo Updated', description: 'Your new clinic logo has been uploaded and saved.' })
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveBrandingSettings = async () => {
    setSavingInfo(true)
    try {
      const settingsToSave = [
        { key: 'clinic_name', value: clinicName },
        { key: 'branding_tagline', value: tagline },
      ]
      for (const s of settingsToSave) {
        // Upsert via settings API
        const res = await fetch('/api/settings')
        const all = await res.json()
        const existing = all.data?.settings?.find((x: any) => x.settingKey === s.key)
        if (existing) {
          await fetch(`/api/settings/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settingValue: s.value }),
          })
        } else {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settingKey: s.key, settingValue: s.value, dataType: 'string', isPublic: true }),
          })
        }
      }
      onSettingsChange()
      toast({ title: 'Saved', description: 'Branding settings updated.' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    } finally {
      setSavingInfo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="w-5 h-5" /> Clinic Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Current Logo Preview */}
            <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ minWidth: 280, minHeight: 140 }}>
              <div className="relative w-72 h-36 rounded-lg overflow-hidden" style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}>
                {/* Checkerboard background shows transparency */}
                <Image
                  src={logoPreview || '/clinic/logo.png'}
                  alt="Clinic Logo"
                  fill
                  className="object-contain"
                  unoptimized={!!logoPreview}
                />
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a new clinic logo. Recommended: PNG with transparent background, at least 820×313px. Supported: JPG, PNG, WebP, SVG (max 5MB).
              </p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                The logo appears on the homepage header, footer, login page, forms, and queue monitor.
              </p>
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Info className="w-3 h-3" />
                For best results, use a PNG with a transparent background so it blends into any page color.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Upload New Logo</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinic Name & Tagline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" /> Clinic Name & Tagline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Clinic Name</label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="SwiftCare Dental Clinic"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tagline / Subtitle</label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Your smile is our priority"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveBrandingSettings} disabled={savingInfo}>
              {savingInfo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Announcement Preview Card ───
function AnnouncementPreviewCard({
  title, subtitle, content, calloutText, imageUrl, type, displayMode = 'standard', isPinned = false,
}: {
  title: string
  subtitle: string
  content: string
  calloutText: string
  imageUrl: string | null
  type: string
  displayMode?: string
  isPinned?: boolean
}) {
  const tcfg = TYPE_OPTIONS.find(t => t.value === type) || TYPE_OPTIONS[0]
  const TIcon = tcfg.icon
  const hasImage = !!imageUrl
  const mode = (displayMode || 'standard').toLowerCase()
  const isBanner = hasImage && mode === 'banner'
  const isTextOnly = mode === 'text_only' || !hasImage

  // Map type → pastel card colors like the live banner
  const typeBg: Record<string, { bg: string; border: string; text: string; subText: string }> = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', subText: 'text-blue-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', subText: 'text-amber-700' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', subText: 'text-emerald-700' },
    urgent: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', subText: 'text-red-700' },
  }
  const colors = typeBg[type] || typeBg.info

  if (isBanner) {
    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg overflow-hidden relative shadow-sm`}>
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl!}
            alt={title || 'Announcement image'}
            className="w-full h-auto object-contain bg-white/40 max-h-[600px]"
          />
          {calloutText && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 shadow-lg uppercase tracking-wide">
                {calloutText}
              </span>
            </div>
          )}
          {isPinned && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 text-gray-800 shadow">
                <Pin className="w-3 h-3" /> PINNED
              </span>
            </div>
          )}
        </div>
        <div className="p-3 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TIcon className={`w-4 h-4 ${colors.text}`} />
              <p className={`font-semibold text-sm ${colors.text}`}>{title || 'Untitled Announcement'}</p>
            </div>
            {subtitle && <p className={`text-xs font-medium ${colors.subText} opacity-90 mt-0.5`}>{subtitle}</p>}
            {content && <p className={`text-sm ${colors.text} opacity-80 mt-1 whitespace-pre-line`}>{content}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (isTextOnly) {
    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg overflow-hidden relative`}>
        <div className="flex items-start gap-3 p-3">
          <TIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colors.text}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold text-sm ${colors.text}`}>{title || 'Untitled Announcement'}</p>
              {calloutText && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-wide">
                  {calloutText}
                </span>
              )}
              {isPinned && <Pin className={`w-3 h-3 ${colors.text} opacity-60`} />}
            </div>
            {subtitle && <p className={`text-xs font-medium ${colors.subText} opacity-90 mt-0.5`}>{subtitle}</p>}
            <p className={`text-sm ${colors.text} opacity-80 mt-0.5 whitespace-pre-line`}>{content || 'No content provided.'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Standard mode
  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg overflow-hidden relative`}>
      <div className="flex items-start gap-3 p-3">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-white/40">
          <Image src={imageUrl!} alt={title || 'Announcement'} fill className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-sm ${colors.text}`}>{title || 'Untitled Announcement'}</p>
            {calloutText && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-wide">
                {calloutText}
              </span>
            )}
            {isPinned && <Pin className={`w-3 h-3 ${colors.text} opacity-60`} />}
          </div>
          {subtitle && <p className={`text-xs font-medium ${colors.subText} opacity-90 mt-0.5`}>{subtitle}</p>}
          <p className={`text-sm ${colors.text} opacity-80 mt-0.5 whitespace-pre-line`}>{content || 'No content provided.'}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Announcements Tab ───
export function AnnouncementsTab({ announcements, onRefresh }: { announcements: Announcement[]; onRefresh: () => void }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    content: '',
    calloutText: '',
    type: 'info',
    placement: [] as string[],
    displayMode: 'standard',
    isActive: true,
    isPinned: false,
    startDate: '',
    endDate: '',
    imageUrl: '' as string | null | '',
    cloudStoragePath: '' as string | null | '',
  })
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

  const resetForm = () => {
    setForm({
      title: '', subtitle: '', content: '', calloutText: '', type: 'info', placement: [],
      displayMode: 'standard',
      isActive: true, isPinned: false, startDate: '', endDate: '',
      imageUrl: '', cloudStoragePath: '',
    })
    setImageDimensions(null)
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      subtitle: a.subtitle || '',
      content: a.content,
      calloutText: a.calloutText || '',
      type: a.type,
      placement: Array.isArray(a.placement) ? a.placement : [],
      displayMode: a.displayMode || 'standard',
      isActive: a.isActive,
      isPinned: a.isPinned,
      startDate: a.startDate ? a.startDate.slice(0, 16) : '',
      endDate: a.endDate ? a.endDate.slice(0, 16) : '',
      imageUrl: a.imageUrl || '',
      cloudStoragePath: a.cloudStoragePath || '',
    })
    setImageDimensions(null)
    setEditingId(a.id)
    setDialogOpen(true)
  }

  const handleImageUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPG, PNG, or WebP images are allowed.', variant: 'destructive' })
      return
    }
    const maxSize = 10 * 1024 * 1024 // Allow up to 10MB for text-heavy posters
    if (file.size > maxSize) {
      toast({ title: 'File too large', description: 'Max size is 10MB.', variant: 'destructive' })
      return
    }
    setImageUploading(true)
    try {
      // Read dimensions locally first
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const img = new window.Image()
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = ev.target?.result as string
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      setImageDimensions(dims)

      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/announcements/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // Auto-detect: switch to Standard mode if image is small or portrait (tall)
      const isSmall = dims.width < 500 || dims.height < 300
      const isPortrait = dims.height > dims.width * 1.3
      let suggestedMode = form.displayMode || 'standard'
      if (!editingId) {
        // Only auto-suggest on create, never override explicit choice in edit
        if (isSmall || isPortrait) {
          suggestedMode = 'standard'
        } else {
          suggestedMode = 'banner'
        }
      }

      setForm((prev) => ({
        ...prev,
        imageUrl: data.url,
        cloudStoragePath: data.cloudStoragePath,
        displayMode: suggestedMode,
      }))

      let descMsg = 'Announcement image is ready.'
      if (!editingId) {
        descMsg += isSmall
          ? ' (Small image — Standard Mode selected.)'
          : isPortrait
            ? ' (Portrait image — Standard Mode selected.)'
            : ' (Banner Mode selected — ideal for text-heavy images.)'
      }
      toast({ title: 'Image uploaded', description: descMsg })
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Failed to upload', variant: 'destructive' })
    } finally {
      setImageUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
  }

  const clearImage = () => {
    setForm((prev) => ({ ...prev, imageUrl: '', cloudStoragePath: '' }))
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Missing fields', description: 'Title and content are required.', variant: 'destructive' })
      return
    }
    // Validate date range
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      toast({ title: 'Invalid date range', description: 'End date must be after start date.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      // Fallback: if no image, force text_only
      const finalDisplayMode = form.imageUrl ? form.displayMode : 'text_only'
      const payload = {
        ...form,
        displayMode: finalDisplayMode,
        subtitle: form.subtitle.trim() || null,
        calloutText: form.calloutText.trim() || null,
        imageUrl: form.imageUrl || null,
        cloudStoragePath: form.cloudStoragePath || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      }
      const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed')
      }
      toast({ title: editingId ? 'Updated' : 'Created', description: `Announcement "${form.title}" ${editingId ? 'updated' : 'created'}.` })
      setDialogOpen(false)
      resetForm()
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast({ title: 'Deleted', description: 'Announcement removed.' })
      setDeleteConfirmId(null)
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const toggleActive = async (a: Announcement) => {
    try {
      await fetch(`/api/admin/announcements/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !a.isActive }),
      })
      onRefresh()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' })
    }
  }

  const togglePin = async (a: Announcement) => {
    try {
      await fetch(`/api/admin/announcements/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !a.isPinned }),
      })
      onRefresh()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to toggle pin', variant: 'destructive' })
    }
  }

  const togglePlacement = (value: string) => {
    setForm(prev => ({
      ...prev,
      placement: prev.placement.includes(value)
        ? prev.placement.filter(p => p !== value)
        : [...prev.placement, value],
    }))
  }

  const filtered = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Announcement
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No announcements yet.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Create First Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const tcfg = TYPE_OPTIONS.find(t => t.value === a.type) || TYPE_OPTIONS[0]
            const TIcon = tcfg.icon
            const placements = Array.isArray(a.placement) ? a.placement : []
            return (
              <Card key={a.id} className={`${!a.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {a.imageUrl ? (
                      <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.imageUrl}
                          alt={a.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (!img.dataset.retried) {
                              img.dataset.retried = '1'
                              // Refetch list to get fresh signed URLs
                              fetch('/api/admin/announcements', { cache: 'no-store' })
                                .then((r) => r.json())
                                .then((d) => {
                                  if (d.success && d.data) {
                                    const fresh = d.data.find((x: Announcement) => x.id === a.id)
                                    if (fresh?.imageUrl) img.src = fresh.imageUrl
                                    onRefresh()
                                  }
                                })
                                .catch(() => {})
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tcfg.color}`}>
                        <TIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm break-words">{a.title}</h3>
                        <Badge className={`${tcfg.color} text-[10px] sm:text-xs px-1.5 py-0`} variant="secondary">{tcfg.label}</Badge>
                        {a.calloutText && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-wide">
                            {a.calloutText}
                          </span>
                        )}
                        {a.isPinned && <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0"><Pin className="w-3 h-3 mr-0.5" />Pinned</Badge>}
                        {!a.isActive && <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">Inactive</Badge>}
                        {a.displayMode && a.displayMode !== 'standard' && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 capitalize border-teal-300 text-teal-700 bg-teal-50">
                            {a.displayMode.replace('_', ' ')} mode
                          </Badge>
                        )}
                      </div>
                      {a.subtitle && <p className="text-xs text-gray-600 font-medium mt-0.5 break-words">{a.subtitle}</p>}
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{a.content}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {placements.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">
                            {PLACEMENT_OPTIONS.find(o => o.value === p)?.label || p}
                          </Badge>
                        ))}
                        {a.startDate && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(a.startDate).toLocaleDateString()}
                            {a.endDate && ` — ${new Date(a.endDate).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => togglePin(a)} title={a.isPinned ? 'Unpin' : 'Pin'}>
                        <Pin className={`w-4 h-4 ${a.isPinned ? 'text-amber-600' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(a)} title={a.isActive ? 'Deactivate' : 'Activate'}>
                        {a.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(a.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Mobile-only action row */}
                  <div className="flex sm:hidden items-center justify-end gap-1 mt-3 pt-3 border-t">
                    <Button variant="ghost" size="sm" onClick={() => togglePin(a)} title={a.isPinned ? 'Unpin' : 'Pin'} className="h-8 px-2">
                      <Pin className={`w-4 h-4 ${a.isPinned ? 'text-amber-600' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(a)} title={a.isActive ? 'Deactivate' : 'Activate'} className="h-8 px-2">
                      {a.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="h-8 px-2">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(a.id)} className="h-8 px-2 text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } else setDialogOpen(true) }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
            <DialogDescription>Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subtitle <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="e.g., Important Update or Limited Time Offer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content *</label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the announcement message..." rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Callout Text <span className="text-xs text-muted-foreground font-normal">(optional — short badge, e.g., "NEW" or "50% OFF")</span></label>
              <Input value={form.calloutText} onChange={(e) => setForm({ ...form, calloutText: e.target.value })} placeholder="Short catchy badge text" maxLength={30} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Image <span className="text-xs text-muted-foreground font-normal">(optional, max 10MB — high-res posters OK)</span></label>
              {form.imageUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <div className="relative w-full bg-muted flex items-center justify-center" style={{ minHeight: '180px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.imageUrl}
                      alt="Announcement image preview"
                      className="w-full h-auto max-h-[360px] object-contain"
                    />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={imageUploading}>
                      <Upload className="w-3 h-3 mr-1" /> Replace
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={clearImage}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  {imageDimensions && (
                    <div className="px-3 py-2 bg-white border-t border-gray-200 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span className="font-medium text-gray-700">{imageDimensions.width} × {imageDimensions.height}px</span>
                      </span>
                      {imageDimensions.height > imageDimensions.width * 1.3 && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Portrait — Standard recommended</Badge>
                      )}
                      {(imageDimensions.width < 500 || imageDimensions.height < 300) && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Small — Standard recommended</Badge>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-teal-500 hover:bg-teal-50/30 transition-colors disabled:opacity-50"
                >
                  {imageUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-muted-foreground">Click to upload (JPG, PNG, WebP — up to 10MB)</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Display Mode Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Display Mode
                <span className="text-xs text-muted-foreground font-normal ml-2">(how this announcement is shown to users)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DISPLAY_MODE_OPTIONS.map((m) => {
                  const disabled = m.value !== 'text_only' && !form.imageUrl
                  return (
                    <button
                      key={m.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setForm({ ...form, displayMode: m.value })}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        form.displayMode === m.value
                          ? 'border-teal-500 bg-teal-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${form.displayMode === m.value ? 'bg-teal-500' : 'bg-gray-300'}`} />
                        <span className="font-semibold text-sm">{m.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{m.desc}</p>
                    </button>
                  )
                })}
              </div>
              {!form.imageUrl && (
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Upload an image to enable Banner and Standard modes.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <label className="text-sm">Active</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isPinned} onCheckedChange={(v) => setForm({ ...form, isPinned: v })} />
                  <label className="text-sm">Pinned</label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Display On</label>
              <div className="flex flex-wrap gap-2">
                {PLACEMENT_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlacement(p.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.placement.includes(p.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date (optional)</label>
                <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date (optional)</label>
                <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!form.title.trim() || !form.content.trim()}>
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog — Desktop + Mobile side-by-side */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Announcement Preview</DialogTitle>
            <DialogDescription>
              This is how your announcement will appear in <strong className="capitalize">{form.displayMode.replace('_', ' ')}</strong> mode.
              Desktop is shown on the left, mobile on the right.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Desktop preview */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <LayoutDashboard className="w-3 h-3" /> Desktop
              </div>
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                <AnnouncementPreviewCard
                  title={form.title}
                  subtitle={form.subtitle}
                  content={form.content}
                  calloutText={form.calloutText}
                  imageUrl={form.imageUrl || null}
                  type={form.type}
                  displayMode={form.displayMode}
                  isPinned={form.isPinned}
                />
              </div>
            </div>
            {/* Mobile preview */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Settings className="w-3 h-3" /> Mobile (375px)
              </div>
              <div className="mx-auto w-[300px] rounded-2xl border-4 border-gray-800 bg-gray-900 p-2 shadow-xl">
                <div className="rounded-xl bg-gray-50 p-2 max-h-[500px] overflow-y-auto">
                  <AnnouncementPreviewCard
                    title={form.title}
                    subtitle={form.subtitle}
                    content={form.content}
                    calloutText={form.calloutText}
                    imageUrl={form.imageUrl || null}
                    type={form.type}
                    displayMode={form.displayMode}
                    isPinned={form.isPinned}
                  />
                </div>
              </div>
            </div>
          </div>
          {form.imageUrl && form.displayMode === 'banner' && (
            <div className="px-4 py-2 rounded-md bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Banner Mode tip:</strong> Users can click the image to open a full-screen viewer with zoom, great for text-heavy images like schedules or posters.
              </span>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Clinic Info Tab ───
export function ClinicInfoTab({ settings, onSettingsChange }: { settings: SystemSettingMap; onSettingsChange: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState({
    clinic_name: '', clinic_phone: '', clinic_email: '', clinic_address: '',
    facebook_url: '', instagram_url: '', google_maps_url: '',
    emergency_contact: '', about_us: '', mission_vision: '',
  })

  useEffect(() => {
    setInfo({
      clinic_name: settings.clinic_name || '',
      clinic_phone: settings.clinic_phone || '',
      clinic_email: settings.clinic_email || '',
      clinic_address: settings.clinic_address || '',
      facebook_url: settings.facebook_url || '',
      instagram_url: settings.instagram_url || '',
      google_maps_url: settings.google_maps_url || '',
      emergency_contact: settings.emergency_contact || '',
      about_us: settings.about_us || '',
      mission_vision: settings.mission_vision || '',
    })
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings')
      const all = await res.json()
      const existing = all.data?.settings || []

      for (const [key, value] of Object.entries(info)) {
        const found = existing.find((s: any) => s.settingKey === key)
        if (found) {
          await fetch(`/api/settings/${found.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settingValue: value }),
          })
        } else if (value) {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settingKey: key, settingValue: value, dataType: 'string', isPublic: true }),
          })
        }
      }
      onSettingsChange()
      toast({ title: 'Saved', description: 'Clinic information updated.' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'clinic_name', label: 'Clinic Name', type: 'text' },
    { key: 'clinic_phone', label: 'Phone Number', type: 'text' },
    { key: 'clinic_email', label: 'Email Address', type: 'email' },
    { key: 'clinic_address', label: 'Address', type: 'text' },
    { key: 'facebook_url', label: 'Facebook Page URL', type: 'url' },
    { key: 'instagram_url', label: 'Instagram URL', type: 'url' },
    { key: 'google_maps_url', label: 'Google Maps Link', type: 'url' },
    { key: 'emergency_contact', label: 'Emergency Contact', type: 'text' },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" /> Clinic Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                <Input
                  type={f.type}
                  value={(info as any)[f.key]}
                  onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">About Us</label>
            <Textarea
              value={info.about_us}
              onChange={(e) => setInfo({ ...info, about_us: e.target.value })}
              placeholder="Brief clinic description..."
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mission / Vision</label>
            <Textarea
              value={info.mission_vision}
              onChange={(e) => setInfo({ ...info, mission_vision: e.target.value })}
              placeholder="Our mission is..."
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Clinic Info
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ───

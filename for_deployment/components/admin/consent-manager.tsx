'use client'

import { formatDisplayName, copyToClipboard } from '@/lib/utils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText, Plus, Loader2, Copy, ExternalLink, Eye, CheckCircle, Clock,
  AlertCircle, PenTool, Send, QrCode, Download, XCircle, Shield, Mail, Trash2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useConfirm } from '@/components/providers/confirm-provider'

interface ConsentData {
  id: string
  consentNumber: string
  title: string
  description: string | null
  formContent: string
  formFields: any[] | null
  formResponses: Record<string, any> | null
  status: string
  round: number
  patientSignature: string | null
  patientSignedAt: string | null
  witnessSignature: string | null
  witnessSignedAt: string | null
  signingToken: string
  tokenExpiresAt: string
  sentAt: string | null
  treatmentSummary: any
  financialSummary: any
  notes: string | null
  createdAt: string
  package: { id: string; packageNumber: string; title: string } | null
  preparedBy: { id: string; firstName: string; lastName: string } | null
  witness: { id: string; firstName: string; lastName: string } | null
}

interface ConsentManagerProps {
  patientId: string
  onConsentChanged?: () => void
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export default function ConsentManager({ patientId, onConsentChanged }: ConsentManagerProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [consents, setConsents] = useState<ConsentData[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [packages, setPackages] = useState<any[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showWitnessDialog, setShowWitnessDialog] = useState(false)
  const [selectedConsent, setSelectedConsent] = useState<ConsentData | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [witnessing, setWitnessing] = useState(false)
  const witnessCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawingWitness, setIsDrawingWitness] = useState(false)

  // Email link dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailConsent, setEmailConsent] = useState<ConsentData | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailPatientDefault, setEmailPatientDefault] = useState('')

  const fetchConsents = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/consents`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setConsents(data.consents || [])
    } catch {
      console.error('Failed to load consents')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (res.ok) {
        const data = await res.json()
        setPackages(data.packages || [])
      }
    } catch { /* ignore */ }
  }, [patientId])

  useEffect(() => { fetchConsents(); fetchPackages() }, [fetchConsents, fetchPackages])

  const createConsent = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackageId || undefined, autoAttachForms: true })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json().catch(() => ({}))
      const extra = Number(data?.autoAttached || 0)
      const skipped = Number(data?.skippedDuplicates || 0)
      const alreadySigned = Array.isArray(data?.skippedAlreadySigned) ? data.skippedAlreadySigned as string[] : []
      const total = 1 + extra
      const parts = [`${total} consent form${total === 1 ? '' : 's'} generated`]
      if (extra > 0) parts.push(`${extra} auto-attached from template rules`)
      if (skipped > 0) parts.push(`${skipped} duplicate${skipped === 1 ? '' : 's'} skipped`)
      toast({ title: 'Consent created', description: parts.join(' · ') })
      if (alreadySigned.length > 0) {
        toast({
          title: 'Already signed forms skipped',
          description: `The following forms were not generated because the patient has already signed them: ${alreadySigned.join(', ')}`,
          duration: 8000,
        })
      }
      setShowCreateDialog(false)
      setSelectedPackageId('')
      await fetchConsents()
      onConsentChanged?.()
    } catch {
      toast({ title: 'Error', description: 'Failed to create consent', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const copySigningLink = async (consent: ConsentData) => {
    const url = `${window.location.origin}/consent/${consent.signingToken}`
    await copyToClipboard(url)
    toast({ title: 'Link copied!', description: 'Signing link copied to clipboard' })

    // Also mark as sent if still draft
    if (consent.status === 'draft') {
      fetch(`/api/patients/${patientId}/consents/${consent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' })
      }).then(() => fetchConsents())
    }
  }

  const openSigningPage = (consent: ConsentData) => {
    window.open(`/consent/${consent.signingToken}`, '_blank')
    if (consent.status === 'draft') {
      fetch(`/api/patients/${patientId}/consents/${consent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' })
      }).then(() => fetchConsents())
    }
  }

  // Open the "Email this link" dialog for a specific consent
  const openEmailDialog = async (consent: ConsentData) => {
    setEmailConsent(consent)
    setEmailNote('')
    setEmailTo('')
    setEmailPatientDefault('')
    setShowEmailDialog(true)
    // Fetch the patient's email as the default
    try {
      const res = await fetch(`/api/patients/${patientId}`)
      if (res.ok) {
        const data = await res.json()
        const p = data?.patient || data
        const existing = p?.emailDirect || p?.user?.email || ''
        if (existing) {
          setEmailTo(existing)
          setEmailPatientDefault(existing)
        }
      }
    } catch {}
  }

  const sendEmailLink = async () => {
    if (!emailConsent) return
    if (!emailTo.trim()) {
      toast({ title: 'Email required', description: 'Please enter an email address.', variant: 'destructive' })
      return
    }
    try {
      setEmailSending(true)
      const res = await fetch(
        `/api/patients/${patientId}/consents/${emailConsent.id}/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailTo.trim(), note: emailNote.trim() || undefined }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send email')
      }
      toast({ title: 'Email sent!', description: `Signing link emailed to ${data.recipient || emailTo}` })
      setShowEmailDialog(false)
      setEmailConsent(null)
      await fetchConsents()
      onConsentChanged?.()
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err?.message || 'Could not send email', variant: 'destructive' })
    } finally {
      setEmailSending(false)
    }
  }

  // QR Code generation using a simple SVG-based approach
  const showQRCode = (consent: ConsentData) => {
    const url = `${window.location.origin}/consent/${consent.signingToken}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`
    window.open(qrUrl, '_blank')
    toast({ title: 'QR Code', description: 'QR code opened in new tab. Save or show to patient.' })
    if (consent.status === 'draft') {
      fetch(`/api/patients/${patientId}/consents/${consent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' })
      }).then(() => fetchConsents())
    }
  }

  // Witness signing canvas
  const initWitnessCanvas = useCallback(() => {
    const canvas = witnessCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1a365d'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    if (showWitnessDialog) {
      setTimeout(initWitnessCanvas, 100)
    }
  }, [showWitnessDialog, initWitnessCanvas])

  const getWitnessCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = witnessCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startWitnessDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawingWitness(true)
    const ctx = witnessCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getWitnessCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const drawWitness = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingWitness) return
    e.preventDefault()
    const ctx = witnessCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getWitnessCanvasPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopWitnessDraw = () => setIsDrawingWitness(false)

  const clearWitnessCanvas = () => {
    const canvas = witnessCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const submitWitnessSignature = async () => {
    if (!selectedConsent || !witnessCanvasRef.current) return
    const data = witnessCanvasRef.current.toDataURL('image/png')
    // Check if canvas has content
    const blankCanvas = document.createElement('canvas')
    blankCanvas.width = witnessCanvasRef.current.width
    blankCanvas.height = witnessCanvasRef.current.height
    if (data === blankCanvas.toDataURL('image/png')) {
      toast({ title: 'Please sign', description: 'Draw your signature before submitting', variant: 'destructive' })
      return
    }

    setWitnessing(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/consents/${selectedConsent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witnessSignature: data })
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Witnessed!', description: 'Your witness signature has been recorded' })
      setShowWitnessDialog(false)
      await fetchConsents()
      onConsentChanged?.()
    } catch {
      toast({ title: 'Error', description: 'Failed to record witness signature', variant: 'destructive' })
    } finally {
      setWitnessing(false)
    }
  }

  const isTokenValid = (consent: ConsentData) => new Date(consent.tokenExpiresAt) > new Date()

  const deleteConsent = async (consent: ConsentData) => {
    const isSigned = consent.status === 'signed'
    const ok = await confirm({
      title: isSigned ? 'Delete signed consent form?' : 'Delete consent form?',
      description: isSigned
        ? `Consent ${consent.consentNumber} is already signed. Deleting will permanently remove the signed record. This cannot be undone.`
        : `Permanently delete consent ${consent.consentNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
    })
    if (!ok) return
    setDeletingId(consent.id)
    try {
      const res = await fetch(`/api/patients/${patientId}/consents/${consent.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to delete consent form')
      }
      toast({ title: 'Consent deleted', description: `${consent.consentNumber} has been removed.` })
      setShowDetailDialog(false)
      await fetchConsents()
      onConsentChanged?.()
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Could not delete consent form.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-[#2D9DA8]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#2D9DA8]" />
          <h3 className="font-semibold text-sm">Consent Forms</h3>
          <Badge variant="secondary" className="text-xs">{consents.length}</Badge>
        </div>
        <Button size="sm" className="h-7 text-xs bg-[#2D9DA8] hover:bg-[#258a93]" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-3 h-3 mr-1" /> New Consent
        </Button>
      </div>

      {/* Consent List */}
      {consents.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No consent forms yet</p>
          <p className="text-xs mt-1">Create one from an active package</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consents.map(consent => {
            const cfg = statusConfig[consent.status] || statusConfig.draft
            const StatusIcon = cfg.icon
            const hasPatientSig = !!consent.patientSignature
            const hasWitnessSig = !!consent.witnessSignature
            const tokenOk = isTokenValid(consent)

            return (
              <div
                key={consent.id}
                className="border rounded-lg p-3 hover:border-[#2D9DA8]/30 transition-colors cursor-pointer"
                onClick={() => { setSelectedConsent(consent); setShowDetailDialog(true) }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{consent.title}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                        <StatusIcon className="w-2.5 h-2.5 mr-0.5" />{cfg.label}
                      </Badge>
                      {consent.round > 1 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Round {consent.round}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{consent.consentNumber}</span>
                      {consent.package && <span>• {consent.package.packageNumber}</span>}
                      <span>• {format(parseISO(consent.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Signature indicators */}
                    <div className="flex gap-0.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasPatientSig ? 'bg-green-100' : 'bg-gray-100'}`} title={hasPatientSig ? 'Patient signed' : 'Patient not signed'}>
                        <PenTool className={`w-2.5 h-2.5 ${hasPatientSig ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasWitnessSig ? 'bg-green-100' : 'bg-gray-100'}`} title={hasWitnessSig ? 'Witnessed' : 'No witness'}>
                        <Shield className={`w-2.5 h-2.5 ${hasWitnessSig ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                  {tokenOk && consent.status !== 'signed' && consent.status !== 'cancelled' && (
                    <>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => copySigningLink(consent)}>
                        <Copy className="w-2.5 h-2.5 mr-1" /> Copy Link
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openSigningPage(consent)}>
                        <ExternalLink className="w-2.5 h-2.5 mr-1" /> Open
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-[#2D9DA8]" onClick={() => openEmailDialog(consent)}>
                        <Mail className="w-2.5 h-2.5 mr-1" /> Email
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => showQRCode(consent)}>
                        <QrCode className="w-2.5 h-2.5 mr-1" /> QR
                      </Button>
                    </>
                  )}
                  {hasPatientSig && !hasWitnessSig && (
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2 bg-[#22B573] hover:bg-[#1da066]"
                      onClick={() => { setSelectedConsent(consent); setShowWitnessDialog(true) }}
                    >
                      <PenTool className="w-2.5 h-2.5 mr-1" /> Witness Sign
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                    disabled={deletingId === consent.id}
                    onClick={() => deleteConsent(consent)}
                    title="Delete consent form"
                  >
                    {deletingId === consent.id ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-2.5 h-2.5 mr-1" /> Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Consent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Consent Form</DialogTitle>
            <DialogDescription>Generate a consent form for the patient to sign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Link to Package (optional)</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={selectedPackageId}
                onChange={e => setSelectedPackageId(e.target.value)}
              >
                <option value="">General Consent (no package)</option>
                {packages.filter(p => ['active', 'in_progress', 'draft'].includes(p.status)).map((pkg: any) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.packageNumber} — {pkg.title} (₱{Number(pkg.patientPayable).toLocaleString()})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Linking to a package auto-fills treatment & financial details
              </p>
            </div>
            {selectedPackageId && (
              <div className="rounded-md border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900">
                <strong className="block mb-1">Auto-attach enabled.</strong>
                All active form templates that match the package's procedures, treatment
                categories, source package template, or are marked "Always Required" will be
                generated automatically. Duplicates (by title) are skipped.
                <div className="mt-1 text-teal-700">
                  Manage the rules at <span className="font-mono">/admin/forms</span>.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button className="bg-[#2D9DA8] hover:bg-[#258a93]" onClick={createConsent} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consent Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedConsent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#2D9DA8]" />
                  {selectedConsent.title}
                </DialogTitle>
                <DialogDescription>{selectedConsent.consentNumber} • Round {selectedConsent.round}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status & Dates */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={statusConfig[selectedConsent.status]?.color || 'bg-gray-100'}>
                    {statusConfig[selectedConsent.status]?.label || selectedConsent.status}
                  </Badge>
                  {selectedConsent.package && (
                    <Badge variant="outline">Package: {selectedConsent.package.packageNumber}</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Created {format(parseISO(selectedConsent.createdAt), 'MMM d, yyyy h:mm a')}
                  </Badge>
                </div>

                {/* Financial Summary */}
                {selectedConsent.financialSummary && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase">Financial Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Total: <span className="font-medium">₱{selectedConsent.financialSummary.totalAmount?.toLocaleString()}</span></div>
                      <div>Coverage: <span className="font-medium text-[#2D9DA8]">₱{selectedConsent.financialSummary.coveredAmount?.toLocaleString()}</span></div>
                      <div>Patient Pays: <span className="font-bold">₱{selectedConsent.financialSummary.patientPayable?.toLocaleString()}</span></div>
                      <div>Balance: <span className="font-medium text-orange-600">₱{selectedConsent.financialSummary.balanceDue?.toLocaleString()}</span></div>
                    </div>
                  </div>
                )}

                {/* Consent Text / Form Fields */}
                <div className="border rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Consent Document</h4>
                  {selectedConsent.formFields && Array.isArray(selectedConsent.formFields) && selectedConsent.formFields.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedConsent.formContent && (
                        <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 mb-2">
                          {selectedConsent.formContent}
                        </pre>
                      )}
                      {selectedConsent.formFields.filter((f: any) => f.type === 'signature' ? f.label.length > 40 : true).map((field: any, idx: number) => (
                        <div key={field.id || idx}>
                          {/* For long-label signature fields (consent text stored with wrong type), show as read-only content */}
                          {field.type === 'signature' && field.label.length > 40 ? (
                            <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                              {field.label}
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-gray-600 mb-0.5">{field.label}</p>
                              {(field.type === 'textarea' || field.type === 'signature') ? (
                                <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                                  {selectedConsent.formResponses?.[field.id] || field.placeholder || <span className="text-gray-400 italic">No response</span>}
                                </div>
                              ) : field.type === 'checkbox' ? (
                                <p className="text-sm text-gray-700">
                                  {selectedConsent.formResponses?.[field.id] ? '✓ Acknowledged' : '○ Not acknowledged'}
                                </p>
                              ) : field.type === 'medical_checklist' ? (
                                <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 space-y-0.5">
                                  {(() => {
                                    const val = selectedConsent.formResponses?.[field.id]
                                    if (!val || typeof val !== 'object') return <span className="text-gray-400 italic">No response</span>
                                    const checkedItems = Object.entries(val.items || {}).filter(([, v]) => v === true).map(([k]) => k)
                                    const declinedItems = Object.entries(val.items || {}).filter(([, v]) => v === false).map(([k]) => k)
                                    const others = (val.others || []).filter((s: string) => s.trim())
                                    if (!checkedItems.length && !others.length && !declinedItems.length) return <span className="text-gray-400 italic">No items selected</span>
                                    return (
                                      <>
                                        {checkedItems.length > 0 && <p><span className="font-medium text-red-600">Yes:</span> {checkedItems.join(', ')}</p>}
                                        {others.length > 0 && <p><span className="font-medium">Others:</span> {others.join(', ')}</p>}
                                        {!checkedItems.length && !others.length && <p className="text-green-600">None reported</p>}
                                      </>
                                    )
                                  })()}
                                </div>
                              ) : field.type === 'radio' ? (
                                <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">
                                  {selectedConsent.formResponses?.[field.id] || <span className="text-gray-400 italic">Not selected</span>}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">
                                  {selectedConsent.formResponses?.[field.id] || <span className="text-gray-400 italic">No response</span>}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : selectedConsent.formContent ? (
                    <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 max-h-48 overflow-y-auto">
                      {selectedConsent.formContent}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No content available</p>
                  )}
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Patient Signature</h4>
                    {selectedConsent.patientSignature ? (
                      <div>
                        <img src={selectedConsent.patientSignature} alt="Patient Signature" className="max-h-20 border rounded" />
                        <p className="text-xs text-gray-500 mt-1">
                          Signed {selectedConsent.patientSignedAt && format(parseISO(selectedConsent.patientSignedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Not yet signed</p>
                    )}
                  </div>
                  <div className="border rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Witness Signature</h4>
                    {selectedConsent.witnessSignature ? (
                      <div>
                        <img src={selectedConsent.witnessSignature} alt="Witness Signature" className="max-h-20 border rounded" />
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedConsent.witness && formatDisplayName(selectedConsent.witness.firstName, selectedConsent.witness.lastName)}
                          {selectedConsent.witnessSignedAt && ` • ${format(parseISO(selectedConsent.witnessSignedAt), 'MMM d, yyyy h:mm a')}`}
                        </p>
                      </div>
                    ) : selectedConsent.patientSignature ? (
                      <Button
                        size="sm"
                        className="bg-[#22B573] hover:bg-[#1da066] text-xs"
                        onClick={() => { setShowDetailDialog(false); setShowWitnessDialog(true) }}
                      >
                        <PenTool className="w-3 h-3 mr-1" /> Add Witness Signature
                      </Button>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Awaiting patient signature first</p>
                    )}
                  </div>
                </div>

                {/* Share Actions */}
                {isTokenValid(selectedConsent) && selectedConsent.status !== 'signed' && selectedConsent.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => copySigningLink(selectedConsent)}>
                      <Copy className="w-4 h-4 mr-2" /> Copy Signing Link
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openSigningPage(selectedConsent)}>
                      <ExternalLink className="w-4 h-4 mr-2" /> Open Signing Page
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2D9DA8] text-[#2D9DA8] hover:bg-[#2D9DA8]/5"
                      onClick={() => { setShowDetailDialog(false); openEmailDialog(selectedConsent) }}
                    >
                      <Mail className="w-4 h-4 mr-2" /> Email Link to Patient
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => showQRCode(selectedConsent)}>
                      <QrCode className="w-4 h-4 mr-2" /> Show QR Code
                    </Button>
                  </div>
                )}

                {/* Danger Zone */}
                <div className="flex justify-end pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={deletingId === selectedConsent.id}
                    onClick={() => deleteConsent(selectedConsent)}
                  >
                    {deletingId === selectedConsent.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete Consent Form
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Witness Signing Dialog */}
      <Dialog open={showWitnessDialog} onOpenChange={setShowWitnessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#22B573]" />
              Witness Signature
            </DialogTitle>
            <DialogDescription>
              Sign as witness for: {selectedConsent?.consentNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg bg-white"
              style={{ touchAction: 'none' }}
            >
              <canvas
                ref={witnessCanvasRef}
                className="w-full cursor-crosshair"
                style={{ height: '150px' }}
                onMouseDown={startWitnessDraw}
                onMouseMove={drawWitness}
                onMouseUp={stopWitnessDraw}
                onMouseLeave={stopWitnessDraw}
                onTouchStart={startWitnessDraw}
                onTouchMove={drawWitness}
                onTouchEnd={stopWitnessDraw}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={clearWitnessCanvas}>Clear</Button>
              <p className="text-xs text-gray-400 self-center">Draw your signature above</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWitnessDialog(false)}>Cancel</Button>
            <Button className="bg-[#22B573] hover:bg-[#1da066]" onClick={submitWitnessSignature} disabled={witnessing}>
              {witnessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Witness Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Signing Link Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#2D9DA8]" />
              Email Signing Link to Patient
            </DialogTitle>
            <DialogDescription>
              {emailConsent?.title ? `Send the signing link for “${emailConsent.title}” directly to the patient.` : 'Send the signing link to the patient by email.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="email-to" className="text-sm">Patient email</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="patient@example.com"
                className="mt-1"
              />
              {emailPatientDefault && emailTo === emailPatientDefault && (
                <p className="text-[11px] text-gray-500 mt-1">Using email on file. You can change it if needed.</p>
              )}
              {!emailPatientDefault && (
                <p className="text-[11px] text-amber-600 mt-1">No email on file — please enter one.</p>
              )}
            </div>
            <div>
              <Label htmlFor="email-note" className="text-sm">Note (optional)</Label>
              <Textarea
                id="email-note"
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                placeholder="Add a short message to the patient (e.g., please complete before your appointment)"
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="rounded-lg bg-slate-50 border text-xs text-slate-600 p-3">
              The email will include a secure one-time link to open, complete, and sign the form on any device.
              The link expires at the same time as the form&apos;s existing token.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={emailSending}>Cancel</Button>
            <Button
              onClick={sendEmailLink}
              disabled={emailSending || !emailTo.trim()}
              className="bg-[#2D9DA8] hover:bg-[#258592]"
            >
              {emailSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

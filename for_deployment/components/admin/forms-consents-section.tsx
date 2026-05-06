'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FileText, Calendar, Loader2, Eye, Clock, Shield, UserCheck, CheckCircle, AlertCircle, Send, XCircle, Trash2, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useSession } from '@/components/auth/custom-session-provider'
import { useConfirm } from '@/components/providers/confirm-provider'
import { useToast } from '@/hooks/use-toast'

interface FormRecord {
  id: string
  title: string
  description: string | null
  consentNumber: string
  status: string
  patientSignedAt: string | null
  formFields: any[]
  formResponses: any
  patientSignature: string | null
  guardianName?: string | null
  guardianRelation?: string | null
  guardianSignature?: string | null
  guardianSignedAt?: string | null
  templateKey?: string | null
  templateVersion?: number | null
  requirementStage?: string | null
  assignmentSource?: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  signed: { label: 'Signed', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Eye },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
}

export default function FormsConsentsSection({ patientId }: { patientId: string }) {
  const [forms, setForms] = useState<FormRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [viewing, setViewing] = useState<FormRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: session } = useSession() || {}
  const role = (session?.user as any)?.role || ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const canAssign = ['admin', 'super_admin', 'staff', 'receptionist', 'manager', 'dentist'].includes(role)

  // Assign form state
  const [assignOpen, setAssignOpen] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<{ key: string; title: string }[]>([])
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const { confirm } = useConfirm()
  const { toast } = useToast()

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const url = `/api/patients/${patientId}/forms-history${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setForms(data.forms || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [patientId, fromDate, toDate])

  useEffect(() => {
    fetchForms()
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group forms by status priority: pending (draft/sent/viewed) -> signed -> expired/cancelled
  const grouped = {
    pending: forms.filter(f => ['draft', 'sent', 'viewed'].includes(f.status)),
    signed: forms.filter(f => f.status === 'signed' || f.patientSignature),
    other: forms.filter(f => ['expired', 'cancelled'].includes(f.status)),
  }

  const clear = () => {
    setFromDate('')
    setToDate('')
    setTimeout(fetchForms, 0)
  }

  const deleteForm = async (f: FormRecord) => {
    if (!isAdmin) return
    const ok = await confirm({
      title: 'Delete this form?',
      description: `This will permanently remove "${f.title}" (#${f.consentNumber}) for this patient. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    setDeletingId(f.id)
    try {
      const res = await fetch(`/api/patients/${patientId}/consents/${f.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete')
      }
      toast({ title: 'Form deleted', description: 'The form has been permanently removed.' })
      setForms(prev => prev.filter(x => x.id !== f.id))
    } catch (err: any) {
      toast({ title: 'Could not delete', description: err.message || 'Try again later.', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const openAssignDialog = async () => {
    setSelectedTemplateKey('')
    setAssignOpen(true)
    if (availableTemplates.length > 0) return
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/checkin-forms?templates=true')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setAvailableTemplates(
        (json.templates || []).map((t: any) => ({ key: t.id, title: t.title }))
      )
    } catch {
      toast({ title: 'Could not load templates', variant: 'destructive' })
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleAssignForm = async () => {
    if (!selectedTemplateKey) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/send-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: selectedTemplateKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed')
      toast({ title: 'Form assigned', description: `"${json?.form?.title || 'Form'}" has been assigned to this patient.` })
      setAssignOpen(false)
      fetchForms()
    } catch (err: any) {
      toast({ title: 'Failed to assign form', description: err.message || 'Try again later.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const renderFormCard = (f: FormRecord) => {
    const statusCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.draft
    const StatusIcon = statusCfg.icon
    const isSigned = f.status === 'signed' || !!f.patientSignature

    return (
      <div key={f.id} className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors ${isSigned ? 'bg-green-50/30 border-green-200' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium text-sm">{f.title}</span>
              <Badge className={`text-xs border ${statusCfg.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" />{statusCfg.label}
              </Badge>
              {f.guardianSignature && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs border">
                  <Shield className="w-3 h-3 mr-1" /> Guardian
                </Badge>
              )}
              {f.templateVersion && (
                <Badge variant="outline" className="text-[10px]">v{f.templateVersion}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-mono">#{f.consentNumber}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> Created {format(parseISO(f.createdAt), 'MMM d, yyyy')}
              </span>
              {f.patientSignedAt && (
                <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                  <Calendar className="w-3 h-3" /> Signed {format(parseISO(f.patientSignedAt), 'MMM d, yyyy h:mm a')}
                </span>
              )}
              {f.guardianName && (
                <span className="inline-flex items-center gap-1 text-purple-700">
                  <UserCheck className="w-3 h-3" /> Guardian: {f.guardianName}{f.guardianRelation ? ` (${f.guardianRelation})` : ''}
                </span>
              )}
            </div>

            {/* Inline Signature Previews */}
            {(f.patientSignature || f.guardianSignature) && (
              <div className="flex items-center gap-4 mt-2">
                {f.patientSignature && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Patient:</span>
                    <img src={f.patientSignature} alt="Patient signature" className="h-8 max-w-[120px] object-contain border rounded bg-white px-1" />
                  </div>
                )}
                {f.guardianSignature && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Guardian:</span>
                    <img src={f.guardianSignature} alt="Guardian signature" className="h-8 max-w-[120px] object-contain border rounded bg-white px-1" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setViewing(f)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteForm(f)}
                disabled={deletingId === f.id}
                title="Admin override: delete this form"
              >
                {deletingId === f.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" /> Forms & Consents
            {forms.length > 0 && <Badge variant="outline">{forms.length}</Badge>}
          </CardTitle>
          {canAssign && (
            <Button size="sm" variant="outline" onClick={openAssignDialog}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Assign Form
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Date Filters */}
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" /></div>
          <Button size="sm" onClick={fetchForms}>Filter</Button>
          <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No forms found{(fromDate || toDate) ? ' in this date range' : ''}.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Forms */}
            {grouped.pending.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Pending ({grouped.pending.length})
                </h3>
                <div className="space-y-2">{grouped.pending.map(renderFormCard)}</div>
              </div>
            )}

            {/* Signed Forms */}
            {grouped.signed.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Signed ({grouped.signed.length})
                </h3>
                <div className="space-y-2">{grouped.signed.map(renderFormCard)}</div>
              </div>
            )}

            {/* Expired / Cancelled */}
            {grouped.other.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expired / Cancelled ({grouped.other.length})</h3>
                <div className="space-y-2">{grouped.other.map(renderFormCard)}</div>
              </div>
            )}
          </div>
        )}

        {/* View Form Dialog */}
        <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewing?.title}</DialogTitle>
              <DialogDescription>
                Form #{viewing?.consentNumber}
                {viewing?.patientSignedAt && ` • Signed on ${format(parseISO(viewing.patientSignedAt), 'MMM d, yyyy h:mm a')}`}
              </DialogDescription>
            </DialogHeader>
            {viewing && (
              <div className="space-y-4">
                {/* Guardian Info */}
                {(viewing.guardianSignature || viewing.guardianName) && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                    <div className="text-sm font-medium text-purple-900 inline-flex items-center gap-1.5 mb-1.5"><Shield className="w-4 h-4" /> Guardian Signer</div>
                    <div className="space-y-1 text-xs text-purple-900">
                      {viewing.guardianName && <div><span className="text-purple-700/80">Name:</span> <span className="font-medium">{viewing.guardianName}</span></div>}
                      {viewing.guardianRelation && <div><span className="text-purple-700/80">Relationship:</span> <span className="font-medium">{viewing.guardianRelation}</span></div>}
                      {viewing.guardianSignedAt && <div><span className="text-purple-700/80">Signed on:</span> <span className="font-medium">{format(parseISO(viewing.guardianSignedAt), 'MMM d, yyyy h:mm a')}</span></div>}
                      {viewing.guardianSignature && (
                        <div className="pt-1">
                          <div className="text-[11px] text-purple-700/80 mb-0.5">Signature:</div>
                          <img src={viewing.guardianSignature} alt="guardian signature" className="max-h-20 border rounded bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                {(viewing.formFields || []).map((field: any, idx: number) => {
                  const resp = viewing.formResponses?.[field.id]
                  if (field.type === 'signature') {
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-sm font-medium">{field.label}</div>
                        {viewing.patientSignature ? (
                          <img src={viewing.patientSignature} alt="signature" className="max-h-24 border rounded bg-white" />
                        ) : (
                          <div className="text-xs text-muted-foreground italic">Not signed</div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="text-sm font-medium">{field.label}</div>
                      <div className="text-sm bg-muted rounded p-2 min-h-[2rem] whitespace-pre-wrap">
                        {typeof resp === 'boolean' ? (resp ? '✓ Yes' : '✗ No') : typeof resp === 'object' ? JSON.stringify(resp) : resp || <span className="text-muted-foreground italic">No response</span>}
                      </div>
                    </div>
                  )
                })}

                {/* Patient Signature at bottom */}
                {viewing.patientSignature && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-medium mb-1">Patient Signature</div>
                    <img src={viewing.patientSignature} alt="Patient signature" className="max-h-24 border rounded bg-white" />
                    {viewing.patientSignedAt && <p className="text-xs text-muted-foreground mt-1">Signed {format(parseISO(viewing.patientSignedAt), 'MMM d, yyyy h:mm a')}</p>}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>

      {/* Assign form dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-600" />
              Assign Form
            </DialogTitle>
            <DialogDescription>
              Manually assign a form template to this patient. This bypasses the once-only rule — the patient can sign this form even if they&apos;ve signed it before.
            </DialogDescription>
          </DialogHeader>
          {templatesLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No form templates available.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Select Form Template</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                >
                  <option value="">Choose a form…</option>
                  {availableTemplates.map((t) => (
                    <option key={t.key} value={t.key}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAssignForm} disabled={!selectedTemplateKey || assigning}>
              {assigning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

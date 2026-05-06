'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { copyToClipboard as safeCopyToClipboard } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Send, Copy, Loader2, ExternalLink } from 'lucide-react'

interface Patient {
  id: string
  fullName?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  address?: string | null
  mobileNumber?: string | null
  emailDirect?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  medicalHistory?: string | null
  allergies?: string | null
  currentMedications?: string | null
  pregnancyStatus?: string | null
}

interface Template {
  id: string
  key: string
  title: string
  description: string | null
  category: string
}

type FieldDef = { key: keyof Patient; label: string; important?: boolean }

const FIELDS_TO_CHECK: FieldDef[] = [
  { key: 'dateOfBirth', label: 'Date of Birth', important: true },
  { key: 'address', label: 'Home Address' },
  { key: 'mobileNumber', label: 'Mobile Number', important: true },
  { key: 'emailDirect', label: 'Email Address' },
  { key: 'emergencyContactName', label: 'Emergency Contact Name', important: true },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', important: true },
  { key: 'medicalHistory', label: 'Medical History' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'currentMedications', label: 'Current Medications' },
]

export default function MissingDataCard({ patient, onRefresh }: { patient: Patient; onRefresh?: () => void }) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('medical-records-update')
  const [sending, setSending] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/form-templates?activeOnly=true')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.templates || []).filter((t: any) =>
          ['data_completion', 'medical', 'intake'].includes(t.category)
        )
        setTemplates(list)
      })
      .catch(() => {})
  }, [])

  const missing = FIELDS_TO_CHECK.filter((f) => {
    const value = patient[f.key]
    return !value || (typeof value === 'string' && value.trim() === '')
  })

  const sendForm = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/patients/${patient.id}/send-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: selectedTemplate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setSigningUrl(data.signingUrl)
      toast({ title: 'Form sent — share the link with the patient' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send form', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const copyLink = async () => {
    if (!signingUrl) return
    await safeCopyToClipboard(signingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Link copied' })
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSigningUrl(null)
    setCopied(false)
    onRefresh?.()
  }

  const hasMissing = missing.length > 0
  const hasImportantMissing = missing.some((f) => f.important)

  return (
    <>
      <Card className={`border-l-4 ${hasImportantMissing ? 'border-l-amber-500' : hasMissing ? 'border-l-slate-400' : 'border-l-green-500'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {hasMissing ? (
              <>
                <AlertCircle className={`w-4 h-4 ${hasImportantMissing ? 'text-amber-600' : 'text-slate-500'}`} />
                Incomplete Patient Data
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Patient Data Complete
              </>
            )}
          </CardTitle>
          {hasMissing && (
            <CardDescription>
              {missing.length} field(s) missing. Send a data completion form to the patient.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {hasMissing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {missing.map((f) => (
                  <Badge key={f.key as string} variant={f.important ? 'destructive' : 'outline'} className="text-xs">
                    {f.label}
                  </Badge>
                ))}
              </div>
              <Button size="sm" className="w-full gap-2" onClick={() => setDialogOpen(true)}>
                <Send className="w-3 h-3" /> Send Data Completion Form
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">All essential patient data is on file.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Data Completion Form</DialogTitle>
            <DialogDescription>
              Pick a form template to send to the patient. When they complete and sign it, their profile will be automatically updated.
            </DialogDescription>
          </DialogHeader>

          {signingUrl ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
                Form has been created. Share this link with the patient:
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={signingUrl}
                  className="flex-1 px-3 py-2 text-xs border rounded bg-muted font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(signingUrl, '_blank')}>
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>

              {/* Quick email / open actions */}
              <div className="flex flex-col gap-2">
                {patient.emailDirect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    onClick={() => {
                      const subject = encodeURIComponent(`SwiftCare Dental – Please complete your form`)
                      const body = encodeURIComponent(
                        `Hi ${patient.fullName || 'there'},\n\nPlease complete and sign the form using this link:\n${signingUrl}\n\nThis link expires in 7 days.\n\nThank you,\nSwiftCare Dental Clinic`
                      )
                      window.open(`mailto:${patient.emailDirect}?subject=${subject}&body=${body}`, '_blank')
                    }}
                  >
                    <Send className="w-3 h-3" /> Email to {patient.emailDirect}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 text-xs"
                  onClick={() => window.open(signingUrl, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" /> Open Form (for in-clinic signing)
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">This link expires in 7 days.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && <SelectItem value="medical-records-update">Medical Records Update</SelectItem>}
                    {templates.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {patient.emailDirect && (
                <p className="text-xs text-muted-foreground">
                  Patient email: <span className="font-medium text-foreground">{patient.emailDirect}</span> — the link will be ready to email after creation.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {signingUrl ? (
              <Button onClick={closeDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={sendForm} disabled={sending}>
                  {sending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                  Create Form
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

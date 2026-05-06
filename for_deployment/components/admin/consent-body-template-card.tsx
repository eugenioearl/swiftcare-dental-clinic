'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useConfirm } from '@/components/providers/confirm-provider'
import {
  FileText,
  Loader2,
  Save,
  RotateCcw,
  Info,
  CheckCircle,
  AlertCircle,
  Pencil,
  Eye,
} from 'lucide-react'

const CONSENT_TEMPLATE_VARIABLES: Array<{ key: string; label: string }> = [
  { key: 'patientName', label: 'Patient Name' },
  { key: 'date', label: 'Current Date' },
  { key: 'packageTitle', label: 'Package Title' },
  { key: 'procedures', label: 'Procedures List' },
  { key: 'totalAmount', label: 'Total Amount' },
  { key: 'coveredAmount', label: 'Covered Amount' },
  { key: 'patientPayable', label: 'Patient Payable' },
  { key: 'balanceDue', label: 'Balance Due' },
  { key: 'financialSummary', label: 'Financial Summary (full block)' },
]

export function ConsentBodyTemplateCard() {
  const { confirm } = useConfirm()
  const [template, setTemplate] = useState('')
  const [savedTemplate, setSavedTemplate] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/consent-template')
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template || '')
        setSavedTemplate(data.template || '')
        setIsDefault(!!data.isDefault)
        setUpdatedAt(data.updatedAt || null)
      } else {
        toast.error('Failed to load consent template')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load consent template')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasChanges = template !== savedTemplate

  const handleSave = async () => {
    if (!template.trim()) {
      toast.error('Template cannot be empty. Use Reset to restore the default.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/consent-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedTemplate(data.template)
        setUpdatedAt(data.updatedAt || null)
        setIsDefault(false)
        toast.success('Consent template updated')
        setEditOpen(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || 'Failed to save')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset to default template?',
      description: 'Your customized consent template will be permanently lost and replaced with the built-in default.',
      confirmLabel: 'Reset',
      variant: 'destructive',
    })
    if (!ok) return
    setResetting(true)
    try {
      const res = await fetch('/api/consent-template', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template || '')
        setSavedTemplate(data.template || '')
        setIsDefault(true)
        setUpdatedAt(null)
        toast.success('Consent template restored to default')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setResetting(false)
    }
  }

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`
    const el = document.getElementById('consent-body-template-textarea') as HTMLTextAreaElement | null
    if (el) {
      const start = el.selectionStart ?? template.length
      const end = el.selectionEnd ?? template.length
      const newValue = template.slice(0, start) + token + template.slice(end)
      setTemplate(newValue)
      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + token.length, start + token.length)
      }, 0)
    } else {
      setTemplate(template + token)
    }
  }

  const buildPreview = () => {
    const sampleVars: Record<string, string> = {
      patientName: 'Juan Dela Cruz',
      date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      packageTitle: 'Orthodontic Treatment',
      procedures:
        '• Comprehensive Orthodontic Assessment\n• Metal Braces Installation (Upper & Lower)\n• Monthly Adjustments (12 months)',
      totalAmount: '85,000',
      coveredAmount: '0',
      patientPayable: '85,000',
      balanceDue: '85,000',
      financialSummary:
        '\n\nFinancial Summary:\n• Total Amount: ₱85,000\n• Coverage: ₱0\n• Patient Payable: ₱85,000',
    }
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (sampleVars[k] ?? `{{${k}}}`))
  }

  return (
    <>
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <CardTitle className="text-base text-purple-900">
                  Default Consent Body Template
                </CardTitle>
                <p className="text-sm text-purple-800/80 mt-1">
                  When staff generate a patient consent from a treatment package, this text is used as the starting body. Edit it here.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              ) : isDefault ? (
                <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                  <Info className="w-3 h-3 mr-1" /> Built-in Default
                </Badge>
              ) : (
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                  <CheckCircle className="w-3 h-3 mr-1" /> Customized
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setEditOpen(true)}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={loading || !savedTemplate.trim()}
            >
              <Eye className="w-3.5 h-3.5 mr-2" /> Preview
            </Button>
            {updatedAt && (
              <span className="text-xs text-purple-700 ml-2">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" /> Edit Consent Body Template
            </DialogTitle>
            <DialogDescription>
              This body text is auto-filled when staff create a new consent for a patient from a package. Use the variables below to insert dynamic patient and package data.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <Label className="text-sm font-medium">Available Variables</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Click a variable to insert it at the cursor position.
              </p>
              <div className="flex flex-wrap gap-2">
                {CONSENT_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="px-2.5 py-1 rounded-md border border-[#2D9DA8]/30 bg-[#2D9DA8]/5 hover:bg-[#2D9DA8]/10 text-xs text-[#2D9DA8] font-medium transition-colors"
                    title={v.label}
                  >
                    {'{{'}
                    {v.key}
                    {'}}'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="consent-body-template-textarea" className="text-sm font-medium">
                Template Content
              </Label>
              <Textarea
                id="consent-body-template-textarea"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="mt-1 min-h-[340px] font-mono text-sm"
                placeholder="Enter the default consent template..."
              />
            </div>

            {hasChanges && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Unsaved changes
              </p>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting || isDefault}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 mr-auto"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" /> Reset to Default
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!template.trim()}>
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-[#2D9DA8] hover:bg-[#268893] text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview (with sample data)</DialogTitle>
            <DialogDescription>
              This is how the consent body will look when auto-filled with real patient and package data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded border text-sm whitespace-pre-wrap font-sans text-gray-800">
            {editOpen ? buildPreview() : savedTemplate ? (
              // Use same interpolation when not editing
              savedTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
                const sampleVars: Record<string, string> = {
                  patientName: 'Juan Dela Cruz',
                  date: new Date().toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                  packageTitle: 'Orthodontic Treatment',
                  procedures:
                    '• Comprehensive Orthodontic Assessment\n• Metal Braces Installation (Upper & Lower)\n• Monthly Adjustments (12 months)',
                  totalAmount: '85,000',
                  coveredAmount: '0',
                  patientPayable: '85,000',
                  balanceDue: '85,000',
                  financialSummary:
                    '\n\nFinancial Summary:\n• Total Amount: ₱85,000\n• Coverage: ₱0\n• Patient Payable: ₱85,000',
                }
                return sampleVars[k] ?? `{{${k}}}`
              })
            ) : ''}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

'use client'

/**
 * OCR Panel
 *
 * Drop-in panel that runs / displays Tesseract OCR for a single SmartUpload.
 * Used inside the document preview dialog so it doesn't clutter the patient
 * page.
 *
 * Workflow:
 *   1. Mount → fetch cached OCR result via GET .../smart-upload/:uploadId/ocr
 *   2. If status is null/skipped/failed, show "Run OCR" button
 *   3. On run → POST .../smart-upload/:uploadId/ocr (with optional force)
 *   4. Show extracted text + detected fields
 *   5. Provide "Review detected fields" button → opens the existing review
 *      dialog via the parent's onReviewFields callback so user can confirm
 *      what to save.
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  ScanText, Loader2, RotateCcw, AlertTriangle, CheckCircle2, Ban,
  ClipboardCopy, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { OcrStatusBadge } from './ocr-status-badge'
import { cn } from '@/lib/utils'

export interface OcrPanelProps {
  patientId: string
  uploadId: string
  /** Whether OCR is supported for this file type (image-only). */
  eligible?: boolean
  /** Optional callback when user clicks "Review detected fields" → parent
   *  forwards the fields into the existing review-and-save dialog. */
  onReviewFields?: (fields: Record<string, any>, ocrText: string) => void
  /** Compact mode for inline use. */
  compact?: boolean
}

interface OcrState {
  ocrStatus: string | null
  ocrText: string | null
  ocrConfidence: number | null
  ocrFields: Record<string, any> | null
  ocrLanguage: string | null
  ocrError: string | null
  ocrProcessedAt: string | null
  eligible?: boolean
  eligibilityReason?: string
}

const INITIAL_STATE: OcrState = {
  ocrStatus: null,
  ocrText: null,
  ocrConfidence: null,
  ocrFields: null,
  ocrLanguage: null,
  ocrError: null,
  ocrProcessedAt: null,
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  firstName: 'First Name',
  lastName: 'Last Name',
  dob: 'Date of Birth',
  email: 'Email',
  emails: 'Emails',
  mobileNumber: 'Mobile Number',
  phones: 'Phone Numbers',
  address: 'Address',
  procedure: 'Procedure',
  procedureNotes: 'Procedure Notes',
  generalChartNotes: 'General Chart Notes',
  orthoChartNotes: 'Ortho Chart Notes',
  toothNumbers: 'Tooth Numbers',
  consentType: 'Consent Type',
  signedDate: 'Signed Date',
  amount: 'Amount',
  amountsAll: 'All Amounts',
  paymentMethod: 'Payment Method',
  invoiceNumber: 'Invoice Number',
  receiptNumber: 'Receipt Number',
  dates: 'Dates Found',
}

function formatFieldValue(value: any): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return String(value)
  return String(value || '')
}

export function OcrPanel({
  patientId,
  uploadId,
  eligible: eligibleProp,
  onReviewFields,
  compact = false,
}: OcrPanelProps) {
  const { toast } = useToast()
  const [state, setState] = useState<OcrState>(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [showText, setShowText] = useState(false)

  const fetchOcr = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload/${uploadId}/ocr`)
      const data = await res.json()
      if (data.success && data.data) {
        setState({ ...INITIAL_STATE, ...data.data })
      } else if (res.status === 403) {
        // No permission — show silently disabled state.
        setState({ ...INITIAL_STATE, eligible: false, eligibilityReason: 'You don\'t have permission to view OCR.' })
      }
    } catch (e) {
      console.warn('[OcrPanel] fetch failed', (e as Error)?.message)
    } finally {
      setLoading(false)
    }
  }, [patientId, uploadId])

  useEffect(() => {
    void fetchOcr()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, uploadId])

  const runOcr = useCallback(async (force = false) => {
    setRunning(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload/${uploadId}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setState({ ...INITIAL_STATE, ...data.data })
        if (data.data.ocrStatus === 'completed') {
          toast({ title: 'OCR completed', description: data.cached ? 'Loaded cached result' : 'Text extraction successful' })
        } else if (data.data.ocrStatus === 'failed') {
          toast({ title: 'OCR failed', description: data.data.ocrError || 'Try a clearer image', variant: 'destructive' })
        } else if (data.data.ocrStatus === 'skipped') {
          toast({ title: 'OCR skipped', description: data.data.ocrError || 'File type not supported' })
        }
      } else {
        throw new Error(data.error || 'OCR request failed')
      }
    } catch (e: any) {
      toast({ title: 'OCR error', description: e?.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setRunning(false)
    }
  }, [patientId, uploadId, toast])

  const copyText = useCallback(async () => {
    if (!state.ocrText) return
    try {
      await navigator.clipboard.writeText(state.ocrText)
      toast({ title: 'Text copied' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }, [state.ocrText, toast])

  const isImageEligible = (eligibleProp ?? state.eligible) ?? true
  const eligibilityReason = state.eligibilityReason

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-gray-500', compact ? 'py-1' : 'py-2')}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking OCR…
      </div>
    )
  }

  if (!isImageEligible) {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className={cn('flex items-start gap-3', compact ? 'p-3' : 'p-4')}>
          <Ban className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700">OCR not available</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{eligibilityReason || 'OCR is only supported for image files (PNG, JPG, JPEG, WEBP).'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const fieldEntries = state.ocrFields ? Object.entries(state.ocrFields).filter(([, v]) => v !== undefined && v !== null && v !== '') : []
  const hasResult = state.ocrStatus === 'completed' && (state.ocrText || fieldEntries.length > 0)

  return (
    <Card className="border-teal-100 bg-gradient-to-br from-teal-50/40 to-white">
      <CardContent className={cn('space-y-3', compact ? 'p-3' : 'p-4')}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <ScanText className="w-4 h-4 text-[#2D9DA8] flex-shrink-0" />
            <h4 className="text-sm font-semibold text-gray-800">Tesseract OCR</h4>
            <OcrStatusBadge status={state.ocrStatus as any} confidence={state.ocrConfidence} />
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {!hasResult && state.ocrStatus !== 'processing' && (
              <Button size="sm" onClick={() => runOcr(false)} disabled={running} className="h-7 text-xs bg-[#2D9DA8] hover:bg-[#258a93]">
                {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ScanText className="w-3 h-3 mr-1" />}
                Run OCR
              </Button>
            )}
            {hasResult && (
              <Button size="sm" variant="outline" onClick={() => runOcr(true)} disabled={running} className="h-7 text-xs">
                {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                Re-run
              </Button>
            )}
            {hasResult && fieldEntries.length > 0 && onReviewFields && (
              <Button
                size="sm"
                onClick={() => onReviewFields(state.ocrFields || {}, state.ocrText || '')}
                className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="w-3 h-3 mr-1" /> Review Extracted Text
              </Button>
            )}
          </div>
        </div>

        {/* Error state */}
        {state.ocrStatus === 'failed' && state.ocrError && (
          <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-700">OCR failed</p>
              <p className="text-red-600/80 mt-0.5 break-words">{state.ocrError}</p>
            </div>
          </div>
        )}

        {/* Idle state — prompt to run */}
        {!hasResult && !state.ocrStatus && !running && (
          <p className="text-[11px] text-gray-500">Click <strong>Run OCR</strong> to extract text from this image. We&apos;ll detect possible patient info, dates, and amounts — nothing is saved without your confirmation.</p>
        )}

        {/* Processing state */}
        {state.ocrStatus === 'processing' && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> OCR is processing… this can take 5-30 seconds depending on image size.
          </div>
        )}

        {/* Detected fields */}
        {hasResult && fieldEntries.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-gray-600 mb-1.5">Detected fields</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
              {fieldEntries.map(([key, val]) => (
                <div key={key} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 flex-shrink-0">
                    {FIELD_LABELS[key] || key}
                  </span>
                  <span className="text-xs text-gray-800 truncate" title={formatFieldValue(val)}>
                    {formatFieldValue(val)}
                  </span>
                </div>
              ))}
            </div>
            <Badge variant="outline" className="mt-2 text-[10px]">Needs review before saving</Badge>
          </div>
        )}

        {/* Extracted text (collapsible) */}
        {hasResult && state.ocrText && (
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-800"
              onClick={() => setShowText(s => !s)}
            >
              {showText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showText ? 'Hide extracted text' : 'Show extracted text'}
              <span className="text-gray-400">({state.ocrText.length} chars)</span>
            </button>
            {showText && (
              <div className="mt-2 relative">
                <Textarea
                  readOnly
                  value={state.ocrText}
                  rows={compact ? 4 : 8}
                  className="text-[11px] font-mono bg-gray-50 border-gray-200"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute top-1 right-1 h-6 px-2 text-[10px]"
                  onClick={copyText}
                >
                  <ClipboardCopy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer meta */}
        {hasResult && (
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>{state.ocrLanguage?.toUpperCase()} • {state.ocrProcessedAt ? new Date(state.ocrProcessedAt).toLocaleString() : ''}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default OcrPanel

'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  FileText, CheckCircle, ChevronRight, ChevronLeft, Loader2, AlertTriangle,
  Pen, RotateCcw, Save, UserCheck, Plus, X
} from 'lucide-react'

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
  patientField?: string
  mapsTo?: string
  checklistItems?: string[]
}

/** Structured value for medical_checklist field type */
interface MedicalChecklistValue {
  items: Record<string, boolean>
  others: string[]
}

interface FormItem {
  id: string
  title: string
  description: string
  status: string
  formFields: FormField[] | null
  formResponses: Record<string, any> | null
  signingToken: string
  isSigned: boolean
  signedAt: string | null
  requiresGuardian?: boolean
  guardianName?: string | null
  guardianRelation?: string | null
  guardianSigned?: boolean
}

interface FormData {
  patientName: string
  appointmentType: string
  scheduledDatetime: string
  prefillData: Record<string, any>
  forms: FormItem[]
  allSigned: boolean
  totalForms: number
  signedCount: number
  patientAge?: number | null
  isMinor?: boolean
  isStandalone?: boolean
}

export default function FormSigningPage() {
  const params = useParams()
  const token = params.token as string
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [currentFormIndex, setCurrentFormIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [signing, setSigning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  // Track which field IDs were prefilled (so we can show the "pre-filled" hint)
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set())

  // Guardian signature pad (for minors)
  const guardianCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawingGuardian, setIsDrawingGuardian] = useState(false)
  const [hasGuardianSignature, setHasGuardianSignature] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelation, setGuardianRelation] = useState('')

  useEffect(() => {
    if (!token) return
    fetchForms()
  }, [token])

  const fetchForms = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/checkin-forms/${token}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load forms')
        return
      }
      const data: FormData = await res.json()
      setFormData(data)

      // Find first unsigned form
      const firstUnsigned = data.forms.findIndex((f) => !f.isSigned)
      const idx = firstUnsigned >= 0 ? firstUnsigned : 0
      setCurrentFormIndex(idx)

      // Pre-fill responses for that form
      initResponses(data, idx)
    } catch (err) {
      setError('Unable to connect. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  // Initialize responses with: saved responses > prefill data > empty
  // Prefill priority: exact id match -> patientField/mapsTo metadata -> case-insensitive key match
  // Also marks fields as "prefilled" when populated from previous consent responses or patient data
  const initResponses = (data: FormData, idx: number) => {
    const form = data.forms[idx]
    if (!form || form.isSigned) {
      setResponses({})
      return
    }

    const fields = (form.formFields || []) as FormField[]
    const saved = (form.formResponses || {}) as Record<string, any>
    const prefill = data.prefillData || {}
    // Build lowercase key -> value map for case-insensitive matching
    const prefillLower: Record<string, any> = {}
    for (const [k, v] of Object.entries(prefill)) {
      prefillLower[k.toLowerCase()] = v
    }
    const merged: Record<string, any> = {}
    const prefilled = new Set<string>()

    const hasValue = (v: any) => v !== undefined && v !== null && v !== ''

    const getPrefillFor = (field: FormField): any => {
      // Try exact id
      if (hasValue(prefill[field.id])) return prefill[field.id]
      // Try explicit patientField / mapsTo alias
      if (field.patientField && hasValue(prefill[field.patientField])) return prefill[field.patientField]
      if (field.mapsTo && hasValue(prefill[field.mapsTo])) return prefill[field.mapsTo]
      // Try case-insensitive match
      const lowerId = field.id.toLowerCase()
      if (hasValue(prefillLower[lowerId])) return prefillLower[lowerId]
      // Try normalized (camelCase -> snake_case) and vice versa
      const toSnake = field.id.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
      if (hasValue(prefill[toSnake])) return prefill[toSnake]
      const toCamel = field.id.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      if (hasValue(prefill[toCamel])) return prefill[toCamel]
      return undefined
    }

    /** Convert a plain text string into a medical_checklist structure by matching against checklistItems */
    const textToChecklist = (text: string, checklistItems: string[]): MedicalChecklistValue => {
      const lower = text.toLowerCase()
      const items: Record<string, boolean> = {}
      const matchedOthers: string[] = []
      for (const item of checklistItems) {
        items[item] = lower.includes(item.toLowerCase())
      }
      // Remaining items in the text not matching any checklist item
      const parts = text.split(',').map(s => s.trim()).filter(Boolean)
      for (const part of parts) {
        if (!checklistItems.some(ci => ci.toLowerCase() === part.toLowerCase())) {
          matchedOthers.push(part)
        }
      }
      return { items, others: matchedOthers }
    }

    for (const field of fields) {
      if (field.type === 'signature') continue
      // Priority: saved response > prefill > empty
      if (hasValue(saved[field.id])) {
        // If saved value is already structured (medical_checklist), use as-is
        merged[field.id] = saved[field.id]
        // Mark as prefilled so patient sees the hint (these come from previous consent or patient data)
        prefilled.add(field.id)
      } else {
        const pf = getPrefillFor(field)
        if (hasValue(pf)) {
          // For medical_checklist, convert text prefill to structured value
          if (field.type === 'medical_checklist' && typeof pf === 'string' && field.checklistItems) {
            merged[field.id] = textToChecklist(pf, field.checklistItems)
          } else {
            merged[field.id] = pf
          }
          prefilled.add(field.id)
        } else {
          merged[field.id] = field.type === 'checkbox' ? false : field.type === 'medical_checklist' ? { items: {}, others: [] } : ''
        }
      }
    }

    setResponses(merged)
    setPrefilledFields(prefilled)
    setShowSignaturePad(false)
    setHasSignature(false)
    setHasGuardianSignature(false)
    setGuardianName('')
    setGuardianRelation('')
  }

  // Navigate to a different form
  const goToForm = (idx: number) => {
    if (!formData) return
    setCurrentFormIndex(idx)
    initResponses(formData, idx)
  }

  // Signature pad handlers
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const getSignatureData = () => {
    const canvas = canvasRef.current
    return canvas ? canvas.toDataURL('image/png') : ''
  }

  // --- Guardian signature pad ---
  const getGuardianCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = guardianCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startGuardianDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = guardianCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getGuardianCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawingGuardian(true)
  }

  const guardianDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawingGuardian) return
    const canvas = guardianCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getGuardianCanvasCoords(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasGuardianSignature(true)
  }

  const stopGuardianDrawing = () => setIsDrawingGuardian(false)

  const clearGuardianSignature = () => {
    const canvas = guardianCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasGuardianSignature(false)
  }

  const getGuardianSignatureData = () => {
    const canvas = guardianCanvasRef.current
    return canvas ? canvas.toDataURL('image/png') : ''
  }

  // Form field update
  const updateResponse = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
    // Once user edits a prefilled value, remove the prefilled indicator
    setPrefilledFields(prev => {
      if (!prev.has(fieldId)) return prev
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  const currentForm = formData?.forms[currentFormIndex]
  const fields = (currentForm?.formFields || []) as FormField[]
  const hasSignatureField = fields.some(f => f.type === 'signature')

  const areRequiredFieldsFilled = () => {
    return fields.filter(f => f.required && f.type !== 'signature').every(f => {
      const val = responses[f.id]
      if (f.type === 'checkbox') return val === true
      return val !== undefined && val !== '' && val !== null
    })
  }

  // Save progress (draft)
  const handleSaveProgress = async () => {
    if (!currentForm) return
    setSaving(true)
    try {
      const res = await fetch(`/api/checkin-forms/${currentForm.signingToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      toast({ title: 'Progress Saved', description: 'Your answers have been saved. You can continue later.' })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Submit / sign current form
  const handleSubmitForm = async () => {
    if (!currentForm || !formData) return

    if (!areRequiredFieldsFilled()) {
      toast({ title: 'Required Fields', description: 'Please fill in all required fields before submitting.', variant: 'destructive' })
      return
    }

    const needsGuardian = !!currentForm.requiresGuardian

    if (hasSignatureField && !showSignaturePad) {
      setShowSignaturePad(true)
      return
    }

    if (hasSignatureField && !hasSignature) {
      toast({ title: 'Signature Required', description: 'Please draw your signature to continue.', variant: 'destructive' })
      return
    }

    if (needsGuardian) {
      if (!guardianName.trim()) {
        toast({ title: 'Guardian Name Required', description: 'This form requires a parent or legal guardian. Please provide the guardian\u2019s full name.', variant: 'destructive' })
        return
      }
      if (!guardianRelation.trim()) {
        toast({ title: 'Guardian Relationship Required', description: 'Please indicate the guardian\u2019s relationship (e.g., Mother, Father, Legal Guardian).', variant: 'destructive' })
        return
      }
      if (!hasGuardianSignature) {
        toast({ title: 'Guardian Signature Required', description: 'Please ask the guardian to sign in the guardian signature box.', variant: 'destructive' })
        return
      }
    }

    setSigning(true)
    try {
      const signature = hasSignatureField ? getSignatureData() : 'acknowledged'
      const guardianSignature = needsGuardian ? getGuardianSignatureData() : undefined
      const res = await fetch(`/api/checkin-forms/${currentForm.signingToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          responses,
          ...(needsGuardian ? {
            guardianName: guardianName.trim(),
            guardianRelation: guardianRelation.trim(),
            guardianSignature,
          } : {}),
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit')
      }

      toast({ title: '✓ Form Submitted', description: `${currentForm.title} signed successfully!` })

      // Refresh
      await fetchForms()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit form', variant: 'destructive' })
    } finally {
      setSigning(false)
    }
  }

  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#2D9DA8]" />
          <p className="text-gray-600">Loading your forms...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Forms</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!formData) return null

  // All forms signed — success screen
  if (formData.allSigned) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">All Forms Completed!</h2>
            <p className="text-gray-600 mb-4">
              Thank you, <strong>{formData.patientName}</strong>. All {formData.totalForms} form(s) have been signed.
            </p>
            {formData.isStandalone ? (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <CheckCircle className="w-5 h-5 text-green-700" />
                  <p className="text-sm font-semibold text-green-800">Form Submitted Successfully!</p>
                </div>
                <p className="text-xs text-green-600 text-center">Your information has been recorded. You may close this page.</p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <UserCheck className="w-5 h-5 text-green-700" />
                  <p className="text-sm font-semibold text-green-800">You&apos;re Checked In!</p>
                </div>
                <p className="text-xs text-green-600 text-center">You&apos;ve been automatically checked in. Please have a seat, we&apos;ll call you shortly.</p>
              </div>
            )}
            <div className="mt-4 p-3 bg-[#2D9DA8]/5 rounded-lg border border-[#2D9DA8]/20">
              <p className="text-sm font-medium text-[#2D9DA8]">SwiftCare Dental Clinic</p>
              <p className="text-xs text-gray-500">Thank you for your patience!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#2D9DA8]">SwiftCare Dental</h1>
              <p className="text-xs text-gray-500">Patient Forms</p>
            </div>
            <Badge variant="outline" className="text-sm">
              {formData.signedCount}/{formData.totalForms} done
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Welcome, <strong>{formData.patientName}</strong>
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b px-4 py-2">
        <div className="max-w-lg mx-auto flex gap-1">
          {formData.forms.map((form, idx) => (
            <button
              key={form.id}
              onClick={() => !form.isSigned && goToForm(idx)}
              className={`h-2 flex-1 rounded-full transition-colors cursor-pointer ${
                form.isSigned ? 'bg-green-500' :
                idx === currentFormIndex ? 'bg-[#2D9DA8]' :
                'bg-gray-200 hover:bg-gray-300'
              }`}
              title={form.title}
            />
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-lg mx-auto p-4">
        {currentForm && !currentForm.isSigned && (
          <div className="space-y-4">
            {/* Form header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2D9DA8]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#2D9DA8]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{currentForm.title}</h2>
                <p className="text-sm text-gray-500">{currentForm.description}</p>
                <p className="text-xs text-gray-400 mt-1">Form {currentFormIndex + 1} of {formData.totalForms} • Fields marked with <span className="text-red-500">*</span> are required</p>
              </div>
            </div>

            {!showSignaturePad ? (
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-5">
                  {fields.filter(f => f.type !== 'signature').map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-800">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>

                      {(field.type === 'text' || field.type === 'string') && (
                        <Input
                          type="text"
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          className="bg-white"
                        />
                      )}

                      {field.type === 'email' && (
                        <Input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          placeholder={field.placeholder || 'you@example.com'}
                          className="bg-white"
                        />
                      )}

                      {(field.type === 'tel' || field.type === 'phone') && (
                        <Input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          placeholder={field.placeholder || '09XXXXXXXXX'}
                          className="bg-white"
                        />
                      )}

                      {field.type === 'number' && (
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="bg-white"
                        />
                      )}

                      {field.type === 'textarea' && (
                        <Textarea
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          rows={3}
                          className="bg-white"
                        />
                      )}

                      {field.type === 'date' && (
                        <Input
                          type="date"
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          className="bg-white"
                        />
                      )}

                      {field.type === 'select' && (
                        <select
                          value={responses[field.id] || ''}
                          onChange={(e) => updateResponse(field.id, e.target.value)}
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9DA8]/30 focus:border-[#2D9DA8]"
                        >
                          <option value="">Select...</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === 'radio' && (
                        <div className="flex flex-wrap gap-3 pt-1">
                          {field.options?.map(opt => (
                            <label key={opt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              responses[field.id] === opt ? 'border-[#2D9DA8] bg-[#2D9DA8]/5 text-[#2D9DA8]' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name={field.id}
                                value={opt}
                                checked={responses[field.id] === opt}
                                onChange={() => updateResponse(field.id, opt)}
                                className="w-3.5 h-3.5 accent-[#2D9DA8]"
                              />
                              <span className="text-sm">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === 'checkbox' && (
                        <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors -mx-2">
                          <Checkbox
                            checked={responses[field.id] === true}
                            onCheckedChange={(checked) => updateResponse(field.id, !!checked)}
                            className="mt-0.5"
                          />
                          <span className="text-sm text-gray-700 leading-snug">{field.label}</span>
                        </label>
                      )}

                      {field.type === 'medical_checklist' && (() => {
                        const val: MedicalChecklistValue = responses[field.id] && typeof responses[field.id] === 'object'
                          ? responses[field.id]
                          : { items: {}, others: [] }
                        const items = field.checklistItems || []
                        const toggleItem = (item: string) => {
                          const newItems = { ...val.items, [item]: !val.items[item] }
                          updateResponse(field.id, { ...val, items: newItems })
                        }
                        const addOther = () => {
                          const newOthers = [...(val.others || []), '']
                          updateResponse(field.id, { ...val, others: newOthers })
                        }
                        const updateOther = (idx: number, text: string) => {
                          const newOthers = [...(val.others || [])]
                          newOthers[idx] = text
                          updateResponse(field.id, { ...val, others: newOthers })
                        }
                        const removeOther = (idx: number) => {
                          const newOthers = (val.others || []).filter((_: string, i: number) => i !== idx)
                          updateResponse(field.id, { ...val, others: newOthers })
                        }
                        return (
                          <div className="space-y-1">
                            {items.map((item, idx) => {
                              const isYes = val.items[item] === true
                              const isNo = val.items[item] === false
                              return (
                                <div key={item} className="flex items-center justify-between py-2.5 px-1 border-b border-gray-100 last:border-0">
                                  <span className="text-sm text-gray-700">{idx + 1}. {item}</span>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newItems = { ...val.items, [item]: false }
                                        updateResponse(field.id, { ...val, items: newItems })
                                      }}
                                      className={`text-xs px-4 py-1 rounded-md border font-medium transition-all ${
                                        isNo
                                          ? 'bg-[#2D9DA8] text-white border-[#2D9DA8] shadow-sm'
                                          : 'text-gray-500 bg-white border-gray-200 hover:border-[#2D9DA8] hover:text-[#2D9DA8]'
                                      }`}
                                    >
                                      No
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newItems = { ...val.items, [item]: true }
                                        updateResponse(field.id, { ...val, items: newItems })
                                      }}
                                      className={`text-xs px-4 py-1 rounded-md border font-medium transition-all ${
                                        isYes
                                          ? 'bg-[#2D9DA8] text-white border-[#2D9DA8] shadow-sm'
                                          : 'text-gray-500 bg-white border-gray-200 hover:border-[#2D9DA8] hover:text-[#2D9DA8]'
                                      }`}
                                    >
                                      Yes
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                            {/* Others, please specify */}
                            <div className="pt-3">
                              <p className="text-sm font-semibold text-gray-700 mb-2">Others, please specify:</p>
                              {(val.others || []).map((other: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 mb-2">
                                  <Input
                                    value={other}
                                    onChange={e => updateOther(idx, e.target.value)}
                                    placeholder="Enter other item..."
                                    className="flex-1 text-sm bg-white"
                                  />
                                  <button type="button" onClick={() => removeOther(idx)} className="text-gray-400 hover:text-red-500 p-1">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={addOther}
                                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Show pre-filled indicator */}
                      {prefilledFields.has(field.id) && responses[field.id] && field.type !== 'checkbox' && (
                        <p className="text-xs text-blue-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Pre-filled from your records — please review and edit if needed
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Action buttons */}
                  <div className="pt-4 space-y-3 border-t">
                    <Button
                      onClick={handleSubmitForm}
                      disabled={!areRequiredFieldsFilled() || signing}
                      className="w-full bg-[#2D9DA8] hover:bg-[#258d97] text-white h-12 text-base"
                    >
                      {signing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                      ) : hasSignatureField ? (
                        <><Pen className="w-4 h-4 mr-2" /> Continue to Sign</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-2" /> Submit Form</>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSaveProgress}
                      disabled={saving}
                      className="w-full h-10"
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save Progress</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Signature pad */
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#22B573]/10 flex items-center justify-center mx-auto mb-3">
                      <Pen className="w-6 h-6 text-[#22B573]" />
                    </div>
                    <p className="text-base font-semibold text-gray-900">Sign to Submit</p>
                    <p className="text-sm text-gray-500">Use your finger or stylus to draw your signature</p>
                  </div>

                  {/* Patient signature */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Patient Signature{currentForm?.requiresGuardian ? ' (if able to sign)' : ''}
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white relative overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={200}
                        className="w-full touch-none cursor-crosshair"
                        style={{ height: '180px' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      {!hasSignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <p className="text-gray-300 text-sm">Draw your signature here</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-1">
                      <Button size="sm" variant="ghost" onClick={clearSignature} disabled={!hasSignature} className="h-7 text-xs">
                        <RotateCcw className="w-3 h-3 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>

                  {/* Guardian fields (only shown for minors / forms requiring a guardian) */}
                  {currentForm?.requiresGuardian && (
                    <div className="space-y-3 border-t pt-4 bg-amber-50/50 -mx-5 px-5 py-4 rounded-b-lg">
                      <div className="flex items-start gap-2">
                        <UserCheck className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">Parent / Legal Guardian Required</p>
                          <p className="text-xs text-amber-700">
                            {formData.isMinor
                              ? 'The patient is under 18 years old. A parent or legal guardian must also sign this form.'
                              : 'This form requires a parent or legal guardian signature in addition to the patient\u2019s.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Guardian Full Name *</Label>
                          <Input
                            value={guardianName}
                            onChange={e => setGuardianName(e.target.value)}
                            placeholder="e.g., Maria Cruz"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Relationship to Patient *</Label>
                          <Input
                            value={guardianRelation}
                            onChange={e => setGuardianRelation(e.target.value)}
                            placeholder="e.g., Mother, Father, Legal Guardian"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                          Guardian Signature *
                        </Label>
                        <div className="border-2 border-dashed border-amber-400 rounded-xl bg-white relative overflow-hidden">
                          <canvas
                            ref={guardianCanvasRef}
                            width={400}
                            height={200}
                            className="w-full touch-none cursor-crosshair"
                            style={{ height: '160px' }}
                            onMouseDown={startGuardianDrawing}
                            onMouseMove={guardianDraw}
                            onMouseUp={stopGuardianDrawing}
                            onMouseLeave={stopGuardianDrawing}
                            onTouchStart={startGuardianDrawing}
                            onTouchMove={guardianDraw}
                            onTouchEnd={stopGuardianDrawing}
                          />
                          {!hasGuardianSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <p className="text-amber-300 text-sm">Guardian, please sign here</p>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end mt-1">
                          <Button size="sm" variant="ghost" onClick={clearGuardianSignature} disabled={!hasGuardianSignature} className="h-7 text-xs">
                            <RotateCcw className="w-3 h-3 mr-1" /> Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSignaturePad(false)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      onClick={handleSubmitForm}
                      disabled={!hasSignature || signing || (!!currentForm?.requiresGuardian && (!guardianName.trim() || !guardianRelation.trim() || !hasGuardianSignature))}
                      className="flex-1 bg-[#22B573] hover:bg-[#1da065] text-white"
                    >
                      {signing ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Signing...</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Sign &amp; Submit</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Forms overview / navigation */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">All Forms</p>
                <div className="space-y-2">
                  {formData.forms.map((form, idx) => (
                    <button
                      key={form.id}
                      onClick={() => goToForm(idx)}
                      disabled={form.isSigned}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-all ${
                        form.isSigned
                          ? 'bg-green-50 text-green-800 cursor-default'
                          : idx === currentFormIndex
                          ? 'bg-[#2D9DA8]/5 text-[#2D9DA8] ring-1 ring-[#2D9DA8]/30'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        form.isSigned
                          ? 'bg-green-200 text-green-800'
                          : idx === currentFormIndex
                          ? 'bg-[#2D9DA8] text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {form.isSigned ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className="flex-1 truncate font-medium">{form.title}</span>
                      {form.isSigned && <span className="text-xs text-green-600 font-medium">Signed ✓</span>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* If current form is already signed, auto-navigate */}
        {currentForm?.isSigned && !formData.allSigned && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">This form has already been signed.</p>
            <Button
              onClick={() => {
                const next = formData.forms.findIndex((f, i) => !f.isSigned && i > currentFormIndex)
                const target = next >= 0 ? next : formData.forms.findIndex(f => !f.isSigned)
                if (target >= 0) goToForm(target)
              }}
              className="bg-[#2D9DA8] hover:bg-[#258d97] text-white"
            >
              Continue to Next Form <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-lg mx-auto px-4 pb-8 pt-4 text-center">
        <p className="text-xs text-gray-400">SwiftCare Dental Clinic • Your data is securely transmitted</p>
      </div>
    </div>
  )
}

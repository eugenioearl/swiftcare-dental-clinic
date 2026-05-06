'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Image from 'next/image'
import {
  FileText, CheckCircle, AlertCircle, Loader2, PenTool,
  Eraser, Shield, DollarSign, Stethoscope, Clock, Pen, RotateCcw, Plus, X
} from 'lucide-react'

/** Structured value for medical_checklist field type */
interface MedicalChecklistValue {
  items: Record<string, boolean>
  others: string[]
}

interface FormField {
  id: string
  type: string
  label: string
  required?: boolean
  options?: string[]
  placeholder?: string
  helpText?: string
  checklistItems?: string[]
}

interface ConsentData {
  id: string
  consentNumber: string
  title: string
  formContent: string | null
  formFields: FormField[] | null
  formResponses: Record<string, any> | null
  treatmentSummary: any
  financialSummary: any
  patientName: string
  packageTitle: string | null
  preparedBy: string | null
  status: string
  round: number
  hasPatientSignature: boolean
  hasWitnessSignature: boolean
}

export default function ConsentSigningPage({ params }: { params: { token: string } }) {
  const [consent, setConsent] = useState<ConsentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [signing, setSigning] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [showSignaturePad, setShowSignaturePad] = useState(false)

  useEffect(() => {
    fetch(`/api/consent/${params.token}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Failed to load')
        setConsent(data.consent)
        // Pre-populate responses from existing formResponses
        if (data.consent.formResponses && typeof data.consent.formResponses === 'object') {
          setResponses(data.consent.formResponses)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.token])

  // Canvas coordinate helper
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const updateResponse = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
  }

  // Check if all required non-signature fields are filled
  const fields = (consent?.formFields || []) as FormField[]
  const nonSignatureFields = fields.filter(f => f.type !== 'signature')
  const hasSignatureField = fields.some(f => f.type === 'signature')

  const areRequiredFieldsFilled = () => {
    return nonSignatureFields.filter(f => f.required).every(f => {
      const val = responses[f.id]
      if (f.type === 'checkbox') return val === true
      return val !== undefined && val !== '' && val !== null
    })
  }

  const handleSubmitForm = async () => {
    if (!consent) return

    if (!areRequiredFieldsFilled()) {
      setError('Please fill in all required fields before submitting.')
      return
    }

    // If there's a signature field and we haven't shown the pad yet, show it
    if (hasSignatureField && !showSignaturePad) {
      setShowSignaturePad(true)
      return
    }

    if (!hasDrawn) {
      setError('Please draw your signature to submit.')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    setSigning(true)
    setError(null)
    try {
      const signature = canvas.toDataURL('image/png')
      const res = await fetch(`/api/consent/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, responses })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to sign')
      }
      setSigned(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#2D9DA8]" />
          <p className="text-gray-600">Loading consent form...</p>
        </div>
      </div>
    )
  }

  if (error && !consent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Consent</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Consent Signed Successfully</h2>
            <p className="text-gray-600 mb-4">Thank you for signing the consent form. Your dentist has been notified.</p>
            <Badge className="bg-green-100 text-green-700">{consent?.consentNumber}</Badge>
            <div className="mt-4 p-3 bg-[#2D9DA8]/5 rounded-lg border border-[#2D9DA8]/20">
              <p className="text-sm font-medium text-[#2D9DA8]">SwiftCare Dental Clinic</p>
              <p className="text-xs text-gray-500">Thank you for your patience!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!consent) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-8">
                <Image src="/clinic/logo.png" alt="SwiftCare" fill className="object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#2D9DA8]">SwiftCare Dental</h1>
                <p className="text-xs text-gray-500">Digital Consent Form</p>
              </div>
            </div>
            <Badge className="bg-[#2D9DA8]/10 text-[#2D9DA8]">{consent.consentNumber}</Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Patient: <strong>{consent.patientName}</strong>
            {consent.packageTitle && <span className="text-gray-400"> • {consent.packageTitle}</span>}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Treatment Summary */}
        {consent.treatmentSummary && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#2D9DA8]" />
                Treatment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {consent.treatmentSummary.procedures?.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{p.name}{p.toothNumber ? ` (Tooth #${p.toothNumber})` : ''}</span>
                    <span className="font-medium">₱{p.cost?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Summary */}
        {consent.financialSummary && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#22B573]" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="font-medium">₱{consent.financialSummary.totalAmount?.toLocaleString()}</span></div>
                {consent.financialSummary.coveredAmount > 0 && (
                  <div className="flex justify-between"><span className="text-green-600">Coverage</span><span className="text-green-600">-₱{consent.financialSummary.coveredAmount?.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between border-t pt-1 font-bold"><span>Patient Payable</span><span className="text-[#2D9DA8]">₱{consent.financialSummary.patientPayable?.toLocaleString()}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2D9DA8]/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[#2D9DA8]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{consent.title}</h2>
            {consent.preparedBy && (
              <p className="text-sm text-gray-500">Prepared by: {consent.preparedBy}</p>
            )}
            {nonSignatureFields.some(f => f.required) && (
              <p className="text-xs text-gray-400 mt-1">Fields marked with <span className="text-red-500">*</span> are required</p>
            )}
          </div>
        </div>

        {/* Form Fields — interactive, matching forms/sign style */}
        {!showSignaturePad ? (
          <Card className="shadow-sm">
            <CardContent className="p-5 space-y-5">
              {nonSignatureFields.length > 0 ? (
                nonSignatureFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    {field.type !== 'checkbox' && (
                      <Label className="text-sm font-medium text-gray-800">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                    )}
                    {field.helpText && <p className="text-xs text-gray-500">{field.helpText}</p>}

                    {field.type === 'textarea' && (
                      <Textarea
                        value={responses[field.id] || ''}
                        onChange={(e) => updateResponse(field.id, e.target.value)}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        rows={4}
                        className="bg-white"
                      />
                    )}

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
                          {items.map((item: string, idx: number) => {
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
                  </div>
                ))
              ) : consent.formContent ? (
                <div className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {consent.formContent}
                </div>
              ) : null}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit / Continue to Sign button */}
              {!consent.hasPatientSignature && (
                <div className="pt-4 border-t">
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
                </div>
              )}

              {consent.hasPatientSignature && (
                <div className="pt-4 border-t text-center">
                  <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Patient signature recorded</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Signature Pad */
          <Card className="shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#22B573]/10 flex items-center justify-center mx-auto mb-3">
                  <Pen className="w-6 h-6 text-[#22B573]" />
                </div>
                <p className="text-base font-semibold text-gray-900">Sign to Submit</p>
                <p className="text-sm text-gray-500">Use your finger or stylus to draw your signature</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Patient Signature</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white relative overflow-hidden" style={{ touchAction: 'none' }}>
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
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-gray-300 text-sm">Draw your signature here</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-1">
                  <Button size="sm" variant="ghost" onClick={clearCanvas} disabled={!hasDrawn} className="h-7 text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" /> Clear
                  </Button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSignaturePad(false)}
                  className="h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitForm}
                  disabled={!hasDrawn || signing}
                  className="flex-1 bg-[#2D9DA8] hover:bg-[#258d97] text-white h-12 text-base"
                >
                  {signing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><PenTool className="w-4 h-4 mr-2" /> Confirm & Sign</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-6">
          <Shield className="w-3 h-3 inline mr-1" />
          This is a secure digital consent form. Your signature is legally binding.
        </div>
      </div>
    </div>
  )
}

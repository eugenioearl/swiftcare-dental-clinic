
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Signature,
  Download, 
  Printer, 
  Save, 
  Eye,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Shield,
  X,
  Plus,
  Settings
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'signature' | 'file' | 'number' | 'email' | 'phone'
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  value?: any
  position?: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface FormSubmission {
  id: string
  formId: string
  patientId: string
  patientName: string
  submittedAt: string
  status: 'draft' | 'completed' | 'verified' | 'signed'
  data: Record<string, any>
  signatures: {
    patient?: {
      signature: string
      timestamp: string
      ipAddress: string
    }
    provider?: {
      signature: string
      timestamp: string
      userId: string
      name: string
    }
  }
  verification?: {
    verifiedBy: string
    verifiedAt: string
    verificationNotes?: string
  }
}

interface EnhancedFormBuilderProps {
  formId?: string
  mode: 'builder' | 'fill' | 'view'
  initialData?: Partial<FormSubmission>
  onSave?: (data: any) => void
  onSubmit?: (data: FormSubmission) => void
  patientInfo?: {
    id: string
    name: string
    email: string
    phone: string
  }
}

export default function EnhancedFormBuilder({
  formId,
  mode = 'builder',
  initialData,
  onSave,
  onSubmit,
  patientInfo
}: EnhancedFormBuilderProps) {
  const [formTitle, setFormTitle] = useState('Untitled Form')
  const [formDescription, setFormDescription] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [currentSignature, setCurrentSignature] = useState<string>('')
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false)
  const [signatureFieldId, setSignatureFieldId] = useState<string>('')
  const [formStatus, setFormStatus] = useState<'draft' | 'completed' | 'verified' | 'signed'>('draft')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormTitle(initialData.formId || 'Untitled Form')
      setFormData(initialData.data || {})
      setFormStatus(initialData.status || 'draft')
    }
  }, [initialData])

  // Default form templates
  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: `New ${type} field`,
      required: false,
      placeholder: type === 'text' ? 'Enter text...' : undefined,
      options: type === 'select' || type === 'radio' ? ['Option 1', 'Option 2'] : undefined
    }
    setFields([...fields, newField])
  }

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ))
  }

  const removeField = (fieldId: string) => {
    setFields(fields.filter(field => field.id !== fieldId))
    const newFormData = { ...formData }
    delete newFormData[fieldId]
    setFormData(newFormData)
  }

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }))
  }

  // Signature pad functionality
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
      }
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
        ctx.stroke()
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const signatureData = canvas.toDataURL()
      setCurrentSignature(signatureData)
      handleFieldChange(signatureFieldId, signatureData)
      setIsSignaturePadOpen(false)
      toast.success('Signature captured successfully')
    }
  }

  const openSignaturePad = (fieldId: string) => {
    setSignatureFieldId(fieldId)
    setIsSignaturePadOpen(true)
  }

  // Form validation
  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        errors.push(`${field.label} is required`)
      }
      
      if (field.validation && formData[field.id]) {
        const value = formData[field.id]
        const validation = field.validation
        
        if (validation.min && value.length < validation.min) {
          errors.push(`${field.label} must be at least ${validation.min} characters`)
        }
        
        if (validation.max && value.length > validation.max) {
          errors.push(`${field.label} must not exceed ${validation.max} characters`)
        }
        
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          errors.push(validation.message || `${field.label} format is invalid`)
        }
      }
    })
    
    return { isValid: errors.length === 0, errors }
  }

  // Form submission
  const handleSubmitForm = async () => {
    const validation = validateForm()
    
    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error))
      return
    }

    setLoading(true)
    
    try {
      const submission: FormSubmission = {
        id: `submission_${Date.now()}`,
        formId: formId || 'unknown',
        patientId: patientInfo?.id || 'unknown',
        patientName: patientInfo?.name || 'Unknown Patient',
        submittedAt: new Date().toISOString(),
        status: 'completed',
        data: formData,
        signatures: {
          patient: fields.some(f => f.type === 'signature' && formData[f.id]) ? {
            signature: Object.values(formData).find((val: any) => 
              typeof val === 'string' && val.startsWith('data:image')
            ) as string,
            timestamp: new Date().toISOString(),
            ipAddress: 'unknown' // Would be captured server-side
          } : undefined
        }
      }

      if (onSubmit) {
        await onSubmit(submission)
      }

      setFormStatus('completed')
      toast.success('Form submitted successfully')
      
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Failed to submit form')
    } finally {
      setLoading(false)
    }
  }

  // Save form template
  const handleSaveTemplate = async () => {
    setLoading(true)
    
    try {
      const template = {
        id: formId || `template_${Date.now()}`,
        title: formTitle,
        description: formDescription,
        fields,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      }

      if (onSave) {
        await onSave(template)
      }

      toast.success('Form template saved successfully')
      
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  // Download/Print functionality
  const downloadPDF = () => {
    // Implementation would use a PDF generation library
    toast.success('PDF download feature would be implemented here')
  }

  const printForm = () => {
    window.print()
  }

  // Field type configurations
  const fieldTypeOptions = [
    { value: 'text', label: 'Text Input', icon: '📝' },
    { value: 'textarea', label: 'Text Area', icon: '📄' },
    { value: 'select', label: 'Dropdown', icon: '📋' },
    { value: 'checkbox', label: 'Checkbox', icon: '☑️' },
    { value: 'radio', label: 'Radio Button', icon: '🔘' },
    { value: 'date', label: 'Date Picker', icon: '📅' },
    { value: 'signature', label: 'Signature', icon: '✍️' },
    { value: 'file', label: 'File Upload', icon: '📎' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'phone', label: 'Phone', icon: '📞' }
  ]

  const renderFormField = (field: FormField, index: number) => {
    const commonProps = {
      id: field.id,
      required: field.required,
      className: "w-full"
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <Input
            {...commonProps}
            type={field.type}
            placeholder={field.placeholder}
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={mode === 'view'}
          />
        )

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            placeholder={field.placeholder}
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={mode === 'view'}
          />
        )

      case 'select':
        return (
          <Select
            value={formData[field.id] || ''}
            onValueChange={(value) => handleFieldChange(field.id, value)}
            disabled={mode === 'view'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, optIndex) => (
                <SelectItem key={optIndex} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={formData[field.id] || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              disabled={mode === 'view'}
              className="rounded border-gray-300"
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.placeholder || 'Check this option'}
            </Label>
          </div>
        )

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, optIndex) => (
              <div key={optIndex} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.id}_${optIndex}`}
                  name={field.id}
                  value={option}
                  checked={formData[field.id] === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  disabled={mode === 'view'}
                  className="rounded-full border-gray-300"
                />
                <Label htmlFor={`${field.id}_${optIndex}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        )

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={mode === 'view'}
          />
        )

      case 'signature':
        return (
          <div className="space-y-2">
            {formData[field.id] ? (
              <div className="border rounded p-4">
                <img
                  src={formData[field.id]}
                  alt="Signature"
                  className="max-h-20 border rounded"
                />
                {mode !== 'view' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSignaturePad(field.id)}
                    className="mt-2"
                  >
                    <Signature className="w-4 h-4 mr-2" />
                    Re-sign
                  </Button>
                )}
              </div>
            ) : (
              mode !== 'view' && (
                <Button
                  variant="outline"
                  onClick={() => openSignaturePad(field.id)}
                  className="w-full h-20"
                >
                  <Signature className="w-6 h-6 mr-2" />
                  Click to Sign
                </Button>
              )
            )}
          </div>
        )

      case 'file':
        return (
          <Input
            {...commonProps}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                // In production, this would upload to cloud storage
                handleFieldChange(field.id, file.name)
              }
            }}
            disabled={mode === 'view'}
          />
        )

      default:
        return (
          <Input
            {...commonProps}
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={mode === 'view'}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          {mode === 'builder' ? (
            <div className="space-y-2">
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="text-2xl font-bold border-none p-0 h-auto"
                placeholder="Form Title"
              />
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Form description..."
                className="border-none p-0 resize-none"
              />
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold">{formTitle}</h1>
              {formDescription && (
                <p className="text-muted-foreground">{formDescription}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          {mode !== 'builder' && (
            <>
              <Button variant="outline" onClick={downloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={printForm}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </>
          )}
          
          {mode === 'builder' && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {isPreviewMode ? 'Edit' : 'Preview'}
              </Button>
              <Button onClick={handleSaveTemplate} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form Status */}
      {mode !== 'builder' && (
        <div className="flex items-center space-x-2">
          <Badge
            variant={
              formStatus === 'signed' ? 'default' :
              formStatus === 'verified' ? 'secondary' :
              formStatus === 'completed' ? 'outline' : 'destructive'
            }
          >
            {formStatus === 'signed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {formStatus === 'verified' && <Shield className="w-3 h-3 mr-1" />}
            {formStatus === 'draft' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {formStatus.charAt(0).toUpperCase() + formStatus.slice(1)}
          </Badge>
          
          {patientInfo && (
            <Badge variant="outline">
              <User className="w-3 h-3 mr-1" />
              {patientInfo.name}
            </Badge>
          )}
          
          <Badge variant="outline">
            <Calendar className="w-3 h-3 mr-1" />
            {new Date().toLocaleDateString()}
          </Badge>
        </div>
      )}

      {/* Field Builder Toolbar (Builder Mode) */}
      {mode === 'builder' && !isPreviewMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Form Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {fieldTypeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => addField(option.value as FormField['type'])}
                  className="flex flex-col h-16 text-xs"
                >
                  <span className="text-lg mb-1">{option.icon}</span>
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <Card key={field.id} className="relative">
            <CardContent className="p-4">
              {/* Field Editor (Builder Mode) */}
              {mode === 'builder' && !isPreviewMode && (
                <div className="absolute top-2 right-2 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(field.id)}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Field Configuration (Builder Mode) */}
              {mode === 'builder' && !isPreviewMode && (
                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded">
                  <div>
                    <Label className="text-xs">Field Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`required-${field.id}`}
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor={`required-${field.id}`} className="text-xs">
                      Required
                    </Label>
                  </div>

                  {(field.type === 'select' || field.type === 'radio') && (
                    <div>
                      <Label className="text-xs">Options (comma separated)</Label>
                      <Input
                        value={field.options?.join(', ') || ''}
                        onChange={(e) => updateField(field.id, {
                          options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                        })}
                        className="h-8"
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Field Display */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {renderFormField(field, index)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Actions */}
      {mode === 'fill' && (
        <div className="flex justify-end space-x-2">
          <Button variant="outline">
            Save Draft
          </Button>
          <Button onClick={handleSubmitForm} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Form'}
          </Button>
        </div>
      )}

      {/* Signature Pad Dialog */}
      <Dialog open={isSignaturePadOpen} onOpenChange={setIsSignaturePadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Digital Signature</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded p-2">
              <canvas
                ref={canvasRef}
                width={400}
                height={200}
                className="border rounded cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={clearSignature}>
                Clear
              </Button>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSignaturePadOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={saveSignature}>
                  Save Signature
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

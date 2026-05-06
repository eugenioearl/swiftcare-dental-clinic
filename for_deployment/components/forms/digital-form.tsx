
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { FileText, Download, Upload, Check, X, Signature } from 'lucide-react'
import { format } from 'date-fns'

export interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'signature'
  label: string
  required?: boolean
  options?: string[]
  placeholder?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

interface DigitalFormProps {
  formId: string
  title: string
  description?: string
  fields: FormField[]
  patientId?: string
  appointmentId?: string
  onSubmit: (data: Record<string, any>) => Promise<void>
  onSave?: (data: Record<string, any>) => Promise<void>
  initialData?: Record<string, any>
  showSignature?: boolean
  requireSignature?: boolean
}

export function DigitalForm({
  formId,
  title,
  description,
  fields,
  patientId,
  appointmentId,
  onSubmit,
  onSave,
  initialData = {},
  showSignature = false,
  requireSignature = false
}: DigitalFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<Record<string, any>>(initialData)
  const [signature, setSignature] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }))
    
    // Clear field error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    fields.forEach(field => {
      const value = formData[field.id]
      
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        newErrors[field.id] = `${field.label} is required`
      }
      
      if (field.validation && value) {
        if (field.validation.min && value.length < field.validation.min) {
          newErrors[field.id] = `${field.label} must be at least ${field.validation.min} characters`
        }
        
        if (field.validation.max && value.length > field.validation.max) {
          newErrors[field.id] = `${field.label} must be no more than ${field.validation.max} characters`
        }
        
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          newErrors[field.id] = `${field.label} format is invalid`
        }
      }
    })

    if (requireSignature && !signature) {
      newErrors.signature = 'Signature is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!onSave) return

    try {
      setIsSaving(true)
      await onSave({
        ...formData,
        signature,
        savedAt: new Date().toISOString()
      })
      
      toast({
        title: "Form saved",
        description: "Your progress has been saved as draft.",
      })
    } catch (error) {
      console.error('Error saving form:', error)
      toast({
        title: "Error saving form",
        description: "Failed to save form. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Form validation failed",
        description: "Please fix the errors and try again.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        ...formData,
        signature,
        submittedAt: new Date().toISOString(),
        patientId,
        appointmentId
      })
      
      toast({
        title: "Form submitted successfully",
        description: "Your form has been submitted and saved.",
      })
    } catch (error) {
      console.error('Error submitting form:', error)
      toast({
        title: "Error submitting form",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderField = (field: FormField) => {
    const value = formData[field.id] || ''
    const hasError = !!errors[field.id]

    switch (field.type) {
      case 'text':
      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={hasError ? 'border-red-500' : ''}
            />
            {hasError && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={hasError ? 'border-red-500' : ''}
              rows={4}
            />
            {hasError && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select onValueChange={(value) => handleFieldChange(field.id, value)} value={value}>
              <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={!!value}
                onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
              />
              <Label htmlFor={field.id} className="flex items-center cursor-pointer">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {hasError && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        )

      case 'signature':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="flex items-center">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px] flex items-center justify-center">
              {signature ? (
                <div className="text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Signature captured</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSignature(null)}
                    className="mt-2"
                  >
                    Clear Signature
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Signature className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to add signature</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // In a real implementation, this would open a signature pad
                      setSignature(`signature_${Date.now()}`)
                    }}
                    className="mt-2"
                  >
                    Add Signature
                  </Button>
                </div>
              )}
            </div>
            {hasError && (
              <p className="text-sm text-red-500">{errors[field.id]}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-gray-600 mt-2">{description}</p>
            )}
          </div>
          <Badge variant="outline">
            Digital Form
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Form Fields */}
        {fields.map(renderField)}

        {/* Signature Section */}
        {showSignature && (
          <div className="space-y-2">
            <Label className="flex items-center">
              Electronic Signature
              {requireSignature && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px] flex items-center justify-center">
              {signature ? (
                <div className="text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Signature captured</p>
                  <p className="text-xs text-gray-500">Signed on {format(new Date(), 'PPP')}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSignature(null)}
                    className="mt-2"
                  >
                    Clear Signature
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Signature className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to add your electronic signature</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // In a real implementation, this would open a signature pad
                      setSignature(`signature_${Date.now()}`)
                    }}
                    className="mt-2"
                  >
                    Add Signature
                  </Button>
                </div>
              )}
            </div>
            {errors.signature && (
              <p className="text-sm text-red-500">{errors.signature}</p>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-between pt-6 border-t">
          <div className="flex space-x-3">
            {onSave && (
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Form'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

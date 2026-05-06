
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SignaturePad from '@/components/digital-signature/signature-pad'
import { FileText, Lock, Eye, EyeOff } from 'lucide-react'

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'signature'
  label: string
  required: boolean
  options?: string[]
  value?: any
}

interface DigitalFormProps {
  formTemplate: {
    id: string
    name: string
    fields: FormField[]
    requiresPatientSignature: boolean
    requiresDentistSignature: boolean
    visibility: 'patient_visible' | 'internal_only'
  }
  patientId: string
  procedureType?: string
  onSubmit: (formData: any) => void
  readonly?: boolean
}

export default function DigitalForm({ 
  formTemplate, 
  patientId, 
  procedureType, 
  onSubmit, 
  readonly = false 
}: DigitalFormProps) {
  const [formData, setFormData] = useState<any>({})
  const [signatures, setSignatures] = useState({
    patient: '',
    dentist: ''
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [fieldId]: value
    }))
  }

  const handleSubmit = () => {
    // Validate required fields
    const missingFields = formTemplate.fields.filter(field => 
      field.required && !formData[field.id]
    )

    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    // Validate signatures
    if (formTemplate.requiresPatientSignature && !signatures.patient) {
      alert('Patient signature is required')
      return
    }

    if (formTemplate.requiresDentistSignature && !signatures.dentist) {
      alert('Dentist signature is required')
      return
    }

    const submissionData = {
      formId: formTemplate.id,
      patientId,
      procedureType,
      formData,
      signatures,
      timestamp: new Date().toISOString(),
      visibility: formTemplate.visibility
    }

    onSubmit(submissionData)
    setIsSubmitted(true)
  }

  const renderField = (field: FormField) => {
    const value = formData[field.id] || ''

    if (readonly && !value) return null

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={readonly}
              required={field.required}
            />
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={readonly}
              required={field.required}
              rows={3}
            />
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleFieldChange(field.id, val)}
              disabled={readonly}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
              disabled={readonly}
            />
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
          </div>
        )

      default:
        return null
    }
  }

  if (isSubmitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <FileText className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-800 mb-2">Form Submitted Successfully</h3>
          <p className="text-green-700">
            {formTemplate.name} has been completed and stored securely.
          </p>
          <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-green-600">
            <Lock className="w-4 h-4" />
            <span>Encrypted & Audited</span>
            {formTemplate.visibility === 'patient_visible' ? (
              <>
                <Eye className="w-4 h-4 ml-4" />
                <span>Patient Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 ml-4" />
                <span>Internal Only</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          {formTemplate.name}
        </CardTitle>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Secure Form</span>
          </div>
          {formTemplate.visibility === 'patient_visible' ? (
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600">Patient Visible</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <EyeOff className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600">Internal Only</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form Fields */}
        <div className="space-y-4">
          {formTemplate.fields.map(renderField)}
        </div>

        {/* Signatures Section */}
        {(formTemplate.requiresPatientSignature || formTemplate.requiresDentistSignature) && !readonly && (
          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Digital Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formTemplate.requiresPatientSignature && (
                <SignaturePad
                  title="Patient Signature"
                  onSignature={(sig) => setSignatures(prev => ({ ...prev, patient: sig }))}
                  width={300}
                  height={150}
                />
              )}
              {formTemplate.requiresDentistSignature && (
                <SignaturePad
                  title="Dentist Signature"
                  onSignature={(sig) => setSignatures(prev => ({ ...prev, dentist: sig }))}
                  width={300}
                  height={150}
                />
              )}
            </div>
          </div>
        )}

        {/* Display signatures if readonly */}
        {readonly && (signatures.patient || signatures.dentist) && (
          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {signatures.patient && (
                <div>
                  <Label className="mb-2 block">Patient Signature</Label>
                  <img src={signatures.patient} alt="Patient Signature" className="border rounded" />
                </div>
              )}
              {signatures.dentist && (
                <div>
                  <Label className="mb-2 block">Dentist Signature</Label>
                  <img src={signatures.dentist} alt="Dentist Signature" className="border rounded" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!readonly && !isSubmitted && (
          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} size="lg">
              Submit Form
            </Button>
          </div>
        )}

        {/* Audit Trail */}
        <div className="text-xs text-gray-500 border-t pt-4">
          <div>Form ID: {formTemplate.id}</div>
          <div>Patient ID: {patientId}</div>
          {procedureType && <div>Procedure: {procedureType}</div>}
          <div>Timestamp: {new Date().toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  )
}

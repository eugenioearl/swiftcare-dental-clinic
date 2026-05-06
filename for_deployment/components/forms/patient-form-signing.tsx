
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  PenTool, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Eye,
  Calendar,
  User,
  Shield
} from 'lucide-react'
import SignaturePad from '@/components/digital-signature/signature-pad'
import { useToast } from '@/hooks/use-toast'

interface PatientForm {
  id: string
  title: string
  formType: 'consent' | 'medical_history' | 'treatment_agreement' | 'privacy_notice' | 'financial_agreement'
  description: string
  content: string
  isRequired: boolean
  appointmentId?: string
  procedureCode?: string
  status: 'pending' | 'signed' | 'expired'
  createdAt: string
  dueDate?: string
  signedAt?: string
  patientSignature?: string
  witnessSignature?: string
}

interface PatientFormSigningProps {
  patientId: string
  appointmentId?: string
  onFormSigned?: (formId: string) => void
}

export default function PatientFormSigning({ patientId, appointmentId, onFormSigned }: PatientFormSigningProps) {
  const { toast } = useToast()
  const [forms, setForms] = useState<PatientForm[]>([])
  const [selectedForm, setSelectedForm] = useState<PatientForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [patientSignature, setPatientSignature] = useState<string>('')
  const [witnessSignature, setWitnessSignature] = useState<string>('')
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [additionalNotes, setAdditionalNotes] = useState('')

  // Mock forms data
  const mockForms: PatientForm[] = [
    {
      id: 'form-consent-001',
      title: 'General Dental Treatment Consent',
      formType: 'consent',
      description: 'General consent for routine dental procedures and treatments',
      content: `
INFORMED CONSENT FOR DENTAL TREATMENT

Patient Name: _________________________ Date: _____________

I understand that dentistry is not an exact science and that no guarantee of success has been made to me regarding the proposed treatment. I acknowledge that no guarantee has been made that the proposed treatment will cure or improve the condition(s) listed above.

I understand the proposed treatment plan, including the benefits, risks, and alternatives. Alternative treatments may include:
• No treatment (which may result in progression of disease, pain, or loss of teeth)
• Extraction and replacement with partial or complete dentures
• Extraction and replacement with fixed bridges or dental implants

RISKS AND COMPLICATIONS:
During treatment, complications may occur including but not limited to:
• Post-operative discomfort and swelling
• Bleeding that may be prolonged
• Stretching of the corners of the mouth resulting in cracking and bruising
• Temporary or permanent numbness of the lip, tongue, chin, gum, or teeth
• Damage to adjacent teeth, restorations, or supporting structures
• Need for retreatment, additional procedures, or extraction
• Allergic reaction to medications or materials used

FINANCIAL RESPONSIBILITY:
I understand and agree to be responsible for payment for all dental services provided. I understand that payment is due at the time services are rendered unless other payment arrangements have been made.

ANESTHESIA:
I understand that local anesthesia may be administered and that in rare instances complications can occur from the injection, including but not limited to: temporary or permanent numbness, pain, swelling, bleeding, infection, or allergic reaction.

I have been given the opportunity to ask questions regarding the proposed treatment, and all my questions have been answered to my satisfaction.

By signing below, I give my informed consent for the proposed dental treatment.
      `,
      isRequired: true,
      appointmentId: appointmentId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'form-history-001',
      title: 'Medical History Update',
      formType: 'medical_history',
      description: 'Update your medical history and current medications',
      content: `
MEDICAL HISTORY QUESTIONNAIRE

Patient Name: _________________________ Date of Birth: _____________

Please answer all questions and explain any "YES" answers in the space provided.

GENERAL HEALTH:
□ Are you currently under the care of a physician?
□ Have you had any serious illness, operation, or been hospitalized in the past 5 years?
□ Are you taking any medications, pills, or drugs?
□ Are you allergic to any medications or substances?

DENTAL HISTORY:
□ Have you had problems with previous dental treatment?
□ Have you ever had prolonged bleeding following dental treatment?
□ Are your gums sore or do they bleed?
□ Have you ever been treated for gum disease?
□ Have you ever had orthodontic treatment?

MEDICAL CONDITIONS:
Please check any conditions you have or have had:
□ Arthritis, Rheumatism    □ Heart Disease, Heart Attack
□ Artificial Heart Valves   □ High Blood Pressure
□ Blood Disorders         □ Stroke
□ Cancer/Tumors          □ Kidney Disease
□ Diabetes               □ Liver Disease
□ Epilepsy               □ Pregnancy
□ Fainting/Seizures       □ Respiratory Problems
□ Hepatitis/Jaundice      □ Stomach Problems

CURRENT MEDICATIONS:
Please list all medications you are currently taking:
_________________________________________________
_________________________________________________

ALLERGIES:
Please list any known allergies:
_________________________________________________
_________________________________________________

I certify that the above information is complete and accurate to the best of my knowledge.
      `,
      isRequired: true,
      status: 'pending',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'form-privacy-001',
      title: 'HIPAA Privacy Notice Acknowledgment',
      formType: 'privacy_notice',
      description: 'Acknowledgment of receipt of HIPAA privacy practices notice',
      content: `
HIPAA PRIVACY NOTICE ACKNOWLEDGMENT

Patient Name: _________________________ Date: _____________

ACKNOWLEDGMENT OF RECEIPT OF NOTICE OF PRIVACY PRACTICES

I acknowledge that I have received a copy of this office's Notice of Privacy Practices, which describes how my health information may be used and disclosed by this office and how I may access my health information.

I understand that this office has the right to change the Notice of Privacy Practices and that I may obtain a current copy by:
• Requesting a copy from the front desk
• Visiting our website at www.swiftcaredental.com
• Calling our office at (555) 123-4567

I understand that I have the right to:
• Request restrictions on the use and disclosure of my health information
• Request to receive confidential communications of health information
• Request access to my health information
• Request amendment of my health information
• Request an accounting of disclosures of my health information
• File a complaint with the office or the Department of Health and Human Services

I understand that this office is not required to agree to any restrictions I request, but if agreed to, the office will abide by such restrictions.

By signing below, I acknowledge that I have been provided with a copy of the Notice of Privacy Practices.
      `,
      isRequired: true,
      status: 'signed',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      signedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      patientSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    },
    {
      id: 'form-financial-001',
      title: 'Financial Agreement & Payment Policy',
      formType: 'financial_agreement',
      description: 'Agreement regarding payment terms and financial responsibilities',
      content: `
FINANCIAL AGREEMENT AND PAYMENT POLICY

Patient Name: _________________________ Date: _____________

PAYMENT POLICY:
• Payment is due at the time services are rendered unless other arrangements have been made in advance.
• We accept cash, checks, and major credit cards (Visa, MasterCard, American Express, Discover).
• For extensive treatment, payment plans may be available upon approval.
• A 3% service charge will be assessed on all returned checks.

INSURANCE:
• We will file your insurance claims as a courtesy to you.
• You are responsible for knowing your insurance benefits and limitations.
• You are responsible for paying any portion not covered by insurance.
• Co-payments and deductibles are due at the time of service.
• We cannot guarantee your insurance benefits or coverage.

MISSED APPOINTMENTS:
• A $50 fee may be charged for appointments cancelled with less than 24 hours notice.
• A $75 fee may be charged for missed appointments without notice.

COLLECTION POLICY:
• Accounts over 90 days will be subject to collection procedures.
• You will be responsible for all collection costs, including attorney fees.
• Collection accounts may be reported to credit bureaus.

TREATMENT ESTIMATES:
• All treatment estimates are subject to change based on clinical findings.
• Additional treatment may be necessary and will be explained before proceeding.

EMERGENCY TREATMENT:
• Emergency treatment will be provided as needed.
• Payment for emergency treatment is due at the time of service.

I have read and understand the above financial policy and agree to its terms.
      `,
      isRequired: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  useEffect(() => {
    // Simulate loading forms
    setTimeout(() => {
      setForms(mockForms)
      setLoading(false)
    }, 1000)
  }, [patientId, appointmentId])

  const handleFormSign = async () => {
    if (!selectedForm || !patientSignature || !agreementChecked) {
      toast({
        title: "Incomplete Form",
        description: "Please provide your signature and confirm agreement.",
        variant: "destructive",
      })
      return
    }

    setSigning(true)
    
    try {
      // Simulate API call to save signature
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Update form status
      setForms(prev => prev.map(form => 
        form.id === selectedForm.id 
          ? {
              ...form,
              status: 'signed' as const,
              signedAt: new Date().toISOString(),
              patientSignature,
              witnessSignature: witnessSignature || undefined
            }
          : form
      ))

      toast({
        title: "Form Signed Successfully",
        description: "Your signature has been saved and the form is now complete.",
      })

      // Reset state
      setSelectedForm(null)
      setPatientSignature('')
      setWitnessSignature('')
      setAgreementChecked(false)
      setAdditionalNotes('')

      if (onFormSigned) {
        onFormSigned(selectedForm.id)
      }

    } catch (error) {
      console.error('Error signing form:', error)
      toast({
        title: "Signing Failed",
        description: "There was an error saving your signature. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSigning(false)
    }
  }

  const getFormTypeIcon = (formType: string) => {
    switch (formType) {
      case 'consent': return <FileText className="w-5 h-5" />
      case 'medical_history': return <User className="w-5 h-5" />
      case 'privacy_notice': return <Shield className="w-5 h-5" />
      case 'financial_agreement': return <FileText className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  const pendingForms = forms.filter(form => form.status === 'pending')
  const signedForms = forms.filter(form => form.status === 'signed')

  return (
    <div className="space-y-6">
      {/* Pending Forms */}
      {pendingForms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-orange-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              Forms Requiring Your Signature ({pendingForms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingForms.map((form) => (
              <div key={form.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getFormTypeIcon(form.formType)}
                      <h3 className="font-medium text-gray-900">{form.title}</h3>
                      {form.isRequired && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{form.description}</p>
                    {form.dueDate && (
                      <div className="flex items-center mt-2 text-sm text-orange-700">
                        <Calendar className="w-4 h-4 mr-1" />
                        Due: {new Date(form.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>{form.title}</DialogTitle>
                          <DialogDescription>{form.description}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-96">
                          <div className="whitespace-pre-wrap p-4 bg-gray-50 rounded text-sm">
                            {form.content}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm"
                          onClick={() => setSelectedForm(form)}
                        >
                          <PenTool className="w-4 h-4 mr-1" />
                          Sign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>Sign Form: {form.title}</DialogTitle>
                          <DialogDescription>
                            Please review the form content and provide your digital signature.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          {/* Form Content */}
                          <ScrollArea className="h-64 border rounded">
                            <div className="whitespace-pre-wrap p-4 text-sm">
                              {form.content}
                            </div>
                          </ScrollArea>

                          {/* Additional Notes */}
                          <div className="space-y-2">
                            <Label htmlFor="notes">Additional Notes (Optional)</Label>
                            <Textarea
                              id="notes"
                              placeholder="Add any additional notes or comments..."
                              value={additionalNotes}
                              onChange={(e) => setAdditionalNotes(e.target.value)}
                              rows={3}
                            />
                          </div>

                          {/* Patient Signature */}
                          <div className="space-y-2">
                            <Label>Patient Signature *</Label>
                            <SignaturePad 
                              onSignatureChange={setPatientSignature}
                              label="Sign here"
                            />
                          </div>

                          {/* Agreement Checkbox */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="agreement"
                              checked={agreementChecked}
                              onCheckedChange={(checked) => setAgreementChecked(checked === true)}
                            />
                            <Label htmlFor="agreement" className="text-sm">
                              I have read, understood, and agree to the terms outlined in this form. *
                            </Label>
                          </div>

                          {/* Submit Button */}
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setSelectedForm(null)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleFormSign}
                              disabled={signing || !patientSignature || !agreementChecked}
                            >
                              {signing ? 'Signing...' : 'Complete Signature'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Signed Forms */}
      {signedForms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <CheckCircle className="w-5 h-5 mr-2" />
              Completed Forms ({signedForms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signedForms.map((form) => (
              <div key={form.id} className="p-3 border border-green-200 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    {getFormTypeIcon(form.formType)}
                    <div>
                      <h4 className="font-medium text-gray-900">{form.title}</h4>
                      <p className="text-sm text-gray-600">
                        Signed on {form.signedAt ? new Date(form.signedAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(form.status)}>
                      {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No Forms */}
      {forms.length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Forms Available</h3>
            <p className="text-gray-600">There are currently no forms that require your attention.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

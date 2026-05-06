
'use client'

import { DigitalForm } from './digital-form'
import type { FormField } from './digital-form'

interface ConsentFormProps {
  patientId: string
  appointmentId?: string
  treatmentType?: string
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => Promise<void>
  onSave?: (data: Record<string, any>) => Promise<void>
}

// General Treatment Consent Form
const generalConsentFields: FormField[] = [
  {
    id: 'patientName',
    type: 'text',
    label: 'Patient Full Name',
    required: true,
    placeholder: 'Enter patient full name'
  },
  {
    id: 'treatmentDescription',
    type: 'textarea',
    label: 'Treatment Description',
    required: true,
    placeholder: 'Detailed description of the proposed treatment'
  },
  {
    id: 'risksUnderstood',
    type: 'checkbox',
    label: 'I understand that dental treatment may involve risks including but not limited to: pain, infection, bleeding, swelling, and possible need for additional treatment',
    required: true
  },
  {
    id: 'alternativesDiscussed',
    type: 'checkbox',
    label: 'Alternative treatments and their risks have been explained to me',
    required: true
  },
  {
    id: 'noGuarantee',
    type: 'checkbox',
    label: 'I understand that no guarantee has been made regarding the success of treatment',
    required: true
  },
  {
    id: 'followInstructions',
    type: 'checkbox',
    label: 'I agree to follow post-treatment instructions and attend follow-up appointments',
    required: true
  },
  {
    id: 'questionsAnswered',
    type: 'checkbox',
    label: 'All my questions have been answered to my satisfaction',
    required: true
  },
  {
    id: 'consentGiven',
    type: 'checkbox',
    label: 'I give my informed consent for the above treatment',
    required: true
  }
]

// X-Ray Consent Form
const xrayConsentFields: FormField[] = [
  {
    id: 'patientName',
    type: 'text',
    label: 'Patient Full Name',
    required: true
  },
  {
    id: 'xrayType',
    type: 'select',
    label: 'Type of X-Ray',
    required: true,
    options: ['Panoramic', 'Bitewing', 'Periapical', 'Cephalometric', 'CBCT']
  },
  {
    id: 'radiationRisk',
    type: 'checkbox',
    label: 'I understand that dental X-rays involve exposure to small amounts of radiation',
    required: true
  },
  {
    id: 'benefitsOutweighRisks',
    type: 'checkbox',
    label: 'I understand that the benefits of X-ray examination outweigh the minimal risks',
    required: true
  },
  {
    id: 'pregnancyStatus',
    type: 'select',
    label: 'Pregnancy Status (for women of childbearing age)',
    options: ['Not pregnant', 'Pregnant', 'Possibly pregnant', 'Not applicable']
  },
  {
    id: 'xrayConsent',
    type: 'checkbox',
    label: 'I consent to having dental X-rays taken',
    required: true
  }
]

// Anesthesia Consent Form
const anesthesiaConsentFields: FormField[] = [
  {
    id: 'patientName',
    type: 'text',
    label: 'Patient Full Name',
    required: true
  },
  {
    id: 'anesthesiaType',
    type: 'select',
    label: 'Type of Anesthesia',
    required: true,
    options: ['Local anesthesia', 'Nitrous oxide', 'IV sedation', 'General anesthesia']
  },
  {
    id: 'medicalHistory',
    type: 'checkbox',
    label: 'I have provided complete and accurate medical history',
    required: true
  },
  {
    id: 'anesthesiaRisks',
    type: 'checkbox',
    label: 'I understand the risks of anesthesia including allergic reaction, numbness, and rare complications',
    required: true
  },
  {
    id: 'followPreOp',
    type: 'checkbox',
    label: 'I agree to follow all pre-operative and post-operative instructions',
    required: true
  },
  {
    id: 'responsibleAdult',
    type: 'checkbox',
    label: 'I have arranged for a responsible adult to drive me home (if applicable)',
    required: true
  },
  {
    id: 'anesthesiaConsent',
    type: 'checkbox',
    label: 'I consent to the administration of anesthesia',
    required: true
  }
]

// Financial Agreement Form
const financialAgreementFields: FormField[] = [
  {
    id: 'patientName',
    type: 'text',
    label: 'Patient/Responsible Party Name',
    required: true
  },
  {
    id: 'treatmentCost',
    type: 'text',
    label: 'Estimated Treatment Cost (PHP)',
    required: true,
    placeholder: 'e.g., PHP 5,000.00'
  },
  {
    id: 'paymentMethod',
    type: 'select',
    label: 'Preferred Payment Method',
    required: true,
    options: ['Cash', 'Credit Card', 'GCash', 'Bank Transfer', 'Insurance + Co-pay', 'Installment Plan']
  },
  {
    id: 'insuranceUsed',
    type: 'checkbox',
    label: 'I plan to use dental insurance for this treatment'
  },
  {
    id: 'financialResponsibility',
    type: 'checkbox',
    label: 'I understand that I am financially responsible for all charges',
    required: true
  },
  {
    id: 'paymentDue',
    type: 'checkbox',
    label: 'I understand that payment is due at the time of service unless other arrangements have been made',
    required: true
  },
  {
    id: 'additionalCharges',
    type: 'checkbox',
    label: 'I understand that additional charges may apply for complications or additional treatment',
    required: true
  },
  {
    id: 'missedAppointment',
    type: 'checkbox',
    label: 'I understand the clinic policy regarding missed appointments and cancellation fees',
    required: true
  }
]

export function GeneralConsentForm(props: ConsentFormProps) {
  return (
    <DigitalForm
      formId="general-consent"
      title="General Treatment Consent Form"
      description="This form provides your informed consent for dental treatment. Please read carefully and ask any questions before signing."
      fields={generalConsentFields}
      showSignature={true}
      requireSignature={true}
      {...props}
    />
  )
}

export function XRayConsentForm(props: ConsentFormProps) {
  return (
    <DigitalForm
      formId="xray-consent"
      title="X-Ray Consent Form"
      description="This form provides your consent for dental radiographs (X-rays)."
      fields={xrayConsentFields}
      showSignature={true}
      requireSignature={true}
      {...props}
    />
  )
}

export function AnesthesiaConsentForm(props: ConsentFormProps) {
  return (
    <DigitalForm
      formId="anesthesia-consent"
      title="Anesthesia Consent Form"
      description="This form provides your consent for the administration of anesthesia during dental treatment."
      fields={anesthesiaConsentFields}
      showSignature={true}
      requireSignature={true}
      {...props}
    />
  )
}

export function FinancialAgreementForm(props: ConsentFormProps) {
  return (
    <DigitalForm
      formId="financial-agreement"
      title="Financial Agreement"
      description="This form outlines the financial terms and payment policies for your dental treatment."
      fields={financialAgreementFields}
      showSignature={true}
      requireSignature={true}
      {...props}
    />
  )
}

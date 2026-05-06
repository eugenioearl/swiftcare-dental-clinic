
'use client'

import { DigitalForm } from './digital-form'
import type { FormField } from './digital-form'

interface PatientIntakeFormProps {
  patientId: string
  appointmentId?: string
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => Promise<void>
  onSave?: (data: Record<string, any>) => Promise<void>
}

const intakeFormFields: FormField[] = [
  // Personal Information
  {
    id: 'firstName',
    type: 'text',
    label: 'First Name',
    required: true,
    placeholder: 'Enter your first name'
  },
  {
    id: 'lastName',
    type: 'text',
    label: 'Last Name',
    required: true,
    placeholder: 'Enter your last name'
  },
  {
    id: 'dateOfBirth',
    type: 'date',
    label: 'Date of Birth',
    required: true
  },
  {
    id: 'gender',
    type: 'select',
    label: 'Gender',
    required: true,
    options: ['Male', 'Female', 'Other', 'Prefer not to say']
  },
  {
    id: 'phone',
    type: 'text',
    label: 'Phone Number',
    required: true,
    placeholder: '+63 9XX XXX XXXX',
    validation: {
      pattern: '^[+]?[0-9\\s\\-\\(\\)]+$'
    }
  },
  {
    id: 'email',
    type: 'text',
    label: 'Email Address',
    required: true,
    placeholder: 'your.email@example.com',
    validation: {
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    }
  },
  {
    id: 'address',
    type: 'textarea',
    label: 'Complete Address',
    required: true,
    placeholder: 'Street, Barangay, City, Province'
  },
  
  // Emergency Contact
  {
    id: 'emergencyContactName',
    type: 'text',
    label: 'Emergency Contact Name',
    required: true,
    placeholder: 'Full name of emergency contact'
  },
  {
    id: 'emergencyContactPhone',
    type: 'text',
    label: 'Emergency Contact Phone',
    required: true,
    placeholder: '+63 9XX XXX XXXX',
    validation: {
      pattern: '^[+]?[0-9\\s\\-\\(\\)]+$'
    }
  },
  {
    id: 'emergencyContactRelationship',
    type: 'select',
    label: 'Relationship to Emergency Contact',
    required: true,
    options: ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other']
  },

  // Insurance Information
  {
    id: 'insuranceProvider',
    type: 'text',
    label: 'Insurance Provider',
    placeholder: 'e.g., PhilHealth, Maxicare, Intellicare'
  },
  {
    id: 'insurancePolicyNumber',
    type: 'text',
    label: 'Policy/ID Number',
    placeholder: 'Insurance ID or policy number'
  },
  {
    id: 'insuranceGroupNumber',
    type: 'text',
    label: 'Group Number (if applicable)',
    placeholder: 'Insurance group number'
  },

  // Visit Information
  {
    id: 'reasonForVisit',
    type: 'textarea',
    label: 'Reason for Today\'s Visit',
    required: true,
    placeholder: 'Please describe your dental concerns or reason for visit',
    validation: {
      min: 10,
      max: 500
    }
  },
  {
    id: 'lastDentalVisit',
    type: 'date',
    label: 'Date of Last Dental Visit',
    placeholder: 'When did you last see a dentist?'
  },
  {
    id: 'previousDentist',
    type: 'text',
    label: 'Previous Dentist Name',
    placeholder: 'Name of your previous dentist (if any)'
  },

  // Current Oral Health
  {
    id: 'currentPain',
    type: 'select',
    label: 'Are you currently experiencing dental pain?',
    required: true,
    options: ['No pain', 'Mild pain', 'Moderate pain', 'Severe pain']
  },
  {
    id: 'painDescription',
    type: 'textarea',
    label: 'If you have pain, please describe it',
    placeholder: 'Location, type of pain, when it occurs, what triggers it'
  },
  {
    id: 'bleedingGums',
    type: 'select',
    label: 'Do your gums bleed when brushing or flossing?',
    required: true,
    options: ['Never', 'Sometimes', 'Often', 'Always']
  },

  // Oral Hygiene Habits
  {
    id: 'brushingFrequency',
    type: 'select',
    label: 'How often do you brush your teeth?',
    required: true,
    options: ['Once a day', 'Twice a day', '3+ times a day', 'Less than once a day']
  },
  {
    id: 'flossingFrequency',
    type: 'select',
    label: 'How often do you floss?',
    required: true,
    options: ['Daily', 'Few times a week', 'Once a week', 'Rarely', 'Never']
  },
  {
    id: 'mouthwashUse',
    type: 'checkbox',
    label: 'Do you use mouthwash regularly?'
  },

  // Lifestyle Factors
  {
    id: 'smokingStatus',
    type: 'select',
    label: 'Smoking Status',
    required: true,
    options: ['Never smoked', 'Former smoker', 'Current smoker']
  },
  {
    id: 'alcoholConsumption',
    type: 'select',
    label: 'Alcohol Consumption',
    required: true,
    options: ['Never', 'Occasionally', 'Regularly', 'Daily']
  },

  // Consent and Agreements
  {
    id: 'treatmentConsent',
    type: 'checkbox',
    label: 'I consent to receive dental treatment and understand that no guarantee has been made regarding the outcome of treatment',
    required: true
  },
  {
    id: 'privacyConsent',
    type: 'checkbox',
    label: 'I consent to the collection and use of my personal health information for treatment purposes',
    required: true
  },
  {
    id: 'communicationConsent',
    type: 'checkbox',
    label: 'I consent to receive appointment reminders and follow-up communications via SMS/email'
  }
]

export function PatientIntakeForm({ 
  patientId, 
  appointmentId, 
  initialData, 
  onSubmit, 
  onSave 
}: PatientIntakeFormProps) {
  return (
    <DigitalForm
      formId="patient-intake"
      title="Patient Intake Form"
      description="Please complete this form before your first visit. This information helps us provide you with the best possible care."
      fields={intakeFormFields}
      patientId={patientId}
      appointmentId={appointmentId}
      onSubmit={onSubmit}
      onSave={onSave}
      initialData={initialData}
      showSignature={true}
      requireSignature={true}
    />
  )
}

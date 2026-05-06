
'use client'

import { DigitalForm } from './digital-form'
import type { FormField } from './digital-form'

interface MedicalHistoryFormProps {
  patientId: string
  appointmentId?: string
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => Promise<void>
  onSave?: (data: Record<string, any>) => Promise<void>
}

const medicalHistoryFields: FormField[] = [
  // Current Medical Conditions
  {
    id: 'heartCondition',
    type: 'checkbox',
    label: 'Heart condition, heart attack, or heart surgery'
  },
  {
    id: 'heartConditionDetails',
    type: 'textarea',
    label: 'If yes, please provide details',
    placeholder: 'Describe your heart condition, medications, restrictions'
  },
  {
    id: 'highBloodPressure',
    type: 'checkbox',
    label: 'High blood pressure'
  },
  {
    id: 'diabetes',
    type: 'checkbox',
    label: 'Diabetes'
  },
  {
    id: 'diabetesType',
    type: 'select',
    label: 'If diabetic, what type?',
    options: ['Type 1', 'Type 2', 'Gestational', 'Other']
  },
  {
    id: 'bloodDisorder',
    type: 'checkbox',
    label: 'Blood disorder or bleeding problems'
  },
  {
    id: 'liverDisease',
    type: 'checkbox',
    label: 'Liver disease or hepatitis'
  },
  {
    id: 'kidneyDisease',
    type: 'checkbox',
    label: 'Kidney disease'
  },
  {
    id: 'seizureDisorder',
    type: 'checkbox',
    label: 'Seizure disorder or epilepsy'
  },
  {
    id: 'cancer',
    type: 'checkbox',
    label: 'Cancer or history of cancer'
  },
  {
    id: 'cancerDetails',
    type: 'textarea',
    label: 'If yes, please specify type and treatment',
    placeholder: 'Type of cancer, when diagnosed, current treatment status'
  },
  {
    id: 'autoimmune',
    type: 'checkbox',
    label: 'Autoimmune disorder (lupus, rheumatoid arthritis, etc.)'
  },
  {
    id: 'mentalHealth',
    type: 'checkbox',
    label: 'Mental health condition requiring medication'
  },

  // Respiratory and Infectious Diseases
  {
    id: 'asthma',
    type: 'checkbox',
    label: 'Asthma or breathing problems'
  },
  {
    id: 'tuberculosis',
    type: 'checkbox',
    label: 'Tuberculosis (TB) - past or present'
  },
  {
    id: 'hiv',
    type: 'checkbox',
    label: 'HIV/AIDS'
  },
  {
    id: 'hepatitis',
    type: 'checkbox',
    label: 'Hepatitis A, B, or C'
  },

  // Pregnancy and Hormonal
  {
    id: 'pregnant',
    type: 'checkbox',
    label: 'Currently pregnant'
  },
  {
    id: 'pregnancyMonth',
    type: 'text',
    label: 'If pregnant, how many months?',
    placeholder: 'Number of months'
  },
  {
    id: 'breastfeeding',
    type: 'checkbox',
    label: 'Currently breastfeeding'
  },
  {
    id: 'birthControl',
    type: 'checkbox',
    label: 'Taking birth control pills or hormonal medications'
  },

  // Current Medications
  {
    id: 'currentMedications',
    type: 'textarea',
    label: 'List all medications you are currently taking (including over-the-counter)',
    required: true,
    placeholder: 'Include medication name, dosage, and frequency. Write "None" if not taking any medications.'
  },
  {
    id: 'bloodThinners',
    type: 'checkbox',
    label: 'Taking blood thinners (Warfarin, Aspirin, etc.)'
  },
  {
    id: 'painMedications',
    type: 'checkbox',
    label: 'Regular use of pain medications'
  },

  // Allergies and Reactions
  {
    id: 'drugAllergies',
    type: 'textarea',
    label: 'Drug allergies or adverse reactions',
    required: true,
    placeholder: 'List any medications that cause allergic reactions or side effects. Write "None" if no known allergies.'
  },
  {
    id: 'latexAllergy',
    type: 'checkbox',
    label: 'Latex allergy'
  },
  {
    id: 'localAnesthetic',
    type: 'checkbox',
    label: 'Problems with local anesthetic (Lidocaine, Novocaine)'
  },
  {
    id: 'antibioticAllergy',
    type: 'checkbox',
    label: 'Antibiotic allergies (Penicillin, Amoxicillin, etc.)'
  },
  {
    id: 'foodAllergies',
    type: 'textarea',
    label: 'Food allergies',
    placeholder: 'List any food allergies. Write "None" if no food allergies.'
  },

  // Previous Surgeries and Hospitalizations
  {
    id: 'recentSurgery',
    type: 'checkbox',
    label: 'Surgery or hospitalization in the past 6 months'
  },
  {
    id: 'surgeryDetails',
    type: 'textarea',
    label: 'If yes, please provide details',
    placeholder: 'Type of surgery/hospitalization, date, any complications'
  },
  {
    id: 'jointReplacement',
    type: 'checkbox',
    label: 'Artificial joint replacement (hip, knee, etc.)'
  },
  {
    id: 'heartValve',
    type: 'checkbox',
    label: 'Artificial heart valve or pacemaker'
  },

  // Dental Medical History
  {
    id: 'dentalAnesthesia',
    type: 'checkbox',
    label: 'Previous problems with dental anesthesia'
  },
  {
    id: 'dentalAnesthesiaDetails',
    type: 'textarea',
    label: 'If yes, please describe',
    placeholder: 'What type of problem occurred?'
  },
  {
    id: 'prolongedBleeding',
    type: 'checkbox',
    label: 'Prolonged bleeding after dental treatment'
  },
  {
    id: 'jawProblems',
    type: 'checkbox',
    label: 'TMJ problems or jaw clicking/locking'
  },
  {
    id: 'previousOralSurgery',
    type: 'checkbox',
    label: 'Previous oral surgery or tooth extractions'
  },

  // Lifestyle and Habits
  {
    id: 'clenching',
    type: 'checkbox',
    label: 'Grinding or clenching teeth'
  },
  {
    id: 'recDrugs',
    type: 'checkbox',
    label: 'Use of recreational drugs'
  },

  // Family History
  {
    id: 'familyPeriodontal',
    type: 'checkbox',
    label: 'Family history of gum disease'
  },
  {
    id: 'familyOralCancer',
    type: 'checkbox',
    label: 'Family history of oral cancer'
  },

  // COVID-19 Related
  {
    id: 'covidVaccinated',
    type: 'checkbox',
    label: 'COVID-19 vaccinated'
  },
  {
    id: 'covidHistory',
    type: 'checkbox',
    label: 'Previous COVID-19 infection'
  },
  {
    id: 'covidSymptoms',
    type: 'checkbox',
    label: 'Currently experiencing flu-like symptoms'
  },

  // Additional Information
  {
    id: 'otherConditions',
    type: 'textarea',
    label: 'Any other medical conditions or information you think we should know',
    placeholder: 'Please provide any additional medical information relevant to your dental care'
  },

  // Physician Information
  {
    id: 'physicianName',
    type: 'text',
    label: 'Primary Care Physician Name',
    placeholder: 'Dr. Full Name'
  },
  {
    id: 'physicianPhone',
    type: 'text',
    label: 'Physician Phone Number',
    placeholder: '+63 9XX XXX XXXX'
  },

  // Acknowledgment
  {
    id: 'informationAccurate',
    type: 'checkbox',
    label: 'I certify that the above information is complete and accurate',
    required: true
  },
  {
    id: 'updatePromise',
    type: 'checkbox',
    label: 'I promise to inform the doctor of any changes in my health',
    required: true
  }
]

export function MedicalHistoryForm({ 
  patientId, 
  appointmentId, 
  initialData, 
  onSubmit, 
  onSave 
}: MedicalHistoryFormProps) {
  return (
    <DigitalForm
      formId="medical-history"
      title="Medical History Form"
      description="This confidential medical history is essential for safe dental treatment. Please answer all questions completely and accurately."
      fields={medicalHistoryFields}
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

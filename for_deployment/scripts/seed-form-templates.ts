// Idempotent seed for dental clinic form templates.
// Run: yarn tsx scripts/seed-form-templates.ts
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config()
const prisma = new PrismaClient()

type FieldDef = {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'signature' | 'number' | 'email' | 'tel' | 'medical_checklist'
  label: string
  required?: boolean
  options?: string[]
  placeholder?: string
  helpText?: string
  patientField?: string  // maps to Patient model field for data sync
  /** For medical_checklist type: list of items with Yes/No toggles */
  checklistItems?: string[]
}

interface TemplateSeed {
  key: string
  title: string
  description: string
  category: 'intake' | 'medical' | 'consent' | 'financial' | 'data_completion'
  fields: FieldDef[]
  requiredForAppointmentTypes?: string[] | null
  requiredAlways?: boolean
  displayOrder: number
}

const templates: TemplateSeed[] = [
  {
    key: 'patient-intake',
    title: 'Patient Intake Form',
    description: 'Basic personal information, contact details, and reason for visit.',
    category: 'intake',
    requiredAlways: true,
    displayOrder: 10,
    fields: [
      { id: 'firstName', type: 'text', label: 'First Name', required: true, patientField: 'firstName' },
      { id: 'lastName', type: 'text', label: 'Last Name', required: true, patientField: 'lastName' },
      { id: 'dateOfBirth', type: 'date', label: 'Date of Birth', required: true, patientField: 'dateOfBirth' },
      { id: 'gender', type: 'select', label: 'Gender', required: false, options: ['Male', 'Female', 'Prefer not to say'], patientField: 'gender' },
      { id: 'phone', type: 'tel', label: 'Mobile Number', required: true, placeholder: '09XXXXXXXXX', patientField: 'mobileNumber' },
      { id: 'email', type: 'email', label: 'Email Address', required: false, patientField: 'emailDirect' },
      { id: 'address', type: 'textarea', label: 'Home Address', required: true, patientField: 'address' },
      { id: 'city', type: 'text', label: 'City', required: false, patientField: 'city' },
      { id: 'emergencyContactName', type: 'text', label: 'Emergency Contact Name', required: true, patientField: 'emergencyContactName' },
      { id: 'emergencyContactPhone', type: 'tel', label: 'Emergency Contact Phone', required: true, patientField: 'emergencyContactPhone' },
      { id: 'emergencyContactRelation', type: 'text', label: 'Relation to You', required: false, patientField: 'emergencyContactRelation' },
      { id: 'reasonForVisit', type: 'textarea', label: 'Reason for Visit', required: true, helpText: 'Briefly describe your concern or what you\'d like addressed today.' },
    ],
  },
  {
    key: 'medical-history',
    title: 'Medical History Form',
    description: 'Comprehensive medical history, current medications, and allergies.',
    category: 'medical',
    requiredAlways: true,
    displayOrder: 20,
    fields: [
      {
        id: 'allergies', type: 'medical_checklist', label: 'Do you have any of the following allergies?', required: false,
        patientField: 'allergies',
        checklistItems: ['Antibiotics', 'Dental materials', 'Latex', 'Local anesthetics', 'Metals', 'Pain medications', 'Sulfa drugs'],
      },
      {
        id: 'conditions', type: 'medical_checklist', label: 'Do you have any of the following conditions?', required: false,
        patientField: 'medicalHistory',
        checklistItems: ['Autoimmune disease', 'Bleeding disorder', 'Cancer and ongoing treatments', 'Diabetes', 'HIV/AIDS', 'Heart disease', 'High blood pressure', 'Kidney disease', 'Neurological disorder', 'Pregnancy', 'Respiratory disease', 'Stroke'],
      },
      {
        id: 'medications', type: 'medical_checklist', label: 'Do you have any of the following medications?', required: false,
        patientField: 'currentMedications',
        checklistItems: ['Antibiotics', 'Anti-anxiety medications', 'Antidepressants', 'Antihistamines', 'Blood thinners', 'Blood pressure medications', 'Hormonal medications', 'Immuno-suppressants', 'Diabetes medications', 'Pain medications', 'Steroids'],
      },
      { id: 'pregnancy', type: 'radio', label: 'Are you pregnant or breastfeeding?', required: false, options: ['Not applicable', 'Pregnant', 'Breastfeeding', 'Possibly pregnant'], patientField: 'pregnancyStatus' },
      { id: 'bleedingDisorders', type: 'radio', label: 'Do you have any bleeding disorders?', required: false, options: ['Yes', 'No', 'Unsure'] },
      { id: 'previousSurgery', type: 'textarea', label: 'Previous Surgeries', required: false, placeholder: 'List any previous surgeries and dates' },
      { id: 'dentalConcerns', type: 'textarea', label: 'Dental Concerns & History', required: false, placeholder: 'Recent dental treatments, pain, sensitivity, etc.' },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'general-treatment-consent',
    title: 'General Treatment Consent',
    description: 'General consent for dental examination and routine treatment.',
    category: 'consent',
    requiredAlways: true,
    displayOrder: 30,
    fields: [
      { id: 'consentGeneral', type: 'checkbox', label: 'I consent to the dental examination and routine treatment as recommended by the dentist.', required: true },
      { id: 'consentXrayBasic', type: 'checkbox', label: 'I consent to basic diagnostic procedures including visual exam and intraoral photographs.', required: true },
      { id: 'consentPrivacy', type: 'checkbox', label: 'I acknowledge the clinic\'s privacy policy and how my records will be handled.', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'xray-consent',
    title: 'X-Ray Consent Form',
    description: 'Authorization for dental X-rays and radiographic examination.',
    category: 'consent',
    requiredForAppointmentTypes: ['xray', 'x_ray', 'x-ray', 'surgery', 'root_canal', 'extraction', 'implant'],
    displayOrder: 40,
    fields: [
      { id: 'xrayPurpose', type: 'textarea', label: 'Purpose of X-Ray', required: false, placeholder: 'Reason for X-ray (auto-filled by dentist if needed)' },
      { id: 'radiationRisksUnderstood', type: 'checkbox', label: 'I understand the risks associated with dental X-rays.', required: true },
      { id: 'pregnancy', type: 'radio', label: 'Are you pregnant?', required: true, options: ['No', 'Yes', 'Possibly'], patientField: 'pregnancyStatus' },
      { id: 'xrayConsent', type: 'checkbox', label: 'I consent to dental X-ray examination.', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'anesthesia-consent',
    title: 'Anesthesia Consent Form',
    description: 'Consent for local anesthesia, sedation, or pain management.',
    category: 'consent',
    requiredForAppointmentTypes: ['surgery', 'extraction', 'root_canal', 'implant', 'procedure'],
    displayOrder: 50,
    fields: [
      { id: 'anesthesiaType', type: 'select', label: 'Type of Anesthesia', required: true, options: ['Local', 'Nitrous Oxide', 'IV Sedation', 'General'] },
      { id: 'medicationAllergies', type: 'textarea', label: 'Medication Allergies', required: false, patientField: 'allergies' },
      { id: 'anesthesiaRisks', type: 'checkbox', label: 'I understand the risks of anesthesia.', required: true },
      { id: 'anesthesiaConsent', type: 'checkbox', label: 'I consent to anesthesia administration.', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'financial-agreement',
    title: 'Financial Agreement',
    description: 'Payment terms, insurance, and financial responsibility.',
    category: 'financial',
    requiredAlways: true,
    displayOrder: 60,
    fields: [
      { id: 'paymentResponsibility', type: 'checkbox', label: 'I accept financial responsibility for all charges not covered by insurance.', required: true },
      { id: 'paymentTerms', type: 'checkbox', label: 'I understand payment terms: payment is due at time of service unless other arrangements are made in writing.', required: true },
      { id: 'insuranceInfo', type: 'textarea', label: 'Insurance Information (if any)', required: false, placeholder: 'Insurance provider, policy number, etc. Leave blank if none.' },
      { id: 'paymentMethod', type: 'select', label: 'Preferred Payment Method', required: false, options: ['Cash', 'GCash', 'Bank Transfer', 'Credit Card', 'HMO / Insurance'] },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'medical-records-update',
    title: 'Medical Records Update',
    description: 'Update existing patient medical records with new information (sent by staff to complete patient data).',
    category: 'data_completion',
    displayOrder: 70,
    fields: [
      { id: 'conditions', type: 'textarea', label: 'Current Medical Conditions', required: false, patientField: 'medicalHistory' },
      { id: 'medications', type: 'textarea', label: 'Current Medications', required: false, patientField: 'currentMedications' },
      { id: 'allergies', type: 'textarea', label: 'Allergies', required: false, patientField: 'allergies' },
      { id: 'pregnancy', type: 'radio', label: 'Pregnancy Status', required: false, options: ['Not applicable', 'Pregnant', 'Breastfeeding'], patientField: 'pregnancyStatus' },
      { id: 'emergencyContactName', type: 'text', label: 'Emergency Contact Name', required: false, patientField: 'emergencyContactName' },
      { id: 'emergencyContactPhone', type: 'tel', label: 'Emergency Contact Phone', required: false, patientField: 'emergencyContactPhone' },
      { id: 'address', type: 'textarea', label: 'Current Home Address', required: false, patientField: 'address' },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
  {
    key: 'emergency-treatment-consent',
    title: 'Emergency Treatment Consent',
    description: 'Consent for urgent / emergency dental procedures.',
    category: 'consent',
    requiredForAppointmentTypes: ['emergency'],
    displayOrder: 80,
    fields: [
      { id: 'emergencySymptoms', type: 'textarea', label: 'Describe your emergency symptoms', required: true },
      { id: 'painLevel', type: 'radio', label: 'Current Pain Level', required: true, options: ['1 - Mild', '2', '3', '4', '5 - Moderate', '6', '7', '8', '9', '10 - Severe'] },
      { id: 'emergencyConsent', type: 'checkbox', label: 'I consent to emergency dental treatment as recommended by the dentist.', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true },
    ],
  },
]

async function seed() {
  console.log('🌱 Seeding form templates...')
  for (const t of templates) {
    try {
      const result = await prisma.formTemplate.upsert({
        where: { key: t.key },
        update: {
          title: t.title,
          description: t.description,
          category: t.category,
          fields: t.fields as any,
          requiredForAppointmentTypes: (t.requiredForAppointmentTypes ?? null) as any,
          requiredAlways: !!t.requiredAlways,
          displayOrder: t.displayOrder,
          isActive: true,
          isSystem: true,
        },
        create: {
          key: t.key,
          title: t.title,
          description: t.description,
          category: t.category,
          fields: t.fields as any,
          requiredForAppointmentTypes: (t.requiredForAppointmentTypes ?? null) as any,
          requiredAlways: !!t.requiredAlways,
          displayOrder: t.displayOrder,
          isActive: true,
          isSystem: true,
        },
      })
      console.log(`  ✔ ${result.key} — ${result.title}`)
    } catch (err) {
      console.error(`  ✖ ${t.key}:`, err)
    }
  }
  console.log('✅ Done')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

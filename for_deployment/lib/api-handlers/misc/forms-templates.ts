
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { z } from "zod"

const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'checkbox', 'radio', 'date', 'signature']),
  label: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional()
})

const formTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  estimatedTime: z.string(),
  linkedServices: z.array(z.string()),
  fields: z.array(formFieldSchema).optional()
})

// In-memory storage for demo purposes
// In production, this would be stored in the database
let formTemplatesStorage: any[] = [
  {
    id: 'patient-intake',
    title: 'Patient Intake Form',
    description: 'Basic personal information, contact details, and reason for visit',
    category: 'intake',
    isRequired: true,
    isActive: true,
    estimatedTime: '5-10 minutes',
    linkedServices: [],
    fields: [
      { id: 'firstName', type: 'text', label: 'First Name', required: true },
      { id: 'lastName', type: 'text', label: 'Last Name', required: true },
      { id: 'dateOfBirth', type: 'date', label: 'Date of Birth', required: true },
      { id: 'phone', type: 'text', label: 'Phone Number', required: true },
      { id: 'address', type: 'textarea', label: 'Address', required: true },
      { id: 'emergencyContact', type: 'text', label: 'Emergency Contact', required: true },
      { id: 'reasonForVisit', type: 'textarea', label: 'Reason for Visit', required: true }
    ]
  },
  {
    id: 'xray-consent',
    title: 'X-Ray Consent Form',
    description: 'Authorization for dental X-rays and radiographic examination',
    category: 'consent',
    isRequired: false,
    isActive: true,
    estimatedTime: '2-3 minutes',
    linkedServices: [],
    fields: [
      { id: 'xrayPurpose', type: 'textarea', label: 'Purpose of X-Ray', required: true },
      { id: 'radiationRisksUnderstood', type: 'checkbox', label: 'I understand the risks associated with dental X-rays', required: true },
      { id: 'pregnancy', type: 'radio', label: 'Are you pregnant?', required: true, options: ['Yes', 'No', 'Possibly'] },
      { id: 'xrayConsent', type: 'checkbox', label: 'I consent to dental X-ray examination', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true }
    ]
  },
  {
    id: 'anesthesia-consent',
    title: 'Anesthesia Consent Form',
    description: 'Consent for local anesthesia, sedation, or pain management',
    category: 'consent',
    isRequired: false,
    isActive: true,
    estimatedTime: '3-5 minutes',
    linkedServices: [],
    fields: [
      { id: 'anesthesiaType', type: 'select', label: 'Type of Anesthesia', required: true, options: ['Local', 'Nitrous Oxide', 'IV Sedation', 'General'] },
      { id: 'medicationAllergies', type: 'textarea', label: 'Medication Allergies', required: true },
      { id: 'anesthesiaRisks', type: 'checkbox', label: 'I understand the risks of anesthesia', required: true },
      { id: 'anesthesiaConsent', type: 'checkbox', label: 'I consent to anesthesia administration', required: true },
      { id: 'patientSignature', type: 'signature', label: 'Patient Signature', required: true }
    ]
  }
]

// GET /api/forms/templates - Get all form templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permissions to manage forms
    if (!['admin', 'super_admin', 'manager', 'receptionist', 'staff', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: {
        templates: formTemplatesStorage
      }
    })

  } catch (error) {
    console.error("Error fetching form templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/forms/templates - Update form templates
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permissions to manage forms
    if (!['admin'].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { templates } = body

    // Validate each template
    const validatedTemplates = templates.map((template: any) => 
      formTemplateSchema.parse(template)
    )

    // Update storage (in production, save to database)
    formTemplatesStorage = validatedTemplates

    return NextResponse.json({
      success: true,
      data: {
        templates: formTemplatesStorage
      }
    })

  } catch (error) {
    console.error("Error updating form templates:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET forms required for specific services
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { serviceIds } = body

    if (!Array.isArray(serviceIds)) {
      return NextResponse.json({ error: "serviceIds must be an array" }, { status: 400 })
    }

    // Find forms linked to any of the provided service IDs
    const requiredForms = formTemplatesStorage.filter(template => 
      template.isActive && (
        template.isRequired || // Always required forms
        template.linkedServices.some((serviceId: string) => serviceIds.includes(serviceId))
      )
    )

    return NextResponse.json({
      success: true,
      data: {
        requiredForms,
        serviceIds
      }
    })

  } catch (error) {
    console.error("Error fetching required forms:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

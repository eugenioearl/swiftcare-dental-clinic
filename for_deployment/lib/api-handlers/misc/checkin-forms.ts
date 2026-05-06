import { NextRequest, NextResponse } from 'next/server'
import { prisma, createConsentFormSafe } from '@/lib/db'
import { getServerAuth } from '@/lib/auth'
import crypto from 'crypto'

function normalizeType(t: string | null | undefined) {
  return (t || '').toString().trim().toLowerCase().replace(/[-\s]+/g, '_')
}

// Determine which templates apply automatically for an appointment type and/or treatments.
// treatmentIds / treatmentCategories are optional extras used for auto-attach rules.
// serviceId allows per-service rules + service-level form key linkage.
function templatesForAppointment(
  templates: any[],
  appointmentType?: string | null,
  treatmentIds: string[] = [],
  treatmentCategories: string[] = [],
  serviceId?: string | null,
  serviceLinkedFormKeys: string[] = []
) {
  const apt = normalizeType(appointmentType)
  const catSet = new Set(treatmentCategories.map((c) => (c || '').toLowerCase()))
  const tidSet = new Set(treatmentIds)
  const serviceFormKeys = new Set(serviceLinkedFormKeys)
  return templates.filter((t) => {
    if (!t.isActive) return false
    if (t.requiredAlways) return true

    // Match by appointment type
    const aptList = Array.isArray(t.requiredForAppointmentTypes)
      ? (t.requiredForAppointmentTypes as string[]).map(normalizeType)
      : []
    if (apt && aptList.includes(apt)) return true

    // Match by treatment ID
    const tidList = Array.isArray(t.requiredForTreatmentIds)
      ? (t.requiredForTreatmentIds as string[])
      : []
    if (tidList.some((id) => tidSet.has(id))) return true

    // Match by treatment category
    const catList = Array.isArray(t.requiredForTreatmentCategories)
      ? (t.requiredForTreatmentCategories as string[]).map((c) => (c || '').toLowerCase())
      : []
    if (catList.some((c) => catSet.has(c))) return true

    // Match by service (form template rule — service IDs list on template)
    const svcList = Array.isArray(t.requiredForServiceIds)
      ? (t.requiredForServiceIds as string[])
      : []
    if (serviceId && svcList.includes(serviceId)) return true

    // Match via service's own linked form keys (service suggests this form)
    if (serviceFormKeys.has(t.key) || (t.familyKey && serviceFormKeys.has(t.familyKey))) return true

    return false
  })
}

// GET - List forms for an appointment or list available templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')
    const templatesOnly = searchParams.get('templates') === 'true'
    const appointmentType = searchParams.get('appointmentType')

    if (templatesOnly) {
      const all = await prisma.formTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
      })
      const templates = all.map((t) => ({
        id: t.key,          // caller-facing id is the stable key
        templateId: t.id,   // internal uuid if needed
        title: t.title,
        description: t.description,
        category: t.category,
        fields: t.fields,
        requiredAlways: t.requiredAlways,
        requiredForAppointmentTypes: t.requiredForAppointmentTypes,
        requiredForTreatmentIds: t.requiredForTreatmentIds,
        requiredForTreatmentCategories: t.requiredForTreatmentCategories,
        requiredForServiceIds: (t as any).requiredForServiceIds || null,
      }))
      const auto = appointmentType
        ? templatesForAppointment(all, appointmentType).map((t) => t.key)
        : []
      return NextResponse.json({ templates, autoRequiredKeys: auto })
    }

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
    }

    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get appointment-linked forms
    const appointmentForms = await prisma.consentForm.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        formFields: true,
        formResponses: true,
        signingToken: true,
        patientSignature: true,
        patientSignedAt: true,
        createdAt: true,
        consentNumber: true,
      },
    })

    // Also include patient-level forms from consent/package flow that aren't
    // linked to any appointment (so check-in view matches the workspace view).
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true },
    })
    let packageForms: typeof appointmentForms = []
    if (appointment?.patientId) {
      const appointmentFormIds = new Set(appointmentForms.map(f => f.id))
      const patientOtherForms = await prisma.consentForm.findMany({
        where: {
          patientId: appointment.patientId,
          appointmentId: null, // forms not linked to any appointment (from consent/package flow)
          formFields: { not: { equals: null as any } }, // only forms with template fields (not bare consents)
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          formFields: true,
          formResponses: true,
          signingToken: true,
          patientSignature: true,
          patientSignedAt: true,
          createdAt: true,
          consentNumber: true,
        },
      })
      // Add only forms not already in appointmentForms (dedup by title)
      const existingTitles = new Set(appointmentForms.map(f => (f.title || '').trim().toLowerCase()))
      packageForms = patientOtherForms.filter(
        f => !appointmentFormIds.has(f.id) && !existingTitles.has((f.title || '').trim().toLowerCase())
      )
    }

    const forms = [...appointmentForms, ...packageForms]

    const firstUnsignedForm = forms.find((f) => !f.patientSignature)
    const signingToken = firstUnsignedForm?.signingToken || forms[0]?.signingToken || null
    const baseUrl = (process.env.NEXTAUTH_URL || request.headers.get('origin') || '').replace(/\/+$/, '')
    const signingUrl = signingToken ? `${baseUrl}/forms/sign/${signingToken}` : null

    return NextResponse.json({
      forms: forms.map((f) => ({ ...f, signingToken: undefined })),
      signingToken,
      signingUrl,
      allSigned: forms.length > 0 && forms.every((f) => !!f.patientSignature),
      totalCount: forms.length,
      signedCount: forms.filter((f) => !!f.patientSignature).length,
    })
  } catch (error) {
    console.error('Error fetching checkin forms:', error)
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 })
  }
}

// POST - Create forms for an appointment from selected template keys OR auto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { appointmentId, templateIds, auto } = body
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
            emailDirect: true,
            dateOfBirth: true,
            gender: true,
            address: true,
            city: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            emergencyContactRelationship: true,
            medicalHistory: true,
            currentMedications: true,
            allergies: true,
            pregnancyStatus: true,
          },
        },
        appointmentTreatments: {
          include: {
            treatment: {
              select: { id: true, name: true, category: true },
            },
          },
        },
        service: {
          select: { id: true, linkedFormTemplateKeys: true },
        },
      },
    })
    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Gather treatment IDs / categories linked to this appointment
    const treatmentIds = (appointment.appointmentTreatments || [])
      .map((t: any) => t.treatment?.id)
      .filter(Boolean) as string[]
    const treatmentCategories = Array.from(
      new Set(
        (appointment.appointmentTreatments || [])
          .map((t: any) => t.treatment?.category)
          .filter(Boolean) as string[]
      )
    )

    // Gather service-level form template keys
    const serviceId = (appointment as any).serviceId || (appointment as any).service?.id || null
    const serviceLinkedFormKeys = Array.isArray((appointment as any).service?.linkedFormTemplateKeys)
      ? (appointment as any).service.linkedFormTemplateKeys as string[]
      : []

    // Load templates from DB
    const allTemplates = await prisma.formTemplate.findMany({ where: { isActive: true } })

    let keysToCreate: string[] = []
    if (auto) {
      keysToCreate = templatesForAppointment(
        allTemplates,
        appointment.appointmentType,
        treatmentIds,
        treatmentCategories,
        serviceId,
        serviceLinkedFormKeys
      ).map((t) => t.key)
    } else {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        return NextResponse.json({ error: 'templateIds[] required' }, { status: 400 })
      }
      keysToCreate = templateIds
    }

    // DEDUPE: Ensure each key is unique (prevents duplicate rules creating multiple of same form)
    keysToCreate = Array.from(new Set(keysToCreate))

    if (keysToCreate.length === 0) {
      return NextResponse.json({ error: 'No templates to create' }, { status: 400 })
    }

    // Load existing forms on this appointment. We preserve any forms that are already
    // signed, and skip creating a new form if one with the same title (template) already exists.
    const existingAppointmentForms = await prisma.consentForm.findMany({
      where: { appointmentId },
      select: { id: true, title: true, patientSignature: true, templateKey: true },
    })
    const existingSignedTitles = new Set(
      existingAppointmentForms.filter((f) => !!f.patientSignature).map((f) => (f.title || '').trim().toLowerCase())
    )

    // Also check ALL patient forms (from consent generation / packages) to avoid duplicating
    // forms that were already signed via a different flow (e.g., consent generated from package).
    const allPatientSignedForms = await prisma.consentForm.findMany({
      where: {
        patientId: appointment.patientId,
        patientSignature: { not: null },
      },
      select: { title: true, templateKey: true },
    })
    const patientSignedTitleSet = new Set(
      allPatientSignedForms.map((f) => (f.title || '').trim().toLowerCase())
    )
    const patientSignedTemplateKeys = new Set(
      allPatientSignedForms.map((f) => f.templateKey).filter(Boolean) as string[]
    )

    // For auto-prepare: remove unsigned forms so re-configuration replaces them (signed forms remain).
    // For manual assignment: keep existing forms — we're just adding a specific form.
    if (auto) {
      await prisma.consentForm.deleteMany({
        where: { appointmentId, patientSignature: null },
      })
    }

    const createdForms = [] as any[]
    const createdTitles = new Set<string>()
    let skipped = 0

    for (let i = 0; i < keysToCreate.length; i++) {
      const key = keysToCreate[i]
      const template = allTemplates.find((t) => t.key === key)
      if (!template) continue

      const normalizedTitle = (template.title || '').trim().toLowerCase()

      // For auto-attach, skip forms already signed by this patient (once-only rule).
      // For manual assignment (staff explicitly chose a form), bypass once-only dedup.
      if (auto) {
        // DEDUPE: Skip if already signed for this appointment (preserve signature)
        if (existingSignedTitles.has(normalizedTitle)) {
          skipped++
          continue
        }

        // DEDUPE: Skip if already signed across ANY patient forms (from consent/package flows)
        if (patientSignedTitleSet.has(normalizedTitle)) {
          skipped++
          continue
        }

        // DEDUPE: Skip if templateKey matches a previously signed form for this patient
        if (template.key && patientSignedTemplateKeys.has(template.key)) {
          skipped++
          continue
        }
        if ((template as any).familyKey && patientSignedTemplateKeys.has((template as any).familyKey)) {
          skipped++
          continue
        }
      }

      // DEDUPE: Skip if we already created one with same title in this pass
      if (createdTitles.has(normalizedTitle)) {
        skipped++
        continue
      }

      const token = crypto.randomBytes(12).toString('hex')

      const form = await createConsentFormSafe({
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        title: template.title,
        description: template.description,
        status: 'sent',
        formFields: template.fields as any,
        formContent: `Check-in form for ${appointment.patient.fullName || 'Patient'}`,
        preparedById: session.user.id,
        signingToken: token,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        sentAt: new Date(),
        templateKey: (template as any).familyKey || template.key,
        templateVersion: (template as any).version || 1,
        assignmentSource: auto ? 'auto' : 'manual',
        requirementStage: 'check_in',
      })
      createdForms.push(form)
      createdTitles.add(normalizedTitle)
    }

    const signingToken = createdForms[0]?.signingToken
    const baseUrl = (process.env.NEXTAUTH_URL || request.headers.get('origin') || '').replace(/\/+$/, '')
    const signingUrl = signingToken ? `${baseUrl}/forms/sign/${signingToken}` : null

    return NextResponse.json(
      {
        success: true,
        forms: createdForms.map((f) => ({ id: f.id, title: f.title, status: f.status })),
        signingToken,
        signingUrl,
        formsCount: createdForms.length,
        skippedCount: skipped,
        message: skipped > 0 && createdForms.length === 0
          ? 'All required forms have already been signed by this patient.'
          : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating checkin forms:', error)
    return NextResponse.json({ error: 'Failed to create forms' }, { status: 500 })
  }
}

// DELETE - Remove a specific unsigned form from an appointment
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const formId = searchParams.get('formId')
    if (!formId) {
      return NextResponse.json({ error: 'formId required' }, { status: 400 })
    }

    const form = await prisma.consentForm.findUnique({ where: { id: formId } })
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    if (form.patientSignature) {
      return NextResponse.json({ error: 'Cannot delete a signed form' }, { status: 400 })
    }

    await prisma.consentForm.delete({ where: { id: formId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checkin form:', error)
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 })
  }
}

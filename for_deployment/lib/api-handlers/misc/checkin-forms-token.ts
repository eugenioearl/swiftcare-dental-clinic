import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Valid Patient model fields that can be updated via form sync.
// CRITICAL: Only include fields that actually exist on the Patient Prisma model.
const VALID_PATIENT_FIELDS = new Set([
  'fullName', 'middleName', 'preferredName', 'mobileNumber', 'emailDirect',
  'dateOfBirth', 'gender', 'civilStatus', 'religion', 'address', 'city',
  'province', 'state', 'zipCode',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
  'emergencyContactRelation', // alias — remapped below to emergencyContactRelationship
  'medicalHistory', 'allergies', 'currentMedications',
  'allergiesList', 'conditionsList', 'medicationsList', // structured JSON list fields
  'insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber',
  'occupation', 'nationality', 'remarks', 'dentalAnxieties',
  'previousDentist', 'previousDentalRemarks',
  'pregnancyStatus', 'bloodPressureHistory', 'medicalSafetyNotes',
  'validIdType', 'validIdNumber',
])

// Alias fields that should be remapped to the canonical Patient model column
const FIELD_ALIASES: Record<string, string> = {
  emergencyContactRelation: 'emergencyContactRelationship',
}

// Map well-known field IDs / field.patientField metadata to Patient model columns.
// Never overwrites existing non-empty values with empty ones. Safe for partial data.
async function syncFormResponsesToPatient(
  patientId: string,
  fields: any[] | null | undefined,
  responses: Record<string, any> | null | undefined,
  formTitle?: string,
) {
  if (!responses || typeof responses !== 'object') return
  if (!patientId) return

  // Resolve mapping: either field.patientField is set, or known-id fallback
  const knownIdMap: Record<string, string> = {
    allergies: 'allergies',
    medications: 'currentMedications',
    conditions: 'medicalHistory',
    medicalHistory: 'medicalHistory',
    medicalConditions: 'medicalHistory',
    emergencyContactName: 'emergencyContactName',
    emergencyContactPhone: 'emergencyContactPhone',
    emergencyContactRelation: 'emergencyContactRelationship',
    emergencyContactRelationship: 'emergencyContactRelationship',
    phone: 'mobileNumber',
    mobileNumber: 'mobileNumber',
    email: 'emailDirect',
    address: 'address',
    city: 'city',
    gender: 'gender',
    dateOfBirth: 'dateOfBirth',
    pregnancy: 'pregnancyStatus',
    pregnancyStatus: 'pregnancyStatus',
    pregnant: 'pregnancyStatus',
    dentalAnxieties: 'dentalAnxieties',
  }

  const updates: Record<string, any> = {}
  const fieldList = Array.isArray(fields) ? fields : []

  /** Convert a medical_checklist JSON value to readable text for patient record */
  const convertChecklistToText = (val: any): string => {
    if (!val || typeof val !== 'object') return ''
    const yesItems = Object.entries(val.items || {}).filter(([_, v]) => v === true).map(([k]) => k)
    const others = (val.others || []).filter((s: string) => s && s.trim())
    const all = [...yesItems, ...others]
    return all.length > 0 ? all.join(', ') : ''
  }

  const applyUpdate = (patientField: string, value: any) => {
    if (value === null || value === undefined) return
    // CRITICAL: Skip any field that is NOT a valid Patient model column
    // (e.g., firstName, lastName are User model fields, not Patient)
    if (!VALID_PATIENT_FIELDS.has(patientField)) return
    // Remap alias fields to canonical column names
    if (FIELD_ALIASES[patientField]) patientField = FIELD_ALIASES[patientField]
    // Handle medical_checklist structured values
    if (typeof value === 'object' && value.items !== undefined) {
      const text = convertChecklistToText(value)
      if (text) updates[patientField] = text.slice(0, 1000)
      return
    }
    // Skip empty strings so we never wipe existing data
    if (typeof value === 'string' && value.trim() === '') return
    // For gender field, validate against enum
    if (patientField === 'gender') {
      const v = String(value).toLowerCase().trim()
      if (['male', 'female', 'other', 'prefer_not_to_say'].includes(v)) {
        updates.gender = v
      } else if (v === 'prefer not to say') {
        updates.gender = 'prefer_not_to_say'
      }
      return
    }
    if (patientField === 'dateOfBirth') {
      const d = new Date(value)
      if (!isNaN(d.getTime())) updates.dateOfBirth = d
      return
    }
    if (patientField === 'pregnancyStatus') {
      const v = String(value).toLowerCase().trim()
      if (['pregnant', 'yes', 'possibly'].includes(v)) updates.pregnancyStatus = 'pregnant'
      else if (['no', 'not pregnant', 'not applicable', 'n/a'].includes(v)) updates.pregnancyStatus = 'not_pregnant'
      else if (['breastfeeding'].includes(v)) updates.pregnancyStatus = 'breastfeeding'
      else if (typeof value === 'string') updates.pregnancyStatus = value.slice(0, 50)
      return
    }
    updates[patientField] = String(value).slice(0, 1000)
  }

  // Go field-by-field first (respects patientField metadata), fallback to id map
  for (const field of fieldList) {
    const id = field?.id
    if (!id) continue
    const pf = field.patientField || knownIdMap[id]
    if (!pf) continue
    if (!(id in responses)) continue
    applyUpdate(pf, responses[id])
  }

  // Catch any response keys that also match knownIdMap (in case field defs lacked patientField)
  for (const [respKey, respVal] of Object.entries(responses)) {
    if (respKey in knownIdMap && !updates[knownIdMap[respKey]]) {
      applyUpdate(knownIdMap[respKey], respVal)
    }
  }

  // Handle fullName sync from firstName + lastName if either provided
  // firstName / lastName are User-model fields so they aren't in VALID_PATIENT_FIELDS,
  // but we use them to construct the Patient fullName.
  const fn = responses.firstName || (fieldList.find((f: any) => f.patientField === 'firstName') ? responses[fieldList.find((f: any) => f.patientField === 'firstName')?.id] : undefined)
  const ln = responses.lastName || (fieldList.find((f: any) => f.patientField === 'lastName') ? responses[fieldList.find((f: any) => f.patientField === 'lastName')?.id] : undefined)
  if ((typeof fn === 'string' && fn.trim()) || (typeof ln === 'string' && ln.trim())) {
    const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } })
    // Format as "Last Name, First Name" (matching clinic convention)
    const parts = [ln, fn].filter((p) => typeof p === 'string' && p.trim())
    const composedName = parts.join(', ').trim()
    if (composedName && (!existing?.fullName || existing.fullName.trim() === '')) {
      updates.fullName = composedName
    }
  }

  // --- Also sync to structured JSON list fields (allergiesList, conditionsList, medicationsList) ---
  // The UI reads from these structured fields, not the flat text fields.
  // Convert text or medical_checklist data into the structured array format.
  const buildStructuredList = (text: string | undefined, type: 'allergy' | 'condition' | 'medication') => {
    if (!text || !text.trim()) return undefined
    const items = text.split(',').map(s => s.trim()).filter(Boolean)
    if (items.length === 0) return undefined
    if (type === 'medication') {
      return items.map(name => ({ name, dose: '', frequency: '', comments: '' }))
    }
    return items.map(name => ({ name, comments: '' }))
  }

  // For each medical text field that was updated, also populate the corresponding structured list
  if (updates.allergies) {
    const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { allergiesList: true } })
    const existingList = Array.isArray(existing?.allergiesList) ? existing.allergiesList as any[] : []
    const newItems = buildStructuredList(updates.allergies, 'allergy')
    if (newItems && newItems.length > 0) {
      // Merge: add items that don't already exist (by name, case-insensitive)
      const existingNames = new Set(existingList.map((a: any) => (a.name || '').toLowerCase()))
      const toAdd = newItems.filter(a => !existingNames.has(a.name.toLowerCase()))
      if (toAdd.length > 0) updates.allergiesList = [...existingList, ...toAdd]
    }
  }
  if (updates.medicalHistory) {
    const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { conditionsList: true } })
    const existingList = Array.isArray(existing?.conditionsList) ? existing.conditionsList as any[] : []
    const newItems = buildStructuredList(updates.medicalHistory, 'condition')
    if (newItems && newItems.length > 0) {
      const existingNames = new Set(existingList.map((c: any) => (c.name || '').toLowerCase()))
      const toAdd = newItems.filter(c => !existingNames.has(c.name.toLowerCase()))
      if (toAdd.length > 0) updates.conditionsList = [...existingList, ...toAdd]
    }
  }
  if (updates.currentMedications) {
    const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { medicationsList: true } })
    const existingList = Array.isArray(existing?.medicationsList) ? existing.medicationsList as any[] : []
    const newItems = buildStructuredList(updates.currentMedications, 'medication')
    if (newItems && newItems.length > 0) {
      const existingNames = new Set(existingList.map((m: any) => (m.name || '').toLowerCase()))
      const toAdd = newItems.filter(m => !existingNames.has(m.name.toLowerCase()))
      if (toAdd.length > 0) updates.medicationsList = [...existingList, ...toAdd]
    }
  }

  if (Object.keys(updates).length === 0) return

  // Fetch current patient data BEFORE update for audit diff
  let beforeData: Record<string, any> = {}
  try {
    const selectFields: Record<string, boolean> = {}
    for (const key of Object.keys(updates)) selectFields[key] = true
    beforeData = (await prisma.patient.findUnique({ where: { id: patientId }, select: selectFields })) || {}
  } catch { /* ignore select errors */ }

  try {
    // Also stamp medical update metadata for medical fields
    const medicalFields = ['medicalHistory', 'allergies', 'currentMedications', 'pregnancyStatus', 'bloodPressureHistory', 'medicalSafetyNotes', 'dentalAnxieties']
    const hasMedicalUpdate = medicalFields.some(f => f in updates)
    if (hasMedicalUpdate) {
      updates.medicalLastUpdatedAt = new Date()
      updates.medicalLastUpdatedByName = 'Patient (Form)'
    }

    await prisma.patient.update({ where: { id: patientId }, data: updates })

    // Write audit log entry with before/after diff
    const changedFields: Record<string, { before: any; after: any }> = {}
    for (const [key, newVal] of Object.entries(updates)) {
      if (['medicalLastUpdatedAt', 'medicalLastUpdatedByName', 'medicalLastUpdatedById'].includes(key)) continue
      const oldVal = beforeData[key] ?? null
      const newStr = newVal instanceof Date ? newVal.toISOString() : String(newVal ?? '')
      const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? '')
      if (oldStr !== newStr) {
        changedFields[key] = { before: oldVal, after: newVal }
      }
    }

    if (Object.keys(changedFields).length > 0) {
      const oldVals: Record<string, any> = {}
      const newVals: Record<string, any> = {}
      for (const [k, v] of Object.entries(changedFields)) {
        oldVals[k] = v.before
        newVals[k] = v.after
      }
      await prisma.auditLog.create({
        data: {
          action: 'update',
          entityType: 'Patient',
          entityId: patientId,
          category: 'CLINICAL',
          description: `Patient data updated via signed form${formTitle ? ` "${formTitle}"` : ''}. Changed: ${Object.keys(changedFields).join(', ')}`,
          oldValues: oldVals,
          newValues: { ...newVals, _source: 'form_signing', _formTitle: formTitle || 'Unknown' },
        },
      })
    }
  } catch (err) {
    console.error('[syncFormResponsesToPatient] update failed:', err, 'Attempted:', updates)
  }
}

// GET - Public endpoint: get forms using a signing token.
// Supports both appointment-linked forms (returns all forms for that appointment)
// and standalone forms (data completion forms without an appointment).
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Find the form by token
    const tokenForm = await prisma.consentForm.findUnique({
      where: { signingToken: params.token },
      select: {
        id: true, appointmentId: true, tokenExpiresAt: true, patientId: true,
        title: true, description: true, status: true, formFields: true,
        formResponses: true, formContent: true, signingToken: true,
        patientSignature: true, patientSignedAt: true, consentNumber: true,
        templateKey: true, templateVersion: true,
        guardianName: true, guardianRelation: true, guardianSignature: true, guardianSignedAt: true,
      }
    })

    if (!tokenForm) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    if (tokenForm.tokenExpiresAt && new Date() > tokenForm.tokenExpiresAt) {
      return NextResponse.json({ error: 'This link has expired. Please ask the clinic staff for a new link.' }, { status: 410 })
    }

    // For standalone forms (no appointment), return just this single form
    const isStandalone = !tokenForm.appointmentId

    // Get forms: all forms for the appointment, or just this one standalone form
    const forms = isStandalone
      ? [tokenForm]
      : await prisma.consentForm.findMany({
          where: { appointmentId: tokenForm.appointmentId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            formFields: true,
            formResponses: true,
            formContent: true,
            signingToken: true,
            patientSignature: true,
            patientSignedAt: true,
            consentNumber: true,
            templateKey: true,
            templateVersion: true,
            guardianName: true,
            guardianRelation: true,
            guardianSignature: true,
            guardianSignedAt: true,
          }
        })

    // Look up guardian requirements from FormTemplate for each form (if templateKey present)
    const templateKeys = Array.from(new Set(forms.map(f => f.templateKey).filter(Boolean))) as string[]
    const templates = templateKeys.length > 0 ? await prisma.formTemplate.findMany({
      where: { familyKey: { in: templateKeys } },
      select: { familyKey: true, version: true, requiresGuardian: true, minorOnly: true, adultOnly: true },
    }) : []
    const templateMap = new Map<string, { requiresGuardian: boolean; minorOnly: boolean; adultOnly: boolean }>()
    for (const t of templates) {
      const key = `${t.familyKey}::${t.version}`
      templateMap.set(key, {
        requiresGuardian: t.requiresGuardian,
        minorOnly: t.minorOnly,
        adultOnly: t.adultOnly,
      })
      // Also store "latest" per familyKey for fallback if version mismatches
      if (!templateMap.has(t.familyKey)) {
        templateMap.set(t.familyKey, {
          requiresGuardian: t.requiresGuardian,
          minorOnly: t.minorOnly,
          adultOnly: t.adultOnly,
        })
      }
    }

    // Get appointment (if linked) and patient info for pre-filling
    const patientSelect = {
      fullName: true,
      mobileNumber: true,
      emailDirect: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelationship: true,
      medicalHistory: true,
      allergies: true,
      currentMedications: true,
      pregnancyStatus: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true
        }
      }
    } as const

    const appointment = tokenForm.appointmentId
      ? await prisma.appointment.findUnique({
          where: { id: tokenForm.appointmentId },
          select: {
            appointmentType: true,
            scheduledDatetime: true,
            reasonForVisit: true,
            patient: { select: patientSelect },
          }
        })
      : null

    // For standalone forms, fetch patient directly
    const patient = appointment?.patient
      || (isStandalone
        ? await prisma.patient.findUnique({
            where: { id: tokenForm.patientId },
            select: patientSelect,
          })
        : null)
    const prefillData: Record<string, any> = {}
    if (patient) {
      const nameParts = (patient.fullName || '').split(' ').filter(Boolean)
      const firstName = patient.user?.firstName || nameParts[0] || ''
      const lastName = patient.user?.lastName || nameParts.slice(1).join(' ') || ''
      const fullName = (patient.fullName && patient.fullName.trim()) || [firstName, lastName].filter(Boolean).join(' ').trim()
      const phone = patient.mobileNumber || patient.user?.phone || ''
      const email = patient.emailDirect || patient.user?.email || ''
      const dob = patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : ''
      const gender = patient.gender || ''
      const combinedAddress = [patient.address, patient.city, patient.state, patient.zipCode].filter(Boolean).join(', ') || ''
      const pregnancyYesNo =
        patient.pregnancyStatus === 'pregnant' ? 'Yes'
        : patient.pregnancyStatus === 'not_pregnant' ? 'No'
        : patient.pregnancyStatus || ''

      // Name variants
      prefillData.firstName = firstName
      prefillData.first_name = firstName
      prefillData.fname = firstName
      prefillData.lastName = lastName
      prefillData.last_name = lastName
      prefillData.lname = lastName
      prefillData.surname = lastName
      prefillData.fullName = fullName
      prefillData.full_name = fullName
      prefillData.patientName = fullName
      prefillData.patient_name = fullName
      prefillData.name = fullName

      // Phone variants
      prefillData.phone = phone
      prefillData.phoneNumber = phone
      prefillData.phone_number = phone
      prefillData.mobile = phone
      prefillData.mobileNumber = phone
      prefillData.mobile_number = phone
      prefillData.contactNumber = phone
      prefillData.contact_number = phone
      prefillData.cellphone = phone

      // Email variants
      prefillData.email = email
      prefillData.emailAddress = email
      prefillData.email_address = email
      prefillData.emailDirect = email

      // DOB variants
      prefillData.dateOfBirth = dob
      prefillData.date_of_birth = dob
      prefillData.dob = dob
      prefillData.birthDate = dob
      prefillData.birth_date = dob

      // Gender
      prefillData.gender = gender
      prefillData.sex = gender

      // Address
      prefillData.address = patient.address || ''
      prefillData.street = patient.address || ''
      prefillData.streetAddress = patient.address || ''
      prefillData.fullAddress = combinedAddress
      prefillData.homeAddress = combinedAddress
      prefillData.home_address = combinedAddress
      prefillData.city = patient.city || ''
      prefillData.state = patient.state || ''
      prefillData.province = patient.state || ''
      prefillData.zipCode = patient.zipCode || ''
      prefillData.zip_code = patient.zipCode || ''
      prefillData.postalCode = patient.zipCode || ''
      prefillData.postal_code = patient.zipCode || ''

      // Emergency contact variants
      prefillData.emergencyContact = [patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(' - ') || ''
      prefillData.emergency_contact = prefillData.emergencyContact
      prefillData.emergencyContactName = patient.emergencyContactName || ''
      prefillData.emergency_contact_name = patient.emergencyContactName || ''
      prefillData.emergencyContactPhone = patient.emergencyContactPhone || ''
      prefillData.emergency_contact_phone = patient.emergencyContactPhone || ''
      prefillData.emergencyContactRelation = patient.emergencyContactRelationship || ''
      prefillData.emergencyContactRelationship = patient.emergencyContactRelationship || ''
      prefillData.emergency_contact_relation = patient.emergencyContactRelationship || ''
      prefillData.emergency_contact_relationship = patient.emergencyContactRelationship || ''

      // Medical fields
      prefillData.conditions = patient.medicalHistory || ''
      prefillData.medicalConditions = patient.medicalHistory || ''
      prefillData.medical_conditions = patient.medicalHistory || ''
      prefillData.medicalHistory = patient.medicalHistory || ''
      prefillData.medical_history = patient.medicalHistory || ''
      prefillData.medications = patient.currentMedications || ''
      prefillData.currentMedications = patient.currentMedications || ''
      prefillData.current_medications = patient.currentMedications || ''
      prefillData.allergies = patient.allergies || ''
      prefillData.drugAllergies = patient.allergies || ''
      prefillData.drug_allergies = patient.allergies || ''
      prefillData.reasonForVisit = appointment?.reasonForVisit || ''
      prefillData.reason_for_visit = appointment?.reasonForVisit || ''

      // Pregnancy variants
      prefillData.pregnant = pregnancyYesNo
      prefillData.pregnancy = pregnancyYesNo
      prefillData.pregnancyStatus = pregnancyYesNo
      prefillData.pregnancy_status = pregnancyYesNo
    }

    // --- Prefill unsigned forms from previously signed consents of the same template ---
    // For each unsigned form with a templateKey, find the most recently signed consent
    // with the same templateKey for the same patient and carry over its responses.
    const unsignedWithTemplate = forms.filter(f => !f.patientSignature && f.templateKey)
    if (unsignedWithTemplate.length > 0) {
      const uniqueKeys = Array.from(new Set(unsignedWithTemplate.map(f => f.templateKey!)))
      const previousConsents = await prisma.consentForm.findMany({
        where: {
          patientId: tokenForm.patientId,
          templateKey: { in: uniqueKeys },
          patientSignature: { not: null }, // only signed ones
          id: { notIn: forms.map(f => f.id) }, // exclude current batch
        },
        orderBy: { patientSignedAt: 'desc' },
        select: {
          templateKey: true,
          formResponses: true,
        },
      })
      // Build map: templateKey -> most recent responses (first match per key since ordered desc)
      const prevResponseMap = new Map<string, Record<string, any>>()
      for (const pc of previousConsents) {
        if (pc.templateKey && !prevResponseMap.has(pc.templateKey) && pc.formResponses && typeof pc.formResponses === 'object') {
          prevResponseMap.set(pc.templateKey, pc.formResponses as Record<string, any>)
        }
      }
      // Merge into unsigned forms' formResponses (without overwriting existing saved responses)
      for (const form of forms) {
        if (form.patientSignature || !form.templateKey) continue
        const prev = prevResponseMap.get(form.templateKey)
        if (!prev) continue
        const existing = (form.formResponses && typeof form.formResponses === 'object' ? form.formResponses : {}) as Record<string, any>
        // Merge: existing saved responses take priority, then previous consent responses
        const merged: Record<string, any> = { ...prev }
        for (const [k, v] of Object.entries(existing)) {
          if (v !== undefined && v !== null && v !== '') merged[k] = v
        }
        // Strip out any signature data from previous responses
        const fieldList = Array.isArray(form.formFields) ? form.formFields as any[] : []
        for (const field of fieldList) {
          if (field?.type === 'signature' && field?.id) delete merged[field.id]
        }
        // Also remove common signature keys just in case
        delete merged.signature
        delete merged.patientSignature
        delete merged.guardianSignature
        ;(form as any).formResponses = merged
      }
    }

    // Mark all unviewed forms as viewed
    const viewFilter = isStandalone
      ? { id: tokenForm.id, viewedAt: null as any }
      : { appointmentId: tokenForm.appointmentId, viewedAt: null as any }
    await prisma.consentForm.updateMany({
      where: viewFilter,
      data: {
        viewedAt: new Date(),
        status: 'viewed'
      }
    })

    // Compute patient age (for isMinor calculation)
    let patientAge: number | null = null
    let isMinor = false
    if (patient?.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth)
      const now = new Date()
      const age = now.getFullYear() - dob.getFullYear() -
        (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate()) ? 1 : 0)
      if (!isNaN(age) && age >= 0 && age < 150) {
        patientAge = age
        isMinor = age < 18
      }
    }

    return NextResponse.json({
      patientName: patient?.fullName || 'Patient',
      appointmentType: appointment?.appointmentType || (isStandalone ? 'Data Completion' : ''),
      scheduledDatetime: appointment?.scheduledDatetime || null,
      prefillData,
      patientAge,
      isMinor,
      forms: forms.map(f => {
        const tpl = f.templateKey
          ? templateMap.get(`${f.templateKey}::${f.templateVersion}`) || templateMap.get(f.templateKey)
          : null
        const requiresGuardian = !!(tpl?.requiresGuardian || (tpl?.minorOnly && isMinor) || isMinor)
        return {
          id: f.id,
          title: f.title,
          description: f.description,
          status: f.patientSignature ? 'signed' : f.status,
          formFields: f.formFields,
          formResponses: f.formResponses,
          signingToken: f.signingToken,
          isSigned: !!f.patientSignature,
          signedAt: f.patientSignedAt,
          requiresGuardian,
          guardianName: f.guardianName,
          guardianRelation: f.guardianRelation,
          guardianSigned: !!f.guardianSignature,
        }
      }),
      allSigned: forms.every(f => !!f.patientSignature),
      totalForms: forms.length,
      signedCount: forms.filter(f => !!f.patientSignature).length,
      isStandalone,
    })
  } catch (error) {
    console.error('Error fetching forms by token:', error)
    return NextResponse.json({ error: 'Failed to load forms' }, { status: 500 })
  }
}

// PATCH - Save form progress without signing (public, uses token)
export async function PATCH(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const consent = await prisma.consentForm.findUnique({
      where: { signingToken: params.token }
    })

    if (!consent) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    if (consent.tokenExpiresAt && new Date() > consent.tokenExpiresAt) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    if (consent.patientSignature) {
      return NextResponse.json({ error: 'Already signed, cannot modify' }, { status: 400 })
    }

    const body = await request.json()
    const { responses } = body

    await prisma.consentForm.update({
      where: { id: consent.id },
      data: {
        formResponses: responses || undefined
      }
    })

    return NextResponse.json({ success: true, message: 'Progress saved' })
  } catch (error) {
    console.error('Error saving form progress:', error)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}

// POST - Sign a specific form (public, uses the form's own signing token)
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const consent = await prisma.consentForm.findUnique({
      where: { signingToken: params.token }
    })

    if (!consent) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    if (consent.tokenExpiresAt && new Date() > consent.tokenExpiresAt) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    if (consent.patientSignature) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 })
    }

    const body = await request.json()
    const { signature, responses, guardianName, guardianRelation, guardianSignature } = body

    if (!signature) {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 })
    }

    // If the ConsentForm was flagged in the GET response as requiring a guardian,
    // guardian data is required. We infer this here by re-checking the template.
    let requiresGuardian = false
    try {
      if (consent.templateKey) {
        const tpl = await prisma.formTemplate.findFirst({
          where: { familyKey: consent.templateKey },
          select: { requiresGuardian: true, minorOnly: true },
        })
        requiresGuardian = !!tpl?.requiresGuardian || !!tpl?.minorOnly
      }
      // Also require guardian if patient is a minor
      if (!requiresGuardian) {
        const patient = await prisma.patient.findUnique({
          where: { id: consent.patientId },
          select: { dateOfBirth: true },
        })
        if (patient?.dateOfBirth) {
          const dob = new Date(patient.dateOfBirth)
          const age = new Date().getFullYear() - dob.getFullYear()
          if (age < 18) requiresGuardian = true
        }
      }
    } catch (guardCheckErr) {
      console.error('Guardian requirement check failed, proceeding without guardian validation:', guardCheckErr)
    }

    if (requiresGuardian) {
      if (!guardianName || typeof guardianName !== 'string' || !guardianName.trim()) {
        return NextResponse.json({ error: 'Guardian name is required for this form' }, { status: 400 })
      }
      if (!guardianRelation || typeof guardianRelation !== 'string' || !guardianRelation.trim()) {
        return NextResponse.json({ error: 'Guardian relationship is required for this form' }, { status: 400 })
      }
      if (!guardianSignature || typeof guardianSignature !== 'string') {
        return NextResponse.json({ error: 'Guardian signature is required for this form' }, { status: 400 })
      }
    }

    await prisma.consentForm.update({
      where: { id: consent.id },
      data: {
        patientSignature: signature,
        patientSignedAt: new Date(),
        formResponses: responses || undefined,
        status: 'signed',
        ...(requiresGuardian ? {
          guardianName: guardianName.trim(),
          guardianRelation: guardianRelation.trim(),
          guardianSignature,
          guardianSignedAt: new Date(),
        } : {}),
      }
    })

    // Form → Patient data sync: map known field ids to Patient model fields.
    try {
      await syncFormResponsesToPatient(consent.patientId, consent.formFields as any, responses, consent.title || undefined)
    } catch (syncErr) {
      console.error('Form->patient sync failed (non-critical):', syncErr)
    }

    // Check if all forms for this appointment are now signed
    let allSigned = false
    if (consent.appointmentId) {
      const remaining = await prisma.consentForm.count({
        where: {
          appointmentId: consent.appointmentId,
          patientSignature: null
        }
      })
      allSigned = remaining === 0

      // Auto check-in patient when all forms are signed
      if (allSigned) {
        try {
          const appointment = await prisma.appointment.findUnique({
            where: { id: consent.appointmentId },
            select: { status: true }
          })
          // Only auto check-in if appointment is still in a pre-checkin status
          if (appointment && ['confirmed', 'scheduled', 'waiting', 'pending'].includes(appointment.status)) {
            await prisma.appointment.update({
              where: { id: consent.appointmentId },
              data: {
                status: 'checked_in',
                checkedInAt: new Date(),
                notes: 'Auto checked-in: All forms signed by patient'
              }
            })
          }
        } catch (autoCheckInError) {
          console.error('Auto check-in failed (non-critical):', autoCheckInError)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: allSigned ? 'All forms signed! You have been checked in.' : 'Form signed successfully',
      allSigned,
      checkedIn: allSigned
    })
  } catch (error) {
    console.error('Error signing form:', error)
    return NextResponse.json({ error: 'Failed to sign form' }, { status: 500 })
  }
}

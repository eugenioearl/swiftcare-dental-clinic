import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST - save extracted data into actual patient records
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = params.id
    const uploadId = params.uploadId
    const body = await request.json()
    const { extractedData, classification, saveOptions: explicitOptions } = body

    if (!extractedData) {
      return NextResponse.json({ error: 'No extracted data provided' }, { status: 400 })
    }

    // Auto-determine save options based on classification and available data
    const saveOptions = explicitOptions || {
      saveVisit: !!(extractedData.visit_info || extractedData.chief_complaint || extractedData.findings || extractedData.treatments),
      saveProcedures: !!(extractedData.treatments && (classification === 'chart' || classification === 'notes')),
      saveNotes: !!(extractedData.notes || extractedData.findings || extractedData.diagnosis),
      saveMedicalHistory: !!(extractedData.medical_history || extractedData.patient_info?.allergies || extractedData.patient_info?.medications),
      saveToChart: !!(extractedData.dental_chart),
      savePatientInfo: !!(extractedData.patient_info || extractedData.id_info),
      savePatientId: !!(extractedData.id_info) || classification === 'id',
    }

    const results: { type: string; id: string; title: string }[] = []
    const authorName = session.user.name || session.user.email || 'Staff'

    // Read current patient so we can merge non-destructively (don't overwrite filled fields)
    const currentPatient = await prisma.patient.findUnique({ where: { id: patientId } })
    const isEmpty = (v: any) => v === null || v === undefined || v === ''

    // Helper: normalize gender to enum-safe lowercase
    const normalizeGender = (g: any): 'male' | 'female' | undefined => {
      if (!g || typeof g !== 'string') return undefined
      const lower = g.toLowerCase().trim()
      if (lower.startsWith('m')) return 'male'
      if (lower.startsWith('f')) return 'female'
      return undefined
    }

    // Helper: parse date safely (returns Date or undefined)
    const parseDate = (d: any): Date | undefined => {
      if (!d) return undefined
      try {
        const parsed = new Date(d)
        if (isNaN(parsed.getTime())) return undefined
        return parsed
      } catch { return undefined }
    }

    // Helper: build full name from parts if needed
    const buildFullName = (pi: any): string | undefined => {
      if (pi?.name) return String(pi.name).trim()
      if (pi?.full_name) return String(pi.full_name).trim()
      const parts = [pi?.first_name, pi?.middle_name, pi?.last_name].filter(Boolean).map((x: any) => String(x).trim())
      return parts.length > 0 ? parts.join(' ') : undefined
    }

    // 0. Update patient info if available (merge non-destructively)
    if (saveOptions.savePatientInfo && (extractedData.patient_info || extractedData.id_info)) {
      const pi = extractedData.patient_info || {}
      const idi = extractedData.id_info || {}
      const updates: any = {}

      // Name (prefer patient_info, fall back to id_info)
      const extractedName = buildFullName(pi) || (idi.full_name_on_id ? String(idi.full_name_on_id).trim() : undefined)
      if (extractedName && isEmpty(currentPatient?.fullName)) updates.fullName = extractedName

      // Middle name (explicit)
      if (pi.middle_name && isEmpty(currentPatient?.middleName)) updates.middleName = String(pi.middle_name).trim()

      // Date of birth
      const dob = parseDate(pi.date_of_birth) || parseDate(idi.date_of_birth_on_id)
      if (dob && isEmpty(currentPatient?.dateOfBirth)) updates.dateOfBirth = dob

      // Gender
      const gender = normalizeGender(pi.gender) || normalizeGender(idi.sex) || normalizeGender(idi.gender_on_id)
      if (gender && isEmpty(currentPatient?.gender)) updates.gender = gender

      // Contact details
      if (pi.phone && isEmpty(currentPatient?.mobileNumber)) updates.mobileNumber = String(pi.phone).trim()
      if (pi.email && isEmpty(currentPatient?.emailDirect)) updates.emailDirect = String(pi.email).trim()

      // Address
      const addr = pi.address || idi.address_on_id
      if (addr && isEmpty(currentPatient?.address)) updates.address = String(addr).trim()
      if (pi.city && isEmpty(currentPatient?.city)) updates.city = String(pi.city).trim()
      if (pi.province && isEmpty(currentPatient?.province)) updates.province = String(pi.province).trim()
      if (pi.zip_code && isEmpty(currentPatient?.zipCode)) updates.zipCode = String(pi.zip_code).trim()

      // Demographics
      if (pi.civil_status && isEmpty(currentPatient?.civilStatus)) updates.civilStatus = String(pi.civil_status).trim()
      if (pi.nationality && isEmpty(currentPatient?.nationality)) updates.nationality = String(pi.nationality).trim()
      if (pi.occupation && isEmpty(currentPatient?.occupation)) updates.occupation = String(pi.occupation).trim()
      if (pi.preferred_language && currentPatient?.preferredLanguage === 'English') updates.preferredLanguage = String(pi.preferred_language).trim()

      // Emergency contact
      if (pi.emergency_contact_name && isEmpty(currentPatient?.emergencyContactName)) updates.emergencyContactName = String(pi.emergency_contact_name).trim()
      if (pi.emergency_contact_phone && isEmpty(currentPatient?.emergencyContactPhone)) updates.emergencyContactPhone = String(pi.emergency_contact_phone).trim()
      if (pi.emergency_contact_relationship && isEmpty(currentPatient?.emergencyContactRelationship)) updates.emergencyContactRelationship = String(pi.emergency_contact_relationship).trim()

      // Allergies + medications (always update if extracted — medical info is important)
      if (pi.allergies) {
        const val = typeof pi.allergies === 'string' ? pi.allergies : Array.isArray(pi.allergies) ? pi.allergies.join(', ') : null
        if (val && isEmpty(currentPatient?.allergies)) updates.allergies = val
      }
      if (pi.medications) {
        const val = typeof pi.medications === 'string' ? pi.medications : Array.isArray(pi.medications) ? pi.medications.join(', ') : null
        if (val && isEmpty(currentPatient?.currentMedications)) updates.currentMedications = val
      }

      // Valid ID fields — from id_info (preferred) or classification=id
      if (saveOptions.savePatientId && idi) {
        const idType = idi.id_type || (classification === 'id' ? 'Valid ID' : null)
        const idNumber = idi.id_number || null
        if (idType && isEmpty(currentPatient?.validIdType)) updates.validIdType = String(idType).trim()
        if (idNumber && isEmpty(currentPatient?.validIdNumber)) updates.validIdNumber = String(idNumber).trim()
      }

      // Remove undefined values
      Object.keys(updates).forEach(k => { if (updates[k] === undefined) delete updates[k] })

      if (Object.keys(updates).length > 0) {
        // Audit metadata: record this update
        updates.lastUpdatedById = session.user.id
        updates.lastUpdatedByName = authorName
        updates.lastUpdatedSection = 'smart_upload'

        await prisma.patient.update({ where: { id: patientId }, data: updates })
        const changedKeys = Object.keys(updates).filter(k => !['lastUpdatedById', 'lastUpdatedByName', 'lastUpdatedSection'].includes(k))
        results.push({ type: 'patient_info', id: patientId, title: `Patient Info Updated (${changedKeys.join(', ')})` })
      }
    }

    // 1. Save as Visit Record
    if (saveOptions.saveVisit && (extractedData.visit_info || extractedData.chief_complaint || extractedData.findings || extractedData.diagnosis || extractedData.treatments)) {
      const visitInfo = extractedData.visit_info || {}
      const visit = await prisma.visitRecord.create({
        data: {
          patientId,
          visitDate: visitInfo.visit_date ? new Date(visitInfo.visit_date) : new Date(),
          appointmentType: visitInfo.visit_type || 'consultation',
          attendingDentist: visitInfo.dentist_name || authorName,
          status: 'completed',
          chiefComplaint: extractedData.chief_complaint || null,
          findings: extractedData.findings || null,
          diagnosis: typeof extractedData.diagnosis === 'string' ? extractedData.diagnosis : Array.isArray(extractedData.diagnosis) ? extractedData.diagnosis.join('; ') : null,
          treatmentDone: typeof extractedData.treatments === 'string' ? extractedData.treatments : Array.isArray(extractedData.treatments) ? extractedData.treatments.map((t: any) => typeof t === 'string' ? t : `${t.procedure || t.name || ''} ${t.tooth_number ? '(Tooth ' + t.tooth_number + ')' : ''}`).join('; ') : null,
          prescriptions: typeof extractedData.prescriptions === 'string' ? extractedData.prescriptions : Array.isArray(extractedData.prescriptions) ? extractedData.prescriptions.map((p: any) => typeof p === 'string' ? p : `${p.medication || p.name || ''} ${p.dosage || ''}`).join('; ') : null,
          followUpInstructions: typeof extractedData.follow_up === 'string' ? extractedData.follow_up : Array.isArray(extractedData.follow_up) ? extractedData.follow_up.join('; ') : extractedData.follow_up?.instructions || null,
          followUpDate: extractedData.follow_up?.date ? new Date(extractedData.follow_up.date) : null,
          createdBy: session.user.id,
        },
      })
      results.push({ type: 'visit', id: visit.id, title: `Visit Record Created` })
    }

    // 2. Save Procedures
    if (saveOptions.saveProcedures && extractedData.treatments) {
      const treatments = Array.isArray(extractedData.treatments) ? extractedData.treatments : [extractedData.treatments]
      for (const t of treatments) {
        if (!t) continue
        const procName = typeof t === 'string' ? t : (t.procedure || t.name || 'Unknown Procedure')
        const toothNums = typeof t === 'string' ? [] : (t.tooth_numbers || (t.tooth_number ? [t.tooth_number] : [])).map(String)
        const proc = await prisma.procedureRecord.create({
          data: {
            patientId,
            procedureType: procName,
            procedureDate: extractedData.visit_info?.visit_date ? new Date(extractedData.visit_info.visit_date) : new Date(),
            dentistName: extractedData.visit_info?.dentist_name || authorName,
            teethInvolved: toothNums,
            notesBefore: t.notes || null,
            notesAfter: t.post_notes || null,
            status: 'completed',
            createdBy: session.user.id,
          },
        })
        results.push({ type: 'procedure', id: proc.id, title: `Procedure: ${procName}` })
      }
    }

    // 3. Save Notes
    if (saveOptions.saveNotes && (extractedData.notes || extractedData.diagnosis || extractedData.findings)) {
      const noteContent = [
        extractedData.findings ? `Findings: ${typeof extractedData.findings === 'string' ? extractedData.findings : JSON.stringify(extractedData.findings)}` : '',
        extractedData.diagnosis ? `Diagnosis: ${typeof extractedData.diagnosis === 'string' ? extractedData.diagnosis : Array.isArray(extractedData.diagnosis) ? extractedData.diagnosis.join(', ') : JSON.stringify(extractedData.diagnosis)}` : '',
        extractedData.notes ? `Notes: ${typeof extractedData.notes === 'string' ? extractedData.notes : JSON.stringify(extractedData.notes)}` : '',
      ].filter(Boolean).join('\n\n')

      if (noteContent.trim()) {
        const note = await prisma.clinicalNote.create({
          data: {
            patientId,
            noteType: 'general',
            content: noteContent,
            authorName,
            authorId: session.user.id,
            isInternal: false,
          },
        })
        results.push({ type: 'note', id: note.id, title: 'Clinical Note from Upload' })
      }
    }

    // 4. Update Medical History
    if (saveOptions.saveMedicalHistory) {
      const mh = extractedData.medical_history || {}
      const pi = extractedData.patient_info || {}
      const updates: any = {}

      const conditions = mh.conditions || mh
      if (conditions && typeof conditions !== 'object') {
        updates.medicalHistory = String(conditions)
      } else if (Array.isArray(conditions)) {
        updates.medicalHistory = conditions.join(', ')
      }

      const allergies = mh.allergies || pi.allergies
      if (allergies) updates.allergies = typeof allergies === 'string' ? allergies : Array.isArray(allergies) ? allergies.join(', ') : null

      const meds = mh.medications || pi.medications
      if (meds) updates.currentMedications = typeof meds === 'string' ? meds : Array.isArray(meds) ? meds.join(', ') : null

      if (Object.keys(updates).length > 0) {
        await prisma.patient.update({ where: { id: patientId }, data: updates })
        results.push({ type: 'medical_history', id: patientId, title: 'Medical History Updated' })
      }
    }

    // 5. Save to Dental Chart
    if (saveOptions.saveToChart && extractedData.dental_chart) {
      const chartEntries = Array.isArray(extractedData.dental_chart) ? extractedData.dental_chart : [extractedData.dental_chart]
      const chartData: Record<string, any> = {}
      for (const entry of chartEntries) {
        if (entry.tooth_number) {
          chartData[String(entry.tooth_number)] = {
            number: parseInt(String(entry.tooth_number)),
            surfaces: { mesial: null, distal: null, occlusal: null, buccal: null, lingual: null },
            wholeTooth: entry.treatment || entry.condition ? {
              type: mapConditionToTreatmentType(entry.condition || entry.treatment || ''),
              date: extractedData.visit_info?.visit_date || new Date().toISOString().split('T')[0],
              dentist: extractedData.visit_info?.dentist_name || authorName,
              status: 'existing',
              customNote: entry.notes || entry.condition || null,
            } : null,
            notes: entry.notes ? [entry.notes] : [],
            lastModified: new Date().toISOString(),
          }
        }
      }

      if (Object.keys(chartData).length > 0) {
        const latest = await prisma.dentalChartVersion.findFirst({
          where: { patientId },
          orderBy: { version: 'desc' },
          select: { version: true, chartData: true },
        })

        const mergedData = { ...(latest?.chartData as any || {}), ...chartData }
        const chart = await prisma.dentalChartVersion.create({
          data: {
            patientId,
            chartData: mergedData,
            notes: `Updated from document migration`,
            version: (latest?.version || 0) + 1,
            updatedByName: authorName,
            updatedById: session.user.id,
          },
        })
        results.push({ type: 'chart', id: chart.id, title: 'Dental Chart Updated' })
      }
    }

    // Mark upload as saved to records
    await prisma.smartUpload.update({
      where: { id: uploadId },
      data: {
        savedToRecords: true,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        migrationStatus: 'migrated',
      },
    })

    // Audit trail: record the migration event
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'create',
          entityType: 'SmartUpload',
          entityId: uploadId,
          category: 'CLINICAL',
          description: `Migrated document to patient records (${results.length} record(s) created/updated)`,
          newValues: {
            savedToRecords: true,
            migrationStatus: 'migrated',
            resultTypes: results.map(r => r.type),
            patientId,
          } as any,
        },
      })
    } catch (auditErr) {
      console.error('Audit log for migration failed (non-critical):', auditErr)
    }

    return NextResponse.json({
      success: true,
      data: { savedRecords: results, count: results.length },
    })
  } catch (error) {
    console.error('Save to records error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function mapConditionToTreatmentType(condition: string): string {
  const lower = condition.toLowerCase()
  if (lower.includes('caries') || lower.includes('cavity') || lower.includes('decay')) return 'caries'
  if (lower.includes('filling') || lower.includes('composite')) return 'filling_composite'
  if (lower.includes('amalgam')) return 'filling_amalgam'
  if (lower.includes('crown')) return lower.includes('gold') ? 'crown_gold' : 'crown_porcelain'
  if (lower.includes('root canal') || lower.includes('endodontic')) return 'root_canal'
  if (lower.includes('extraction') || lower.includes('missing')) return 'extraction'
  if (lower.includes('implant')) return 'implant'
  if (lower.includes('bridge')) return 'bridge'
  if (lower.includes('veneer')) return 'veneer'
  if (lower.includes('sealant')) return 'sealant'
  if (lower.includes('abscess')) return 'abscess'
  if (lower.includes('mobility') || lower.includes('loose')) return 'mobility'
  if (lower.includes('recession')) return 'recession'
  return 'other'
}

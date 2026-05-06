import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const LLM_API_URL = 'https://apps.abacus.ai/v1/chat/completions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = params.id

    // Gather all patient data
    const [patient, visits, procedures, notes, charts, appointments] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      }),
      prisma.visitRecord.findMany({ where: { patientId }, orderBy: { visitDate: 'desc' }, take: 20 }),
      prisma.procedureRecord.findMany({ where: { patientId }, orderBy: { procedureDate: 'desc' }, take: 20 }),
      prisma.clinicalNote.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.dentalChartVersion.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 1 }),
      prisma.appointment.findMany({
        where: { patientId },
        orderBy: { scheduledDatetime: 'desc' },
        take: 20,
        select: { scheduledDatetime: true, status: true, appointmentType: true, reasonForVisit: true, notes: true },
      }),
    ])

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const patientName = patient.fullName || `${patient.user?.lastName || ''}, ${patient.user?.firstName || ''}`.trim() || 'Unknown'

    // Build context for LLM
    const context = {
      patient: {
        name: patientName,
        age: patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000) : null,
        gender: patient.gender,
        allergies: patient.allergies,
        medications: patient.currentMedications,
        medicalHistory: patient.medicalHistory,
        pregnancyStatus: patient.pregnancyStatus,
        bloodPressureHistory: patient.bloodPressureHistory,
        dentalAnxieties: patient.dentalAnxieties,
      },
      recentVisits: visits.slice(0, 10).map((v: any) => ({
        date: v.visitDate,
        type: v.appointmentType,
        complaint: v.chiefComplaint,
        diagnosis: v.diagnosis,
        treatment: v.treatmentDone,
        followUp: v.followUpInstructions,
      })),
      procedures: procedures.slice(0, 10).map((p: any) => ({
        date: p.procedureDate,
        type: p.procedureType,
        teeth: p.teethInvolved,
        complications: p.complications,
      })),
      recentNotes: notes.slice(0, 5).map((n: any) => ({ type: n.noteType, content: n.content.substring(0, 300) })),
      appointments: appointments.slice(0, 10).map((a: any) => ({
        date: a.scheduledDatetime,
        type: a.appointmentType,
        status: a.status,
        reason: a.reasonForVisit,
      })),
      latestChart: charts[0]?.chartData || null,
    }

    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

    const res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a dental clinical assistant AI. Analyze the patient data and generate a concise clinical summary. Return JSON with these keys:
- "risk_level": "low" | "medium" | "high" (based on medical conditions, dental history, missed appointments)
- "risk_factors": string[] (list of specific risk factors)
- "key_dental_issues": string[] (current and recurring dental problems)
- "treatment_history_summary": string (1-2 sentence summary of past treatments)
- "suggested_next_treatments": string[] (recommended next steps based on history)
- "follow_up_urgency": "routine" | "soon" | "urgent"
- "notes": string (any important clinical observations or warnings)
Be medically accurate and concise. If data is sparse, note that more records are needed.`,
          },
          {
            role: 'user',
            content: `Generate clinical summary for this patient:\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('AI Summary LLM error:', errText)
      return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || '{}'
    const summary = JSON.parse(raw)

    return NextResponse.json({ success: true, data: { patientName, ...summary } })
  } catch (error) {
    console.error('AI Summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

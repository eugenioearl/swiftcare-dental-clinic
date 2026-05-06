

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/appointments/[id]/readiness - Check appointment readiness
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const appointmentId = params.id

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Get required forms for this appointment
    const requiredForms = await prisma.patientDocument.findMany({
      where: {
        patientId: appointment.patientId,
        mimeType: 'application/json',
        tags: { has: `appointment:${appointmentId}` }
      }
    })

    // Parse form metadata to check status
    const formStatuses = requiredForms.map(form => {
      let metadata: any = {}
      try {
        metadata = JSON.parse(form.description || '{}')
      } catch (e) {
        metadata = { status: 'draft' }
      }

      return {
        id: form.id,
        type: form.category,
        title: form.originalName,
        status: metadata.status || 'draft',
        priority: metadata.priority || 'normal',
        isRequired: metadata.isRequired || false
      }
    })

    // Check readiness
    const requiredForms_incomplete = formStatuses.filter(form => 
      form.isRequired && form.status !== 'completed' && form.status !== 'submitted'
    )

    const highPriorityIncomplete = requiredForms_incomplete.filter(form => form.priority === 'high')
    
    const readinessStatus = {
      isReady: requiredForms_incomplete.length === 0,
      canProceed: highPriorityIncomplete.length === 0, // Can proceed if all high priority forms are complete
      completionPercentage: Math.round((formStatuses.filter(f => f.status === 'completed' || f.status === 'submitted').length / formStatuses.length) * 100),
      requiredFormsTotal: formStatuses.length,
      completedForms: formStatuses.filter(f => f.status === 'completed' || f.status === 'submitted').length,
      pendingForms: requiredForms_incomplete.length,
      highPriorityPending: highPriorityIncomplete.length
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          appointmentNumber: appointment.appointmentNumber,
          scheduledDatetime: appointment.scheduledDatetime,
          appointmentType: appointment.appointmentType,
          status: appointment.status
        },
        readiness: readinessStatus,
        forms: formStatuses,
        incompleteForms: requiredForms_incomplete
      }
    })

  } catch (error) {
    console.error("Error checking appointment readiness:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


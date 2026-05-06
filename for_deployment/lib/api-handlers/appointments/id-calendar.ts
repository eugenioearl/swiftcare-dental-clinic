import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateICalFile, createAppointmentCalendarEvent } from "@/lib/calendar"

// GET /api/appointments/[id]/calendar - Download calendar invite
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch appointment with related data
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { include: { user: true } },
        dentist: { include: { user: true } }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const patientUser = appointment.patient.user
    const dentistUser = appointment.dentist?.user

    // Create calendar event
    const calendarEvent = createAppointmentCalendarEvent(
      appointment.id,
      appointment.appointmentNumber,
      appointment.appointmentType,
      new Date(appointment.scheduledDatetime),
      appointment.durationMinutes,
      `${patientUser?.lastName || ""}, ${patientUser?.firstName || ""}`,
      patientUser?.email,
      dentistUser ? `${dentistUser.lastName}, ${dentistUser.firstName}` : undefined,
      appointment.reasonForVisit || undefined
    )

    // Generate .ics file content
    const icsContent = generateICalFile(calendarEvent)

    // Return as downloadable file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="appointment-${appointment.appointmentNumber}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error("Error generating calendar file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import QRCode from 'qrcode'

// GET /api/appointments/[id]/qr-code - Generate QR code for appointment check-in
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    // Check if user has permission to view this appointment
    const isPatient = session.user?.role === 'patient' && appointment.patient.user?.id === session.user?.id
    const isStaff = ['admin', 'manager', 'receptionist', 'dentist'].includes(session.user?.role)
    
    if (!isPatient && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Generate QR code data
    const qrData = {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      appointmentNumber: appointment.appointmentNumber,
      checkInUrl: `${process.env.NEXTAUTH_URL}/patient/check-in?apt=${appointment.id}&qr=true`
    }

    const qrString = JSON.stringify(qrData)
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrString, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        checkInUrl: qrData.checkInUrl,
        appointmentNumber: appointment.appointmentNumber
      }
    })

  } catch (error) {
    console.error("Error generating QR code:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

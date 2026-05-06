
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessAppointments } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/calendar/resources - Get available resources (dentists, rooms, equipment)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessAppointments(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const resourceType = searchParams.get('type') // 'dentist', 'room', 'equipment'

    // Get dentists
    const dentists = await prisma.dentist.findMany({
      where: { 
        isAvailable: true,
        user: { isActive: true }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { user: { lastName: 'asc' } }
    })

    // Format dentists as resources
    const dentistResources = dentists.map(dentist => ({
      id: dentist.id,
      name: `Dr. ${dentist.user.lastName}, ${dentist.user.firstName}`,
      type: 'dentist',
      isAvailable: dentist.isAvailable,
      description: dentist.specialization || 'General Dentist',
      email: dentist.user.email,
      specialization: dentist.specialization
    }))

    // Mock rooms data (in real implementation, this would come from a rooms table)
    const roomResources = [
      {
        id: 'room1',
        name: 'Room 1',
        type: 'room',
        isAvailable: true,
        description: 'General consultation and examination room',
        capacity: 1
      },
      {
        id: 'room2',
        name: 'Room 2', 
        type: 'room',
        isAvailable: true,
        description: 'Surgery and procedure room',
        capacity: 1
      },
      {
        id: 'room3',
        name: 'X-Ray Room',
        type: 'room',
        isAvailable: true,
        description: 'Digital imaging and radiology',
        capacity: 1
      },
      {
        id: 'room4',
        name: 'Hygiene Bay 1',
        type: 'room',
        isAvailable: true,
        description: 'Dental cleaning and prevention',
        capacity: 1
      },
      {
        id: 'room5',
        name: 'Hygiene Bay 2',
        type: 'room',
        isAvailable: true,
        description: 'Dental cleaning and prevention',
        capacity: 1
      },
      {
        id: 'consultation',
        name: 'Consultation Room',
        type: 'room',
        isAvailable: true,
        description: 'Private consultation and treatment planning',
        capacity: 3
      }
    ]

    // Mock equipment data
    const equipmentResources = [
      {
        id: 'xray_machine',
        name: 'Digital X-Ray Machine',
        type: 'equipment',
        isAvailable: true,
        description: 'High-resolution digital imaging',
        location: 'X-Ray Room'
      },
      {
        id: 'ultrasonic_scaler',
        name: 'Ultrasonic Scaler',
        type: 'equipment',
        isAvailable: true,
        description: 'Advanced scaling and cleaning equipment',
        location: 'Mobile'
      },
      {
        id: 'laser_therapy',
        name: 'Soft Tissue Laser',
        type: 'equipment',
        isAvailable: true,
        description: 'Minimally invasive laser therapy',
        location: 'Room 2'
      }
    ]

    // Combine all resources
    let resources = [...dentistResources, ...roomResources, ...equipmentResources]

    // Filter by resource type if specified
    if (resourceType && resourceType !== 'all') {
      resources = resources.filter(resource => resource.type === resourceType)
    }

    // If date is provided, check availability for that specific date
    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

      // Get appointments for the specified date to check resource availability
      const appointmentsOnDate = await prisma.appointment.findMany({
        where: {
          scheduledDatetime: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: { notIn: ['cancelled', 'no_show'] }
        },
        select: {
          dentistId: true,
          scheduledDatetime: true,
          durationMinutes: true
        }
      })

      // Mark resources as busy based on appointments
      resources = resources.map(resource => {
        if (resource.type === 'dentist') {
          const dentistAppointments = appointmentsOnDate.filter(apt => apt.dentistId === resource.id)
          const totalBusyMinutes = dentistAppointments.reduce((sum, apt) => sum + apt.durationMinutes, 0)
          
          return {
            ...resource,
            busyMinutes: totalBusyMinutes,
            appointmentCount: dentistAppointments.length,
            utilizationPercent: Math.round((totalBusyMinutes / (8 * 60)) * 100) // Assuming 8-hour workday
          }
        }
        return resource
      })
    }

    // Get resource utilization statistics
    const stats = {
      totalDentists: dentistResources.length,
      activeDentists: dentistResources.filter(d => d.isAvailable).length,
      totalRooms: roomResources.length,
      availableRooms: roomResources.filter(r => r.isAvailable).length,
      totalEquipment: equipmentResources.length,
      availableEquipment: equipmentResources.filter(e => e.isAvailable).length
    }

    return NextResponse.json({
      success: true,
      data: { 
        resources,
        stats,
        date: date || null
      }
    })

  } catch (error) {
    console.error("Error fetching resources:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

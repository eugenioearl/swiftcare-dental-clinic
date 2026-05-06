

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicHoursForDate, parseTime } from "@/lib/clinic-hours"
import { getBookingSettings, effectiveMaxPerSlot } from "@/lib/booking-settings"

export const dynamic = "force-dynamic"

// GET /api/appointments/available-slots - Get available time slots for a given date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      // Temporarily allow access for testing - this should be removed in production
      console.log('⚠️ Bypassing auth for available-slots API - TESTING ONLY')
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const proceduresParam = searchParams.get('procedures')
    
    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    // Parse the date
    const targetDate = new Date(date)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    // Get total number of available dentists
    // First, try to find dentists with schedules for this specific date
    const dentistsWithSchedules = await prisma.schedule.findMany({
      where: {
        scheduleDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        isAvailable: true,
        dentist: {
          isAvailable: true
        }
      },
      select: {
        dentistId: true
      },
      distinct: ['dentistId']
    })
    
    // If no schedules exist for this date, use all available dentists
    // This allows booking even when schedules haven't been created yet
    let totalDentists = dentistsWithSchedules.length
    
    if (totalDentists === 0) {
      const allAvailableDentists = await prisma.dentist.findMany({
        where: {
          isAvailable: true
        },
        select: {
          id: true
        }
      })
      totalDentists = allAvailableDentists.length
      console.log(`No schedules found for ${date}, using all ${totalDentists} available dentists`)
    } else {
      console.log(`Found ${totalDentists} dentists with schedules for ${date}`)
    }

    // Calculate estimated duration from procedures
    let estimatedDuration = 30 // default
    if (proceduresParam && proceduresParam !== '') {
      const procedureIds = proceduresParam.split(',').filter(Boolean)
      if (procedureIds.length > 0) {
        const selectedProcedures = await prisma.treatment.findMany({
          where: { id: { in: procedureIds } }
        })
        estimatedDuration = selectedProcedures.reduce((sum, proc) => 
          sum + (proc.estimatedDurationMinutes || 30), 0
        )
      }
    }

    // Get dynamic clinic hours for this date
    const clinicHours = await getClinicHoursForDate(new Date(date))
    
    if (clinicHours.isClosed) {
      return NextResponse.json({
        success: true,
        availableSlots: [],
        totalDentists,
        requestedDuration: estimatedDuration,
        clinicClosed: true,
        closedReason: clinicHours.reason || 'Clinic is closed on this date'
      })
    }

    const open = parseTime(clinicHours.openTime)
    const close = parseTime(clinicHours.closeTime)

    // Generate all possible time slots based on clinic hours (every 30 minutes)
    const timeSlots = []
    for (let hour = open.hours; hour < close.hours || (hour === close.hours && 0 < close.minutes); hour++) {
      for (let minute = (hour === open.hours ? open.minutes : 0); minute < 60; minute += 30) {
        // Don't go past close time
        if (hour > close.hours || (hour === close.hours && minute >= close.minutes)) break
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        timeSlots.push(timeString)
      }
    }

    const availableSlots: any[] = []
    const bookingSettings = await getBookingSettings(new Date(date))
    const MAX_PER_SLOT = effectiveMaxPerSlot(bookingSettings)

    // Compare dates in clinic's local timezone (Asia/Manila) to handle server timezone mismatches
    const CLINIC_TZ = 'Asia/Manila'
    const getClinicParts = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d)
      const obj: Record<string, string> = {}
      for (const p of parts) if (p.type !== 'literal') obj[p.type] = p.value
      return {
        date: `${obj.year}-${obj.month}-${obj.day}`,
        hour: parseInt(obj.hour, 10),
        minute: parseInt(obj.minute, 10),
      }
    }

    // The requested date as YYYY-MM-DD in clinic TZ
    const requestedDateStr = (() => {
      // Accept "YYYY-MM-DD" or full ISO — treat only the date component
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
      return getClinicParts(new Date(date)).date
    })()

    const nowInClinic = getClinicParts(new Date())
    const isToday = requestedDateStr === nowInClinic.date
    // Add small buffer (15 minutes) before "now" so patients can't book a slot that's too close
    const nowMinutes = nowInClinic.hour * 60 + nowInClinic.minute + 15

    // Check each time slot
    for (const timeSlot of timeSlots) {
      const [hours, minutes] = timeSlot.split(':').map(Number)
      const appointmentStart = new Date(targetDate)
      appointmentStart.setHours(hours, minutes, 0, 0)

      // Skip past (or too-soon) time slots if booking for today
      if (isToday) {
        const slotMinutes = hours * 60 + minutes
        if (slotMinutes <= nowMinutes) {
          continue // Don't show slots that have already passed or are within the next 15 min
        }
      }
      
      const appointmentEnd = new Date(appointmentStart)
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + estimatedDuration)

      // Check if appointment would end after business hours
      const businessEnd = new Date(targetDate)
      businessEnd.setHours(close.hours, close.minutes, 0, 0)
      
      if (appointmentEnd > businessEnd) {
        continue // Skip this slot if appointment would run past business hours
      }

      // Get existing appointments that would conflict with this time slot
      const conflictingAppointments = await prisma.appointment.count({
        where: {
          scheduledDatetime: {
            gte: appointmentStart,
            lt: appointmentEnd
          },
          status: {
            notIn: ['cancelled', 'no_show', 'completed']
          },
          // Only count appointments with assigned dentists
          dentistId: {
            not: null
          }
        }
      })

      // Count TOTAL bookings at this slot (regardless of dentist assignment)
      // for the double-booking cap.
      const totalSlotBookings = await prisma.appointment.count({
        where: {
          scheduledDatetime: {
            gte: appointmentStart,
            lt: appointmentEnd
          },
          status: {
            notIn: ['cancelled', 'no_show', 'completed']
          }
        }
      })

      // Also check for appointments that would be interrupted by this new appointment
      const interruptingAppointments = await prisma.appointment.count({
        where: {
          OR: [
            // Appointments that start before but end after our start time
            {
              AND: [
                { scheduledDatetime: { lt: appointmentStart } },
                { 
                  scheduledDatetime: { 
                    gte: new Date(appointmentStart.getTime() - 240 * 60 * 1000) // Max 4 hours before
                  } 
                }
              ]
            }
          ],
          status: {
            notIn: ['cancelled', 'no_show', 'completed']
          },
          dentistId: {
            not: null
          }
        }
      })

      const busyDentists = conflictingAppointments + interruptingAppointments
      const availableDentists = Math.max(0, totalDentists - busyDentists)

      // Enforce admin-configurable double-booking cap
      const slotIsFull = totalSlotBookings >= MAX_PER_SLOT
      const slotIsAvailable = availableDentists > 0 && !slotIsFull

      availableSlots.push({
        time: timeSlot,
        availableDentists: availableDentists,
        estimatedDuration: estimatedDuration,
        booked: totalSlotBookings,
        capacity: MAX_PER_SLOT,
        full: slotIsFull,
        available: slotIsAvailable,
      })
    }

    return NextResponse.json({
      success: true,
      availableSlots,
      totalDentists,
      requestedDuration: estimatedDuration,
      doubleBooking: {
        enabled: bookingSettings.doubleBookingEnabled,
        maxPerSlot: MAX_PER_SLOT,
      },
      clinicHours: {
        openTime: clinicHours.openTime,
        closeTime: clinicHours.closeTime,
        isClosed: false
      }
    })

  } catch (error) {
    console.error("Error fetching available slots:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


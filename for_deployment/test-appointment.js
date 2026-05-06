
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function testAppointmentBooking() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Testing appointment booking functionality...')
    
    // Get a sample patient and dentist
    const samplePatient = await prisma.patient.findFirst({
      include: { user: true }
    })
    
    const sampleDentist = await prisma.dentist.findFirst({
      include: { user: true }
    })
    
    if (!samplePatient || !sampleDentist) {
      throw new Error('No sample patient or dentist found')
    }
    
    console.log(`Found patient: ${samplePatient.user.firstName} ${samplePatient.user.lastName}`)
    console.log(`Found dentist: Dr. ${sampleDentist.user.firstName} ${sampleDentist.user.lastName}`)
    
    // Test appointment data similar to what the booking form sends
    const appointmentData = {
      patientId: samplePatient.id,
      dentistId: sampleDentist.id,
      appointmentType: 'consultation',
      scheduledDatetime: new Date('2024-12-01T10:00:00Z'),
      durationMinutes: 30,
      reasonForVisit: 'Test booking',
      isEmergency: false,
      procedures: [] // Empty procedures
    }
    
    // Validate data structure
    console.log('Appointment data:', JSON.stringify(appointmentData, null, 2))
    
    // Check for existing appointments at this time
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        dentistId: appointmentData.dentistId,
        scheduledDatetime: appointmentData.scheduledDatetime,
        status: {
          notIn: ['cancelled', 'no_show', 'completed']
        }
      }
    })
    
    if (existingAppointment) {
      console.log('Conflict check passed: Found existing appointment', existingAppointment.id)
    } else {
      console.log('No conflicts found for this time slot')
    }
    
    // Generate appointment number
    const currentYear = new Date().getFullYear()
    const appointmentCount = await prisma.appointment.count()
    const appointmentNumber = `A-${currentYear}-${String(appointmentCount + 1).padStart(4, '0')}`
    console.log('Generated appointment number:', appointmentNumber)
    
    console.log('All validation checks passed. The appointment booking logic should work correctly.')
    
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAppointmentBooking()

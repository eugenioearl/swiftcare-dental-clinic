const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkData() {
  console.log('🔍 Verifying imported data:')
  
  const userCount = await prisma.user.count()
  const patientCount = await prisma.patient.count()
  const dentistCount = await prisma.dentist.count()
  const appointmentCount = await prisma.appointment.count()
  const treatmentCount = await prisma.treatment.count()
  const billingCount = await prisma.billing.count()
  const inventoryCount = await prisma.inventoryItem.count()
  
  console.log(`📊 Import Summary:`)
  console.log(`   👥 Users: ${userCount}`)
  console.log(`   🏥 Patients: ${patientCount}`)
  console.log(`   🦷 Dentists: ${dentistCount}`)
  console.log(`   📅 Appointments: ${appointmentCount}`)
  console.log(`   💊 Treatments: ${treatmentCount}`)
  console.log(`   💳 Billing Records: ${billingCount}`)
  console.log(`   📦 Inventory Items: ${inventoryCount}`)
  
  // Sample data verification
  const samplePatient = await prisma.patient.findFirst({
    include: { user: true }
  })
  
  const sampleAppointment = await prisma.appointment.findFirst({
    include: { 
      patient: { include: { user: true } },
      dentist: { include: { user: true } }
    }
  })
  
  console.log(`\n📝 Sample Data:`)
  console.log(`   Patient: ${samplePatient?.user.firstName} ${samplePatient?.user.lastName}`)
  console.log(`   Appointment: ${sampleAppointment?.appointmentType} on ${sampleAppointment?.scheduledDatetime.toDateString()}`)
  console.log(`   Dentist: Dr. ${sampleAppointment?.dentist?.user.firstName} ${sampleAppointment?.dentist?.user.lastName}`)
  
  await prisma.$disconnect()
}

checkData().catch(console.error)

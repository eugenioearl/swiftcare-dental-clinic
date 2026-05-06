require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    
    const userCount = await prisma.user.count()
    console.log(`Database connected successfully. Found ${userCount} users.`)
    
    // Test appointments table
    const appointmentCount = await prisma.appointment.count()
    console.log(`Found ${appointmentCount} appointments.`)
    
    // Test dentists
    const dentistCount = await prisma.dentist.count()
    console.log(`Found ${dentistCount} dentists.`)
    
    // Test patients
    const patientCount = await prisma.patient.count()
    console.log(`Found ${patientCount} patients.`)
    
  } catch (error) {
    console.error('Database connection error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()

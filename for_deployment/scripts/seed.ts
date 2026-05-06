
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
config()

const prisma = new PrismaClient()

// Import demo data from JSON files
async function loadDemoData() {
  const demoDataPath = path.join(process.cwd(), '../demo-data')
  
  const files = [
    'users.json',
    'patients.json', 
    'treatments_procedures.json',
    'appointments.json',
    'inventory.json',
    'billing_payments.json',
    'queue_management.json',
    'analytics_reports.json'
  ]

  const demoData: any = {}

  for (const file of files) {
    try {
      const filePath = path.join(demoDataPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(fileContent)
      demoData[file.replace('.json', '')] = data
      console.log(`📁 Loaded ${file}`)
    } catch (error) {
      console.warn(`⚠️ Could not load ${file}:`, error)
    }
  }

  return demoData
}

async function clearDatabase() {
  console.log('🗑️ Clearing existing data...')
  
  // Clear in correct order to handle foreign keys
  await prisma.notification.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.billing.deleteMany()
  await prisma.appointmentTreatmentItem.deleteMany()
  await prisma.appointmentTreatment.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.inventoryTransaction.deleteMany()
  await prisma.treatmentInventoryUsage.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.dentalAnnotation.deleteMany()
  await prisma.dentalProcedure.deleteMany()
  await prisma.toothRecord.deleteMany()
  await prisma.dentalRecord.deleteMany()
  await prisma.treatmentPlan.deleteMany()
  await prisma.patientDocument.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.dentist.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()
  await prisma.treatment.deleteMany()
  await prisma.systemSetting.deleteMany()

  console.log('✅ Database cleared')
}

async function seedSystemSettings() {
  console.log('⚙️ Creating system settings...')
  
  await prisma.systemSetting.createMany({
    data: [
      {
        settingKey: 'clinic_name',
        settingValue: 'SwiftCare Dental Clinic',
        description: 'Clinic name displayed in UI',
        dataType: 'string',
        isPublic: true
      },
      {
        settingKey: 'clinic_phone',
        settingValue: '+63 2 8123 4567',
        description: 'Main clinic phone number',
        dataType: 'string',
        isPublic: true
      },
      {
        settingKey: 'clinic_email',
        settingValue: 'info@swiftcaredental.com',
        description: 'Clinic email address',
        dataType: 'string',
        isPublic: true
      },
      {
        settingKey: 'clinic_address',
        settingValue: '456 Healthcare Avenue, Ortigas Center, Pasig City, Philippines',
        description: 'Clinic address',
        dataType: 'string',
        isPublic: true
      },
      {
        settingKey: 'appointment_duration_default',
        settingValue: '30',
        description: 'Default appointment duration in minutes',
        dataType: 'integer'
      },
      {
        settingKey: 'working_hours_start',
        settingValue: '08:00',
        description: 'Clinic opening time',
        dataType: 'string'
      },
      {
        settingKey: 'working_hours_end',
        settingValue: '18:00',
        description: 'Clinic closing time',
        dataType: 'string'
      }
    ]
  })
  
  console.log('✅ System settings created')
}

async function seedUsers(demoData: any) {
  console.log('👥 Creating users...')
  
  const users = demoData.users?.users || []
  const userIdMap = new Map() // Map demo IDs to real UUIDs
  
  for (const userData of users) {
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10)
      
      const user = await prisma.user.create({
        data: {
          email: userData.username,
          passwordHash: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: userData.role as any,
          isActive: userData.status === 'active',
          emailVerified: true,
        }
      })
      
      userIdMap.set(userData.id, user.id)
      console.log(`✓ Created user: ${userData.firstName} ${userData.lastName} (${userData.role})`)
      
      // Create dentist profile if role is dentist
      if (userData.role === 'dentist') {
        await prisma.dentist.create({
          data: {
            userId: user.id,
            licenseNumber: userData.licenseNumber || `LIC-${Math.floor(Math.random() * 100000)}`,
            licenseState: userData.licenseState || 'NCR',
            specialization: userData.specialization || 'General Dentistry',
            bio: userData.bio || `Dr. ${userData.firstName} ${userData.lastName} is a dedicated dental professional.`,
            consultationFee: parseFloat(userData.consultationFee || '1500'),
            yearsExperience: userData.yearsExperience || 5,
            education: userData.education || 'Doctor of Dental Surgery',
            languagesSpoken: userData.languagesSpoken || ['English'],
          }
        })
        console.log(`✓ Created dentist profile for: ${userData.firstName} ${userData.lastName}`)
      }
      
      // Create staff profile if role is staff/receptionist/manager
      if (['staff', 'receptionist', 'manager'].includes(userData.role) && userData.employeeId) {
        await prisma.staff.create({
          data: {
            userId: user.id,
            employeeId: userData.employeeId,
            department: userData.department,
            position: userData.role,
            hireDate: new Date(userData.dateHired || '2024-01-01'),
          }
        })
      }
      
    } catch (error) {
      console.error(`❌ Error creating user ${userData.username}:`, error)
    }
  }
  
  return userIdMap
}

async function seedPatients(demoData: any, userIdMap: Map<string, string>) {
  console.log('🏥 Creating patients...')
  
  const patients = demoData.patients?.patients || []
  const patientIdMap = new Map()
  
  // Helper function to truncate strings safely
  const truncateString = (str: string | undefined, maxLength: number): string | undefined => {
    if (!str) return str
    return str.length > maxLength ? str.substring(0, maxLength) : str
  }
  
  for (const patientData of patients) {
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(patientData.password, 10)
      
      // Create user account for patient
      const user = await prisma.user.create({
        data: {
          email: patientData.email,
          passwordHash: hashedPassword,
          firstName: truncateString(patientData.firstName, 100) || 'Unknown',
          lastName: truncateString(patientData.lastName, 100) || 'Unknown',
          phone: truncateString(patientData.phone, 20),
          role: 'patient',
          isActive: true,
          emailVerified: true,
        }
      })
      
      // Create patient profile
      const shortPatientNumber = `PAT-${Math.floor(Math.random() * 100000)}`
      const cityFromAddress = patientData.address?.split(',').slice(1).join(',')?.trim() || ''
      
      // Safely extract and truncate values
      const medicalConditions = Array.isArray(patientData.medicalHistory?.conditions) 
        ? patientData.medicalHistory.conditions.join(', ') 
        : (patientData.medicalHistory?.notes || '')
      const allergyList = Array.isArray(patientData.medicalHistory?.allergies)
        ? patientData.medicalHistory.allergies.join(', ')
        : ''
      const medicationList = Array.isArray(patientData.medicalHistory?.medications)
        ? patientData.medicalHistory.medications.join(', ')
        : ''
        
      const patient = await prisma.patient.create({
        data: {
          userId: user.id,
          patientNumber: truncateString(shortPatientNumber, 20) || 'PAT-00000',
          dateOfBirth: new Date(patientData.dateOfBirth),
          gender: patientData.gender?.toLowerCase() as any,
          address: truncateString(patientData.address, 500) || '',
          city: truncateString(cityFromAddress, 100) || truncateString(patientData.city, 100) || '',
          zipCode: truncateString(patientData.zipCode, 10) || '',
          emergencyContactName: truncateString(patientData.emergencyContact?.name, 200) || '',
          emergencyContactPhone: truncateString(patientData.emergencyContact?.phone, 20) || '',
          emergencyContactRelationship: truncateString(patientData.emergencyContact?.relationship, 50) || '',
          medicalHistory: truncateString(medicalConditions, 1000) || '',
          allergies: truncateString(allergyList, 500) || '',
          currentMedications: truncateString(medicationList, 500) || '',
          insuranceProvider: truncateString(patientData.insurance?.provider, 200) || '',
          insurancePolicyNumber: truncateString(patientData.insurance?.policyNumber, 100) || '',
          insuranceGroupNumber: truncateString(patientData.insurance?.groupNumber, 100) || '',
          preferredLanguage: truncateString(patientData.preferences?.language || 'English', 50),
        }
      })
      
      patientIdMap.set(patientData.id, patient.id)
      userIdMap.set(patientData.id, user.id)
      console.log(`✓ Created patient: ${patientData.firstName} ${patientData.lastName}`)
      
    } catch (error) {
      console.error(`❌ Error creating patient ${patientData.email}:`, error)
    }
  }
  
  return patientIdMap
}

async function seedTreatments(demoData: any) {
  console.log('🦷 Creating treatments...')
  
  // Create standard procedures from demo data
  const standardProcedures = [
    {
      treatmentCode: "D0150",
      name: "Comprehensive Oral Examination", 
      category: "Preventive",
      baseCost: 1500.00,
      estimatedDurationMinutes: 60
    },
    {
      treatmentCode: "D3310", 
      name: "Endodontic Therapy - Anterior Tooth",
      category: "Endodontic", 
      baseCost: 8000.00,
      estimatedDurationMinutes: 90
    },
    {
      treatmentCode: "D1110",
      name: "Prophylaxis - Adult",
      category: "Preventive",
      baseCost: 2000.00, 
      estimatedDurationMinutes: 45
    },
    {
      treatmentCode: "D2161",
      name: "Composite Filling - Two Surface",
      category: "Restorative",
      baseCost: 3500.00,
      estimatedDurationMinutes: 60
    },
    {
      treatmentCode: "D7140",
      name: "Extraction - Erupted Tooth",
      category: "Oral Surgery", 
      baseCost: 2500.00,
      estimatedDurationMinutes: 30
    }
  ]
  
  const treatmentIdMap = new Map()
  
  for (const treatmentData of standardProcedures) {
    try {
      const treatment = await prisma.treatment.create({
        data: {
          treatmentCode: treatmentData.treatmentCode,
          name: treatmentData.name,
          description: `Standard ${treatmentData.name.toLowerCase()} procedure`,
          category: treatmentData.category,
          baseCost: treatmentData.baseCost,
          estimatedDurationMinutes: treatmentData.estimatedDurationMinutes,
        }
      })
      
      treatmentIdMap.set(treatmentData.treatmentCode, treatment.id)
      console.log(`✓ Created treatment: ${treatmentData.name}`)
      
    } catch (error) {
      console.error(`❌ Error creating treatment ${treatmentData.name}:`, error)
    }
  }
  
  return treatmentIdMap
}

async function seedInventory(demoData: any) {
  console.log('📦 Creating inventory...')
  
  const inventory = demoData.inventory?.items || []
  
  // First create suppliers
  const suppliers = demoData.inventory?.suppliers || []
  const supplierIdMap = new Map()
  
  for (const supplierData of suppliers) {
    try {
      const supplier = await prisma.supplier.create({
        data: {
          name: supplierData.name || `Supplier-${Math.floor(Math.random() * 1000)}`,
          contactPerson: supplierData.contactPerson || '',
          email: supplierData.email || `contact${Math.floor(Math.random() * 1000)}@supplier.com`,
          phone: supplierData.phone || '',
          address: supplierData.address || '',
        }
      })
      
      supplierIdMap.set(supplierData.id, supplier.id)
      console.log(`✓ Created supplier: ${supplierData.name}`)
      
    } catch (error) {
      console.error(`❌ Error creating supplier ${supplierData.name}:`, error)
    }
  }
  
  // Then create inventory items
  for (const itemData of inventory) {
    try {
      const supplierId = itemData.supplierId ? supplierIdMap.get(itemData.supplierId) : null
      
      // Helper to safely parse numbers
      const parseNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue
        const parsed = Number(value)
        return isNaN(parsed) ? defaultValue : parsed
      }
      
      await prisma.inventoryItem.create({
        data: {
          name: itemData.name || 'Unknown Item',
          description: itemData.description || '',
          category: (itemData.category || 'equipment') as any,
          sku: itemData.sku || `SKU-${Math.floor(Math.random() * 100000)}`,
          currentStock: parseNumber(itemData.currentStock, 0),
          minimumStock: parseNumber(itemData.minimumStock, 0),
          unit: itemData.unit || 'piece',
          costPerUnit: parseNumber(itemData.costPerUnit, 0),
          supplierId: supplierId,
          status: (itemData.status || 'active') as any,
        }
      })
      
      console.log(`✓ Created inventory item: ${itemData.name}`)
      
    } catch (error) {
      console.error(`❌ Error creating inventory item ${itemData.name}:`, error)
    }
  }
}

async function seedAppointments(demoData: any, patientIdMap: Map<string, string>, userIdMap: Map<string, string>, treatmentIdMap: Map<string, string>) {
  console.log('📅 Creating appointments...')
  
  const appointments = demoData.appointments?.appointments || []
  
  // Get all dentist records (not user records!) for appointments
  const dentistRecords = await prisma.dentist.findMany({
    select: { 
      id: true, 
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })
  
  // Create mapping from demo user ID to actual Dentist.id
  const dentistIdMap = new Map<string, string>()
  for (const dentist of dentistRecords) {
    // Find the demo user ID that maps to this dentist's userId
    for (const [demoUserId, actualUserId] of userIdMap.entries()) {
      if (actualUserId === dentist.userId) {
        dentistIdMap.set(demoUserId, dentist.id)
        break
      }
    }
  }
  
  const fallbackDentistId = dentistRecords[0]?.id
  
  // Debug logging
  console.log('🔍 Debug Info:')
  console.log('Available userIdMap entries:', Array.from(userIdMap.keys()).slice(0, 10))
  console.log('Available patientIdMap entries:', Array.from(patientIdMap.keys()).slice(0, 5))
  console.log('Dentist records found:', dentistRecords.length)
  console.log('DentistIdMap entries:', Array.from(dentistIdMap.entries()))
  console.log('Fallback dentist ID (Dentist.id):', fallbackDentistId)
  
  // Helper function to map appointment types to valid enum values
  const mapAppointmentType = (type: string): string => {
    const typeMapping: { [key: string]: string } = {
      'extraction': 'surgery',
      'filling': 'procedure',
      'composite_filling': 'procedure',
      'crown': 'procedure',
      'root_canal': 'procedure',
      'dental_implant': 'surgery',
      'bridge': 'procedure',
      'orthodontic': 'consultation',
      'scaling': 'cleaning',
      'polishing': 'cleaning',
      'whitening': 'procedure',
      'follow-up': 'follow_up',
      'followup': 'follow_up',
      'check-up': 'consultation',
      'checkup': 'consultation',
      'routine': 'consultation',
      'examination': 'consultation',
      'consult': 'consultation'
    }
    
    const normalizedType = type?.toLowerCase().replace(/[_\s-]/g, '_')
    return typeMapping[normalizedType] || typeMapping[type?.toLowerCase()] || 'consultation'
  }
  
  // Helper function to truncate strings safely
  const truncateString = (str: string | undefined, maxLength: number): string | undefined => {
    if (!str) return str
    return str.length > maxLength ? str.substring(0, maxLength) : str
  }

  // Helper function to map appointment statuses to valid enum values
  const mapAppointmentStatus = (status: string): string => {
    const statusMapping: { [key: string]: string } = {
      'booked': 'scheduled',
      'confirmed': 'confirmed',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'no_show': 'no_show',
      'rescheduled': 'rescheduled',
      'pending': 'pending_assignment',
      'in_progress': 'in_progress',
      'checked_in': 'checked_in',
      'waiting': 'waiting'
    }
    
    return statusMapping[status?.toLowerCase()] || 'scheduled'
  }
  
  let appointmentCount = 0
  
  // First, create some appointments for TODAY to populate the queue system
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const patients = await prisma.patient.findMany()
  
  // Create 10 appointments for today at different times
  const todayTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']
  
  for (let i = 0; i < Math.min(10, patients.length); i++) {
    try {
      const patient = patients[i]
      const dentistId = fallbackDentistId || dentistIdMap.values().next().value
      const createdById = userIdMap.get('USR-AD-001') || patient.userId
      const timeSlot = todayTimes[i % todayTimes.length]
      
      const scheduledDatetime = new Date(`${todayStr}T${timeSlot}:00`)
      
      await prisma.appointment.create({
        data: {
          appointmentNumber: `APT-TODAY-${i + 1}`,
          patientId: patient.id,
          dentistId: dentistId,
          createdBy: createdById,
          scheduledDatetime: scheduledDatetime,
          durationMinutes: 30,
          status: 'confirmed' as any,
          appointmentType: 'consultation' as any,
          reasonForVisit: getRandomComplaint(),
          estimatedCost: parseFloat((Math.random() * 3000 + 1500).toFixed(2)),
        }
      })
      
      appointmentCount++
      console.log(`✓ Created TODAY appointment: ${i + 1} at ${timeSlot}`)
      
    } catch (error) {
      console.error(`❌ Error creating today appointment ${i + 1}:`, error)
    }
  }
  
  // Then create appointments from demo data
  for (const aptData of appointments) {
    try {
      const patientId = patientIdMap.get(aptData.patientId)
      
      if (!patientId) {
        console.warn(`⚠️ Patient not found for appointment ${aptData.id}`)
        continue
      }
      
      // Map dentist ID to actual Dentist.id, with aggressive fallback
      let dentistId = dentistIdMap.get(aptData.dentistId)
      if (!dentistId) {
        // Use fallback dentist if original mapping fails
        dentistId = fallbackDentistId
        console.log(`🔄 Using fallback dentist for appointment ${aptData.id} (original: ${aptData.dentistId})`)
      }
      
      if (!dentistId) {
        console.warn(`⚠️ No dentist found for appointment ${aptData.id}, skipping`)
        continue
      }
      
      const createdById = userIdMap.get(aptData.createdBy || aptData.dentistId) || dentistId || patientId
      
      const scheduledDatetime = new Date(`${aptData.appointmentDate}T${aptData.appointmentTime}:00`)
      
      const appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: truncateString(`APT-${Math.floor(Math.random() * 100000)}`, 20) || `APT-${Math.floor(Math.random() * 10000)}`,
          patientId: patientId,
          dentistId: dentistId,
          createdBy: createdById,
          scheduledDatetime: scheduledDatetime,
          durationMinutes: aptData.duration || 30,
          status: mapAppointmentStatus(aptData.status) as any,
          appointmentType: mapAppointmentType(aptData.type) as any,
          reasonForVisit: truncateString(aptData.notes, 500),
          estimatedCost: parseFloat(aptData.totalAmount || '0'),
          completedAt: aptData.completedAt ? new Date(aptData.completedAt) : null,
        }
      })
      
      appointmentCount++
      console.log(`✓ Created appointment: ${aptData.id}`)
      
    } catch (error) {
      console.error(`❌ Error creating appointment ${aptData.id}:`, error)
    }
  }
  
  console.log(`✅ Total appointments created: ${appointmentCount}`)
}

async function seedBilling(demoData: any, patientIdMap: Map<string, string>) {
  console.log('💳 Creating billing records...')
  
  const billingData = demoData.billing_payments?.billing || []
  
  for (const billData of billingData) {
    try {
      const patientId = patientIdMap.get(billData.patientId)
      
      if (!patientId) {
        console.warn(`⚠️ Patient not found for billing ${billData.id}`)
        continue
      }
      
      // Helper function to safely parse decimals
      const parseDecimal = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue
        const parsed = parseFloat(value)
        return isNaN(parsed) ? defaultValue : parsed
      }
      
      const billing = await prisma.billing.create({
        data: {
          invoiceNumber: billData.invoiceNumber || `INV-${Math.floor(Math.random() * 100000)}`,
          patientId: patientId,
          subtotal: parseDecimal(billData.subtotal),
          taxAmount: parseDecimal(billData.tax || billData.taxAmount),
          totalAmount: parseDecimal(billData.totalAmount),
          balanceDue: parseDecimal(billData.balanceDue || billData.totalAmount),
          status: (billData.status || 'draft') as any,
          dueDate: billData.dueDate ? new Date(billData.dueDate) : null,
        }
      })
      
      // Create payments if any
      if (billData.payments && Array.isArray(billData.payments) && billData.payments.length > 0) {
        for (const paymentData of billData.payments) {
          try {
            await prisma.payment.create({
              data: {
                billingId: billing.id,
                paymentReference: `PAY-${Math.floor(Math.random() * 100000)}`,
                amount: parseDecimal(paymentData.amount),
                paymentMethod: (paymentData.method || 'cash') as any,
                status: (paymentData.status || 'pending') as any,
                processedAt: paymentData.processedAt ? new Date(paymentData.processedAt) : null,
              }
            })
          } catch (paymentError) {
            console.error(`❌ Error creating payment for ${billData.invoiceNumber}:`, paymentError)
          }
        }
      }
      
      console.log(`✓ Created billing: ${billData.invoiceNumber || billing.invoiceNumber}`)
      
    } catch (error) {
      console.error(`❌ Error creating billing ${billData.id}:`, error)
    }
  }
}

async function seedQueueManagement(demoData: any, patientIdMap: Map<string, string>) {
  console.log('🎯 Creating queue management data...')
  
  try {
    // Get today's appointments that should be in the queue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayAppointments = await prisma.appointment.findMany({
      where: {
        scheduledDatetime: {
          gte: today,
          lt: tomorrow
        },
        status: {
          in: ['confirmed', 'checked_in', 'waiting', 'in_progress']
        }
      },
      include: {
        patient: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        scheduledDatetime: 'asc'
      }
    })

    // Update some appointments to have queue-like statuses
    let queuePosition = 1
    const currentTime = new Date()
    
    for (const appointment of todayAppointments) {
      // Set appointment status based on time
      let status = 'confirmed'
      let checkedInAt = null
      let startedAt = null
      
      if (queuePosition <= 2) {
        status = 'in_progress'
        checkedInAt = new Date(currentTime.getTime() - (60 * 60 * 1000)) // 1 hour ago
        startedAt = new Date(currentTime.getTime() - (30 * 60 * 1000)) // 30 minutes ago
      } else if (queuePosition <= 5) {
        status = 'checked_in'
        checkedInAt = new Date(currentTime.getTime() - (30 * 60 * 1000)) // 30 minutes ago
      } else if (queuePosition <= 8) {
        status = 'waiting'
        checkedInAt = new Date(currentTime.getTime() - (10 * 60 * 1000)) // 10 minutes ago
      }
      
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: status as any,
          checkedInAt: checkedInAt,
          startedAt: startedAt
        }
      })
      
      queuePosition++
    }
    
    console.log(`✓ Updated ${todayAppointments.length} appointments for queue management`)
    
  } catch (error) {
    console.error('❌ Error creating queue management data:', error)
  }
}

async function seedDentalRecords(patientIdMap: Map<string, string>) {
  console.log('🦷 Creating dental records...')
  
  try {
    const patients = await prisma.patient.findMany({
      include: { user: true }
    })
    
    const dentists = await prisma.dentist.findMany()
    
    for (const patient of patients.slice(0, 15)) { // Create records for first 15 patients
      const dentist = dentists[Math.floor(Math.random() * dentists.length)]
      
      // Create 1-3 dental records per patient
      const recordCount = Math.floor(Math.random() * 3) + 1
      
      for (let i = 0; i < recordCount; i++) {
        const visitDate = new Date()
        visitDate.setDate(visitDate.getDate() - (Math.floor(Math.random() * 365)))
        
        const dentalRecord = await prisma.dentalRecord.create({
          data: {
            patientId: patient.id,
            dentistId: dentist.id,
            visitDate: visitDate,
            chiefComplaint: getRandomComplaint(),
            presentIllness: getRandomPresentIllness(),
            treatmentProvided: getRandomTreatment(),
            followUpNeeded: Math.random() > 0.7,
            followUpDate: Math.random() > 0.5 ? new Date(visitDate.getTime() + (30 * 24 * 60 * 60 * 1000)) : null
          }
        })
        
        // Create 1-4 tooth records per dental record
        const toothCount = Math.floor(Math.random() * 4) + 1
        const usedTeethNumbers = new Set()
        
        for (let j = 0; j < toothCount; j++) {
          let toothNumber = Math.floor(Math.random() * 32) + 1
          while (usedTeethNumbers.has(toothNumber.toString())) {
            toothNumber = Math.floor(Math.random() * 32) + 1
          }
          usedTeethNumbers.add(toothNumber.toString())
          
          await prisma.toothRecord.create({
            data: {
              dentalRecordId: dentalRecord.id,
              toothNumber: toothNumber.toString(),
              status: getRandomToothStatus(),
              surfaces: getRandomSurfaces(),
              notes: getRandomToothNotes()
            }
          })
        }
      }
    }
    
    console.log(`✓ Created dental records for ${Math.min(patients.length, 15)} patients`)
    
  } catch (error) {
    console.error('❌ Error creating dental records:', error)
  }
}

async function seedTreatmentPlans(patientIdMap: Map<string, string>) {
  console.log('📋 Creating treatment plans...')
  
  try {
    const patients = await prisma.patient.findMany()
    const dentists = await prisma.dentist.findMany()
    
    for (const patient of patients.slice(0, 10)) { // Create treatment plans for first 10 patients
      const dentist = dentists[Math.floor(Math.random() * dentists.length)]
      
      const treatmentPlan = await prisma.treatmentPlan.create({
        data: {
          patientId: patient.id,
          dentistId: dentist.id,
          title: getRandomTreatmentPlanTitle(),
          description: getRandomTreatmentPlanDescription(),
          status: getRandomTreatmentPlanStatus(),
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          phases: getRandomTreatmentPhases(),
          estimatedStartDate: new Date(),
          estimatedEndDate: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)), // 90 days from now
          estimatedCost: parseFloat((Math.random() * 50000 + 5000).toFixed(2)),
          diagnosis: getRandomDiagnosis(),
          prognosis: ['Excellent', 'Good', 'Fair', 'Poor'][Math.floor(Math.random() * 4)],
          completionPercentage: Math.floor(Math.random() * 101),
          currentPhase: ['initial', 'preparation', 'treatment', 'restoration', 'maintenance'][Math.floor(Math.random() * 5)],
          patientApproval: Math.random() > 0.3
        }
      })
    }
    
    console.log(`✓ Created treatment plans for ${Math.min(patients.length, 10)} patients`)
    
  } catch (error) {
    console.error('❌ Error creating treatment plans:', error)
  }
}

async function seedSchedules() {
  console.log('📅 Creating dentist schedules...')
  
  try {
    const dentists = await prisma.dentist.findMany()
    
    for (const dentist of dentists) {
      // Create schedules for the next 30 days
      for (let day = 0; day < 30; day++) {
        const scheduleDate = new Date()
        scheduleDate.setDate(scheduleDate.getDate() + day)
        
        // Skip weekends
        if (scheduleDate.getDay() === 0 || scheduleDate.getDay() === 6) continue
        
        // Morning schedule (8:00 AM - 12:00 PM)
        await prisma.schedule.create({
          data: {
            dentistId: dentist.id,
            scheduleDate: scheduleDate,
            startTime: new Date('1970-01-01T08:00:00Z'),
            endTime: new Date('1970-01-01T12:00:00Z'),
            isAvailable: Math.random() > 0.1, // 90% availability
            scheduleType: 'regular',
            notes: Math.random() > 0.8 ? 'Available for emergency cases only' : null
          }
        })
        
        // Afternoon schedule (1:00 PM - 6:00 PM)
        await prisma.schedule.create({
          data: {
            dentistId: dentist.id,
            scheduleDate: scheduleDate,
            startTime: new Date('1970-01-01T13:00:00Z'),
            endTime: new Date('1970-01-01T18:00:00Z'),
            isAvailable: Math.random() > 0.1, // 90% availability
            scheduleType: 'regular',
            notes: Math.random() > 0.8 ? 'Limited appointments available' : null
          }
        })
      }
    }
    
    console.log(`✓ Created schedules for ${dentists.length} dentists`)
    
  } catch (error) {
    console.error('❌ Error creating schedules:', error)
  }
}

function getRandomComplaint(): string {
  const complaints = [
    'Toothache in upper right quadrant',
    'Sensitivity to cold drinks',
    'Bleeding gums when brushing',
    'Broken filling in molar',
    'Routine cleaning and check-up',
    'Wisdom tooth pain',
    'Loose crown',
    'Bad breath concern',
    'Jaw pain and clicking',
    'Routine dental check-up'
  ]
  return complaints[Math.floor(Math.random() * complaints.length)]
}

function getRandomPresentIllness(): string {
  const illnesses = [
    'Patient reports intermittent pain for 2 weeks',
    'Gradual onset of sensitivity over past month',
    'Occasional bleeding noticed during oral hygiene',
    'Sharp pain when chewing on affected side',
    'No acute symptoms, preventive visit',
    'Continuous dull ache for 3 days',
    'Swelling and discomfort in gum area',
    'Difficulty opening mouth fully',
    'Food getting stuck in cavity',
    'General dental discomfort'
  ]
  return illnesses[Math.floor(Math.random() * illnesses.length)]
}

function getRandomTreatment(): string {
  const treatments = [
    'Composite restoration completed',
    'Prophylaxis and fluoride treatment',
    'Root canal therapy initiated',
    'Crown preparation and temporization',
    'Extraction of impacted tooth',
    'Deep scaling and root planing',
    'Orthodontic consultation provided',
    'Dental implant placement',
    'Gum disease treatment',
    'Oral hygiene instruction given'
  ]
  return treatments[Math.floor(Math.random() * treatments.length)]
}

function getRandomToothStatus(): any {
  const statuses = ['healthy', 'cavity', 'filled', 'crowned', 'needs_attention']
  return statuses[Math.floor(Math.random() * statuses.length)] as any
}

function getRandomSurfaces(): any {
  const surfaces = {
    occlusal: Math.random() > 0.7,
    mesial: Math.random() > 0.8,
    distal: Math.random() > 0.8,
    buccal: Math.random() > 0.9,
    lingual: Math.random() > 0.9
  }
  return surfaces
}

function getRandomToothNotes(): string {
  const notes = [
    'Small cavity detected',
    'Existing filling in good condition',
    'Slight wear on occlusal surface',
    'Gum inflammation around tooth',
    'Normal appearance',
    'Previous restoration present',
    'Crown margins intact',
    'Needs monitoring',
    'Sensitive to pressure'
  ]
  return notes[Math.floor(Math.random() * notes.length)]
}

function getRandomTreatmentPlanTitle(): string {
  const titles = [
    'Comprehensive Oral Rehabilitation',
    'Periodontal Maintenance Program',
    'Restorative Treatment Plan',
    'Preventive Care Protocol',
    'Orthodontic Treatment Plan',
    'Implant Restoration Plan',
    'Emergency Treatment Protocol',
    'Cosmetic Enhancement Plan',
    'Root Canal Treatment Series',
    'Full Mouth Reconstruction'
  ]
  return titles[Math.floor(Math.random() * titles.length)]
}

function getRandomTreatmentPlanDescription(): string {
  const descriptions = [
    'Comprehensive treatment plan addressing multiple dental concerns with phased approach',
    'Preventive maintenance program to ensure optimal oral health',
    'Restorative procedures to repair damaged teeth and restore function',
    'Surgical intervention followed by restorative rehabilitation',
    'Multi-phase treatment plan with regular monitoring and adjustments',
    'Conservative treatment approach focusing on preservation of natural teeth',
    'Advanced treatment plan incorporating latest dental technologies',
    'Urgent care protocol addressing immediate dental needs',
    'Aesthetic enhancement procedures to improve smile appearance',
    'Long-term treatment strategy with emphasis on patient comfort'
  ]
  return descriptions[Math.floor(Math.random() * descriptions.length)]
}

function getRandomTreatmentPlanStatus(): any {
  const statuses = ['draft', 'pending_approval', 'approved', 'in_progress', 'completed']
  return statuses[Math.floor(Math.random() * statuses.length)] as any
}

function getRandomTreatmentPhases(): any {
  return [
    {
      phase: 1,
      name: 'Initial Assessment',
      description: 'Comprehensive examination and diagnostic procedures',
      estimatedDuration: '1-2 weeks',
      procedures: ['X-rays', 'Clinical examination', 'Treatment planning']
    },
    {
      phase: 2,
      name: 'Preparatory Treatment',
      description: 'Address urgent issues and prepare for main treatment',
      estimatedDuration: '2-3 weeks',
      procedures: ['Cleaning', 'Basic restorations', 'Gum treatment']
    },
    {
      phase: 3,
      name: 'Primary Treatment',
      description: 'Main treatment procedures',
      estimatedDuration: '4-6 weeks',
      procedures: ['Major restorations', 'Surgical procedures', 'Specialized care']
    }
  ]
}

function getRandomDiagnosis(): string {
  const diagnoses = [
    'Chronic periodontitis with bone loss',
    'Multiple carious lesions requiring restoration',
    'Impacted third molars with inflammation',
    'Malocclusion requiring orthodontic intervention',
    'Temporomandibular joint dysfunction',
    'Acute pulpitis requiring endodontic treatment',
    'Gingivitis with localized recession',
    'Failed restorations requiring replacement',
    'Enamel hypoplasia with aesthetic concerns',
    'Routine maintenance with good oral health'
  ]
  return diagnoses[Math.floor(Math.random() * diagnoses.length)]
}

async function seedNotifications() {
  console.log('🔔 Creating notifications...')
  
  try {
    const users = await prisma.user.findMany()
    
    for (const user of users.slice(0, 15)) {
      // Create 2-5 notifications per user
      const notificationCount = Math.floor(Math.random() * 4) + 2
      
      for (let i = 0; i < notificationCount; i++) {
        const createdAt = new Date()
        createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30)) // Within last 30 days
        
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: getRandomNotificationTitle(),
            message: getRandomNotificationMessage(),
            type: getRandomNotificationType(),
            status: getRandomNotificationStatus(),
            priority: getRandomNotificationPriority(),
            scheduledAt: createdAt,
            sentAt: Math.random() > 0.3 ? createdAt : null,
            deliveredAt: Math.random() > 0.5 ? createdAt : null,
            readAt: Math.random() > 0.7 ? createdAt : null,
            createdAt: createdAt
          }
        })
      }
    }
    
    console.log(`✓ Created notifications for ${Math.min(users.length, 15)} users`)
    
  } catch (error) {
    console.error('❌ Error creating notifications:', error)
  }
}

function getRandomNotificationTitle(): string {
  const titles = [
    'Appointment Reminder',
    'Payment Due',
    'Treatment Plan Updated',
    'Lab Results Available',
    'Prescription Ready',
    'Follow-up Required',
    'Insurance Claim Processed',
    'Schedule Change Notice',
    'Health Tip',
    'Preventive Care Reminder'
  ]
  return titles[Math.floor(Math.random() * titles.length)]
}

function getRandomNotificationMessage(): string {
  const messages = [
    'Your appointment is scheduled for tomorrow at 2:00 PM.',
    'Your payment of PHP 2,500 is due in 3 days.',
    'Your treatment plan has been updated by Dr. Rodriguez.',
    'Your lab results are now available for review.',
    'Your prescription is ready for pickup.',
    'Please schedule a follow-up appointment within 2 weeks.',
    'Your insurance claim has been processed successfully.',
    'Your appointment has been rescheduled to next week.',
    'Remember to brush twice daily and floss regularly.',
    'It\'s time for your routine dental cleaning.'
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

function getRandomNotificationType(): any {
  const types = ['appointment_reminder', 'payment_due', 'treatment_plan', 'system_alert']
  return types[Math.floor(Math.random() * types.length)] as any
}

function getRandomNotificationStatus(): any {
  const statuses = ['pending', 'sent', 'delivered', 'failed']
  return statuses[Math.floor(Math.random() * statuses.length)] as any
}

function getRandomNotificationPriority(): any {
  const priorities = ['low', 'normal', 'high']
  return priorities[Math.floor(Math.random() * priorities.length)] as any
}

async function seedAnalytics(demoData: any) {
  console.log('📊 Creating analytics data...')
  
  // For now, just log that this would be implemented
  // In a real scenario, you would create analytics records
  console.log('✓ Analytics data prepared')
}

async function main() {
  console.log('🌱 Starting demo data import process...')
  
  try {
    // Load demo data from JSON files
    const demoData = await loadDemoData()
    
    // Clear existing data
    await clearDatabase()
    
    // Seed data in correct order
    await seedSystemSettings()
    
    const userIdMap = await seedUsers(demoData)
    const patientIdMap = await seedPatients(demoData, userIdMap)
    const treatmentIdMap = await seedTreatments(demoData)
    
    await seedInventory(demoData)
    await seedAppointments(demoData, patientIdMap, userIdMap, treatmentIdMap)
    await seedBilling(demoData, patientIdMap)
    
    // Seed additional comprehensive data for all pages
    await seedSchedules()
    await seedDentalRecords(patientIdMap)
    await seedTreatmentPlans(patientIdMap)
    await seedNotifications()
    await seedQueueManagement(demoData, patientIdMap)
    await seedAnalytics(demoData)
    
    console.log('🎉 Demo data import completed successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   Users: ${userIdMap.size}`)
    console.log(`   Patients: ${patientIdMap.size}`)
    console.log(`   Treatments: ${treatmentIdMap.size}`)
    console.log('')
    // Always create the admin user
    await createAdminUser()
    
    console.log('🔐 Super Admin Login:')
    console.log('   Username: super_admin')
    console.log('   Email: admin@swiftcaredental.site')
    console.log('   Password: $wifti3$')
    
  } catch (error) {
    console.error('💥 Error during seeding:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function createAdminUser() {
  console.log('👑 Creating super admin user...')
  
  try {
    const hashedPassword = await bcrypt.hash('$wifti3$', 12)
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@swiftcaredental.site' },
      update: {
        passwordHash: hashedPassword,
        username: 'super_admin',
        role: 'super_admin',
        isActive: true,
      },
      create: {
        email: 'admin@swiftcaredental.site',
        username: 'super_admin',
        passwordHash: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+63 917 999 8888',
        role: 'super_admin',
        isActive: true,
        emailVerified: true,
      }
    })
    
    console.log('✓ Admin user created successfully')
    return adminUser
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPatients() {
  try {
    // Get all users with patient role
    const patientUsers = await prisma.user.findMany({
      where: { role: 'patient' },
      select: { id: true, email: true, firstName: true, lastName: true }
    });
    
    console.log('\n=== USERS WITH PATIENT ROLE ===');
    console.log(`Found ${patientUsers.length} patient users:`);
    patientUsers.forEach(u => {
      console.log(`- ${u.email} (${u.firstName} ${u.lastName}) - ID: ${u.id}`);
    });
    
    // Get all patient records
    const patients = await prisma.patient.findMany({
      include: { user: true }
    });
    
    console.log('\n=== PATIENT RECORDS ===');
    console.log(`Found ${patients.length} patient records:`);
    patients.forEach(p => {
      console.log(`- Patient ID: ${p.id}`);
      console.log(`  User ID: ${p.userId}`);
      console.log(`  User Email: ${p.user?.email || 'N/A'}`);
      console.log(`  User Name: ${p.user?.firstName} ${p.user?.lastName}`);
      console.log('');
    });
    
    // Check for users without patient records
    console.log('\n=== USERS WITHOUT PATIENT RECORDS ===');
    for (const user of patientUsers) {
      const patientRecord = await prisma.patient.findFirst({
        where: { userId: user.id }
      });
      
      if (!patientRecord) {
        console.log(`⚠️  ${user.email} (${user.firstName} ${user.lastName}) - NO PATIENT RECORD`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatients();

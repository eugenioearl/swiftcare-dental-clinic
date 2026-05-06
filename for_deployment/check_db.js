const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Check if there are any users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      },
      take: 5
    });
    
    console.log('=== Users in database ===');
    console.log(JSON.stringify(users, null, 2));
    
    // Check if there are any patients
    const patients = await prisma.patient.findMany({
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      take: 5
    });
    
    console.log('\n=== Patients in database ===');
    console.log(JSON.stringify(patients, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    // Check dentists
    const dentists = await prisma.dentist.findMany({
      include: { user: { select: { firstName: true, lastName: true } } }
    });
    console.log('\n=== DENTISTS ===');
    console.log(`Total: ${dentists.length}`);
    dentists.forEach(d => {
      console.log(`  - ${d.user?.firstName} ${d.user?.lastName} (Available: ${d.isAvailable})`);
    });

    // Check schedules
    const schedules = await prisma.schedule.findMany({
      where: {
        scheduleDate: {
          gte: new Date('2025-10-14')
        }
      },
      include: {
        dentist: { include: { user: { select: { firstName: true, lastName: true } } } }
      },
      take: 10,
      orderBy: { scheduleDate: 'asc' }
    });
    console.log('\n=== DENTIST SCHEDULES (Next 10) ===');
    console.log(`Total: ${schedules.length}`);
    schedules.forEach(s => {
      console.log(`  - ${s.dentist?.user?.firstName} ${s.dentist?.user?.lastName}: ${s.scheduleDate.toISOString().split('T')[0]} ${s.startTime}-${s.endTime} (Available: ${s.isAvailable})`);
    });

    // Check treatments
    const treatments = await prisma.treatment.count();
    console.log(`\n=== TREATMENTS ===`);
    console.log(`Total: ${treatments}`);

    // Check patients
    const patients = await prisma.patient.count();
    console.log(`\n=== PATIENTS ===`);
    console.log(`Total: ${patients}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();


require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('Testing database connection...');
    
    // Test database connection
    const userCount = await prisma.user.count();
    console.log(`Total users in database: ${userCount}`);
    
    // Test specific user
    const testEmail = 'admin@swiftcare.com';
    console.log(`\nLooking for user: ${testEmail}`);
    
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: {
        patient: true,
        dentist: true,
        staff: true
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      
      // List all users
      const allUsers = await prisma.user.findMany({
        select: { email: true, role: true, isActive: true }
      });
      console.log('\nAll users in database:');
      allUsers.forEach(u => console.log(`- ${u.email} (${u.role}) - Active: ${u.isActive}`));
      
    } else {
      console.log('✅ User found:', {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        firstName: user.firstName,
        lastName: user.lastName
      });
      
      // Test password
      const testPassword = 'password123';
      const isPasswordValid = await bcrypt.compare(testPassword, user.passwordHash);
      console.log(`\nPassword test for "${testPassword}": ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();

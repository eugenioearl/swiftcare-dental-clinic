
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testInventorySystem() {
  console.log('🔍 Testing Inventory System...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected. Found ${userCount} users.\n`);
    
    // Test 2: Inventory Data
    console.log('2. Testing inventory data...');
    const inventoryCount = await prisma.inventoryItem.count();
    console.log(`📦 Found ${inventoryCount} inventory items.\n`);
    
    if (inventoryCount > 0) {
      const items = await prisma.inventoryItem.findMany({
        take: 3,
        include: {
          supplier: { select: { name: true } }
        }
      });
      
      console.log('Sample inventory items:');
      items.forEach(item => {
        console.log(`- ${item.name} (${item.currentStock} ${item.unit}) - Status: ${item.status}`);
      });
    }
    
    // Test 3: Suppliers
    console.log('\n3. Testing supplier data...');
    const supplierCount = await prisma.supplier.count();
    console.log(`🏢 Found ${supplierCount} suppliers.\n`);
    
    // Test 4: Transactions
    console.log('4. Testing transaction data...');
    const transactionCount = await prisma.inventoryTransaction.count();
    console.log(`📊 Found ${transactionCount} inventory transactions.\n`);
    
    console.log('✅ All database tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing inventory system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInventorySystem();

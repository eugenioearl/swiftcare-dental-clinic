const fs = require('fs');

// Test data for form submission
const testFormData = {
  patientId: "test-patient-id", 
  documentType: "patient-intake",
  title: "Patient Intake Form",
  status: "completed",
  content: JSON.stringify({
    firstName: "John",
    lastName: "Doe", 
    dateOfBirth: "1990-01-01",
    phone: "555-123-4567",
    address: "123 Main St",
    emergencyContact: "Jane Doe",
    emergencyPhone: "555-987-6543",
    reasonForVisit: "Regular checkup"
  })
};

console.log('Form data to be submitted:');
console.log(JSON.stringify(testFormData, null, 2));

// Check if the forms service would work
console.log('\nTesting forms service logic...');

// Check file structure
if (fs.existsSync('lib/prisma-forms.ts')) {
  console.log('✓ Forms service file exists');
} else {
  console.log('✗ Forms service file missing');
}

if (fs.existsSync('api/forms/route.ts')) {
  console.log('✓ Forms API route exists');
} else {
  console.log('✗ Forms API route missing');
}

console.log('Test complete');

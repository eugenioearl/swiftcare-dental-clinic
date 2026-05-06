const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testFullAppointmentFlow() {
  try {
    console.log('=== Testing Complete Appointment Booking Flow ===');
    
    // Step 1: Login
    console.log('\n1. Testing login...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/custom-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'escletoglenn24@gmail.com',
      password: 'P@nc@k3$'
    });
    
    console.log('Login status:', loginResponse.status);
    console.log('Login success:', loginResponse.data.success);
    
    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.error);
      return;
    }
    
    // Extract session cookie
    const cookies = loginResponse.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('swiftcare-session='))?.split(';')[0];
    
    if (!sessionCookie) {
      console.error('❌ No session cookie received');
      return;
    }
    
    console.log('✅ Login successful, session cookie received');
    
    // Step 2: Test session check
    console.log('\n2. Testing session check...');
    const sessionResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/custom-session',
      method: 'GET',
      headers: { 'Cookie': sessionCookie }
    });
    
    console.log('Session check status:', sessionResponse.status);
    console.log('Session authenticated:', sessionResponse.data.authenticated);
    console.log('User role:', sessionResponse.data.user?.role);
    
    if (!sessionResponse.data.authenticated) {
      console.error('❌ Session check failed');
      return;
    }
    
    // Step 3: Get a patient ID for testing
    console.log('\n3. Getting patients...');
    const patientsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/patients',
      method: 'GET',
      headers: { 'Cookie': sessionCookie }
    });
    
    console.log('Patients API status:', patientsResponse.status);
    const patients = patientsResponse.data.data?.patients || [];
    console.log('Number of patients found:', patients.length);
    
    if (patients.length === 0) {
      console.error('❌ No patients found for testing');
      return;
    }
    
    const testPatient = patients[0];
    console.log('Using test patient:', testPatient.user?.firstName, testPatient.user?.lastName);
    
    // Step 4: Try to book an appointment
    console.log('\n4. Testing appointment booking...');
    
    const appointmentData = {
      patientId: testPatient.id,
      appointmentType: 'consultation',
      scheduledDatetime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 days from now
      durationMinutes: 30,
      reasonForVisit: 'Test appointment via API',
      isEmergency: false,
      notes: 'Testing appointment booking system'
    };
    
    const appointmentResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/appointments',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie 
      }
    }, appointmentData);
    
    console.log('Appointment booking status:', appointmentResponse.status);
    console.log('Appointment booking success:', appointmentResponse.data.success);
    
    if (appointmentResponse.data.success) {
      console.log('✅ Appointment booked successfully!');
      console.log('Appointment number:', appointmentResponse.data.data.appointmentNumber);
      console.log('Appointment ID:', appointmentResponse.data.data.id);
    } else {
      console.error('❌ Appointment booking failed:', appointmentResponse.data.error);
      if (appointmentResponse.data.details) {
        console.error('Error details:', appointmentResponse.data.details);
      }
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testFullAppointmentFlow();

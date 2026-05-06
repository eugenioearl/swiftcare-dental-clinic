const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing admin login...');
    const response = await fetch('http://localhost:3000/api/custom-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'escletoglenn24@gmail.com',
        password: 'P@nc@k3$'
      })
    });

    console.log('Login response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Login successful:', data.success);
      
      // Extract the session cookie
      const cookies = response.headers.get('set-cookie');
      console.log('Cookies received:', cookies);
      
      if (cookies) {
        const sessionCookie = cookies
          .split(';')
          .find(c => c.trim().startsWith('swiftcare-session='))
          ?.split('=')[1];
        
        if (sessionCookie) {
          console.log('Session cookie found, testing treatments API...');
          
          // Test treatments API
          const treatmentsResponse = await fetch('http://localhost:3000/api/treatments', {
            headers: {
              'Cookie': `swiftcare-session=${sessionCookie}`
            }
          });
          
          console.log('Treatments API status:', treatmentsResponse.status);
          
          if (treatmentsResponse.ok) {
            const treatmentsData = await treatmentsResponse.json();
            console.log('Treatments found:', treatmentsData.data?.treatments?.length || 0);
            if (treatmentsData.data?.treatments) {
              console.log('Sample treatment:', treatmentsData.data.treatments[0]?.name);
            }
          } else {
            const error = await treatmentsResponse.text();
            console.log('Treatments API error:', error);
          }
          
          // Test available slots API
          const todayDate = new Date().toISOString().split('T')[0];
          const slotsResponse = await fetch(`http://localhost:3000/api/appointments/available-slots?date=${todayDate}`, {
            headers: {
              'Cookie': `swiftcare-session=${sessionCookie}`
            }
          });
          
          console.log('Available slots API status:', slotsResponse.status);
          
          if (slotsResponse.ok) {
            const slotsData = await slotsResponse.json();
            console.log('Available slots found:', slotsData.availableSlots?.length || 0);
          } else {
            const error = await slotsResponse.text();
            console.log('Available slots API error:', error);
          }
        }
      }
    } else {
      const error = await response.text();
      console.log('Login failed:', error);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testLogin();

// Simple test to verify appointment booking API
const fetch = require('node-fetch')

async function testAppointmentBooking() {
  try {
    console.log('Testing appointment booking API...')
    
    // First, let's test login
    const loginResponse = await fetch('http://localhost:3000/api/custom-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'escletoglenn24@gmail.com',
        password: 'P@nc@k3$'
      })
    })

    const loginData = await loginResponse.json()
    console.log('Login test result:', loginData)
    
    if (!loginData.success) {
      console.error('Login failed, cannot test appointment booking')
      return
    }

    // Extract session cookie
    const cookies = loginResponse.headers.get('set-cookie') || ''
    const sessionMatch = cookies.match(/swiftcare-session=([^;]+)/)
    const sessionCookie = sessionMatch ? sessionMatch[0] : ''
    
    console.log('Session cookie found:', !!sessionCookie)
    
    // Test session check
    const sessionResponse = await fetch('http://localhost:3000/api/custom-session', {
      headers: {
        'Cookie': sessionCookie
      }
    })
    
    const sessionData = await sessionResponse.json()
    console.log('Session check result:', sessionData)
    
    // Test appointment booking
    if (sessionData.authenticated) {
      console.log('Testing appointment creation...')
      
      const appointmentData = {
        patientId: 'patient-uuid-here', // This would need to be a real patient ID
        appointmentType: 'consultation',
        scheduledDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 30,
        reasonForVisit: 'API test appointment',
        isEmergency: false
      }
      
      const appointmentResponse = await fetch('http://localhost:3000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify(appointmentData)
      })
      
      const appointmentResult = await appointmentResponse.json()
      console.log('Appointment booking test result:', appointmentResult)
    } else {
      console.log('Session not authenticated, skipping appointment test')
    }

  } catch (error) {
    console.error('Test error:', error)
  }
}

testAppointmentBooking()

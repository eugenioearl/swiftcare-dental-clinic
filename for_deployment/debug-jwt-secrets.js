// Compare secrets between login and verification
const http = require('http');

// Test the JWT creation and verification with exact same data
const { SignJWT, jwtVerify } = require('jose');

async function testJWTConsistency() {
  console.log('=== Testing JWT Secret Consistency ===');
  
  // Get the secret the same way both APIs do it
  require('dotenv').config();
  const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret';
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  console.log('Secret from .env:', JWT_SECRET);
  console.log('Secret length:', secret.length);
  console.log('Secret preview:', JWT_SECRET.substring(0, 8) + '...');
  
  try {
    // Create a test JWT (same way as login API)
    const token = await new SignJWT({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
      isActive: true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);
    
    console.log('Created token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
    
    // Try to verify immediately with same secret
    const { payload } = await jwtVerify(token, secret);
    console.log('✅ Local verification successful:', payload.email);
    
    // Now make a real token via login API and compare
    console.log('\n=== Testing via Login API ===');
    
    const loginResponse = await makeHTTPRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/custom-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'escletoglenn24@gmail.com',
      password: 'P@nc@k3$'
    });
    
    if (loginResponse.data.success) {
      const cookies = loginResponse.headers['set-cookie'] || [];
      const sessionCookieHeader = cookies.find(c => c.startsWith('swiftcare-session='));
      
      if (sessionCookieHeader) {
        const realToken = sessionCookieHeader.split('=')[1].split(';')[0];
        console.log('Real token length:', realToken.length);
        console.log('Real token preview:', realToken.substring(0, 20) + '...');
        
        // Try to verify the real token with our secret
        try {
          const { payload: realPayload } = await jwtVerify(realToken, secret);
          console.log('✅ Real token verification successful:', realPayload.email);
        } catch (verifyError) {
          console.error('❌ Real token verification failed:', verifyError.message);
          
          // Let's decode the header and payload without verification to see what's different
          const parts = realToken.split('.');
          if (parts.length === 3) {
            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            console.log('Real token header:', header);
            console.log('Real token payload preview:', {
              userId: payload.userId,
              email: payload.email,
              iat: new Date(payload.iat * 1000),
              exp: new Date(payload.exp * 1000)
            });
          }
        }
      }
    } else {
      console.error('Login failed:', loginResponse.data.error);
    }
    
  } catch (error) {
    console.error('Error in JWT test:', error);
  }
}

async function makeHTTPRequest(options, data = null) {
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

testJWTConsistency();

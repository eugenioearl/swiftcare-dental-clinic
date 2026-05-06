

export async function getServerAuth() {
  // This would normally use getServerSession but for development we'll use a simpler approach
  return null
}

// Alternative auth function that's more lenient for testing
export async function getServerAuthLenient() {
  try {
    // For testing purposes, if no session, return a real admin user from DB
    if (process.env.NODE_ENV === 'development') {
      console.warn("⚠️ Using mock session for development testing")
      
      // Try to get a real admin user from the database
      const { prisma } = require('@/lib/db')
      
      try {
        const adminUser = await prisma.user.findFirst({
          where: { 
            email: 'admin@swiftcare.com',
            role: 'admin' 
          }
        })
        
        if (adminUser) {
          return {
            user: {
              id: adminUser.id,
              email: adminUser.email,
              role: adminUser.role
            }
          }
        }
      } catch (error) {
        console.error('Error fetching admin user:', error)
      }
      
      // Fallback to mock if DB fails
      return {
        user: {
          id: '2dcca7ce-b580-4b1f-8486-98664d78ce1c', // Known admin ID from seed
          email: 'admin@swiftcare.com',
          role: 'admin'
        }
      }
    }
    
    return null
  } catch (error) {
    console.error("Error getting server session:", error)
    
    // Return mock session for development
    if (process.env.NODE_ENV === 'development') {
      console.warn("⚠️ Using mock session due to auth error in development")
      return {
        user: {
          id: '2dcca7ce-b580-4b1f-8486-98664d78ce1c', // Known admin ID from seed
          email: 'admin@swiftcare.com',
          role: 'admin'
        }
      }
    }
    
    return null
  }
}

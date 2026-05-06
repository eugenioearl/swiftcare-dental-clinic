
// Global token store for check-in tokens
// In production, use Redis or database instead

interface TokenData {
  appointmentId: string
  expiresAt: number
}

class CheckInTokenStore {
  private store: Map<string, TokenData>

  constructor() {
    this.store = new Map()
    
    // Clean up expired tokens every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  set(token: string, data: TokenData) {
    this.store.set(token, data)
  }

  get(token: string): TokenData | undefined {
    const data = this.store.get(token)
    
    // Check if expired
    if (data && data.expiresAt < Date.now()) {
      this.store.delete(token)
      return undefined
    }
    
    return data
  }

  delete(token: string) {
    this.store.delete(token)
  }

  cleanup() {
    const now = Date.now()
    for (const [token, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(token)
      }
    }
  }
}

// Create singleton instance
const globalForTokenStore = global as unknown as {
  checkinTokenStore: CheckInTokenStore | undefined
}

export const checkinTokenStore = 
  globalForTokenStore.checkinTokenStore ?? new CheckInTokenStore()

if (process.env.NODE_ENV !== 'production') {
  globalForTokenStore.checkinTokenStore = checkinTokenStore
}

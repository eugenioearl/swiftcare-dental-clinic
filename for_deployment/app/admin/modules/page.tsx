
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminModulesPage() {
  const router = useRouter()

  useEffect(() => {
    // Module Management has been removed - redirect to admin dashboard
    router.replace('/admin/dashboard')
  }, [router])

  return null
}


'use client'

import React from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { useBreakpoint } from '@/hooks/use-device-type'
import { OptimizedSidebar } from '@/components/navigation/optimized-sidebar'
import { OptimizedMobileNavigation, OptimizedMobileBottomNav } from '@/components/navigation/optimized-mobile-nav'
import { FloatingActionButton } from '@/components/ui/floating-action-button'
import { ResponsiveLayout } from '@/components/ui/responsive-layout'
import { AnimatedBackground } from '@/components/ui/dental-animations'
import { cn } from '@/lib/utils'

interface ResponsiveDashboardLayoutProps {
  children: React.ReactNode
  title?: string
  className?: string
  showFAB?: boolean
}

export function ResponsiveDashboardLayout({ 
  children, 
  title,
  className,
  showFAB = true
}: ResponsiveDashboardLayoutProps) {
  const { data: session } = useSession()
  const { shouldUseMobileLayout, isDesktop } = useBreakpoint()

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Desktop layout
  if (isDesktop) {
    return (
      <OptimizedSidebar title={title}>
        <AnimatedBackground variant="subtle">
          {children}
        </AnimatedBackground>
      </OptimizedSidebar>
    )
  }

  // Mobile/Tablet layout
  return (
    <ResponsiveLayout className={className}>
      <div className="min-h-screen flex flex-col">
        <OptimizedMobileNavigation />
        
        <main className="flex-1 pb-20 relative">
          <AnimatedBackground variant="subtle" className="min-h-full">
            <div className="p-4 space-y-4">
              {title && (
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-primary-800 mb-1">
                    {title}
                  </h1>
                  <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full" />
                </div>
              )}
              {children}
            </div>
          </AnimatedBackground>
        </main>

        <OptimizedMobileBottomNav />
        
        {showFAB && <FloatingActionButton />}
      </div>
    </ResponsiveLayout>
  )
}

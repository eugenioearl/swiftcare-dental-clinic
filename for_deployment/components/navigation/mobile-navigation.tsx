
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/auth/custom-session-provider'
import { useBreakpoint } from '@/hooks/use-device-type'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Menu, X, Home, Calendar, Users, CreditCard, Settings,
  Bell, User, LogOut, Building2, Stethoscope, ClipboardList,
  BarChart3, Package, Phone, Mail, MapPin, Shield
} from 'lucide-react'
import { ToothIcon, SmileIcon } from '@/components/ui/dental-animations'

interface MobileNavigationProps {
  className?: string
}

export function MobileNavigation({ className }: MobileNavigationProps) {
  const { data: session } = useSession()
  const { shouldUseMobileLayout } = useBreakpoint()
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragCurrentX, setDragCurrentX] = useState(0)
  const drawerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  if (!shouldUseMobileLayout) return null

  const userRole = session?.user?.role || 'patient'

  const getNavigationItems = () => {
    const baseItems = [
      { icon: Home, label: 'Home', href: '/' },
      { icon: Calendar, label: 'Appointments', href: '/patient/appointments' },
      { icon: User, label: 'Profile', href: '/patient/profile' }
    ]

    switch (userRole) {
      case 'admin':
      case 'dentist':
      case 'super_admin':
      case 'manager':
        return [
          { icon: BarChart3, label: 'Dashboard', href: '/admin/dashboard' },
          { icon: Calendar, label: 'Appointments', href: '/admin/scheduling' },
          { icon: Users, label: 'Patients', href: '/admin/patients' },
          { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
          { icon: Settings, label: 'Settings', href: '/admin/settings' }
        ]
      case 'staff':
        return [
          { icon: Building2, label: 'Dashboard', href: '/staff/dashboard' },
          { icon: Users, label: 'Patients', href: '/staff/patients' },
          { icon: Calendar, label: 'Appointments', href: '/admin/scheduling' },
          { icon: ClipboardList, label: 'Check-in', href: '/admin/scheduling?tab=checkin' }
        ]
      default:
        return [
          { icon: Home, label: 'Dashboard', href: '/patient/dashboard' },
          { icon: Calendar, label: 'Appointments', href: '/patient/appointments' },
          { icon: ClipboardList, label: 'Forms', href: '/patient/forms' },
          { icon: User, label: 'Profile', href: '/patient/profile' }
        ]
    }
  }

  const navigationItems = getNavigationItems()

  // Touch/Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setDragStartX(touch.clientX)
    setDragCurrentX(touch.clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    setDragCurrentX(touch.clientX)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    const dragDistance = dragCurrentX - dragStartX
    
    if (isOpen && dragDistance < -50) {
      setIsOpen(false) // Swipe left to close
    } else if (!isOpen && dragDistance > 50) {
      setIsOpen(true) // Swipe right to open
    }
    
    setIsDragging(false)
    setDragStartX(0)
    setDragCurrentX(0)
  }

  // Close drawer when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    const { signOut } = await import('@/components/auth/custom-session-provider')
    signOut()
  }

  return (
    <>
      {/* Mobile Header */}
      <div className={cn(
        'mobile-header sticky top-0 z-40 flex items-center justify-between',
        className
      )}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="text-white hover:bg-white/20 p-2"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <ToothIcon size={28} animation="3d" className="text-white" />
            <span className="font-bold text-lg">SwiftCare</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 p-2 relative"
          >
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-accent-coral border-white">
              3
            </Badge>
          </Button>
          {session?.user && (
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <SmileIcon size={20} animation="pulse" className="text-white" />
              <span className="text-sm font-medium text-white">
                {session.user.firstName || 'User'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ToothIcon size={32} animation="rotate" className="text-white" />
              <span className="text-xl font-bold">SwiftCare Dental</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {session?.user && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold">{session.user.name}</p>
                <p className="text-sm text-white/80 capitalize">{session.user.role.replace('_', ' ')}</p>
                <p className="text-xs text-white/70">{session.user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-4">
          <nav className="space-y-1">
            {navigationItems.map((item, index) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    'mobile-list-item flex items-center gap-3 mx-4 transition-all duration-200',
                    isActive
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5',
                    isActive ? 'text-primary-600' : 'text-gray-500'
                  )} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary-500" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPin className="w-4 h-4" />
            <span>123 Dental Street, City</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Phone className="w-4 h-4" />
            <span>(555) 123-4567</span>
          </div>

          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </>
  )
}

interface MobileBottomNavProps {
  className?: string
}

export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const { data: session } = useSession()
  const { shouldUseMobileLayout } = useBreakpoint()
  const pathname = usePathname()

  if (!shouldUseMobileLayout) return null

  const userRole = session?.user?.role || 'patient'

  const getQuickActions = () => {
    switch (userRole) {
      case 'admin':
      case 'dentist':
      case 'super_admin':
      case 'manager':
        return [
          { icon: BarChart3, label: 'Dashboard', href: '/admin/dashboard' },
          { icon: Calendar, label: 'Appointments', href: '/admin/scheduling' },
          { icon: Users, label: 'Patients', href: '/admin/patients' }
        ]
      case 'staff':
        return [
          { icon: Building2, label: 'Dashboard', href: '/staff/dashboard' },
          { icon: Users, label: 'Patients', href: '/staff/patients' },
          { icon: Calendar, label: 'Appointments', href: '/admin/scheduling' },
          { icon: ClipboardList, label: 'Check-in', href: '/admin/scheduling?tab=checkin' }
        ]
      default:
        return [
          { icon: Home, label: 'Home', href: '/patient/dashboard' },
          { icon: Calendar, label: 'Appointments', href: '/patient/appointments' },
          { icon: User, label: 'Profile', href: '/patient/profile' }
        ]
    }
  }

  const quickActions = getQuickActions()

  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30',
      'grid grid-cols-4 py-2',
      className
    )}>
      {quickActions.map((action, index) => {
        const Icon = action.icon
        const isActive = pathname === action.href || pathname.startsWith(action.href + '/')
        
        return (
          <Link
            key={index}
            href={action.href}
            className={cn(
              'touch-target flex flex-col items-center justify-center py-2 transition-colors duration-200',
              isActive 
                ? 'text-primary-600 bg-primary-50' 
                : 'text-gray-600 hover:text-primary-500 hover:bg-gray-50'
            )}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{action.label}</span>
            {isActive && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
            )}
          </Link>
        )
      })}
    </div>
  )
}


'use client'

import { useState } from 'react'
import { useSession, signOut } from '@/components/auth/custom-session-provider'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2,
  Calendar,
  Users,
  CreditCard,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  BarChart3,
  Stethoscope,
  Clock,
  Activity,
  FileText,
  Package,
  UserCheck,
  ClipboardList,
  TrendingUp,
  Shield,
  HeartHandshake,
  Zap,
  ChevronRight,
  ChevronDown,
  Home
} from 'lucide-react'
import { cn, formatDisplayName, getInitials } from '@/lib/utils'

interface NavigationItem {
  name: string
  href?: string
  icon: any
  badge?: string | number
  children?: NavigationItem[]
  roles: string[]
}

interface OptimizedSidebarProps {
  children: React.ReactNode
  title?: string
}

// Define navigation structure with role-based access and workflow grouping
const navigationConfig: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff', 'patient']
  },
  {
    name: 'Appointments',
    icon: Calendar,
    roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff', 'patient'],
    children: [
      { name: 'Schedule', href: '/appointments', icon: Calendar, roles: ['super_admin', 'admin', 'manager', 'staff', 'patient'] },
      { name: 'Calendar View', href: '/calendar', icon: Calendar, roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff'] },
      { name: 'Queue', href: '/queue', icon: Clock, roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff'] },
      { name: 'Check-In', href: '/check-in', icon: UserCheck, roles: ['staff', 'patient'] }
    ]
  },
  {
    name: 'Patients',
    icon: Users,
    roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff'],
    children: [
      { name: 'Patient List', href: '/patients', icon: Users, roles: ['super_admin', 'admin', 'manager', 'dentist', 'staff'] },
      { name: 'Medical Records', href: '/records', icon: FileText, roles: ['super_admin', 'admin', 'manager', 'dentist'] },
      { name: 'Patient Forms', href: '/forms', icon: ClipboardList, roles: ['super_admin', 'admin', 'manager', 'staff'] }
    ]
  },
  {
    name: 'Treatment',
    icon: Stethoscope,
    roles: ['super_admin', 'admin', 'manager', 'dentist'],
    children: [
      { name: 'Treatment Plans', href: '/treatment', icon: Stethoscope, roles: ['super_admin', 'admin', 'manager', 'dentist'] },
      { name: 'Dental Chart', href: '/chart', icon: Activity, roles: ['super_admin', 'admin', 'manager', 'dentist'] },
      { name: 'Procedures', href: '/procedures', icon: HeartHandshake, roles: ['super_admin', 'admin', 'manager', 'dentist'] }
    ]
  },
  {
    name: 'Operations',
    icon: Zap,
    roles: ['super_admin', 'admin', 'manager', 'staff'],
    children: [
      { name: 'Staff Management', href: '/staff', icon: Shield, roles: ['super_admin', 'admin', 'manager'] },
      { name: 'Document Migration', href: '/migration', icon: FileText, roles: ['super_admin', 'admin', 'manager'] },
    ]
  },
  {
    name: 'Analytics',
    icon: TrendingUp,
    roles: ['super_admin', 'admin', 'manager'],
    children: [
      { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
      { name: 'Analytics', href: '/analytics', icon: TrendingUp, roles: ['super_admin', 'admin', 'manager'] }
    ]
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
    roles: ['patient']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['super_admin', 'admin', 'manager']
  }
]

// Patient-specific simplified navigation
const patientNavigationConfig: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/patient/dashboard',
    icon: Home,
    roles: ['patient']
  },
  {
    name: 'Appointments',
    href: '/patient/appointments',
    icon: Calendar,
    roles: ['patient']
  },
  {
    name: 'Check-In',
    href: '/patient/check-in',
    icon: UserCheck,
    roles: ['patient']
  },
  {
    name: 'Records',
    href: '/patient/records',
    icon: FileText,
    roles: ['patient']
  },
  {
    name: 'Profile',
    href: '/patient/profile',
    icon: User,
    roles: ['patient']
  }
]

export function OptimizedSidebar({ children, title }: OptimizedSidebarProps) {
  const { data: session } = useSession() || {}
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>([])
  const router = useRouter()
  const pathname = usePathname()

  const userRole = session?.user?.role || 'patient'

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const toggleSection = (sectionName: string) => {
    setOpenSections(prev => 
      prev.includes(sectionName) 
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    )
  }

  const hasAccessToItem = (item: NavigationItem) => {
    return item.roles.includes(userRole) || item.roles.includes('all')
  }

  const getNavigationConfig = () => {
    return userRole === 'patient' ? patientNavigationConfig : navigationConfig
  }

  const buildHref = (href: string) => {
    if (href.startsWith('/') && !href.includes('/patient/') && !href.includes('/admin/') && !href.includes('/staff/') && !href.includes('/dentist/')) {
      const prefix = ['admin', 'super_admin', 'manager', 'dentist'].includes(userRole) ? 'admin' : userRole
      return `/${prefix}${href}`
    }
    return href
  }

  const isActiveLink = (href: string) => {
    const fullHref = buildHref(href)
    return pathname === fullHref || pathname.startsWith(fullHref + '/')
  }

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    if (!hasAccessToItem(item)) return null

    const hasChildren = item.children && item.children.length > 0
    const isOpen = openSections.includes(item.name)
    const isActive = item.href ? isActiveLink(item.href) : false

    if (hasChildren) {
      const visibleChildren = item.children?.filter(hasAccessToItem) || []
      
      if (visibleChildren.length === 0) return null

      return (
        <div key={item.name} className="space-y-1">
          <Collapsible 
            open={isOpen} 
            onOpenChange={() => toggleSection(item.name)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-sm font-medium h-9 px-3",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  "transition-all duration-200 group"
                )}
              >
                <item.icon className="w-4 h-4 mr-3" />
                <span className="flex-1 text-left">{item.name}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                    {item.badge}
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 ml-2 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 ml-2 transition-transform" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              <div className="ml-4 border-l border-muted pl-4 space-y-1">
                {visibleChildren.map(child => renderNavigationItem(child, level + 1))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )
    }

    const href = item.href ? buildHref(item.href) : '#'

    return (
      <Link key={item.name} href={href}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-sm font-medium h-9 px-3",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-all duration-200",
            isActive && "bg-muted text-foreground border-r-2 border-primary"
          )}
          onClick={() => setSidebarOpen(false)}
        >
          <item.icon className={cn("w-4 h-4 mr-3", isActive && "text-primary")} />
          <span className="flex-1 text-left">{item.name}</span>
          {item.badge && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
              {item.badge}
            </Badge>
          )}
        </Button>
      </Link>
    )
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'admin': 
      case 'manager': 
        return 'bg-destructive/10 text-destructive'
      case 'dentist': return 'bg-primary/10 text-primary'
      case 'staff':
      case 'receptionist': 
        return 'bg-secondary/10 text-secondary'
      case 'patient': return 'bg-accent/10 text-accent'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const navigationItems = getNavigationConfig()

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex flex-col w-72 bg-card shadow-xl border-r border-border">
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">SwiftCare</h1>
                  <p className="text-sm text-muted-foreground">Dental Clinic</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {navigationItems.map(item => renderNavigationItem(item))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-card border-r border-border shadow-sm">
          <div className="flex items-center h-16 px-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary rounded-lg">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">SwiftCare</h1>
                <p className="text-sm text-muted-foreground">Dental Clinic</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 px-4 py-6 overflow-y-auto">
            <nav className="space-y-2">
              {navigationItems.map(item => renderNavigationItem(item))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="bg-card shadow-sm border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              {title && (
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-muted relative"
                onClick={() => alert('Notifications feature coming soon!')}
              >
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 text-xs bg-destructive text-destructive-foreground">
                  3
                </Badge>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 hover:bg-muted">
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {formatDisplayName(session?.user?.firstName, session?.user?.lastName)}
                      </p>
                      <Badge className={`text-xs ${getRoleBadgeColor(session?.user?.role || 'patient')}`}>
                        {session?.user?.role ? (
                          session.user.role.replace('_', ' ').split(' ').map(word => 
                            word.charAt(0)?.toUpperCase() + word.slice(1)
                          ).join(' ')
                        ) : 'Patient'}
                      </Badge>
                    </div>
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
                      {getInitials(session?.user?.firstName, session?.user?.lastName)}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-medium">{formatDisplayName(session?.user?.firstName, session?.user?.lastName)}</p>
                      <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/${session?.user?.role || 'patient'}/profile`)}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  {(['super_admin', 'admin', 'manager'].includes(session?.user?.role || '')) && (
                    <DropdownMenuItem onClick={() => router.push(`/${session?.user?.role || 'admin'}/settings`)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

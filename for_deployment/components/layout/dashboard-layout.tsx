
'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ProfilePictureUpload } from '@/components/ui/profile-picture-upload'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  BarChart3,
  Stethoscope,
  UserPlus,
  Clock,
  Activity,
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  HeartPulse,
  Upload,
  Package,
  ShieldCheck,
  ClipboardList,
  FileText,
  Syringe,
  Tv,
  UserCheck,
  ChevronDown,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn, formatDisplayName } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/notification-bell'

interface NavItem {
  name: string
  href: string
  icon: any
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { data: session } = useSession() || {}
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const router = useRouter()

  // Load collapsed sections preference from localStorage on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const role = session?.user?.role || 'admin'
    try {
      const stored = window.localStorage.getItem(`swiftcare:sidebar:collapsed:${role}`)
      if (stored) setCollapsedSections(JSON.parse(stored))
    } catch (err) {
      // ignore
    }
  }, [session?.user?.role])

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try {
        const role = session?.user?.role || 'admin'
        window.localStorage.setItem(`swiftcare:sidebar:collapsed:${role}`, JSON.stringify(next))
      } catch (err) {
        // ignore
      }
      return next
    })
  }

  useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        const response = await fetch('/api/users/profile-picture')
        if (response.ok) {
          const data = await response.json()
          setProfilePictureUrl(data.profilePictureUrl)
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error)
      }
    }
    if (session?.user?.id) fetchProfilePicture()
  }, [session?.user?.id])

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const pathname = usePathname()

  const getNavigationSections = (): NavSection[] => {
    const role = session?.user?.role || 'admin'

    // === DENTIST NAV: Clinical + all staff features ===
    if (role === 'dentist') {
      return [
        {
          label: '',
          items: [
            { name: 'Dashboard', href: '/dentist/dashboard', icon: LayoutDashboard },
          ]
        },
        {
          label: 'Clinical',
          items: [
            { name: 'Dental Chart', href: '/admin/chart', icon: HeartPulse },
            { name: 'Treatment', href: '/admin/treatment', icon: Stethoscope },
            { name: 'Procedures', href: '/admin/procedures', icon: Syringe },
            { name: 'Packages', href: '/admin/package-templates', icon: Package },
          ]
        },
        {
          label: 'Front Desk',
          items: [
            { name: 'Scheduling', href: '/admin/scheduling', icon: Calendar },
            { name: 'Check-In', href: '/staff/checkin', icon: UserCheck },
          ]
        },
        {
          label: 'Records',
          items: [
            { name: 'Patients', href: '/staff/patients', icon: Users },
          ]
        },
      ]
    }

    // === STAFF/RECEPTIONIST NAV: Operations-focused ===
    if (role === 'staff' || role === 'receptionist') {
      return [
        {
          label: '',
          items: [
            { name: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
          ]
        },
        {
          label: 'Front Desk',
          items: [
            { name: 'Scheduling', href: '/admin/scheduling', icon: Calendar },
            { name: 'Check-In', href: '/staff/checkin', icon: UserCheck },
            { name: 'Queue Monitor', href: '/queue-monitor', icon: Tv },
          ]
        },
        {
          label: 'Records',
          items: [
            { name: 'Patients', href: '/staff/patients', icon: Users },
          ]
        },
      ]
    }

    // === ADMIN / SUPER ADMIN NAV: Full access ===
    return [
      {
        label: '',
        items: [
          { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        label: 'Scheduling',
        items: [
          { name: 'Scheduling', href: '/admin/scheduling', icon: Calendar },
          { name: 'Check-In', href: '/staff/checkin', icon: UserCheck },
          { name: 'Queue Monitor', href: '/queue-monitor', icon: Tv },
        ]
      },
      {
        label: 'Patient Care',
        items: [
          { name: 'Patients', href: '/admin/patients', icon: Users },
          { name: 'Dental Chart', href: '/admin/chart', icon: HeartPulse },
          { name: 'Treatment', href: '/admin/treatment', icon: Stethoscope },
          { name: 'Procedures', href: '/admin/procedures', icon: Syringe },
          { name: 'Packages', href: '/admin/package-templates', icon: Package },
        ]
      },
      {
        label: 'Operations',
        items: [
          { name: 'Staff', href: '/admin/staff', icon: Users },
          { name: 'Services', href: '/admin/services', icon: Activity },
          { name: 'Forms & Rules', href: '/admin/forms', icon: FileText },
          { name: 'User Management', href: '/admin/users', icon: ShieldCheck },
        ]
      },
      {
        label: 'Insights',
        items: [
          { name: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
          { name: 'Business Overview', href: '/admin/insights', icon: BarChart3 },
          { name: 'Audit Log', href: '/admin/audit-log', icon: ClipboardList },
          { name: 'Migration', href: '/admin/migration', icon: Upload },
        ]
      },
      {
        label: '',
        items: [
          { name: 'Settings', href: '/admin/settings', icon: Settings },
        ]
      },
    ]
  }

  const navigationSections = getNavigationSections()

  const isActive = (href: string) => {
    if (href === '/admin/dashboard' || href === '/staff/dashboard' || href === '/dentist/dashboard') {
      return pathname === href
    }
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-destructive/10 text-destructive'
      case 'dentist':
        return 'bg-blue-100 text-blue-700'
      case 'staff':
      case 'receptionist':
        return 'bg-emerald-100 text-emerald-700'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'dentist': return 'Dentist'
      case 'staff': return 'Staff'
      case 'receptionist': return 'Receptionist'
      default: return role?.charAt(0)?.toUpperCase() + role?.slice(1)
    }
  }

  const getProfilePath = () => {
    const role = session?.user?.role || 'admin'
    if (role === 'dentist') return '/dentist/profile'
    if (role === 'staff' || role === 'receptionist') return '/staff/profile'
    return '/admin/profile'
  }

  const getDashboardPath = () => {
    const role = session?.user?.role || 'admin'
    if (role === 'dentist') return '/dentist/dashboard'
    if (role === 'staff' || role === 'receptionist') return '/staff/dashboard'
    return '/admin/dashboard'
  }

  // Clicking the logo should route to the user's dashboard if they're authenticated
  // or refresh the current page if already on the dashboard (does not log out)
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!session?.user) return // allow default navigation to `/` when not logged in
    e.preventDefault()
    setSidebarOpen(false)
    const target = getDashboardPath()
    if (pathname === target) {
      // Already on dashboard — just refresh the current page
      router.refresh()
    } else {
      router.push(target)
    }
  }

  const logoHref = session?.user ? getDashboardPath() : '/'

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex flex-col w-64 max-h-screen bg-card shadow-xl border-r border-border">
            <div className="flex items-center justify-between h-16 px-4 border-b border-border bg-white shrink-0">
              <Link href={logoHref} onClick={handleLogoClick} className="flex items-center">
                <div className="relative w-32 h-10">
                  <Image
                    src="/clinic/logo.png"
                    alt="SwiftCare Dental Clinic"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
              {navigationSections.map((section, sIdx) => {
                const isCollapsed = !!collapsedSections[section.label]
                const hasLabel = !!section.label
                return (
                  <div key={sIdx} className={hasLabel ? 'pt-3 first:pt-0' : ''}>
                    {hasLabel && (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.label)}
                        className="w-full flex items-center justify-between px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <span>{section.label}</span>
                        <ChevronDown
                          className={cn(
                            'w-3.5 h-3.5 transition-transform duration-200',
                            isCollapsed && '-rotate-90'
                          )}
                        />
                      </button>
                    )}
                    {(!hasLabel || !isCollapsed) && section.items.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150',
                            active
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          {item.name}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
              {/* Bottom padding so last items are reachable */}
              <div className="pb-24" />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-card border-r border-border shadow-sm">
          <div className="flex items-center h-20 px-4 border-b border-border bg-white">
            <Link href={logoHref} onClick={handleLogoClick} className="flex items-center">
              <div className="relative w-40 h-14">
                <Image
                  src="/clinic/logo.png"
                  alt="SwiftCare Dental Clinic"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigationSections.map((section, sIdx) => {
              const isCollapsed = !!collapsedSections[section.label]
              const hasLabel = !!section.label
              return (
                <div key={sIdx} className={hasLabel ? 'pt-4 first:pt-0' : ''}>
                  {hasLabel && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.label)}
                      className="w-full flex items-center justify-between px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <span>{section.label}</span>
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          isCollapsed && '-rotate-90'
                        )}
                      />
                    </button>
                  )}
                  {(!hasLabel || !isCollapsed) && section.items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-card shadow-sm border-b border-border">
          <div className="flex items-center justify-between h-16 px-3 sm:px-6 lg:px-8 gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
              {title && (
                <h2 className="text-base sm:text-xl font-semibold text-foreground truncate">{title}</h2>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-muted px-2 sm:px-3">
                    <div className="text-right hidden sm:block max-w-[160px]">
                      <p className="text-sm font-medium text-foreground truncate">
                        {formatDisplayName(session?.user?.firstName, session?.user?.lastName)}
                      </p>
                      <Badge className={`text-xs ${getRoleBadgeColor(session?.user?.role || 'admin')}`}>
                        {getRoleLabel(session?.user?.role || 'admin')}
                      </Badge>
                    </div>
                    <ProfilePictureUpload
                      currentPictureUrl={profilePictureUrl}
                      firstName={session?.user?.firstName || ''}
                      lastName={session?.user?.lastName || ''}
                      size="sm"
                      editable={false}
                    />
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
                  <DropdownMenuItem onClick={() => router.push(getProfilePath())}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <div className="px-1">
                    <ChangePasswordDialog />
                  </div>
                  {['admin', 'super_admin'].includes(session?.user?.role || '') && (
                    <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
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
        <main className="p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

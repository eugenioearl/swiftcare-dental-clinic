'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useSession, signOut } from '@/components/auth/custom-session-provider'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TodayFlowBoard } from '@/components/today-flow/today-flow-board'
import { UpcomingAppointmentsBoard } from '@/components/scheduling/upcoming-appointments-board'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Activity, Zap, Shield, CalendarClock, Layers, AlertTriangle, LogOut } from 'lucide-react'

const ALLOWED_ROLES = ['admin', 'super_admin', 'manager', 'staff', 'receptionist', 'dentist']

/**
 * UNIFIED OPERATIONS BOARD
 * ============================
 * SINGLE SCREEN that runs the entire clinic day.
 *
 * There are NO MORE separate tabs for Appointments / Check-in / Queue / Calendar.
 * All operations happen here inside the Operations Board:
 *   - Today's Schedule (interactive — click or drag)
 *   - Waiting / In Queue / In Treatment / Completed lanes
 *   - Walk-in Standby with manual approval
 *   - Full card actions: Check In, Move to Waiting, Move to Queue, Start, Complete,
 *     Cancel, Mark Left, Mark No Show, Assign Dentist, Fit Into Slot
 *
 * Legacy pages (/admin/appointments, /admin/calendar, /admin/queue, /admin/checkin)
 * remain accessible at their own routes for backward compatibility but are no longer
 * part of the primary workflow.
 *
 * URL PARAMS (for notification deep-links):
 *   ?tab=today|upcoming             → default selected tab
 *   ?appointmentId=<uuid>           → highlight & scroll to that appointment
 *   ?forUserId=<user-id>            → intended recipient of the link. If it does not
 *                                     match the current session user, show a banner
 *                                     telling the user they may be signed in as the
 *                                     wrong account, with a quick "sign out" action.
 */
function SchedulingPageInner() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentDentistId, setCurrentDentistId] = useState<string | undefined>()
  const [dismissedWrongUser, setDismissedWrongUser] = useState(false)

  const urlTab = searchParams?.get('tab') || ''
  const appointmentId = searchParams?.get('appointmentId') || ''
  const forUserId = searchParams?.get('forUserId') || ''

  const initialTab = useMemo(() => {
    if (urlTab === 'upcoming' || urlTab === 'appointments') return 'upcoming'
    if (urlTab === 'today') return 'today'
    // If we have an appointmentId but no explicit tab, prefer upcoming (which covers
    // today + future appointments) so the link always lands on something.
    if (appointmentId) return 'upcoming'
    return 'today'
  }, [urlTab, appointmentId])

  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const wrongUser =
    !!forUserId && !!session?.user?.id && forUserId !== session.user.id && !dismissedWrongUser

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      // Preserve query string through sign-in so deep link continues to work
      const callback = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/admin/scheduling'
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`)
      return
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  // Fetch current dentist ID for lane filtering
  useEffect(() => {
    const fetchDentistId = async () => {
      if (session?.user && ALLOWED_ROLES.includes(session.user.role)) {
        try {
          const response = await fetch('/api/dentists')
          if (response.ok) {
            const data = await response.json()
            const currentDentist = data.data?.dentists?.find(
              (d: any) => d.user.email === session.user.email || d.user.id === session.user.id
            )
            if (currentDentist) {
              setCurrentDentistId(currentDentist.id)
            }
          }
        } catch (error) {
          console.error('Error fetching dentist info:', error)
        }
      }
    }
    fetchDentistId()
  }, [session])

  const handleSignOut = async () => {
    const target =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/admin/scheduling'
    await signOut({ callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent(target)}` })
  }

  if (status === 'loading') {
    return (
      <DashboardLayout title="Operations Board">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return (
      <DashboardLayout title="Operations Board">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const role = session.user.role as any
  const displayName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') ||
    session.user.email ||
    'this account'

  return (
    <DashboardLayout title="Operations Board">
      <div className="space-y-4">
        {/* Wrong-user banner — only shows when a notification link's forUserId
             does not match the currently signed-in user. Typical scenario:
             staff forwards a link and the dentist opens it on a shared device. */}
        {wrongUser && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">
              You might be signed in as the wrong account
            </AlertTitle>
            <AlertDescription className="text-amber-800">
              <p className="mb-2">
                This notification link was sent to a different user, but you are currently signed in
                as <strong>{displayName}</strong> ({role.replace(/_/g, ' ')}). If this link is meant for
                you, please sign out and sign back in with your own account.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-900 hover:bg-amber-100"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out &amp; switch accounts
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-900 hover:bg-amber-100"
                  onClick={() => setDismissedWrongUser(true)}
                >
                  Continue as {displayName}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2D9DA8] to-[#4A90E2] flex items-center justify-center shadow-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">Operations Board</h1>
                <p className="text-sm text-gray-500">
                  Run the entire clinic day from one screen &mdash; drag cards, click actions, stay in flow.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" /> Live &middot; auto-refresh every 15s
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <Shield className="w-3.5 h-3.5" /> Walk-ins never auto-cancelled
            </span>
          </div>
        </div>

        {/* Tabs: Today's Operations Board (default) vs Upcoming Appointments */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border rounded-lg p-1 h-auto w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger
              value="today"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2D9DA8] data-[state=active]:to-[#4A90E2] data-[state=active]:text-white text-xs sm:text-sm px-2 sm:px-4 py-2 gap-1 sm:gap-2 whitespace-nowrap"
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Today</span>
              <span className="hidden sm:inline">Today&rsquo;s Operations Board</span>
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2D9DA8] data-[state=active]:to-[#4A90E2] data-[state=active]:text-white text-xs sm:text-sm px-2 sm:px-4 py-2 gap-1 sm:gap-2 whitespace-nowrap"
            >
              <CalendarClock className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Upcoming</span>
              <span className="hidden sm:inline">Upcoming Appointments</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-4">
            {/* Flow guide strip (only shown on Today tab) */}
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-r from-[#2D9DA8]/5 to-[#4A90E2]/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-gray-600">
                  <span className="text-gray-500">Patient flow:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">Today&rsquo;s Schedule</span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">Waiting</span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">In Queue</span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">In Treatment</span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Completed</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700">Walk-in Standby</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-500 italic">approve → waiting/queue</span>
                </div>
              </CardContent>
            </Card>

            {/* Today's operations board */}
            <TodayFlowBoard
              role={role}
              currentDentistId={currentDentistId}
              highlightAppointmentId={activeTab === 'today' ? appointmentId : undefined}
            />
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            <UpcomingAppointmentsBoard
              role={role}
              currentDentistId={currentDentistId}
              highlightAppointmentId={activeTab === 'upcoming' ? appointmentId : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

export default function SchedulingPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Operations Board">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DashboardLayout>
      }
    >
      <SchedulingPageInner />
    </Suspense>
  )
}

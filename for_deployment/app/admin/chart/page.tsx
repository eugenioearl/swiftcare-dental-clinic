'use client'

import { formatPatientName } from '@/lib/utils'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ProfessionalDentalChart, { ChartData, DentalChartType, buildDefaultChartData } from '@/components/dental-chart/professional-dental-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { Loader2, Search, User, ArrowLeft, CalendarDays, FileText, Package } from 'lucide-react'

function ChartPageContent() {
  const { data: session } = useSession() || {}
  const searchParams = useSearchParams()
  const router = useRouter()
  const patientId = searchParams?.get('patientId') || ''
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState<any>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [chartVersion, setChartVersion] = useState<number>(0)
  const [chartHistory, setChartHistory] = useState<any[]>([])
  const [chartType, setChartType] = useState<DentalChartType>('permanent')
  const [restoring, setRestoring] = useState<string | null>(null)

  // Patient search state (when no patientId in URL)
  const [searchQuery, setSearchQuery] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Determine the chart-type to use for a patient: persisted override first,
  // else age-based auto-suggest, else permanent fallback.
  const getInitialChartType = (pt: any): DentalChartType => {
    if (pt?.currentChartType === 'primary' || pt?.currentChartType === 'mixed' || pt?.currentChartType === 'permanent') {
      return pt.currentChartType
    }
    if (pt?.dateOfBirth) {
      const dob = new Date(pt.dateOfBirth)
      if (!isNaN(dob.getTime())) {
        const now = new Date()
        let age = now.getFullYear() - dob.getFullYear()
        const m = now.getMonth() - dob.getMonth()
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
        if (age <= 6) return 'primary'
        if (age <= 12) return 'mixed'
      }
    }
    return 'permanent'
  }

  // Fetch patient + chart data
  const fetchPatientChart = useCallback(async () => {
    if (!patientId) { setLoading(false); return }
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/patients/${patientId}`),
        fetch(`/api/patients/${patientId}/charts`),
      ])
      const pData = await pRes.json()
      const cData = await cRes.json()

      let thisPatient: any = null
      if (pData.success) {
        thisPatient = pData.data
        setPatient(thisPatient)
      }
      const initialType = getInitialChartType(thisPatient)
      setChartType(initialType)

      if (cData.success && cData.data.length > 0) {
        setChartData(cData.data[0].chartData as ChartData)
        setChartVersion(cData.data[0].version)
        setChartHistory(cData.data)
      } else {
        // Auto-create a default chart for this patient
        const defaultData = buildDefaultChartData(initialType)
        const createRes = await fetch(`/api/patients/${patientId}/charts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chartData: defaultData, notes: 'Initial chart — all teeth healthy', chartType: initialType }),
        })
        const createData = await createRes.json()
        if (createData.success) {
          setChartData(createData.data.chartData as ChartData)
          setChartVersion(createData.data.version)
          setChartHistory([createData.data])
        }
      }
    } catch (err) {
      console.error('Fetch chart error:', err)
      toast({ title: 'Failed to load chart data', variant: 'destructive' })
    }
    setLoading(false)
  }, [patientId, toast])

  useEffect(() => { fetchPatientChart() }, [fetchPatientChart])



  // Save chart (with chart-type meta)
  const handleSaveChart = async (data: ChartData, meta?: { chartType?: DentalChartType }) => {
    const res = await fetch(`/api/patients/${patientId}/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chartData: data,
        notes: `Updated by ${session?.user?.name || session?.user?.email || 'Staff'}`,
        chartType: meta?.chartType || chartType,
      }),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result.error)
    setChartVersion(result.data.version)
    if (meta?.chartType) setChartType(meta.chartType)
    // Refresh history
    const hRes = await fetch(`/api/patients/${patientId}/charts`)
    const hData = await hRes.json()
    if (hData.success) setChartHistory(hData.data)
  }

  // Called by the chart component when the dentist switches chart type.
  // We persist the override to the patient profile so it's remembered on reload.
  const handleChartTypeChange = async (next: DentalChartType) => {
    setChartType(next)
    try {
      await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentChartType: next }),
      })
    } catch {
      // Non-fatal - the next save will also persist it
    }
  }

  // Restore an older chart version — creates a new version server-side and refetches.
  const handleRestore = async (versionId: string, versionNumber: number) => {
    const ok = await confirm({
      title: `Restore chart to version ${versionNumber}?`,
      description: 'This will create a new chart version using the selected snapshot. The current version will not be deleted.',
      confirmLabel: 'Restore',
      variant: 'warning',
    })
    if (!ok) return
    setRestoring(versionId)
    try {
      const res = await fetch(`/api/patients/${patientId}/charts/${versionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: `Restored from version ${versionNumber} by ${session?.user?.name || session?.user?.email || 'Staff'}` }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Restore failed')
      toast({ title: `Chart restored from v${versionNumber}`, description: `Now at v${result.data.version}` })
      await fetchPatientChart()
    } catch (err: any) {
      toast({ title: 'Failed to restore chart', description: err?.message, variant: 'destructive' })
    }
    setRestoring(null)
  }

  // Patient search
  const searchPatients = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery)}&limit=10`)
      const data = await res.json()
      if (data.success) setPatients(data.data?.patients || data.data || [])
    } catch { }
    setSearchLoading(false)
  }, [searchQuery])

  // ─── No patient selected — show search ───
  if (!patientId) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold mb-6">Dental Chart</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a Patient</CardTitle>
              <CardDescription>Search for a patient to open their dental chart.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input placeholder="Search by name, number, or phone..." className="pl-9" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                </div>
                <Button onClick={searchPatients} disabled={searchLoading}>
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>
              {patients.length > 0 && (
                <div className="space-y-2">
                  {patients.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/chart?patientId=${p.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
                        <div>
                          <p className="font-medium text-sm">{formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, 'Unknown')}</p>
                          <p className="text-xs text-gray-500">{p.patientNumber} • {p.mobileNumber || p.user?.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">Open Chart</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // ─── Loading ───
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  // Only dentist, admin, super_admin can access dental charts
  if (session?.user && !['dentist', 'admin', 'super_admin'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Dental Chart">
        <div className="text-center py-16">
          <p className="text-gray-600 text-lg">Access denied. Only dentists and administrators can view dental charts.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    )
  }

  const dentistName = session?.user?.name || session?.user?.email || 'Dentist'

  // ─── Main chart page ───
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-4 px-4 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/patients/${patientId}`)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Profile
            </Button>
            <div>
              <h1 className="text-xl font-bold">{formatPatientName(patient?.fullName, patient?.user?.firstName, patient?.user?.lastName, 'Patient')}</h1>
              <p className="text-xs text-gray-500">{patient?.patientNumber} • Chart v{chartVersion}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <CalendarDays className="w-3 h-3 mr-1" /> {chartHistory.length} version{chartHistory.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Chart */}
        <ProfessionalDentalChart
          patientId={patientId}
          editable={true}
          initialChartData={chartData}
          chartType={chartType}
          onChartTypeChange={handleChartTypeChange}
          onSave={handleSaveChart}
          dentistName={dentistName}
        />

        {/* Treatment Package Note */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package className="w-4 h-4 text-[#22B573]" />
                <span>To create or manage treatment packages, go to the patient&apos;s <strong>Workspace</strong> tab.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/admin/patients/${patientId}?tab=workspace`)}
                className="text-[#2D9DA8] border-[#2D9DA8]/30 hover:bg-[#2D9DA8]/5"
              >
                Open Workspace
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Version History */}
        {chartHistory.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" /> Chart Version History
              </CardTitle>
              <CardDescription className="text-xs">
                Restoring an older version creates a new version (the existing history is preserved).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {chartHistory.map((ver: any) => {
                  const typeBadgeLabel = ver.chartType === 'primary' ? 'Primary' : ver.chartType === 'mixed' ? 'Mixed' : ver.chartType === 'permanent' ? 'Permanent' : null
                  return (
                    <div key={ver.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Version {ver.version}</p>
                          {typeBadgeLabel && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-blue-50 text-blue-700 border-blue-200">
                              {typeBadgeLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{ver.updatedByName || 'Staff'} • {new Date(ver.createdAt).toLocaleString()}</p>
                        {ver.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{ver.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setChartData(ver.chartData as ChartData); if (ver.chartType) setChartType(ver.chartType) }}
                          title="Preview this version (does not save)"
                        >
                          Preview
                        </Button>
                        {ver.version !== chartVersion ? (
                          <Button
                            size="sm"
                            onClick={() => handleRestore(ver.id, ver.version)}
                            disabled={restoring === ver.id}
                            className="bg-[#22B573] hover:bg-[#1ea069] text-white"
                          >
                            {restoring === ver.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Restore'}
                          </Button>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">Current</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function DentistChartPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></DashboardLayout>}>
      <ChartPageContent />
    </Suspense>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { getReportType } from '@/lib/reports/schema'
import {
  fetchAppointments,
  fetchPatients,
  fetchBilling,
  fetchProcedures,
  fetchDentistPerformance,
  summarizeAppointments,
  summarizePatients,
  summarizeBilling,
  summarizeProcedures,
  summarizeDentistPerformance,
} from '@/lib/reports/fetchers'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['super_admin', 'admin', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reportType, filters = {}, fields = [], mode = 'detailed' } = body

    const def = getReportType(reportType)
    if (!def) return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })

    let rows: any[] = []
    let summary: any = null

    switch (reportType) {
      case 'appointments':
        if (mode === 'summary') summary = await summarizeAppointments(filters)
        else rows = await fetchAppointments(filters, fields)
        break
      case 'patients':
        if (mode === 'summary') summary = await summarizePatients(filters)
        else rows = await fetchPatients(filters, fields)
        break
      case 'billing':
        if (mode === 'summary') summary = await summarizeBilling(filters)
        else rows = await fetchBilling(filters, fields)
        break
      case 'procedures':
        if (mode === 'summary') summary = await summarizeProcedures(filters)
        else rows = await fetchProcedures(filters, fields)
        break
      case 'dentist-performance':
        if (mode === 'summary') summary = await summarizeDentistPerformance(filters)
        else rows = await fetchDentistPerformance(filters)
        break
      default:
        return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 })
    }

    // For detailed mode, limit to first 100 rows for preview
    const totalCount = rows.length
    const sampleRows = rows.slice(0, 100)

    return NextResponse.json({
      mode,
      rows: sampleRows,
      totalCount,
      sample: rows.length > 100,
      summary,
    })
  } catch (error: any) {
    console.error('Report preview error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

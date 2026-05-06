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
import { toCSV, toXLSX, toPDF, buildReportHTML } from '@/lib/reports/exporters'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['super_admin', 'admin', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reportType, filters = {}, fields: selectedFields = [], mode = 'detailed', format = 'csv' } = body

    const def = getReportType(reportType)
    if (!def) return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })

    let rows: any[] = []
    let summary: any = null

    switch (reportType) {
      case 'appointments':
        if (mode === 'summary') summary = await summarizeAppointments(filters)
        else rows = await fetchAppointments(filters, selectedFields)
        break
      case 'patients':
        if (mode === 'summary') summary = await summarizePatients(filters)
        else rows = await fetchPatients(filters, selectedFields)
        break
      case 'billing':
        if (mode === 'summary') summary = await summarizeBilling(filters)
        else rows = await fetchBilling(filters, selectedFields)
        break
      case 'procedures':
        if (mode === 'summary') summary = await summarizeProcedures(filters)
        else rows = await fetchProcedures(filters, selectedFields)
        break
      case 'dentist-performance':
        if (mode === 'summary') summary = await summarizeDentistPerformance(filters)
        else rows = await fetchDentistPerformance(filters)
        break
      default:
        return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 })
    }

    const title = def.name
    const subtitle = buildSubtitle(filters, def)
    const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

    // Build headers/data matrix
    let headers: string[] = []
    let dataRows: (string | number)[][] = []

    if (mode === 'summary' && summary) {
      headers = ['Metric', 'Value']
      for (const [k, v] of Object.entries(summary)) {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
        if (typeof v === 'object' && v !== null) {
          dataRows.push([label, ''])
          for (const [sk, sv] of Object.entries(v)) dataRows.push([`  ${sk}`, String(sv)])
        } else {
          dataRows.push([label, String(v ?? '')])
        }
      }
    } else {
      // Detailed mode
      const activeFields = selectedFields.length > 0
        ? def.fields.filter(f => selectedFields.includes(f.key))
        : def.fields.filter(f => f.defaultOn)
      headers = activeFields.map(f => f.label)
      dataRows = rows.map(r => activeFields.map(f => r[f.key] ?? ''))
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9]+/g, '_')
    const datestamp = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      const buf = toCSV(headers, dataRows)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeTitle}_${datestamp}.csv"`,
        },
      })
    }

    if (format === 'xlsx') {
      const buf = toXLSX(headers, dataRows, def.name)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${safeTitle}_${datestamp}.xlsx"`,
        },
      })
    }

    if (format === 'pdf') {
      const html = buildReportHTML({
        title,
        subtitle,
        generatedAt,
        headers,
        rows: dataRows,
        summary: mode === 'summary' ? summary : undefined,
        totalRows: mode === 'summary' ? Object.keys(summary || {}).length : dataRows.length,
      })
      const buf = await toPDF(html)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeTitle}_${datestamp}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  } catch (error: any) {
    console.error('Report export error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

function buildSubtitle(filters: any, def: any): string {
  const parts: string[] = []
  if (filters.startDate && filters.endDate) {
    parts.push(`${filters.startDate} \u2192 ${filters.endDate}`)
  } else if (filters.startDate) {
    parts.push(`From ${filters.startDate}`)
  } else if (filters.endDate) {
    parts.push(`Until ${filters.endDate}`)
  }
  if (filters.status && filters.status !== 'all') parts.push(`Status: ${filters.status}`)
  return parts.join(' \u2022 ')
}

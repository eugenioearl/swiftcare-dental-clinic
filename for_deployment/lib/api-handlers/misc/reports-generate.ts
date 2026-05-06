import { formatPatientName, formatDentistName } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

function buildReportHtml(title: string, sections: { heading: string; rows: string[][] }[], generatedBy: string) {
  const sectionHtml = sections.map(s => {
    const headerRow = s.rows[0] || []
    const dataRows = s.rows.slice(1)
    return `
      <h2 style="color:#2D9DA8;margin-top:24px;font-size:16px;">${s.heading}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
        <thead>
          <tr style="background:#2D9DA8;color:white;">
            ${headerRow.map(h => `<th style="padding:8px;text-align:left;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${dataRows.map((row, i) => `
            <tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};">
              ${row.map(c => `<td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;">
      <div style="border-bottom:3px solid #2D9DA8;padding-bottom:16px;margin-bottom:24px;">
        <h1 style="color:#2D9DA8;margin:0;font-size:22px;">SwiftCare Dental Clinic</h1>
        <h2 style="color:#555;margin:4px 0 0;font-size:16px;font-weight:normal;">${title}</h2>
        <p style="color:#888;margin:4px 0 0;font-size:11px;">Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')} by ${generatedBy}</p>
      </div>
      ${sectionHtml}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#888;font-size:10px;text-align:center;">
        SwiftCare Dental Clinic &bull; Confidential Report
      </div>
    </body></html>
  `
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportType, parameters } = await request.json()
    if (!reportType) {
      return NextResponse.json({ error: 'Report type required' }, { status: 400 })
    }

    const generatedBy = session.user.name || session.user.email || 'Staff'
    let title = ''
    const sections: { heading: string; rows: string[][] }[] = []

    const today = new Date()
    const dateParam = parameters?.date ? new Date(parameters.date) : today

    if (reportType === 'daily-summary') {
      title = `Daily Summary — ${format(dateParam, 'MMMM d, yyyy')}`
      const dayStart = startOfDay(dateParam)
      const dayEnd = endOfDay(dateParam)

      const appointments = await prisma.appointment.findMany({
        where: { scheduledDatetime: { gte: dayStart, lte: dayEnd } },
        include: {
          patient: { select: { fullName: true, patientNumber: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } }
        },
        orderBy: { scheduledDatetime: 'asc' }
      })

      const statusCounts: Record<string, number> = {}
      appointments.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1 })

      sections.push({
        heading: 'Summary',
        rows: [
          ['Metric', 'Value'],
          ['Total Appointments', String(appointments.length)],
          ...Object.entries(statusCounts).map(([s, c]) => [s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' '), String(c)])
        ]
      })

      sections.push({
        heading: 'Appointment Details',
        rows: [
          ['Time', 'Patient', 'Patient #', 'Dentist', 'Type', 'Status'],
          ...appointments.map(a => [
            format(new Date(a.scheduledDatetime), 'h:mm a'),
            a.patient?.fullName || 'Unknown',
            a.patient?.patientNumber || '',
            a.dentist?.user ? formatDentistName(a.dentist.user.firstName, a.dentist.user.lastName) : 'Unassigned',
            a.appointmentType,
            a.status.replace('_', ' ')
          ])
        ]
      })

    } else if (reportType === 'patient-demographics') {
      title = 'Patient Demographics Report'
      const patients = await prisma.patient.findMany({
        include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200
      })

      const genderCounts: Record<string, number> = {}
      patients.forEach(p => { const g = p.gender || 'Unknown'; genderCounts[g] = (genderCounts[g] || 0) + 1 })

      sections.push({
        heading: 'Overview',
        rows: [
          ['Metric', 'Value'],
          ['Total Patients', String(patients.length)],
          ...Object.entries(genderCounts).map(([g, c]) => [g.charAt(0).toUpperCase() + g.slice(1), String(c)])
        ]
      })

      sections.push({
        heading: 'Patient List',
        rows: [
          ['#', 'Name', 'Patient #', 'Gender', 'Email', 'Phone'],
          ...patients.slice(0, 50).map((p, i) => [
            String(i + 1),
            formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, 'Unknown'),
            p.patientNumber,
            p.gender || 'N/A',
            p.user?.email || p.emailDirect || 'N/A',
            p.user?.phone || p.mobileNumber || 'N/A'
          ])
        ]
      })

    } else if (reportType === 'procedure-performance') {
      title = 'Procedure Performance Report'
      const thirtyDaysAgo = subDays(today, 30)
      const appointments = await prisma.appointment.findMany({
        where: { scheduledDatetime: { gte: thirtyDaysAgo } },
        select: { appointmentType: true, status: true, durationMinutes: true }
      })

      const typeCounts: Record<string, { total: number; completed: number }> = {}
      appointments.forEach(a => {
        if (!typeCounts[a.appointmentType]) typeCounts[a.appointmentType] = { total: 0, completed: 0 }
        typeCounts[a.appointmentType].total++
        if (a.status === 'completed') typeCounts[a.appointmentType].completed++
      })

      sections.push({
        heading: 'Procedure Summary (Last 30 Days)',
        rows: [
          ['Procedure Type', 'Total', 'Completed', 'Completion Rate'],
          ...Object.entries(typeCounts).map(([type, counts]) => [
            type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
            String(counts.total),
            String(counts.completed),
            `${counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0}%`
          ])
        ]
      })

    } else if (reportType === 'staff-productivity') {
      title = 'Staff Productivity Report'
      const dentists = await prisma.dentist.findMany({
        include: {
          user: { select: { firstName: true, lastName: true } },
          appointments: {
            where: { scheduledDatetime: { gte: subDays(today, 30) } },
            select: { status: true }
          }
        }
      })

      sections.push({
        heading: 'Dentist Productivity (Last 30 Days)',
        rows: [
          ['Dentist', 'Total Appointments', 'Completed', 'Completion Rate'],
          ...dentists.map(d => {
            const total = d.appointments.length
            const completed = d.appointments.filter(a => a.status === 'completed').length
            return [
              formatDentistName(d.user?.firstName, d.user?.lastName),
              String(total),
              String(completed),
              `${total > 0 ? Math.round((completed / total) * 100) : 0}%`
            ]
          })
        ]
      })

    } else {
      title = `${reportType.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Report`
      sections.push({ heading: 'Info', rows: [['Note'], ['Report data for this type is being prepared.']] })
    }

    const html = buildReportHtml(title, sections, generatedBy)

    // Generate PDF using HTML2PDF API
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: html,
        pdf_options: { format: 'A4', print_background: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } },
        base_url: process.env.NEXTAUTH_URL || ''
      })
    })

    if (!createResponse.ok) {
      console.error('HTML2PDF create failed:', await createResponse.text())
      return NextResponse.json({ error: 'Failed to create PDF request' }, { status: 500 })
    }

    const { request_id } = await createResponse.json()
    if (!request_id) {
      return NextResponse.json({ error: 'No request ID returned' }, { status: 500 })
    }

    // Poll for completion
    let attempts = 0
    while (attempts < 120) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY })
      })
      const statusResult = await statusResponse.json()
      const status = statusResult?.status || 'FAILED'

      if (status === 'SUCCESS' && statusResult?.result?.result) {
        const pdfBuffer = Buffer.from(statusResult.result.result, 'base64')
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          }
        })
      } else if (status === 'FAILED') {
        console.error('PDF generation failed:', statusResult)
        return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
      }
      attempts++
    }

    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

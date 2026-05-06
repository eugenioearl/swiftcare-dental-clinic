import { formatPatientName, formatDentistName } from '@/lib/utils'
import { prisma } from '@/lib/db'

export type ReportFilters = {
  startDate?: string
  endDate?: string
  dentistId?: string
  status?: string
}

// ---------- helpers ----------
function getDateRange(filters: ReportFilters) {
  const start = filters.startDate ? new Date(filters.startDate) : undefined
  const end = filters.endDate ? new Date(filters.endDate) : undefined
  if (end) {
    end.setHours(23, 59, 59, 999)
  }
  return { start, end }
}

function calcAge(dob?: Date | null): string {
  if (!dob) return ''
  const diff = Date.now() - new Date(dob).getTime()
  const yrs = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  return String(yrs)
}

function fmtDate(d?: Date | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })
  } catch { return '' }
}

function fmtTime(d?: Date | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

function fmtCurrency(n: any): string {
  const v = typeof n === 'object' && n !== null && 'toNumber' in n ? (n as any).toNumber() : Number(n ?? 0)
  return `\u20B1${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---------- Appointments ----------
export async function fetchAppointments(filters: ReportFilters, fields: string[]) {
  const { start, end } = getDateRange(filters)
  const where: any = {}
  if (start || end) where.scheduledDatetime = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
  if (filters.dentistId && filters.dentistId !== 'all') where.dentistId = filters.dentistId
  if (filters.status && filters.status !== 'all') where.status = filters.status

  const appts = await prisma.appointment.findMany({
    where,
    orderBy: { scheduledDatetime: 'desc' },
    include: {
      patient: { include: { user: true } },
      dentist: { include: { user: true } },
      service: true,
    },
    take: 5000,
  })

  return appts.map(a => ({
    appointmentNumber: a.appointmentNumber,
    scheduledDate: fmtDate(a.scheduledDatetime),
    scheduledTime: fmtTime(a.scheduledDatetime),
    patientName: formatPatientName(a.patient?.fullName, a.patient?.user?.firstName, a.patient?.user?.lastName, 'Unknown'),
    patientNumber: a.patient?.patientNumber ?? '',
    patientPhone: a.patient?.mobileNumber ?? a.patient?.user?.phone ?? '',
    dentistName: a.dentist?.user ? formatDentistName(a.dentist.user.firstName, a.dentist.user.lastName) : '',
    appointmentType: a.appointmentType,
    serviceName: a.service?.name ?? '',
    duration: String(a.durationMinutes ?? ''),
    status: a.status,
    notes: a.notes ?? '',
    createdAt: fmtDate(a.createdAt),
  }))
}

export async function summarizeAppointments(filters: ReportFilters) {
  const rows = await fetchAppointments(filters, [])
  const byStatus = countBy(rows, 'status')
  const byType = countBy(rows, 'appointmentType')
  const byDentist = countBy(rows, 'dentistName')
  const byDay = countBy(rows, 'scheduledDate')
  return {
    totalAppointments: rows.length,
    byStatus,
    byType,
    byDentist,
    byDay,
  }
}

// ---------- Patients ----------
export async function fetchPatients(filters: ReportFilters, fields: string[]) {
  const { start, end } = getDateRange(filters)
  const where: any = { isActive: true }
  if (start || end) where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }

  const patients = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      appointments: { orderBy: { scheduledDatetime: 'desc' }, take: 1 },
      _count: { select: { appointments: true } },
    },
    take: 5000,
  })

  return patients.map(p => ({
    patientNumber: p.patientNumber,
    fullName: formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, 'Unknown'),
    dateOfBirth: fmtDate(p.dateOfBirth),
    age: calcAge(p.dateOfBirth),
    gender: p.gender ?? '',
    email: p.emailDirect ?? p.user?.email ?? '',
    mobileNumber: p.mobileNumber ?? p.user?.phone ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    allergies: p.allergies ?? '',
    medicalHistory: p.medicalHistory ? p.medicalHistory.slice(0, 100) : '',
    insuranceProvider: p.insuranceProvider ?? '',
    totalVisits: String(p._count?.appointments ?? 0),
    lastVisit: p.appointments?.[0] ? fmtDate(p.appointments[0].scheduledDatetime) : '',
    registeredAt: fmtDate(p.createdAt),
  }))
}

export async function summarizePatients(filters: ReportFilters) {
  const rows = await fetchPatients(filters, [])
  const byGender = countBy(rows, 'gender')
  const byAgeGroup: Record<string, number> = {}
  rows.forEach(r => {
    const age = parseInt(r.age || '0')
    const group = age < 13 ? '0-12' : age < 20 ? '13-19' : age < 30 ? '20-29' : age < 45 ? '30-44' : age < 60 ? '45-59' : '60+'
    byAgeGroup[group] = (byAgeGroup[group] || 0) + 1
  })
  return {
    totalPatients: rows.length,
    byGender,
    byAgeGroup,
    newPatients: rows.length,
  }
}

// ---------- Billing ----------
export async function fetchBilling(filters: ReportFilters, fields: string[]) {
  const { start, end } = getDateRange(filters)
  const where: any = {}
  if (start || end) where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
  if (filters.status && filters.status !== 'all') where.status = filters.status

  const bills = await prisma.billing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: { include: { user: true } },
      appointment: { include: { dentist: { include: { user: true } } } },
    },
    take: 5000,
  })

  const filtered = filters.dentistId && filters.dentistId !== 'all'
    ? bills.filter(b => b.appointment?.dentistId === filters.dentistId)
    : bills

  return filtered.map(b => ({
    invoiceNumber: b.invoiceNumber,
    issueDate: fmtDate(b.createdAt),
    dueDate: fmtDate(b.dueDate),
    patientName: formatPatientName(b.patient?.fullName, b.patient?.user?.firstName, b.patient?.user?.lastName, 'Unknown'),
    patientNumber: b.patient?.patientNumber ?? '',
    subtotal: fmtCurrency(b.subtotal),
    taxAmount: fmtCurrency(b.taxAmount),
    discountAmount: fmtCurrency(b.discountAmount),
    totalAmount: fmtCurrency(b.totalAmount),
    amountPaid: fmtCurrency(b.paidAmount),
    balanceDue: fmtCurrency(b.balanceDue),
    status: b.status,
  }))
}

export async function summarizeBilling(filters: ReportFilters) {
  const { start, end } = getDateRange(filters)
  const where: any = {}
  if (start || end) where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
  if (filters.status && filters.status !== 'all') where.status = filters.status

  const bills = await prisma.billing.findMany({
    where,
    include: { appointment: true },
    take: 5000,
  })
  const filtered = filters.dentistId && filters.dentistId !== 'all'
    ? bills.filter(b => b.appointment?.dentistId === filters.dentistId)
    : bills

  const totalRevenue = filtered.reduce((s, b) => s + Number(b.totalAmount), 0)
  const totalPaid = filtered.reduce((s, b) => s + Number(b.paidAmount), 0)
  const totalOutstanding = filtered.reduce((s, b) => s + Number(b.balanceDue), 0)
  const byStatus: Record<string, number> = {}
  filtered.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1 })
  return {
    totalRevenue: fmtCurrency(totalRevenue),
    totalPaid: fmtCurrency(totalPaid),
    totalOutstanding: fmtCurrency(totalOutstanding),
    byStatus,
    invoiceCount: filtered.length,
  }
}

// ---------- Procedures ----------
export async function fetchProcedures(filters: ReportFilters, fields: string[]) {
  const { start, end } = getDateRange(filters)
  const where: any = {}
  if (start || end) where.procedureDate = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
  if (filters.dentistId && filters.dentistId !== 'all') where.dentistId = filters.dentistId

  const procs = await prisma.procedureRecord.findMany({
    where,
    orderBy: { procedureDate: 'desc' },
    include: { patient: { include: { user: true } } },
    take: 5000,
  })

  return procs.map(p => ({
    date: fmtDate(p.procedureDate),
    patientName: formatPatientName(p.patient?.fullName, p.patient?.user?.firstName, p.patient?.user?.lastName, 'Unknown'),
    patientNumber: p.patient?.patientNumber ?? '',
    procedureCode: '',
    procedureName: p.procedureType ?? '',
    toothNumber: Array.isArray(p.teethInvolved) ? p.teethInvolved.join(', ') : '',
    surface: '',
    dentistName: p.dentistName ?? '',
    cost: '',
    status: p.status,
  }))
}

export async function summarizeProcedures(filters: ReportFilters) {
  const rows = await fetchProcedures(filters, [])
  const byProcedure = countBy(rows, 'procedureName')
  const byDentist = countBy(rows, 'dentistName')
  return {
    totalProcedures: rows.length,
    byProcedure,
    byDentist,
    totalRevenue: '\u20B10.00',
  }
}

// ---------- Dentist Performance ----------
export async function fetchDentistPerformance(filters: ReportFilters) {
  const { start, end } = getDateRange(filters)
  const apptWhere: any = {}
  if (start || end) apptWhere.scheduledDatetime = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }

  const dentists = await prisma.dentist.findMany({
    where: { isAvailable: true },
    include: {
      user: true,
      appointments: { where: apptWhere },
    },
  })

  return dentists.map(d => {
    const total = d.appointments?.length ?? 0
    const completed = d.appointments?.filter(a => a.status === 'completed').length ?? 0
    const cancelled = d.appointments?.filter(a => a.status === 'cancelled').length ?? 0
    const noShow = d.appointments?.filter(a => a.status === 'no_show').length ?? 0
    const avgDuration = total > 0 ? Math.round(d.appointments!.reduce((s, a) => s + (a.durationMinutes ?? 0), 0) / total) : 0
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%'
    return {
      dentistName: d.user ? formatDentistName(d.user.firstName, d.user.lastName) : '',
      specialization: d.specialization ?? '',
      totalAppointments: String(total),
      completed: String(completed),
      cancelled: String(cancelled),
      noShow: String(noShow),
      completionRate,
      totalRevenue: '\u20B10.00',
      avgAppointmentDuration: String(avgDuration),
    }
  })
}

export async function summarizeDentistPerformance(filters: ReportFilters) {
  const rows = await fetchDentistPerformance(filters)
  const totalDentists = rows.length
  const avgCompletion = rows.length > 0
    ? (rows.reduce((s, r) => s + parseFloat(r.completionRate || '0'), 0) / rows.length).toFixed(1) + '%'
    : '0%'
  const topPerformer = rows
    .map(r => ({ name: r.dentistName, count: parseInt(r.totalAppointments || '0') }))
    .sort((a, b) => b.count - a.count)[0]
  return {
    topPerformer: topPerformer ? `${topPerformer.name} (${topPerformer.count} appointments)` : '',
    totalDentists,
    avgCompletionRate: avgCompletion,
  }
}

// ---------- helpers ----------
function countBy(rows: any[], key: string): Record<string, number> {
  const counts: Record<string, number> = {}
  rows.forEach(r => {
    const v = r[key] || 'Unspecified'
    counts[v] = (counts[v] || 0) + 1
  })
  return counts
}

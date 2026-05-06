// Report generator schema — defines report types, fields, and data fetchers

export type ReportField = {
  key: string
  label: string
  defaultOn?: boolean
  group?: string
}

export type ReportTypeDef = {
  id: string
  name: string
  description: string
  category: string
  supportsDateRange: boolean
  supportsDentistFilter: boolean
  supportsStatusFilter?: boolean
  statusOptions?: { value: string; label: string }[]
  fields: ReportField[]
  summaryFields?: ReportField[]
}

export const REPORT_TYPES: ReportTypeDef[] = [
  {
    id: 'appointments',
    name: 'Appointments Report',
    description: 'Complete list of appointments with patient, dentist, service and status details.',
    category: 'Operations',
    supportsDateRange: true,
    supportsDentistFilter: true,
    supportsStatusFilter: true,
    statusOptions: [
      { value: 'all', label: 'All statuses' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'checked_in', label: 'Checked In' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'no_show', label: 'No Show' },
    ],
    fields: [
      { key: 'appointmentNumber', label: 'Appointment #', defaultOn: true },
      { key: 'scheduledDate', label: 'Date', defaultOn: true },
      { key: 'scheduledTime', label: 'Time', defaultOn: true },
      { key: 'patientName', label: 'Patient Name', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #', defaultOn: true },
      { key: 'patientPhone', label: 'Patient Phone' },
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'appointmentType', label: 'Type', defaultOn: true },
      { key: 'serviceName', label: 'Service' },
      { key: 'duration', label: 'Duration (min)' },
      { key: 'status', label: 'Status', defaultOn: true },
      { key: 'notes', label: 'Notes' },
      { key: 'createdAt', label: 'Booked On' },
    ],
    summaryFields: [
      { key: 'totalAppointments', label: 'Total Appointments', defaultOn: true },
      { key: 'byStatus', label: 'Breakdown by Status', defaultOn: true },
      { key: 'byType', label: 'Breakdown by Type', defaultOn: true },
      { key: 'byDentist', label: 'Breakdown by Dentist', defaultOn: true },
      { key: 'byDay', label: 'Daily Counts', defaultOn: false },
    ],
  },
  {
    id: 'patients',
    name: 'Patients Report',
    description: 'Patient registry with demographics, contact info and visit history.',
    category: 'Patient Analytics',
    supportsDateRange: true,
    supportsDentistFilter: false,
    fields: [
      { key: 'patientNumber', label: 'Patient #', defaultOn: true },
      { key: 'fullName', label: 'Full Name', defaultOn: true },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'age', label: 'Age', defaultOn: true },
      { key: 'gender', label: 'Gender', defaultOn: true },
      { key: 'email', label: 'Email', defaultOn: true },
      { key: 'mobileNumber', label: 'Mobile Number', defaultOn: true },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'emergencyContactName', label: 'Emergency Contact' },
      { key: 'emergencyContactPhone', label: 'Emergency Phone' },
      { key: 'allergies', label: 'Allergies' },
      { key: 'medicalHistory', label: 'Medical History' },
      { key: 'insuranceProvider', label: 'Insurance Provider' },
      { key: 'totalVisits', label: 'Total Visits' },
      { key: 'lastVisit', label: 'Last Visit' },
      { key: 'registeredAt', label: 'Registered On', defaultOn: true },
    ],
    summaryFields: [
      { key: 'totalPatients', label: 'Total Patients', defaultOn: true },
      { key: 'byGender', label: 'Breakdown by Gender', defaultOn: true },
      { key: 'byAgeGroup', label: 'Breakdown by Age Group', defaultOn: true },
      { key: 'newPatients', label: 'New Registrations (period)', defaultOn: true },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Revenue Report',
    description: 'Invoices, payments, outstanding balances and revenue totals.',
    category: 'Financial',
    supportsDateRange: true,
    supportsDentistFilter: true,
    supportsStatusFilter: true,
    statusOptions: [
      { value: 'all', label: 'All statuses' },
      { value: 'pending', label: 'Pending' },
      { value: 'paid', label: 'Paid' },
      { value: 'partial', label: 'Partial' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    fields: [
      { key: 'invoiceNumber', label: 'Invoice #', defaultOn: true },
      { key: 'issueDate', label: 'Issue Date', defaultOn: true },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'patientName', label: 'Patient', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'taxAmount', label: 'Tax' },
      { key: 'discountAmount', label: 'Discount' },
      { key: 'totalAmount', label: 'Total', defaultOn: true },
      { key: 'amountPaid', label: 'Paid', defaultOn: true },
      { key: 'balanceDue', label: 'Balance Due', defaultOn: true },
      { key: 'status', label: 'Status', defaultOn: true },
    ],
    summaryFields: [
      { key: 'totalRevenue', label: 'Total Revenue', defaultOn: true },
      { key: 'totalPaid', label: 'Total Paid', defaultOn: true },
      { key: 'totalOutstanding', label: 'Total Outstanding', defaultOn: true },
      { key: 'byStatus', label: 'Breakdown by Status', defaultOn: true },
      { key: 'invoiceCount', label: 'Invoice Count', defaultOn: true },
    ],
  },
  {
    id: 'procedures',
    name: 'Procedures & Treatments Report',
    description: 'Procedures performed with counts, revenue and dentist attribution.',
    category: 'Clinical',
    supportsDateRange: true,
    supportsDentistFilter: true,
    fields: [
      { key: 'date', label: 'Date', defaultOn: true },
      { key: 'patientName', label: 'Patient', defaultOn: true },
      { key: 'patientNumber', label: 'Patient #' },
      { key: 'procedureCode', label: 'Code' },
      { key: 'procedureName', label: 'Procedure', defaultOn: true },
      { key: 'toothNumber', label: 'Tooth #' },
      { key: 'surface', label: 'Surface' },
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'cost', label: 'Cost', defaultOn: true },
      { key: 'status', label: 'Status', defaultOn: true },
    ],
    summaryFields: [
      { key: 'totalProcedures', label: 'Total Procedures', defaultOn: true },
      { key: 'byProcedure', label: 'Breakdown by Procedure', defaultOn: true },
      { key: 'byDentist', label: 'Revenue by Dentist', defaultOn: true },
      { key: 'totalRevenue', label: 'Total Revenue', defaultOn: true },
    ],
  },
  {
    id: 'dentist-performance',
    name: 'Dentist Performance Report',
    description: 'Per-dentist appointment counts, revenue and completion rates.',
    category: 'Operations',
    supportsDateRange: true,
    supportsDentistFilter: false,
    fields: [
      { key: 'dentistName', label: 'Dentist', defaultOn: true },
      { key: 'specialization', label: 'Specialization', defaultOn: true },
      { key: 'totalAppointments', label: 'Total Appointments', defaultOn: true },
      { key: 'completed', label: 'Completed', defaultOn: true },
      { key: 'cancelled', label: 'Cancelled' },
      { key: 'noShow', label: 'No Show' },
      { key: 'completionRate', label: 'Completion Rate', defaultOn: true },
      { key: 'totalRevenue', label: 'Revenue Generated', defaultOn: true },
      { key: 'avgAppointmentDuration', label: 'Avg Duration (min)' },
    ],
    summaryFields: [
      { key: 'topPerformer', label: 'Top Performer', defaultOn: true },
      { key: 'totalDentists', label: 'Total Active Dentists', defaultOn: true },
      { key: 'avgCompletionRate', label: 'Average Completion Rate', defaultOn: true },
    ],
  },
]

export function getReportType(id: string): ReportTypeDef | undefined {
  return REPORT_TYPES.find(r => r.id === id)
}

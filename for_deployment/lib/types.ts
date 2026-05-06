
import { User, Patient, Dentist, Staff, Appointment, Treatment, Billing, Payment, Notification } from "@prisma/client"

export interface ExtendedUser extends User {
  patient?: Patient | null
  dentist?: Dentist | null
  staff?: Staff | null
}

export interface AppointmentWithDetails extends Appointment {
  patient: Patient & { user: User }
  dentist: Dentist & { user: User }
  creator: User
  canceller?: User | null
  appointmentTreatments: Array<{
    id: string
    treatment: Treatment
    quantity: number
    unitCost: number
    totalCost: number
    status: string
  }>
}

export interface PatientWithDetails extends Patient {
  user: User
  appointments: Array<Appointment & {
    dentist: Dentist & { user: User }
  }>
  billing: Array<Billing & {
    payments: Payment[]
  }>
}

export interface DentistWithDetails extends Dentist {
  user: User
  appointments: Appointment[]
  schedules: Array<{
    id: string
    scheduleDate: Date
    startTime: Date
    endTime: Date
    isAvailable: boolean
  }>
}

export interface BillingWithDetails extends Billing {
  patient: Patient & { user: User }
  appointment?: Appointment | null
  payments: Payment[]
}

export interface DashboardStats {
  totalPatients: number
  todayAppointments: number
  pendingBills: number
  monthlyRevenue: number
  patientGrowth: number
  appointmentGrowth: number
}

export interface QueueItem {
  appointmentId: string
  appointmentNumber: string
  patientName: string
  patientNumber: string
  dentistName: string
  scheduledTime: Date
  status: string
  estimatedWaitTime: number
}

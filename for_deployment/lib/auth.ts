
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-config"
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret'
const secret = new TextEncoder().encode(JWT_SECRET)

export async function getServerAuth() {
  try {
    try {
      const cookieStore = cookies()
      const sessionCookie = cookieStore.get('swiftcare-session')
      
      if (sessionCookie) {
        try {
          const jwtSecret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
          const encodedSecret = new TextEncoder().encode(jwtSecret)
          const { payload } = await jwtVerify(sessionCookie.value, encodedSecret)
          
          return {
            user: {
              id: payload.userId as string,
              email: payload.email as string,
              name: payload.name as string,
              role: payload.role as string,
              isActive: payload.isActive as boolean,
            }
          }
        } catch (jwtError) {
          console.log('JWT verification failed:', (jwtError as Error)?.message)
        }
      }
    } catch (cookieError) {
      // Cookies might not be available in static generation
    }
    
    try {
      return await getServerSession(authOptions)
    } catch (nextAuthError) {
      console.log('NextAuth session check failed:', nextAuthError)
    }
    
    return null
  } catch (error) {
    console.error('getServerAuth error:', error)
    return null
  }
}

// ==========================================
// STRICT ROLE DEFINITIONS (3 roles only)
// ==========================================
// Admin/Super Admin: Full system access
// Staff/Receptionist: Operational access (patients, appointments, billing, queue, inventory)
// Dentist: Clinical access only (patients read, dental chart, treatment, clinical notes)

const ADMIN_ROLES = ['admin', 'super_admin']
const STAFF_ROLES = ['staff', 'receptionist']
const CLINICAL_ROLES = ['dentist']

// === Core Role Checks ===
export function isAdminRole(userRole: string): boolean {
  return ADMIN_ROLES.includes(userRole)
}

export function isStaffRole(userRole: string): boolean {
  return STAFF_ROLES.includes(userRole)
}

export function isDentistRole(userRole: string): boolean {
  return CLINICAL_ROLES.includes(userRole)
}

export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'super_admin'
}

export function isAdmin(userRole: string): boolean {
  return isAdminRole(userRole)
}

// === Permission Helpers ===

// Patient data: Admin (full), Staff (read/write for ops), Dentist (read + clinical write)
export function canAccessPatientData(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole) || isDentistRole(userRole)
}

export function canManagePatients(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole)
}

// Staff management: Admin only
export function canManageStaff(userRole: string): boolean {
  return isAdminRole(userRole)
}

// Inventory: Admin + Staff
export function canAccessInventory(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole)
}

export function canManageInventory(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole)
}

// Billing: Admin (full), Staff (operational billing), Dentist (read-only)
export function canAccessBilling(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole) || isDentistRole(userRole)
}

export function canManageBilling(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole)
}

// Appointments: Admin + Staff (full), Dentist (read own)
export function canAccessAppointments(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole) || isDentistRole(userRole)
}

export function canManageAppointments(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole) || isDentistRole(userRole)
}

// Reports/Analytics: Admin only
export function canAccessReports(userRole: string): boolean {
  return isAdminRole(userRole)
}

// Settings: Admin only
export function canManageSettings(userRole: string): boolean {
  return isAdminRole(userRole)
}

// Treatments: Admin + Dentist
export function canManageTreatments(userRole: string): boolean {
  return isAdminRole(userRole) || isDentistRole(userRole)
}

// User management: Admin only
export function canManageUsers(userRole: string): boolean {
  return isAdminRole(userRole)
}

// Messaging: Admin + Staff
export function canSendMessages(userRole: string): boolean {
  return isAdminRole(userRole) || isStaffRole(userRole)
}

// Clinical actions: Admin + Dentist
export function canPerformClinical(userRole: string): boolean {
  return isAdminRole(userRole) || isDentistRole(userRole)
}

// === Action Category Tags ===
export type ActionCategory = 'CLINICAL' | 'OPERATIONAL' | 'ADMINISTRATIVE'

export function getActionCategory(action: string): ActionCategory {
  const clinicalActions = [
    'treatment_create', 'treatment_update', 'treatment_complete',
    'dental_chart_update', 'diagnosis_create', 'prescription_create',
    'clinical_note_create', 'consent_create', 'consent_sign',
    'patient_examine', 'xray_upload', 'treatment_plan_create',
  ]
  const operationalActions = [
    'appointment_create', 'appointment_update', 'appointment_cancel',
    'patient_checkin', 'patient_checkout', 'queue_update',
    'payment_create', 'payment_update', 'invoice_create',
    'inventory_update', 'patient_create', 'patient_update',
    'intake_review', 'intake_approve', 'intake_reject',
    'upload_document', 'schedule_update',
  ]
  
  if (clinicalActions.includes(action)) return 'CLINICAL'
  if (operationalActions.includes(action)) return 'OPERATIONAL'
  return 'ADMINISTRATIVE'
}

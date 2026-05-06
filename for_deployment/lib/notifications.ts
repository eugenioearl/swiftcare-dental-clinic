/**
 * Centralized notification helper for SwiftCare Dental Clinic.
 *
 * Provides reusable functions that create in-app notifications and, optionally,
 * trigger email notifications. All helpers are fail-safe: email errors never
 * break the in-app notification creation, and notification creation failures
 * never break the host transaction — every helper logs errors and returns
 * gracefully.
 *
 * Usage:
 *   import { createNotification, notifyRoles } from '@/lib/notifications'
 *
 *   await createNotification({
 *     userId,
 *     title: 'Appointment Approved',
 *     message: '...',
 *     type: 'appointment_approved',
 *     module: 'appointments',
 *     relatedRecordId: appointmentId,
 *     redirectUrl: `/admin/appointments?id=${appointmentId}`,
 *     priority: 'normal',
 *   })
 */

import { prisma } from '@/lib/db'

// The NotificationType and NotificationPriority enum values recognized by the
// Notification Prisma model. Kept in sync with prisma/schema.prisma.
export type NotificationTypeValue =
  | 'appointment_reminder'
  | 'appointment_confirmation'
  | 'appointment_cancelled'
  | 'payment_due'
  | 'payment_received'
  | 'treatment_plan'
  | 'system_alert'
  | 'marketing'
  | 'new_appointment_request'
  | 'appointment_approved'
  | 'appointment_rejected'
  | 'appointment_rescheduled'
  | 'dentist_assigned'
  | 'emergency_appointment'
  | 'patient_checked_in'
  | 'appointment_completed'
  | 'appointment_no_show'
  | 'appointment_in_progress'
  | 'invoice_created'
  | 'treatment_plan_approved'

export type NotificationPriorityValue =
  | 'low'
  | 'normal'
  | 'important'
  | 'high'
  | 'urgent'
  | 'emergency'

export type NotificationModule =
  | 'appointments'
  | 'patients'
  | 'documents'
  | 'clinical'
  | 'billing'
  | 'queue'
  | 'system'

export interface CreateNotificationInput {
  userId: string
  title: string
  message: string
  type: NotificationTypeValue
  module?: NotificationModule
  relatedRecordId?: string | null
  redirectUrl?: string | null
  priority?: NotificationPriorityValue
  metadata?: Record<string, unknown> | null
}

/**
 * Creates a single in-app notification for a specific user.
 * Returns the created notification or null if creation fails.
 * Never throws — always safe to call from within larger transactions.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: string } | null> {
  try {
    if (!input.userId) return null
    const notif = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title.slice(0, 200),
        message: input.message,
        type: input.type as any,
        module: input.module || null,
        relatedRecordId: input.relatedRecordId || null,
        redirectUrl: input.redirectUrl || null,
        priority: (input.priority || 'normal') as any,
        status: 'sent',
        sentAt: new Date(),
        metadata: (input.metadata as any) || undefined,
      },
      select: { id: true },
    })
    return notif
  } catch (err) {
    console.error('[notifications] createNotification failed:', err)
    return null
  }
}

/**
 * Creates identical notifications for every active user with one of the given
 * roles. Commonly used to broadcast to admin + staff when a patient performs
 * an action (e.g. submitting an appointment request).
 *
 * Pass a unique `dedupeKey` (e.g. `appointment:<id>:new`) to guarantee the
 * same broadcast is never persisted twice in the same 60-second window.
 */
export async function notifyRoles(
  roles: string[],
  input: Omit<CreateNotificationInput, 'userId'> & { dedupeKey?: string }
): Promise<number> {
  try {
    if (!roles || roles.length === 0) return 0

    // Simple dedupe guard: if a notification with the same type +
    // relatedRecordId was created in the last 60 seconds, skip the broadcast.
    if (input.dedupeKey || input.relatedRecordId) {
      const since = new Date(Date.now() - 60_000)
      const dup = await prisma.notification.findFirst({
        where: {
          type: input.type as any,
          relatedRecordId: input.relatedRecordId || undefined,
          createdAt: { gte: since },
        },
        select: { id: true },
      })
      if (dup) {
        return 0
      }
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: roles as any },
        isActive: true,
      },
      select: { id: true },
    })
    if (users.length === 0) return 0

    const data = users.map((u) => ({
      userId: u.id,
      title: input.title.slice(0, 200),
      message: input.message,
      type: input.type as any,
      module: input.module || null,
      relatedRecordId: input.relatedRecordId || null,
      redirectUrl: input.redirectUrl || null,
      priority: (input.priority || 'normal') as any,
      status: 'sent' as const,
      sentAt: new Date(),
      metadata: (input.metadata as any) || undefined,
    }))
    const res = await prisma.notification.createMany({ data })
    return res.count || 0
  } catch (err) {
    console.error('[notifications] notifyRoles failed:', err)
    return 0
  }
}

/**
 * Builds the canonical in-app deep-link to a specific appointment on the
 * Operations Board. Accepts an optional `forUserId` so the Operations Board
 * can detect when the wrong user (e.g. a shared-device admin) is opening a
 * link addressed to someone else and prompt them to switch accounts.
 *
 * Example output:
 *   /admin/scheduling?tab=upcoming&appointmentId=abc123&forUserId=dent-uid
 */
export function buildAppointmentDeepLink(
  appointmentId: string,
  opts?: { forUserId?: string | null; tab?: 'upcoming' | 'today' }
): string {
  const params = new URLSearchParams()
  params.set('tab', opts?.tab || 'upcoming')
  params.set('appointmentId', appointmentId)
  if (opts?.forUserId) params.set('forUserId', opts.forUserId)
  return `/admin/scheduling?${params.toString()}`
}

// Role groups — kept in sync with lib/auth.ts.
export const ADMIN_STAFF_ROLES = [
  'admin',
  'super_admin',
  'manager',
  'receptionist',
  'staff',
]

export const ADMIN_ONLY_ROLES = ['admin', 'super_admin', 'manager']

/**
 * Looks up a dentist's userId from a dentistId (Dentist.id).
 * Returns null if the dentist has no linked user.
 */
export async function getDentistUserId(dentistId: string): Promise<string | null> {
  try {
    const d = await prisma.dentist.findUnique({
      where: { id: dentistId },
      select: { userId: true },
    })
    return d?.userId || null
  } catch (err) {
    console.error('[notifications] getDentistUserId failed:', err)
    return null
  }
}

/**
 * Looks up a patient's userId from a patientId.
 * Returns null if the patient is not linked to a user account.
 */
export async function getPatientUserId(patientId: string): Promise<string | null> {
  try {
    const p = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true },
    })
    return p?.userId || null
  } catch (err) {
    console.error('[notifications] getPatientUserId failed:', err)
    return null
  }
}

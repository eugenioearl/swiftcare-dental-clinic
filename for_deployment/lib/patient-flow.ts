/**
 * PATIENT FLOW STATE MACHINE
 * ============================
 * Central definitions for patient lifecycle states and valid transitions.
 *
 * Two separate pipelines:
 *
 *   SCHEDULED PATIENTS:
 *     pending → pending_assignment → scheduled → confirmed → checked_in → waiting → in_progress → completed
 *     (exit anytime: cancelled, rejected, no_show)
 *
 *   WALK-IN PATIENTS:
 *     (registered) → checked_in → waiting → in_progress → completed
 *     (exit: manual cancel only — NEVER auto-cancelled, NEVER auto no-show)
 *
 * Each patient exists in exactly ONE state at a time.
 */

export type AppointmentStatus =
  | 'pending'
  | 'pending_assignment'
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'no_show'
  | 'rescheduled'

export type AppointmentType =
  | 'consultation'
  | 'cleaning'
  | 'procedure'
  | 'surgery'
  | 'emergency'
  | 'follow_up'
  | 'x_ray'
  | 'walk_in'
  | 'other'

export type FlowLane =
  | 'today_schedule'   // Scheduled, confirmed, pending_assignment
  | 'waiting'          // Checked in, sitting in waiting area (status = checked_in)
  | 'queue'            // Active queue, ready for dentist (status = waiting)
  | 'standby'          // Walk-ins awaiting dentist approval
  | 'in_treatment'     // in_progress
  | 'completed'        // completed (today)

/** States considered ACTIVE — patient is currently in the clinic, DO NOT auto-cancel */
export const ACTIVE_STATES: AppointmentStatus[] = ['checked_in', 'waiting', 'in_progress']

/** Terminal states — once set, don't auto-transition out */
export const TERMINAL_STATES: AppointmentStatus[] = ['completed', 'cancelled', 'rejected', 'no_show']

/** States that appear in the live flow board (excludes terminal + rescheduled) */
export const LIVE_FLOW_STATES: AppointmentStatus[] = [
  'pending', 'pending_assignment', 'scheduled', 'confirmed',
  'checked_in', 'waiting', 'in_progress'
]

/**
 * State transition matrix.
 * Each key lists the states it can legally transition TO.
 */
export const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending:            ['pending_assignment', 'scheduled', 'confirmed', 'cancelled', 'rejected'],
  pending_assignment: ['scheduled', 'confirmed', 'cancelled', 'rejected'],
  scheduled:          ['confirmed', 'checked_in', 'cancelled', 'rescheduled', 'no_show'],
  confirmed:          ['checked_in', 'cancelled', 'rescheduled', 'no_show'],
  checked_in:         ['waiting', 'in_progress', 'cancelled'],
  waiting:            ['in_progress', 'checked_in', 'cancelled'],
  in_progress:        ['completed', 'waiting'],
  completed:          [],
  cancelled:          [],
  rejected:           [],
  no_show:            ['scheduled', 'checked_in'], // Late arrival recovery
  rescheduled:        ['scheduled', 'confirmed', 'cancelled'],
}

/** Can `from` transition to `to`? */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/** Is this a walk-in patient? */
export function isWalkIn(appointmentType: AppointmentType | string): boolean {
  return appointmentType === 'walk_in'
}

/** Determine which flow lane an appointment should appear in */
export function getFlowLane(
  status: AppointmentStatus,
  appointmentType: AppointmentType | string,
  isStandby: boolean = false
): FlowLane | null {
  if (TERMINAL_STATES.includes(status) && status !== 'completed') return null
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'in_treatment'

  // Walk-ins waiting for a slot that haven't been accepted → standby
  if (isWalkIn(appointmentType) && isStandby) return 'standby'

  // checked_in → "Waiting" lane (in waiting area, not yet actively queued)
  if (status === 'checked_in') return 'waiting'
  // waiting → "Queue" lane (actively queued, next up for treatment)
  if (status === 'waiting') return 'queue'

  // Scheduled / confirmed / pending → today schedule
  if (['scheduled', 'confirmed', 'pending', 'pending_assignment'].includes(status)) {
    return 'today_schedule'
  }

  return null
}

/**
 * Map a flow lane → the AppointmentStatus that places a patient into that lane.
 * Used by drag-and-drop to know what status to set on drop.
 */
export function laneToStatus(lane: FlowLane): AppointmentStatus | null {
  switch (lane) {
    case 'today_schedule': return 'scheduled'
    case 'waiting':        return 'checked_in'   // Waiting lane = just checked in
    case 'queue':          return 'waiting'      // Queue lane = actively waiting for dentist
    case 'in_treatment':   return 'in_progress'
    case 'completed':      return 'completed'
    case 'standby':        return null           // standby is a computed lane, not a real status
  }
}

/**
 * Can a patient be moved from current lane to target lane?
 * Returns { allowed: boolean, reason?: string } for human-readable errors.
 */
export function canMoveToLane(
  apt: { status: AppointmentStatus; appointmentType: AppointmentType | string; isStandby?: boolean },
  targetLane: FlowLane
): { allowed: boolean; reason?: string } {
  const currentLane = getFlowLane(apt.status, apt.appointmentType, apt.isStandby || false)
  if (currentLane === targetLane) {
    return { allowed: false, reason: 'Already in this lane' }
  }
  if (targetLane === 'standby') {
    return { allowed: false, reason: 'Standby is only for newly-registered walk-ins' }
  }
  if (targetLane === 'today_schedule') {
    return { allowed: false, reason: 'Cannot move patients back to today schedule' }
  }

  const targetStatus = laneToStatus(targetLane)
  if (!targetStatus) return { allowed: false, reason: 'Invalid target lane' }

  // Drag rules:
  // - From today_schedule, you can check-in (→ waiting) but not skip to queue/treatment
  // - From waiting (checked_in), can move to queue (→ waiting status), in_treatment, or completed
  // - From queue (waiting), can move to in_treatment, back to waiting (checked_in), or completed
  // - From standby (walk-in), can move to waiting or queue (approval)
  // - From in_treatment, can only go to completed
  // - Cannot move from completed

  if (apt.status === 'completed') {
    return { allowed: false, reason: 'Already completed' }
  }

  if (TERMINAL_STATES.includes(apt.status)) {
    return { allowed: false, reason: 'Patient is in a terminal state' }
  }

  // From today_schedule (scheduled/confirmed/pending) — must check-in first
  if (currentLane === 'today_schedule') {
    if (targetLane === 'waiting' || targetLane === 'queue') return { allowed: true }
    if (targetLane === 'in_treatment') {
      return { allowed: true } // auto-check-in then start
    }
    return { allowed: false, reason: 'Patient must be checked in first' }
  }

  // From waiting/queue/standby — can move between active lanes
  if (currentLane === 'waiting' || currentLane === 'queue' || currentLane === 'standby') {
    if (targetLane === 'waiting' || targetLane === 'queue' || targetLane === 'in_treatment' || targetLane === 'completed') {
      return { allowed: true }
    }
  }

  // From in_treatment — only completed
  if (currentLane === 'in_treatment') {
    if (targetLane === 'completed') return { allowed: true }
    return { allowed: false, reason: 'Treatment in progress — complete it first' }
  }

  return { allowed: false, reason: 'Move not allowed' }
}

/**
 * Queue priority (lower number = higher priority)
 * 1. Emergency
 * 2. Scheduled (checked_in)
 * 3. Approved walk-ins (checked_in with walk_in type)
 * 4. Standby walk-ins
 */
export function getQueuePriority(params: {
  isEmergency?: boolean
  appointmentType?: AppointmentType | string
  status?: AppointmentStatus
}): number {
  if (params.isEmergency) return 1
  if (!isWalkIn(params.appointmentType || '')) return 2
  if (params.status === 'checked_in' || params.status === 'waiting') return 3
  return 4
}

/** Is a scheduled patient LATE? (>10 minutes past scheduled time, not checked in) */
export function isLate(apt: {
  scheduledDatetime: Date | string
  status: AppointmentStatus
  appointmentType?: AppointmentType | string
}, now: Date = new Date()): boolean {
  if (isWalkIn(apt.appointmentType || '')) return false
  if (ACTIVE_STATES.includes(apt.status)) return false
  if (TERMINAL_STATES.includes(apt.status)) return false
  const scheduledTime = new Date(apt.scheduledDatetime).getTime()
  const minutesLate = (now.getTime() - scheduledTime) / (60 * 1000)
  return minutesLate > 10
}

/** Human-readable label for a status */
export function statusLabel(status: AppointmentStatus, appointmentType?: AppointmentType | string): string {
  const isWI = appointmentType ? isWalkIn(appointmentType) : false
  const labels: Record<AppointmentStatus, string> = {
    pending:            'Pending',
    pending_assignment: 'Needs Assignment',
    scheduled:          'Scheduled',
    confirmed:          'Confirmed',
    checked_in:         isWI ? 'Walk-in Arrived' : 'Checked In',
    waiting:            'Waiting',
    in_progress:        'In Treatment',
    completed:          'Completed',
    cancelled:          'Cancelled',
    rejected:           'Rejected',
    no_show:            'No Show',
    rescheduled:        'Rescheduled',
  }
  return labels[status] || status
}

/** Tailwind color classes for status badges */
export function statusBadgeClass(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    pending:            'bg-gray-100 text-gray-700 border-gray-200',
    pending_assignment: 'bg-orange-100 text-orange-800 border-orange-200',
    scheduled:          'bg-blue-100 text-blue-800 border-blue-200',
    confirmed:          'bg-cyan-100 text-cyan-800 border-cyan-200',
    checked_in:         'bg-indigo-100 text-indigo-800 border-indigo-200',
    waiting:            'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_progress:        'bg-purple-100 text-purple-800 border-purple-200',
    completed:          'bg-green-100 text-green-800 border-green-200',
    cancelled:          'bg-red-100 text-red-800 border-red-200',
    rejected:           'bg-red-100 text-red-800 border-red-200',
    no_show:            'bg-rose-100 text-rose-800 border-rose-200',
    rescheduled:        'bg-amber-100 text-amber-800 border-amber-200',
  }
  return map[status] || 'bg-gray-100 text-gray-700 border-gray-200'
}

/** Lane color scheme for the kanban board */
export const LANE_CONFIG: Record<FlowLane, {
  label: string
  color: string
  headerBg: string
  accentColor: string
  icon: string
}> = {
  today_schedule: {
    label: 'Today Schedule',
    color: 'text-blue-700',
    headerBg: 'bg-blue-50 border-blue-200',
    accentColor: 'border-l-blue-500',
    icon: 'CalendarDays'
  },
  waiting: {
    label: 'Waiting',
    color: 'text-amber-700',
    headerBg: 'bg-amber-50 border-amber-200',
    accentColor: 'border-l-amber-500',
    icon: 'Clock'
  },
  queue: {
    label: 'In Queue',
    color: 'text-yellow-700',
    headerBg: 'bg-yellow-50 border-yellow-200',
    accentColor: 'border-l-yellow-500',
    icon: 'Users'
  },
  standby: {
    label: 'Walk-in Standby',
    color: 'text-orange-700',
    headerBg: 'bg-orange-50 border-orange-200',
    accentColor: 'border-l-orange-500',
    icon: 'UserPlus'
  },
  in_treatment: {
    label: 'In Treatment',
    color: 'text-purple-700',
    headerBg: 'bg-purple-50 border-purple-200',
    accentColor: 'border-l-purple-500',
    icon: 'Stethoscope'
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    headerBg: 'bg-green-50 border-green-200',
    accentColor: 'border-l-green-500',
    icon: 'CheckCircle2'
  },
}

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Formats a name as "Last Name, First Name".
 * Handles optional/null values gracefully.
 */
export function formatDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback: string = 'Unknown'
): string {
  const f = firstName?.trim() || ''
  const l = lastName?.trim() || ''
  if (l && f) return `${l}, ${f}`
  if (l) return l
  if (f) return f
  return fallback
}

/**
 * Formats a dentist name as "Dr. Last Name, First Name".
 */
export function formatDentistName(
  firstName?: string | null,
  lastName?: string | null,
  fallback: string = 'Unassigned'
): string {
  const f = firstName?.trim() || ''
  const l = lastName?.trim() || ''
  if (l && f) return `Dr. ${l}, ${f}`
  if (l) return `Dr. ${l}`
  if (f) return `Dr. ${f}`
  return fallback
}

/**
 * Formats a patient name: uses fullName if available (reorders to Last, First),
 * otherwise falls back to user firstName/lastName.
 */
export function formatPatientName(
  fullName?: string | null,
  firstName?: string | null,
  lastName?: string | null,
  fallback: string = 'Unknown Patient'
): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      const last = parts[parts.length - 1]
      const rest = parts.slice(0, -1).join(' ')
      return `${last}, ${rest}`
    }
    return fullName.trim()
  }
  return formatDisplayName(firstName, lastName, fallback)
}

/**
 * Gets initials from a "Last, First" formatted name or firstName/lastName.
 */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null
): string {
  return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    if (currency === 'PHP') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  } catch (error) {
    // Fallback formatting
    return `${currency} ${amount.toFixed(2)}`
  }
}

/**
 * Copy text to clipboard with fallback for iframe/permissions-policy restricted environments.
 * Returns true if copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Blocked by permissions policy — fall through to legacy method
  }
  // Legacy fallback using execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}
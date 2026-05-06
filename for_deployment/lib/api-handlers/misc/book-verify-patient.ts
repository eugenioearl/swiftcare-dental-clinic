import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Normalize a name for comparison: lowercase + trim + collapse inner whitespace
function normalizeName(value: string | null | undefined): string {
  if (!value) return ''
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Match last name against either the patient.lastName field (preferred)
// or the patient.fullName (fallback for legacy records that don't have
// firstName/lastName populated). Matches case-insensitively and trims spaces.
function lastNameMatches(patient: { lastName?: string | null; fullName?: string | null }, inputLastNorm: string): boolean {
  if (!inputLastNorm) return false

  // Preferred match: exact case-insensitive compare on patient.lastName
  const storedLast = normalizeName(patient.lastName)
  if (storedLast && storedLast === inputLastNorm) return true

  // Fallback: parse fullName and compare. Matches when fullName equals
  // the last name OR ends with " <lastName>" (space-separated last token).
  const storedFull = normalizeName(patient.fullName)
  if (storedFull) {
    if (storedFull === inputLastNorm) return true
    // Require preceding space so e.g. "rodriguez" doesn't match "cruz"
    if (storedFull.endsWith(' ' + inputLastNorm)) return true
  }

  return false
}

// POST /api/book/verify-patient
// Verify existing patient by patientNumber + lastName
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientNumber, lastName } = body

    if (!patientNumber || !lastName) {
      return NextResponse.json(
        { success: false, error: 'Patient number and last name are required' },
        { status: 400 }
      )
    }

    const cleanPatientNumber = String(patientNumber).trim().toUpperCase()
    const inputLastNorm = normalizeName(String(lastName))

    if (!inputLastNorm) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid last name' },
        { status: 400 }
      )
    }

    // Find patient by patient number (case-insensitive)
    const patient = await prisma.patient.findFirst({
      where: {
        patientNumber: { equals: cleanPatientNumber, mode: 'insensitive' },
        isActive: true,
      },
    })

    if (!patient) {
      // Don't reveal whether the patient number exists
      return NextResponse.json(
        { success: false, error: 'Patient number and last name do not match our records' },
        { status: 404 }
      )
    }

    // Verify last name matches (case-insensitive, trimmed)
    if (!lastNameMatches(patient, inputLastNorm)) {
      return NextResponse.json(
        { success: false, error: 'Patient number and last name do not match our records' },
        { status: 404 }
      )
    }

    // Success — return limited patient info (only what's needed for booking UI)
    return NextResponse.json({
      success: true,
      data: {
        id: patient.id,
        patientNumber: patient.patientNumber,
        fullName: patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient',
        lastName: patient.lastName || null,
      },
    })
  } catch (error) {
    console.error('Error verifying patient:', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

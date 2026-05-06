import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST - match patient by name, phone, or email
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, phone, email } = body

    if (!name && !phone && !email) {
      return NextResponse.json({ error: 'At least one search field required' }, { status: 400 })
    }

    const conditions: any[] = []

    // Match by phone (most reliable)
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9+]/g, '')
      if (cleanPhone.length >= 7) {
        conditions.push({ mobileNumber: { contains: cleanPhone.slice(-7), mode: 'insensitive' } })
        conditions.push({ user: { phone: { contains: cleanPhone.slice(-7), mode: 'insensitive' } } })
      }
    }

    // Match by email
    if (email) {
      const cleanEmail = email.trim().toLowerCase()
      conditions.push({ emailDirect: { equals: cleanEmail, mode: 'insensitive' } })
      conditions.push({ user: { email: { equals: cleanEmail, mode: 'insensitive' } } })
    }

    // Match by name (fuzzy)
    if (name) {
      const cleanName = name.trim()
      if (cleanName.length >= 2) {
        conditions.push({ fullName: { contains: cleanName, mode: 'insensitive' } })
        // Split name for first/last matching
        const parts = cleanName.split(/\s+/)
        if (parts.length >= 2) {
          conditions.push({
            user: {
              AND: [
                { firstName: { contains: parts[0], mode: 'insensitive' } },
                { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
              ],
            },
          })
        } else {
          conditions.push({ user: { firstName: { contains: cleanName, mode: 'insensitive' } } })
          conditions.push({ user: { lastName: { contains: cleanName, mode: 'insensitive' } } })
        }
      }
    }

    if (conditions.length === 0) {
      return NextResponse.json({ success: true, data: { matches: [], bestMatch: null } })
    }

    const matches = await prisma.patient.findMany({
      where: { OR: conditions, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
      take: 10,
    })

    // Score matches
    const scored = matches.map((p: any) => {
      let score = 0
      const pName = p.fullName || `${p.user?.lastName || ''}, ${p.user?.firstName || ''}`.trim()
      const pPhone = p.mobileNumber || p.user?.phone || ''
      const pEmail = (p.emailDirect || p.user?.email || '').toLowerCase()

      // Phone match = highest confidence
      if (phone) {
        const cleanPhone = phone.replace(/[^0-9+]/g, '')
        if (pPhone.includes(cleanPhone.slice(-7))) score += 50
      }

      // Email exact match = high confidence
      if (email && pEmail === email.trim().toLowerCase()) score += 40

      // Name match
      if (name) {
        const cleanName = name.trim().toLowerCase()
        if (pName.toLowerCase() === cleanName) score += 30
        else if (pName.toLowerCase().includes(cleanName) || cleanName.includes(pName.toLowerCase())) score += 15
      }

      return {
        id: p.id,
        patientNumber: p.patientNumber,
        fullName: pName,
        mobileNumber: p.mobileNumber,
        email: pEmail,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        score,
      }
    }).sort((a: any, b: any) => b.score - a.score)

    return NextResponse.json({
      success: true,
      data: {
        matches: scored,
        bestMatch: scored.length > 0 && scored[0].score >= 30 ? scored[0] : null,
      },
    })
  } catch (error) {
    console.error('Patient match error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

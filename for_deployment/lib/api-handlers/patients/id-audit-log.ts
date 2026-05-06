import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/patients/[id]/audit-log
 *
 * Returns field-level audit entries for a patient, including per-field diffs.
 * Supports filtering by:
 *   - from / to (ISO date strings)
 *   - field (case-insensitive, filters by substring in description or key in oldValues/newValues)
 *   - category (CLINICAL | OPERATIONAL | ADMINISTRATIVE)
 *   - action (create | update | delete)
 *   - page / limit (default: 1 / 100)
 *
 * Why a dedicated endpoint? The timeline endpoint returns a condensed
 * per-event view; the viewer below needs the full field-by-field diff in
 * a flat list optimized for filtering.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerAuth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const fieldFilter = (searchParams.get('field') || '').trim().toLowerCase()
    const categoryFilter = (searchParams.get('category') || '').trim().toUpperCase()
    const actionFilter = (searchParams.get('action') || '').trim().toLowerCase()

    const where: any = {
      // Match multiple entityType casings used across the codebase
      entityType: { in: ['Patient', 'patient'] },
      entityId: params.id,
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }
    if (categoryFilter && ['CLINICAL', 'OPERATIONAL', 'ADMINISTRATIVE'].includes(categoryFilter)) {
      where.category = categoryFilter
    }
    if (actionFilter && ['create', 'update', 'delete'].includes(actionFilter)) {
      where.action = actionFilter as any
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    // Flatten into per-field entries for easier rendering
    // One audit log with N changed fields → N entry rows
    const fieldEntries: any[] = []
    for (const log of logs) {
      const oldVals = (log.oldValues || {}) as Record<string, any>
      const newVals = (log.newValues || {}) as Record<string, any>
      const allFields = new Set([
        ...Object.keys(oldVals),
        ...Object.keys(newVals),
      ])
      const userName = log.user
        ? `${log.user.lastName || ''}, ${log.user.firstName || ''}`.replace(/^, |, $/g, '').trim() || 'System'
        : 'System'
      const userRole = log.user?.role || null

      if (allFields.size === 0) {
        // Audit log with no field diff (e.g. create/delete events) – still surface it
        if (!fieldFilter) {
          fieldEntries.push({
            id: log.id,
            logId: log.id,
            fieldKey: null,
            fieldLabel: null,
            oldValue: null,
            newValue: null,
            action: log.action,
            category: log.category,
            description: log.description,
            createdAt: log.createdAt,
            userName,
            userRole,
          })
        }
        continue
      }

      for (const field of Array.from(allFields)) {
        if (fieldFilter && !field.toLowerCase().includes(fieldFilter)) continue
        fieldEntries.push({
          id: `${log.id}-${field}`,
          logId: log.id,
          fieldKey: field,
          fieldLabel: humanizeFieldName(field),
          oldValue: oldVals[field] ?? null,
          newValue: newVals[field] ?? null,
          action: log.action,
          category: log.category,
          description: log.description,
          createdAt: log.createdAt,
          userName,
          userRole,
        })
      }
    }

    // Distinct list of fields in the returned window (for filter dropdown)
    const distinctFields = Array.from(new Set(fieldEntries.map(e => e.fieldKey).filter(Boolean))).sort()

    return NextResponse.json({
      success: true,
      entries: fieldEntries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      meta: { distinctFields },
    })
  } catch (error) {
    console.error('[patient audit-log] GET error', error)
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 })
  }
}

/**
 * Convert camelCase or snake_case field keys into human-readable labels.
 * e.g. "validIdNumber" → "Valid Id Number", "emergency_contact_phone" → "Emergency Contact Phone"
 */
function humanizeFieldName(key: string): string {
  if (!key) return ''
  const cleaned = key
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

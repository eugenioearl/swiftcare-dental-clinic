/**
 * OCR API handler for SmartUpload documents.
 *
 * Routes:
 *   GET  /api/patients/:id/smart-upload/:uploadId/ocr   → Get cached OCR result
 *   POST /api/patients/:id/smart-upload/:uploadId/ocr   → Run / re-run OCR
 *
 * Permissions: limited to clinical / staff / admin roles. Patients should
 * NEVER trigger OCR on documents — they only see what existing visibility
 * rules already allow.
 *
 * Audit: every OCR run and every confirmation (via the existing
 * save-to-records endpoint) is logged in the AuditLog table.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isStaffRole, isAdminRole, isDentistRole, canPerformClinical } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { downloadFile } from '@/lib/s3'
import { runOcrFromUrl, getOcrEligibility } from '@/lib/ocr'

function canRunOcr(role: string | null | undefined): boolean {
  if (!role) return false
  return (
    isAdminRole(role) ||
    isStaffRole(role) ||
    isDentistRole(role) ||
    canPerformClinical(role)
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; uploadId: string } },
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canRunOcr(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const upload = await prisma.smartUpload.findFirst({
      where: { id: params.uploadId, patientId: params.id },
      select: {
        id: true,
        ocrStatus: true,
        ocrText: true,
        ocrConfidence: true,
        ocrFields: true,
        ocrLanguage: true,
        ocrError: true,
        ocrProcessedAt: true,
        mimeType: true,
        originalName: true,
      },
    })
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    const eligibility = getOcrEligibility(upload.mimeType, upload.originalName)
    return NextResponse.json({
      success: true,
      data: {
        ocrStatus: upload.ocrStatus,
        ocrText: upload.ocrText,
        ocrConfidence: upload.ocrConfidence,
        ocrFields: upload.ocrFields,
        ocrLanguage: upload.ocrLanguage,
        ocrError: upload.ocrError,
        ocrProcessedAt: upload.ocrProcessedAt,
        eligible: eligibility.supported,
        eligibilityReason: eligibility.reason,
      },
    })
  } catch (e) {
    console.error('[OCR][GET] failed:', (e as Error)?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } },
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canRunOcr(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const upload = await prisma.smartUpload.findFirst({
      where: { id: params.uploadId, patientId: params.id },
    })
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    // Read body softly: { force?: boolean, language?: string }
    let body: { force?: boolean; language?: string } = {}
    try { body = await request.json() } catch { /* no-op */ }

    const eligibility = getOcrEligibility(upload.mimeType, upload.originalName)
    if (!eligibility.supported) {
      // Persist the skipped state so the UI can render a clear message.
      const skipped = await prisma.smartUpload.update({
        where: { id: upload.id },
        data: {
          ocrStatus: 'skipped',
          ocrError: eligibility.reason || 'Unsupported file type',
          ocrProcessedAt: new Date(),
          ocrProcessedBy: session.user.id,
        },
      })
      return NextResponse.json({
        success: true,
        data: {
          ocrStatus: skipped.ocrStatus,
          ocrText: skipped.ocrText,
          ocrConfidence: skipped.ocrConfidence,
          ocrFields: skipped.ocrFields,
          ocrLanguage: skipped.ocrLanguage,
          ocrError: skipped.ocrError,
          ocrProcessedAt: skipped.ocrProcessedAt,
        },
      })
    }

    // Cache hit: don't re-run unless force=true
    if (!body.force && upload.ocrStatus === 'completed' && upload.ocrText) {
      return NextResponse.json({
        success: true,
        cached: true,
        data: {
          ocrStatus: upload.ocrStatus,
          ocrText: upload.ocrText,
          ocrConfidence: upload.ocrConfidence,
          ocrFields: upload.ocrFields,
          ocrLanguage: upload.ocrLanguage,
          ocrError: upload.ocrError,
          ocrProcessedAt: upload.ocrProcessedAt,
        },
      })
    }

    // Mark as processing immediately
    await prisma.smartUpload.update({
      where: { id: upload.id },
      data: {
        ocrStatus: 'processing',
        ocrError: null,
        ocrProcessedBy: session.user.id,
      },
    })

    // Resolve a signed download URL and run OCR.
    let signedUrl: string
    try {
      signedUrl = await downloadFile(upload.cloudStoragePath)
    } catch (e: any) {
      const failed = await prisma.smartUpload.update({
        where: { id: upload.id },
        data: {
          ocrStatus: 'failed',
          ocrError: 'Failed to access file: ' + (e?.message || 'unknown error').slice(0, 200),
          ocrProcessedAt: new Date(),
        },
      })
      return NextResponse.json({
        success: false,
        data: {
          ocrStatus: failed.ocrStatus,
          ocrError: failed.ocrError,
          ocrProcessedAt: failed.ocrProcessedAt,
        },
      }, { status: 500 })
    }

    const ocrResult = await runOcrFromUrl(
      signedUrl,
      { mimeType: upload.mimeType || undefined, fileName: upload.originalName },
      { language: body.language },
    )

    const updated = await prisma.smartUpload.update({
      where: { id: upload.id },
      data: {
        ocrStatus: ocrResult.status,
        ocrText: ocrResult.text || null,
        ocrConfidence: ocrResult.confidence,
        ocrFields: ocrResult.fields as any,
        ocrLanguage: ocrResult.language,
        ocrError: ocrResult.error || null,
        ocrProcessedAt: new Date(ocrResult.processedAt),
        ocrProcessedBy: session.user.id,
      },
    })

    // Audit log: OCR run (informational; not a clinical write yet)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'read',
          entityType: 'SmartUpload',
          entityId: upload.id,
          category: 'CLINICAL',
          description: `OCR ${ocrResult.status} (confidence: ${ocrResult.confidence ?? 'n/a'}, duration ${ocrResult.durationMs}ms)`,
          newValues: {
            ocrStatus: ocrResult.status,
            ocrConfidence: ocrResult.confidence,
            ocrLanguage: ocrResult.language,
            ocrFieldKeys: Object.keys(ocrResult.fields || {}),
            forceRerun: !!body.force,
          } as any,
        },
      })
    } catch (auditErr) {
      console.warn('[OCR] audit log failed (non-critical)', (auditErr as Error)?.message)
    }

    return NextResponse.json({
      success: true,
      data: {
        ocrStatus: updated.ocrStatus,
        ocrText: updated.ocrText,
        ocrConfidence: updated.ocrConfidence,
        ocrFields: updated.ocrFields,
        ocrLanguage: updated.ocrLanguage,
        ocrError: updated.ocrError,
        ocrProcessedAt: updated.ocrProcessedAt,
      },
    })
  } catch (e) {
    console.error('[OCR][POST] failed:', (e as Error)?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFile, downloadFile } from '@/lib/s3'
import { extractFromImage, extractFromPDF, extractFromText } from '@/lib/llm-extract'

// GET - list uploads for this patient (with signed download URLs attached)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const uploads = await prisma.smartUpload.findMany({
      where: { patientId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    // Attach signed URLs so the frontend can preview/download without an extra round-trip.
    // Failures per-file are tolerated so the list still renders.
    const enriched = await Promise.all(
      uploads.map(async (u) => {
        let fileUrl: string | null = null
        try {
          if (u.cloudStoragePath) fileUrl = await downloadFile(u.cloudStoragePath)
        } catch (e) {
          console.error('Failed to get signed URL for', u.id, e)
        }
        return { ...u, fileUrl }
      })
    )

    return NextResponse.json({ success: true, data: enriched })
  } catch (error) {
    console.error('Get uploads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - upload file, store in S3, trigger LLM extraction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // Upload to S3
    const cloudPath = await uploadFile(buffer, file.name)

    // Create record with pending status
    const upload = await prisma.smartUpload.create({
      data: {
        patientId: params.id,
        fileName: `${Date.now()}-${file.name}`,
        originalName: file.name,
        mimeType: file.type,
        fileSize: buffer.length,
        cloudStoragePath: cloudPath,
        extractionStatus: 'processing',
        uploadedBy: session.user.id,
      },
    })

    // Run extraction based on file type
    try {
      let result
      if (file.type === 'application/pdf') {
        result = await extractFromPDF(base64)
      } else if (file.type.startsWith('image/')) {
        result = await extractFromImage(base64, file.type)
      } else if (file.type.startsWith('text/')) {
        const text = buffer.toString('utf-8')
        result = await extractFromText(text)
      } else {
        // Try as text fallback
        const text = buffer.toString('utf-8')
        result = await extractFromText(text)
      }

      await prisma.smartUpload.update({
        where: { id: upload.id },
        data: {
          extractedData: result.extractedData as any,
          confidenceScores: result.confidenceScores as any,
          extractionStatus: 'completed',
          classification: result.classification || 'other',
          classificationConfidence: result.classificationConfidence ?? 0.5,
          migrationStatus: 'scanned',
        },
      })

      const updated = await prisma.smartUpload.findUnique({ where: { id: upload.id } })
      let fileUrl: string | null = null
      try { if (updated?.cloudStoragePath) fileUrl = await downloadFile(updated.cloudStoragePath) } catch {}
      return NextResponse.json({ success: true, data: { ...updated, fileUrl } }, { status: 201 })
    } catch (extractError) {
      console.error('Extraction failed:', extractError)
      await prisma.smartUpload.update({
        where: { id: upload.id },
        data: { extractionStatus: 'failed' },
      })

      const updated = await prisma.smartUpload.findUnique({ where: { id: upload.id } })
      let fileUrl: string | null = null
      try { if (updated?.cloudStoragePath) fileUrl = await downloadFile(updated.cloudStoragePath) } catch {}
      return NextResponse.json({ success: true, data: { ...updated, fileUrl }, warning: 'Extraction failed but file was uploaded' }, { status: 201 })
    }
  } catch (error) {
    console.error('Smart upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

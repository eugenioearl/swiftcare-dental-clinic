import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { downloadFile, deleteFile } from '@/lib/s3'

// GET - get upload details with download url
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const upload = await prisma.smartUpload.findFirst({
      where: { id: params.uploadId, patientId: params.id },
    })
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    const downloadUrl = await downloadFile(upload.cloudStoragePath)

    return NextResponse.json({ success: true, data: { ...upload, downloadUrl } })
  } catch (error) {
    console.error('Get upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - update extracted data after review, or save to records
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { extractedData, savedToRecords, targetType, targetId, classification, migrationStatus, reviewNotes } = body

    const updateData: any = {}
    if (extractedData !== undefined) updateData.extractedData = extractedData
    if (savedToRecords !== undefined) updateData.savedToRecords = savedToRecords
    if (targetType !== undefined) updateData.targetType = targetType
    if (targetId !== undefined) updateData.targetId = targetId
    if (classification !== undefined) updateData.classification = classification
    if (migrationStatus !== undefined) updateData.migrationStatus = migrationStatus
    if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes
    if (savedToRecords || migrationStatus === 'reviewed') {
      updateData.reviewedBy = session.user.id
      updateData.reviewedAt = new Date()
    }

    const upload = await prisma.smartUpload.update({
      where: { id: params.uploadId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: upload })
  } catch (error) {
    console.error('Update upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - delete an upload and its S3 file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const upload = await prisma.smartUpload.findFirst({
      where: { id: params.uploadId, patientId: params.id },
    })
    if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

    // Delete from S3
    try {
      await deleteFile(upload.cloudStoragePath)
    } catch (e) {
      console.error('S3 delete error (continuing):', e)
    }

    // Delete from database
    await prisma.smartUpload.delete({ where: { id: params.uploadId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, canManagePatients } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFile, deleteFile } from '@/lib/s3'

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `/api/image-proxy?path=${encodeURIComponent(path)}`
}

// POST /api/patients/[id]/profile-picture - Upload patient profile picture
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only staff/admin/dentist can upload patient profile pictures
    if (!canManagePatients(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Verify patient exists and get existing picture
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      select: { id: true, profilePictureCloudPath: true, fullName: true },
    })

    if (!existingPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Delete old picture if present
    if (existingPatient.profilePictureCloudPath) {
      try {
        await deleteFile(existingPatient.profilePictureCloudPath)
      } catch (err) {
        console.error('Failed to delete old patient profile picture:', err)
        // Continue
      }
    }

    // Upload new picture
    const cloudStoragePath = await uploadFile(buffer, `patient-${id}-${file.name}`)

    // Update patient record
    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        profilePicture: cloudStoragePath,
        profilePictureCloudPath: cloudStoragePath,
        profilePictureUpdatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        profilePicture: true,
        profilePictureCloudPath: true,
        profilePictureUpdatedAt: true,
      },
    })

    const profilePictureUrl = buildImageUrl(cloudStoragePath)

    // Audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'patient',
          entityId: id,
          action: 'update',
          newValues: { profilePicture: 'updated' },
        },
      })
    } catch (err) {
      console.error('Audit log error:', err)
    }

    return NextResponse.json({
      success: true,
      patient: updatedPatient,
      profilePictureUrl,
    })
  } catch (error) {
    console.error('Error uploading patient profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    )
  }
}

// DELETE /api/patients/[id]/profile-picture - Remove patient profile picture
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManagePatients(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      select: { id: true, profilePictureCloudPath: true },
    })

    if (!existingPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (!existingPatient.profilePictureCloudPath) {
      return NextResponse.json(
        { error: 'No profile picture to delete' },
        { status: 404 }
      )
    }

    try {
      await deleteFile(existingPatient.profilePictureCloudPath)
    } catch (err) {
      console.error('Error deleting picture from S3:', err)
    }

    await prisma.patient.update({
      where: { id },
      data: {
        profilePicture: null,
        profilePictureCloudPath: null,
        profilePictureUpdatedAt: new Date(),
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'patient',
          entityId: id,
          action: 'update',
          newValues: { profilePicture: 'removed' },
        },
      })
    } catch (err) {
      console.error('Audit log error:', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting patient profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to delete profile picture' },
      { status: 500 }
    )
  }
}

// GET /api/patients/[id]/profile-picture - Get patient profile picture URL
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const patient = await prisma.patient.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        profilePicture: true,
        profilePictureCloudPath: true,
        profilePictureUpdatedAt: true,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const profilePictureUrl = buildImageUrl(patient.profilePictureCloudPath)

    return NextResponse.json({
      patient,
      profilePictureUrl,
    })
  } catch (error) {
    console.error('Error fetching patient profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile picture' },
      { status: 500 }
    )
  }
}

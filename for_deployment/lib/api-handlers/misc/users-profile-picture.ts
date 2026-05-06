import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { uploadFile, deleteFile } from '@/lib/s3'
import { prisma } from '@/lib/db'

// Build a stable proxied image URL that never expires.
function buildImageUrl(cloudStoragePath: string | null | undefined): string | null {
  if (!cloudStoragePath) return null
  return `/api/image-proxy?path=${encodeURIComponent(cloudStoragePath)}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Get current user to check for existing profile picture
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profilePicture: true }
    })

    // Delete old profile picture if exists
    if (currentUser?.profilePicture) {
      try {
        await deleteFile(currentUser.profilePicture)
      } catch (error) {
        console.error('Error deleting old profile picture:', error)
        // Continue even if deletion fails
      }
    }

    // Upload new profile picture
    const cloudStoragePath = await uploadFile(buffer, file.name)

    // Update user record with new profile picture
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePicture: cloudStoragePath },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true
      }
    })

    const profilePictureUrl = buildImageUrl(cloudStoragePath)

    return NextResponse.json({
      success: true,
      user: updatedUser,
      profilePictureUrl
    })
  } catch (error) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profilePicture: true }
    })

    if (!currentUser?.profilePicture) {
      return NextResponse.json(
        { error: 'No profile picture to delete' },
        { status: 404 }
      )
    }

    // Delete from S3
    try {
      await deleteFile(currentUser.profilePicture)
    } catch (error) {
      console.error('Error deleting profile picture from S3:', error)
      // Continue even if S3 deletion fails
    }

    // Update user record
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePicture: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (error) {
    console.error('Error deleting profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to delete profile picture' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const profilePictureUrl = buildImageUrl(user.profilePicture)

    return NextResponse.json({
      user,
      profilePictureUrl
    })
  } catch (error) {
    console.error('Error fetching profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile picture' },
      { status: 500 }
    )
  }
}

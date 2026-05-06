import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { uploadFile } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = session.user.role
    if (!['admin', 'super_admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = `service-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const cloudStoragePath = await uploadFile(buffer, safeName)
    const proxyUrl = `/api/image-proxy?path=${encodeURIComponent(cloudStoragePath)}`

    return NextResponse.json({
      success: true,
      cloudStoragePath,
      url: proxyUrl,
    })
  } catch (err) {
    console.error('Service image upload failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

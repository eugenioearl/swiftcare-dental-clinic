import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { uploadFile } from '@/lib/s3'
import { prisma } from '@/lib/db'

// POST /api/admin/branding/upload  — upload logo, favicon, or hero image
// Body: FormData with 'file' + 'type' (logo | favicon | hero | login_logo)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const assetType = (formData.get('type') as string) || 'logo'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. JPG, PNG, WebP, SVG allowed.' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determine extension
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
      'image/webp': '.webp', 'image/svg+xml': '.svg',
    }
    const ext = extMap[file.type] || '.png'
    const safeName = `branding-${assetType}-${Date.now()}${ext}`

    // Upload to cloud storage
    const cloudStoragePath = await uploadFile(buffer, safeName)
    const signedUrl = `/api/image-proxy?path=${encodeURIComponent(cloudStoragePath)}`

    // Save as system setting
    const settingKey = `branding_${assetType}_cloud_path`
    const upserted = await prisma.systemSetting.upsert({
      where: { settingKey },
      update: { settingValue: cloudStoragePath },
      create: {
        settingKey,
        settingValue: cloudStoragePath,
        description: `Cloud storage path for ${assetType}`,
        dataType: 'string',
        isPublic: true,
      },
    })

    const urlKey = `branding_${assetType}_url`
    await prisma.systemSetting.upsert({
      where: { settingKey: urlKey },
      update: { settingValue: signedUrl },
      create: {
        settingKey: urlKey,
        settingValue: signedUrl,
        description: `Signed URL for ${assetType}`,
        dataType: 'string',
        isPublic: true,
      },
    })

    // Audit log — entityId must be a UUID, use the upserted setting id
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'SystemSetting',
        entityId: upserted.id,
        action: 'update',
        category: 'ADMINISTRATIVE',
        description: `Uploaded new ${assetType} image: ${file.name}`,
        newValues: { assetType, cloudStoragePath, fileName: file.name },
      },
    })

    return NextResponse.json({
      success: true,
      cloudStoragePath,
      url: signedUrl,
      assetType,
    })
  } catch (err) {
    console.error('Branding upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

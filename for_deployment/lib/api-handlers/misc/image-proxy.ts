import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createS3Client, getBucketConfig } from '@/lib/aws-config'

export const dynamic = 'force-dynamic'

// GET /api/image-proxy?path=<cloudStoragePath>
// Streams an image from S3. This endpoint provides a stable URL for images that
// doesn't expire (unlike signed URLs), solving cached/stale-URL issues on
// announcements, profile pictures, and other public-facing images.
export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    // Allow only paths that start with expected folder prefixes (security)
    const { bucketName, folderPrefix } = getBucketConfig()
    const validPrefixes = [`${folderPrefix}uploads/`, 'uploads/']
    const ok = validPrefixes.some((p) => path.startsWith(p))
    if (!ok) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    if (!bucketName) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }

    const s3: S3Client = createS3Client()
    const cmd = new GetObjectCommand({ Bucket: bucketName, Key: path })
    const resp = await s3.send(cmd)
    const body = resp.Body
    if (!body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Convert to Buffer
    const chunks: Buffer[] = []
    // @ts-expect-error: Body is a Readable stream in Node runtime
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk))
    }
    const buffer = Buffer.concat(chunks)

    // Determine content type
    const contentType = resp.ContentType || guessContentType(path) || 'application/octet-stream'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err: any) {
    console.error('Image proxy error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}

function guessContentType(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return map[ext] || null
}

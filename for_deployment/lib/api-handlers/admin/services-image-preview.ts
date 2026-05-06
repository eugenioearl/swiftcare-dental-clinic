import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    // Redirect to stable image-proxy endpoint (doesn't expire like signed URLs)
    const proxyUrl = `/api/image-proxy?path=${encodeURIComponent(key)}`
    return NextResponse.redirect(new URL(proxyUrl, request.url))
  } catch (err) {
    console.error('Image preview failed:', err)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}

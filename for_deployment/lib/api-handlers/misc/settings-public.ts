import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// GET /api/settings/public - Returns ONLY public settings, no auth required
// Used by the public landing page to display clinic contact info, branding, etc.
export async function GET(_request: NextRequest) {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: [{ settingKey: 'asc' }],
      select: {
        settingKey: true,
        settingValue: true,
        dataType: true,
      },
    })

    // Build a key→value map for easy consumption
    const map: Record<string, string> = {}
    for (const s of settings) {
      map[s.settingKey] = s.settingValue
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: map,
      },
    }, {
      // Cache for a minute on the edge to avoid hammering the DB on every page load
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    console.error('[settings-public GET]', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to load settings' }, { status: 500 })
  }
}

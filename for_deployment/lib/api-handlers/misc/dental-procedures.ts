
import { NextRequest, NextResponse } from "next/server"

// GET /api/dental-procedures
export async function GET(request: NextRequest) {
  return NextResponse.json({ procedures: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })
}

// POST /api/dental-procedures
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

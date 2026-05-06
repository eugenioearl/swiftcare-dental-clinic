
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

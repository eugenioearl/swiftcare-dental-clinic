
import { NextRequest, NextResponse } from "next/server"

// GET /api/dental-procedures/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

// PUT /api/dental-procedures/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

// DELETE /api/dental-procedures/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

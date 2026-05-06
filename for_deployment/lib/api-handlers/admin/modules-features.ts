import { NextRequest, NextResponse } from "next/server"

// Module Management has been removed from SwiftCare system
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    error: "Module Management feature has been removed" 
  }, { status: 404 })
}
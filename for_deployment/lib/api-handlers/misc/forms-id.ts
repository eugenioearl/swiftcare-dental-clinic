
import { NextRequest, NextResponse } from "next/server"
import { formsService } from '@/lib/prisma-forms'

// GET /api/forms/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const form = await formsService.getFormById(params.id)
    
    if (!form) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Form not found' 
        }, 
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { form }
    })
  } catch (error) {
    console.error('Error fetching form:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch form' 
      }, 
      { status: 500 }
    )
  }
}

// PUT /api/forms/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    
    const form = await formsService.updateForm({
      ...body,
      id: params.id
    })
    
    return NextResponse.json({
      success: true,
      data: { form }
    })
  } catch (error) {
    console.error('Error updating form:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update form' 
      }, 
      { status: 500 }
    )
  }
}

// DELETE /api/forms/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await formsService.deleteForm(params.id)
    
    return NextResponse.json({
      success: true,
      message: 'Form deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting form:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete form' 
      }, 
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from "next/server"
import { formsService } from '@/lib/prisma-forms'

// GET /api/forms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters = {
      patientId: searchParams.get('patientId') || undefined,
      documentType: searchParams.get('documentType') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    }

    const result = await formsService.getForms(filters)
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error fetching forms:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch forms' 
      }, 
      { status: 500 }
    )
  }
}

// POST /api/forms
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log the request data for debugging
    console.log('Creating form with data:', { 
      patientId: body.patientId, 
      documentType: body.documentType, 
      status: body.status 
    })
    
    // Validate required fields
    if (!body.patientId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Patient ID is required' 
        }, 
        { status: 400 }
      )
    }
    
    if (!body.documentType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Document type is required' 
        }, 
        { status: 400 }
      )
    }
    
    if (!body.title) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Title is required' 
        }, 
        { status: 400 }
      )
    }
    
    const form = await formsService.createForm(body)
    
    console.log('Form created successfully:', form.id)
    
    return NextResponse.json({
      success: true,
      data: { form }
    })
  } catch (error) {
    console.error('Error creating form:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create form'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', errorMessage, errorStack)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      }, 
      { status: 500 }
    )
  }
}

// PUT /api/forms
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log the request data for debugging
    console.log('Updating form with data:', { 
      id: body.id, 
      patientId: body.patientId, 
      documentType: body.documentType, 
      status: body.status 
    })
    
    if (!body.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Form ID is required for update' 
        }, 
        { status: 400 }
      )
    }
    
    const form = await formsService.updateForm(body)
    
    console.log('Form updated successfully:', form.id)
    
    return NextResponse.json({
      success: true,
      data: { form }
    })
  } catch (error) {
    console.error('Error updating form:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update form'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', errorMessage, errorStack)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      }, 
      { status: 500 }
    )
  }
}

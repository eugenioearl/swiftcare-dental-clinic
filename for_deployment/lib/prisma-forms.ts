
import { prisma as db } from '@/lib/db'

export interface CreateFormData {
  patientId: string
  documentType: string
  title: string
  status: 'draft' | 'completed' | 'submitted'
  content?: string
  patientSignature?: string
  witnessSignature?: string
  cloudStoragePath?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
}

export interface UpdateFormData extends Partial<CreateFormData> {
  id: string
}

// Map our form types to the DocumentType enum
const mapFormTypeToDocumentType = (formType: string) => {
  switch (formType) {
    case 'patient-intake':
    case 'medical-history':
      return 'intake_form'
    case 'general-consent':
    case 'xray-consent':
    case 'anesthesia-consent':
    case 'financial-agreement':
      return 'consent_form'
    default:
      return 'other'
  }
}

export interface FormFilters {
  patientId?: string
  documentType?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

export const formsService = {
  async createForm(data: CreateFormData) {
    try {
      // Get current user for uploadedBy
      const user = await db.user.findFirst({
        where: { role: { not: 'patient' } },
        orderBy: { createdAt: 'desc' }
      })

      // Store form data as JSON in description field
      const formMetadata = {
        status: data.status,
        content: data.content,
        patientSignature: data.patientSignature,
        formType: data.documentType
      }

      const form = await db.patientDocument.create({
        data: {
          patientId: data.patientId,
          filename: `${data.documentType}-form.json`,
          originalName: data.title,
          documentType: mapFormTypeToDocumentType(data.documentType),
          description: JSON.stringify(formMetadata),
          cloudStoragePath: data.cloudStoragePath || `/forms/${data.documentType}/${Date.now()}.json`,
          fileSize: data.fileSize || 0,
          mimeType: 'application/json',
          category: data.documentType,
          uploadedBy: user?.id || data.patientId,
          tags: [data.documentType, data.status || 'draft']
        },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      // Transform the response to match expected interface
      return {
        ...form,
        title: form.originalName,
        status: formMetadata.status,
        content: formMetadata.content,
        patientSignature: formMetadata.patientSignature,
        createdByUser: {
          firstName: 'System',
          lastName: 'Admin',
          role: 'admin'
        }
      }
    } catch (error) {
      console.error('Error creating form:', error)
      throw error
    }
  },

  async updateForm(data: UpdateFormData) {
    try {
      const { id, ...updateData } = data
      
      // Get existing document to merge data
      const existing = await db.patientDocument.findUnique({ where: { id } })
      if (!existing) {
        throw new Error('Form not found')
      }

      let existingMetadata: any = {}
      try {
        existingMetadata = JSON.parse(existing.description || '{}')
      } catch (e) {
        // If description is not valid JSON, start fresh
      }

      // Update form metadata
      const formMetadata = {
        ...existingMetadata,
        status: updateData.status || existingMetadata.status,
        content: updateData.content || existingMetadata.content,
        patientSignature: updateData.patientSignature || existingMetadata.patientSignature,
        formType: updateData.documentType || existingMetadata.formType
      }
      
      const form = await db.patientDocument.update({
        where: { id },
        data: {
          ...(updateData.title && { originalName: updateData.title }),
          ...(updateData.documentType && { 
            documentType: mapFormTypeToDocumentType(updateData.documentType),
            category: updateData.documentType
          }),
          description: JSON.stringify(formMetadata),
          tags: [formMetadata.formType, formMetadata.status || 'draft']
        },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      // Transform the response to match expected interface
      return {
        ...form,
        title: form.originalName,
        status: formMetadata.status,
        content: formMetadata.content,
        patientSignature: formMetadata.patientSignature,
        createdByUser: {
          firstName: 'System',
          lastName: 'Admin',
          role: 'admin'
        }
      }
    } catch (error) {
      console.error('Error updating form:', error)
      throw error
    }
  },

  async getForms(filters: FormFilters = {}) {
    try {
      const { 
        patientId, 
        documentType, 
        status, 
        search, 
        page = 1, 
        limit = 20 
      } = filters

      const skip = (page - 1) * limit

      const where: any = {
        // Only get form documents (not actual uploaded files)
        mimeType: 'application/json'
      }

      if (patientId) where.patientId = patientId
      if (documentType) where.category = documentType
      if (search) {
        where.OR = [
          { originalName: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { patient: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
          { patient: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
          { patient: { user: { email: { contains: search, mode: 'insensitive' } } } }
        ]
      }

      const [documents, total] = await Promise.all([
        db.patientDocument.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }),
        db.patientDocument.count({ where })
      ])

      // Transform documents to match form interface
      const forms = documents.map(doc => {
        let metadata: any = {}
        try {
          metadata = JSON.parse(doc.description || '{}')
        } catch (e) {
          // If description is not valid JSON, use defaults
          metadata = { status: 'draft' }
        }

        return {
          ...doc,
          title: doc.originalName,
          documentType: doc.category || doc.filename.split('-')[0],
          status: metadata.status || 'draft',
          content: metadata.content,
          patientSignature: metadata.patientSignature,
          createdByUser: {
            firstName: 'System',
            lastName: 'Admin', 
            role: 'admin'
          }
        }
      })

      // Apply status filter after transformation
      const filteredForms = status 
        ? forms.filter(form => form.status === status)
        : forms

      const pages = Math.ceil(total / limit)

      return {
        forms: filteredForms,
        pagination: {
          page,
          limit,
          total: filteredForms.length,
          pages
        }
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      throw error
    }
  },

  async getFormById(id: string) {
    try {
      const doc = await db.patientDocument.findUnique({
        where: { id },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      if (!doc) return null

      // Transform document to match form interface
      let metadata: any = {}
      try {
        metadata = JSON.parse(doc.description || '{}')
      } catch (e) {
        // If description is not valid JSON, use defaults
        metadata = { status: 'draft' }
      }

      return {
        ...doc,
        title: doc.originalName,
        documentType: doc.category || doc.filename.split('-')[0],
        status: metadata.status || 'draft',
        content: metadata.content,
        patientSignature: metadata.patientSignature,
        createdByUser: {
          firstName: 'System',
          lastName: 'Admin', 
          role: 'admin'
        }
      }
    } catch (error) {
      console.error('Error fetching form:', error)
      throw error
    }
  },

  async deleteForm(id: string) {
    try {
      await db.patientDocument.delete({
        where: { id }
      })
      return true
    } catch (error) {
      console.error('Error deleting form:', error)
      throw error
    }
  }
}

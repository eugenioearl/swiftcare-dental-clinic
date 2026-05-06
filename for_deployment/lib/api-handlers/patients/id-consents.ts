import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma, createConsentFormSafe } from '@/lib/db'
import crypto from 'crypto'

// GET /api/patients/[id]/consents
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const consents = await prisma.consentForm.findMany({
      where: { patientId: params.id },
      include: {
        package: { select: { id: true, packageNumber: true, title: true } },
        preparedBy: { select: { id: true, firstName: true, lastName: true } },
        witness: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ consents })
  } catch (error) {
    console.error('Error fetching consents:', error)
    return NextResponse.json({ error: 'Failed to fetch consents' }, { status: 500 })
  }
}

// Normalize a title for dedup: lowercase, strip punctuation/whitespace
function normalizeTitle(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// POST /api/patients/[id]/consents - Generate consent from package,
// and auto-attach additional FormTemplates matching the package's
// procedures / categories / source package template / required_always rules.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { packageId, title, description, formContent, autoAttachForms } = body
    const shouldAutoAttach = autoAttachForms !== false // default ON

    // Get patient info
    const patient = await prisma.patient.findUnique({ where: { id: params.id } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Build treatment and financial summary from package
    let treatmentSummary: any = null
    let financialSummary: any = null
    let pkg: any = null

    if (packageId) {
      pkg = await prisma.treatmentPackage.findUnique({
        where: { id: packageId },
        include: { items: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } } }
      })
      if (pkg) {
        treatmentSummary = {
          packageTitle: pkg.title,
          packageNumber: pkg.packageNumber,
          procedures: pkg.items.map((i: any) => ({
            name: i.procedureName,
            toothNumber: i.toothNumber,
            quantity: i.quantity,
            cost: Number(i.adjustedCost)
          }))
        }
        financialSummary = {
          totalAmount: Number(pkg.totalAmount),
          coveredAmount: Number(pkg.coveredAmount),
          patientPayable: Number(pkg.patientPayable),
          paidAmount: Number(pkg.paidAmount),
          balanceDue: Number(pkg.balanceDue)
        }
      }
    }

    // Determine round number
    const existingCount = await prisma.consentForm.count({
      where: { patientId: params.id, packageId: packageId || undefined }
    })

    // Generate unique token and consent number
    const token = crypto.randomBytes(32).toString('hex')

    // Default form content — uses admin-configurable template from SystemSetting if available
    const defaultContent = formContent || await generateDefaultConsent(patient.fullName || 'Patient', treatmentSummary, financialSummary)
    const mainTitle = title || `Treatment Consent - ${treatmentSummary?.packageTitle || 'General'}`

    const createdRow = await createConsentFormSafe({
      patientId: params.id,
      packageId: packageId || null,
      title: mainTitle,
      description: description || null,
      formContent: defaultContent,
      treatmentSummary,
      financialSummary,
      preparedById: session.user.id,
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      round: existingCount + 1,
      assignmentSource: 'manual',
      requirementStage: 'before_procedure',
    })
    const consent = await prisma.consentForm.findUnique({
      where: { id: createdRow.id },
      include: {
        package: { select: { id: true, packageNumber: true, title: true } },
        preparedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    // ---- Auto-attach matching form templates ----
    const additionalForms: any[] = []
    let skippedCount = 0
    let skippedAlreadySigned: string[] = []

    if (shouldAutoAttach && pkg) {
      try {
        // Gather context from the package
        const treatmentIdsInPkg = Array.from(new Set(pkg.items.map((i: any) => i.treatmentId).filter(Boolean)))
        const treatmentCats = Array.from(new Set(
          pkg.items
            .map((i: any) => i.treatment?.category)
            .filter(Boolean)
            .map((c: string) => c.toLowerCase())
        ))
        const sourceTemplateId = (pkg as any).sourcePackageTemplateId || null

        // Load existing consent forms for this patient to dedup by title and templateKey
        const existingForms = await prisma.consentForm.findMany({
          where: { patientId: params.id },
          select: { title: true, templateKey: true, patientSignature: true }
        })
        const existingTitleSet = new Set(existingForms.map(f => normalizeTitle(f.title)))
        // Track which forms are already signed (for user notification)
        const signedTitleSet = new Set(
          existingForms.filter(f => !!f.patientSignature).map(f => normalizeTitle(f.title))
        )
        const signedTemplateKeySet = new Set(
          existingForms.filter(f => !!f.patientSignature && f.templateKey).map(f => f.templateKey as string)
        )
        // The main consent we just created is already in existingForms
        const createdTitleSet = new Set<string>([normalizeTitle(mainTitle)])

        // Load all active form templates
        const templates = await prisma.formTemplate.findMany({
          where: { isActive: true, status: 'active' },
          orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }]
        })

        const matched: any[] = []
        for (const t of templates) {
          const tidList = Array.isArray(t.requiredForTreatmentIds) ? (t.requiredForTreatmentIds as string[]) : []
          const tcatList = Array.isArray(t.requiredForTreatmentCategories)
            ? ((t.requiredForTreatmentCategories as string[]).map(c => (c || '').toLowerCase()))
            : []
          const pkgTmplList = Array.isArray((t as any).requiredForPackageTemplateIds)
            ? ((t as any).requiredForPackageTemplateIds as string[])
            : []

          const treatmentMatch = tidList.length > 0 && treatmentIdsInPkg.some((id: any) => tidList.includes(id))
          const categoryMatch = tcatList.length > 0 && treatmentCats.some((c: any) => tcatList.includes(c))
          const packageTemplateMatch = !!(sourceTemplateId && pkgTmplList.includes(sourceTemplateId))
          const alwaysMatch = !!t.requiredAlways

          if (treatmentMatch || categoryMatch || packageTemplateMatch || alwaysMatch) {
            matched.push(t)
          }
        }

        // Dedup by normalized title and templateKey against existing + already-created
        for (const t of matched) {
          const norm = normalizeTitle(t.title)

          // Check if already signed by templateKey (most reliable check)
          const tKey = (t as any).familyKey || t.key
          if (tKey && signedTemplateKeySet.has(tKey)) {
            skippedCount++
            skippedAlreadySigned.push(t.title)
            continue
          }

          // Check if already signed by title
          if (signedTitleSet.has(norm)) {
            skippedCount++
            skippedAlreadySigned.push(t.title)
            continue
          }

          if (existingTitleSet.has(norm) || createdTitleSet.has(norm)) {
            skippedCount++
            continue
          }

          // Build a minimal form_content from the template fields (for signing flow)
          const fieldList = Array.isArray(t.fields) ? (t.fields as any[]) : []
          const body = `${t.title}\n\n${t.description || ''}\n\nPlease review and sign below.`

          const formToken = crypto.randomBytes(32).toString('hex')

          const created = await createConsentFormSafe({
            patientId: params.id,
            packageId: packageId || null,
            title: t.title,
            description: t.description || null,
            formContent: body,
            formFields: fieldList as any,
            templateKey: t.key,
            templateVersion: t.version,
            assignmentSource: 'auto',
            requirementStage: 'before_procedure',
            preparedById: session.user.id,
            signingToken: formToken,
            tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            round: 1,
          })
          additionalForms.push(created)
          createdTitleSet.add(norm)
        }
      } catch (err) {
        console.warn('[id-consents] auto-attach failed (non-fatal):', err)
      }
    }

    return NextResponse.json({
      consent,
      additionalForms,
      autoAttached: additionalForms.length,
      skippedDuplicates: skippedCount,
      skippedAlreadySigned,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating consent:', error)
    return NextResponse.json({ error: 'Failed to create consent' }, { status: 500 })
  }
}

// Built-in fallback template — used when no template is stored in SystemSetting.
// Supports these variables: {{patientName}}, {{date}}, {{packageTitle}}, {{procedures}},
// {{totalAmount}}, {{coveredAmount}}, {{patientPayable}}, {{balanceDue}}, {{financialSummary}}
export const DEFAULT_CONSENT_TEMPLATE = `INFORMED CONSENT FOR DENTAL TREATMENT

Patient Name: {{patientName}}
Date: {{date}}

I, {{patientName}}, hereby consent to the following dental treatment(s):

{{procedures}}

I acknowledge that:
1. The nature of the proposed treatment has been explained to me.
2. The potential risks, benefits, and alternatives have been discussed.
3. I have had the opportunity to ask questions and all questions have been answered satisfactorily.
4. No guarantees have been made regarding the outcome of treatment.
5. I understand the estimated costs and payment terms.{{financialSummary}}

I voluntarily consent to proceed with the proposed treatment plan.
`

function buildFinancialSummary(financial: any): string {
  if (!financial) return ''
  return `\n\nFinancial Summary:\n• Total Amount: ₱${financial.totalAmount?.toLocaleString() || '0'}\n• Coverage: ₱${financial.coveredAmount?.toLocaleString() || '0'}\n• Patient Payable: ₱${financial.patientPayable?.toLocaleString() || '0'}`
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? ''))
}

async function generateDefaultConsent(patientName: string, treatment: any, financial: any): Promise<string> {
  const procedures = treatment?.procedures?.map((p: any) => `• ${p.name}${p.toothNumber ? ` (Tooth #${p.toothNumber})` : ''}`).join('\n') || 'As discussed during consultation'

  // Try to load admin-configured template from SystemSetting
  let template = DEFAULT_CONSENT_TEMPLATE
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'consent_default_template' }
    })
    if (setting?.settingValue && setting.settingValue.trim().length > 0) {
      template = setting.settingValue
    }
  } catch (err) {
    console.warn('Failed to load consent_default_template setting, using built-in fallback:', err)
  }

  const vars: Record<string, string> = {
    patientName,
    date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    packageTitle: treatment?.packageTitle || 'General',
    procedures,
    totalAmount: financial?.totalAmount?.toLocaleString() || '0',
    coveredAmount: financial?.coveredAmount?.toLocaleString() || '0',
    patientPayable: financial?.patientPayable?.toLocaleString() || '0',
    balanceDue: financial?.balanceDue?.toLocaleString() || '0',
    financialSummary: buildFinancialSummary(financial),
  }

  return interpolate(template, vars)
}

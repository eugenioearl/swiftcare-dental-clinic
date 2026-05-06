/**
 * Seeds the 15 official SwiftCare Dental Clinic services with linked
 * treatments, package templates, appointment types and default form rules.
 *
 * Idempotent — safe to re-run. Uses upsert by name. Services not in the
 * official list are **deactivated and hidden** from website/booking, but
 * never deleted (historical records + appointment references preserved).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type OfficialService = {
  name: string
  displayName: string
  description: string
  category: string
  tagalog?: string
  duration: number
  estimatedPrice?: number
  priceMin?: number
  priceMax?: number
  priceDisplay?: string
  imageUrl?: string
  linkedTreatmentCodes?: string[]
  linkedPackageNames?: string[]
  linkedFormKeys?: string[]
  defaultAppointmentType?: string
  defaultPlanTitle?: string
  defaultPlanPhases?: any[]
}

const SERVICES: OfficialService[] = [
  {
    name: 'Dental Consultation',
    displayName: 'Dental Consultation',
    tagalog: 'Konsulta',
    description: 'Comprehensive oral examination, diagnosis and treatment recommendations from our licensed dentists.',
    category: 'Diagnostic',
    duration: 30,
    estimatedPrice: 500,
    priceDisplay: 'Starting at ₱500',
    imageUrl: '/services/consultation.jpg',
    linkedTreatmentCodes: ['D0120', 'D0150'],
    linkedFormKeys: ['patient-intake', 'medical-history'],
    defaultAppointmentType: 'consultation'
  },
  {
    name: 'Tooth Extraction (Bunot)',
    displayName: 'Tooth Extraction',
    tagalog: 'Bunot',
    description: 'Simple and straightforward extraction of a damaged or problem tooth. Gentle technique, minimal downtime.',
    category: 'Oral Surgery',
    duration: 45,
    estimatedPrice: 2500,
    priceMin: 2500,
    priceMax: 5000,
    priceDisplay: '₱2,500 – ₱5,000',
    imageUrl: '/services/extraction.jpg',
    linkedTreatmentCodes: ['D7140', 'D7210'],
    linkedFormKeys: ['general-treatment-consent', 'anesthesia-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Tooth Restoration (Pasta)',
    displayName: 'Tooth Restoration',
    tagalog: 'Pasta',
    description: 'Composite/tooth-coloured fillings to restore cavities back to healthy function and natural appearance.',
    category: 'Restorative',
    duration: 45,
    estimatedPrice: 2500,
    priceMin: 2500,
    priceMax: 4500,
    priceDisplay: '₱2,500 – ₱4,500 per tooth',
    imageUrl: '/services/restoration.jpg',
    linkedTreatmentCodes: ['D2140', 'D2161', 'D2392', 'FILL-001'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Oral Prophylaxis (Linis)',
    displayName: 'Oral Prophylaxis',
    tagalog: 'Linis',
    description: 'Professional dental cleaning to remove plaque, tartar, and surface stains — keeps gums healthy and teeth bright.',
    category: 'Preventive',
    duration: 45,
    estimatedPrice: 2000,
    priceDisplay: 'Starting at ₱2,000',
    imageUrl: '/services/oral-prophylaxis.jpg',
    linkedTreatmentCodes: ['D1110', 'D1120'],
    linkedPackageNames: ['Oral Prophylaxis Package'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'cleaning'
  },
  {
    name: 'Dentures (Pustiso)',
    displayName: 'Dentures',
    tagalog: 'Pustiso',
    description: 'Full or partial removable dentures, custom-fit for comfort, function and a confident smile.',
    category: 'Prosthodontic',
    duration: 60,
    estimatedPrice: 18000,
    priceMin: 18000,
    priceMax: 25000,
    priceDisplay: '₱18,000 – ₱25,000',
    imageUrl: '/services/dentures.jpg',
    linkedTreatmentCodes: ['D5110', 'D5120', 'D5213'],
    linkedPackageNames: ['Complete Denture Package'],
    linkedFormKeys: ['general-treatment-consent', 'financial-agreement'],
    defaultAppointmentType: 'consultation',
    defaultPlanTitle: 'Denture Fabrication Plan',
    defaultPlanPhases: [
      { phaseNumber: 1, title: 'Impressions & Bite Registration', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 1, notes: 'Initial impressions' },
      { phaseNumber: 2, title: 'Try-In', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 1, notes: 'Wax try-in for fit' },
      { phaseNumber: 3, title: 'Delivery & Adjustments', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 2, notes: 'Denture delivery + 1 follow-up' }
    ]
  },
  {
    name: 'Fixed Bridge',
    displayName: 'Fixed Bridge',
    description: 'Permanent replacement for missing teeth anchored to adjacent teeth — natural-looking and durable.',
    category: 'Prosthodontic',
    duration: 60,
    estimatedPrice: 12000,
    priceMin: 12000,
    priceMax: 36000,
    priceDisplay: '₱12,000 per unit',
    imageUrl: '/services/fixed-bridge.jpg',
    linkedTreatmentCodes: ['D6240', 'D2740'],
    linkedFormKeys: ['general-treatment-consent', 'financial-agreement'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Jacket Crowns',
    displayName: 'Jacket Crowns',
    description: 'Porcelain and PFM crowns to restore strength and aesthetics for compromised or post-RCT teeth.',
    category: 'Restorative',
    duration: 60,
    estimatedPrice: 12000,
    priceMin: 12000,
    priceMax: 15000,
    priceDisplay: '₱12,000 – ₱15,000',
    imageUrl: '/services/crown.jpg',
    linkedTreatmentCodes: ['D2740', 'D2750'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Veneers',
    displayName: 'Porcelain Veneers',
    description: 'Thin porcelain shells that transform front teeth — fix chips, stains, gaps, shape.',
    category: 'Cosmetic',
    duration: 60,
    estimatedPrice: 20000,
    priceDisplay: 'Starting at ₱20,000',
    imageUrl: '/services/veneers.jpg',
    linkedTreatmentCodes: ['D2962'],
    linkedPackageNames: ['Cosmetic Smile Makeover'],
    linkedFormKeys: ['general-treatment-consent', 'financial-agreement'],
    defaultAppointmentType: 'consultation'
  },
  {
    name: 'Fluoride Application',
    displayName: 'Fluoride Application',
    description: 'Topical fluoride treatment to strengthen enamel and protect against cavities — ideal for children and high-risk patients.',
    category: 'Preventive',
    duration: 20,
    estimatedPrice: 800,
    priceDisplay: '₱800',
    imageUrl: '/services/fluoride.jpg',
    linkedTreatmentCodes: ['D1208'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Pit & Fissure Sealant',
    displayName: 'Pit & Fissure Sealant',
    description: 'Protective resin coating on the chewing surfaces of back teeth — seals deep grooves to prevent decay.',
    category: 'Preventive',
    duration: 30,
    estimatedPrice: 1000,
    priceDisplay: '₱1,000 per tooth',
    imageUrl: '/services/sealant.jpg',
    linkedTreatmentCodes: ['D1351'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Orthodontic Treatment (Braces)',
    displayName: 'Braces / Orthodontics',
    tagalog: 'Braces',
    description: 'Metal braces and clear aligners to correct crooked teeth, bite issues, and achieve a beautiful straight smile.',
    category: 'Orthodontic',
    duration: 60,
    estimatedPrice: 60000,
    priceMin: 60000,
    priceMax: 120000,
    priceDisplay: '₱60,000 – ₱120,000',
    imageUrl: '/services/orthodontics.jpg',
    linkedTreatmentCodes: ['D8080', 'D8090', 'D8040'],
    linkedFormKeys: ['general-treatment-consent', 'financial-agreement'],
    defaultAppointmentType: 'consultation',
    defaultPlanTitle: 'Orthodontic Treatment Plan',
    defaultPlanPhases: [
      { phaseNumber: 1, title: 'Initial Records & Diagnostic', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 2, notes: 'X-rays, impressions, photos' },
      { phaseNumber: 2, title: 'Bracket Placement / Aligner Delivery', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 1, notes: 'Bond brackets or fit aligners' },
      { phaseNumber: 3, title: 'Active Treatment & Adjustments', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 18, notes: 'Monthly adjustments 18-24 months' },
      { phaseNumber: 4, title: 'Debonding & Retention', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 2, notes: 'Remove brackets + retainers' }
    ]
  },
  {
    name: 'Root Canal Treatment',
    displayName: 'Root Canal Treatment',
    description: 'Save your natural tooth when the inner pulp is infected — painless with modern techniques.',
    category: 'Endodontic',
    duration: 90,
    estimatedPrice: 8000,
    priceMin: 8000,
    priceMax: 15000,
    priceDisplay: '₱8,000 – ₱15,000',
    imageUrl: '/services/root-canal.jpg',
    linkedTreatmentCodes: ['D3310', 'D3320', 'D3330'],
    linkedPackageNames: ['Root Canal + Crown Package'],
    linkedFormKeys: ['general-treatment-consent', 'anesthesia-consent'],
    defaultAppointmentType: 'procedure',
    defaultPlanTitle: 'Root Canal + Restoration Plan',
    defaultPlanPhases: [
      { phaseNumber: 1, title: 'Access & Canal Preparation', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 1, notes: 'Clean and shape canals' },
      { phaseNumber: 2, title: 'Obturation & Build-up', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 1, notes: 'Fill canals + core build-up' },
      { phaseNumber: 3, title: 'Final Crown Restoration', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 2, notes: 'Prep + cement crown' }
    ]
  },
  {
    name: 'Teeth Whitening',
    displayName: 'Teeth Whitening',
    description: 'In-office professional teeth whitening — noticeably brighter smile in a single visit.',
    category: 'Cosmetic',
    duration: 60,
    estimatedPrice: 15000,
    priceDisplay: '₱15,000 per session',
    imageUrl: '/services/teeth-whitening.jpg',
    linkedTreatmentCodes: ['D9972'],
    linkedFormKeys: ['general-treatment-consent'],
    defaultAppointmentType: 'procedure'
  },
  {
    name: 'Wisdom Tooth Removal',
    displayName: 'Wisdom Tooth Removal',
    description: 'Surgical removal of impacted or problem wisdom teeth — comprehensive pre-op and post-op care.',
    category: 'Oral Surgery',
    duration: 75,
    estimatedPrice: 8000,
    priceMin: 8000,
    priceMax: 12000,
    priceDisplay: '₱8,000 – ₱12,000 per tooth',
    imageUrl: '/services/wisdom-tooth.jpg',
    linkedTreatmentCodes: ['D7220', 'D7230'],
    linkedPackageNames: ['Wisdom Tooth Extraction Package'],
    linkedFormKeys: ['general-treatment-consent', 'anesthesia-consent'],
    defaultAppointmentType: 'surgery',
    defaultPlanTitle: 'Wisdom Tooth Surgical Plan',
    defaultPlanPhases: [
      { phaseNumber: 1, title: 'Pre-Op Evaluation', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 1, notes: 'X-rays + medical clearance' },
      { phaseNumber: 2, title: 'Surgical Extraction', status: 'pending', priority: 'high', procedures: [], estimatedVisits: 1, notes: 'Wisdom tooth removal with sedation if needed' },
      { phaseNumber: 3, title: 'Post-Op Follow-Up', status: 'pending', priority: 'medium', procedures: [], estimatedVisits: 1, notes: 'Suture removal + healing check' }
    ]
  },
  {
    name: 'X-ray (Panoramic / Periapical)',
    displayName: 'Dental X-ray',
    description: 'Panoramic and periapical dental X-rays for accurate diagnosis and treatment planning.',
    category: 'Diagnostic',
    duration: 15,
    estimatedPrice: 500,
    priceMin: 500,
    priceMax: 1500,
    priceDisplay: '₱500 – ₱1,500',
    imageUrl: '/services/xray.jpg',
    linkedTreatmentCodes: ['D0220', 'D0274', 'D0330'],
    linkedFormKeys: ['xray-consent'],
    defaultAppointmentType: 'x_ray'
  }
]

async function main() {
  console.log('[seed-services] Starting official services seed...')

  // Build lookup maps
  const treatments = await prisma.treatment.findMany({
    select: { id: true, treatmentCode: true }
  })
  const treatmentCodeToId = new Map(treatments.map(t => [t.treatmentCode, t.id]))

  const packages = await prisma.packageTemplate.findMany({
    select: { id: true, name: true }
  })
  const packageNameToId = new Map(packages.map(p => [p.name, p.id]))

  const officialNames = new Set(SERVICES.map(s => s.name))

  // First pass: upsert official services
  let sortOrder = 0
  for (const svc of SERVICES) {
    const linkedTreatmentIds = (svc.linkedTreatmentCodes || [])
      .map(c => treatmentCodeToId.get(c))
      .filter((id): id is string => Boolean(id))

    const linkedPackageTemplateIds = (svc.linkedPackageNames || [])
      .map(n => packageNameToId.get(n))
      .filter((id): id is string => Boolean(id))

    const data: any = {
      name: svc.name,
      displayName: svc.displayName,
      description: svc.description,
      category: svc.category,
      tagalog: svc.tagalog || null,
      duration: svc.duration,
      isActive: true,
      websiteVisible: true,
      isOfficial: true,
      sortOrder: sortOrder++,
      estimatedPrice: svc.estimatedPrice ?? null,
      priceMin: svc.priceMin ?? null,
      priceMax: svc.priceMax ?? null,
      priceDisplay: svc.priceDisplay || null,
      imageUrl: svc.imageUrl || null,
      linkedTreatmentIds: linkedTreatmentIds.length ? linkedTreatmentIds : null,
      linkedPackageTemplateIds: linkedPackageTemplateIds.length ? linkedPackageTemplateIds : null,
      linkedFormTemplateKeys: (svc.linkedFormKeys && svc.linkedFormKeys.length) ? svc.linkedFormKeys : null,
      defaultAppointmentType: svc.defaultAppointmentType || null,
      defaultPlanTitle: svc.defaultPlanTitle || null,
      defaultPlanPhases: svc.defaultPlanPhases || null
    }

    // Upsert by name
    const existing = await prisma.clinicService.findFirst({ where: { name: svc.name } })
    if (existing) {
      await prisma.clinicService.update({ where: { id: existing.id }, data })
      console.log(`  ✓ updated: ${svc.name} (${linkedTreatmentIds.length} treatments, ${linkedPackageTemplateIds.length} packages)`)
    } else {
      await prisma.clinicService.create({ data })
      console.log(`  + created: ${svc.name}`)
    }
  }

  // Second pass: deactivate (but NEVER delete) non-official services so they
  // stop appearing on website/booking but preserve historical appointment data.
  const nonOfficial = await prisma.clinicService.findMany({
    where: { name: { notIn: Array.from(officialNames) } },
    select: { id: true, name: true }
  })
  for (const s of nonOfficial) {
    await prisma.clinicService.update({
      where: { id: s.id },
      data: { isActive: false, websiteVisible: false, isOfficial: false }
    })
    console.log(`  ✗ deactivated non-official: ${s.name}`)
  }

  console.log(`[seed-services] Done. ${SERVICES.length} official services seeded, ${nonOfficial.length} non-official deactivated.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})

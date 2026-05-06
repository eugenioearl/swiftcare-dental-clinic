import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config()

const prisma = new PrismaClient()

// Common Filipino dental procedures with ADA-compatible codes
const procedures = [
  // Preventive
  { treatmentCode: 'D0150', name: 'Comprehensive Oral Examination', category: 'Preventive', baseCost: 1500, estimatedDurationMinutes: 60, description: 'Complete oral evaluation including radiographs and treatment planning' },
  { treatmentCode: 'D0120', name: 'Periodic Oral Evaluation', category: 'Preventive', baseCost: 800, estimatedDurationMinutes: 30, description: 'Routine periodic oral evaluation for established patients' },
  { treatmentCode: 'D1110', name: 'Prophylaxis - Adult (Oral Cleaning)', category: 'Preventive', baseCost: 2000, estimatedDurationMinutes: 45, description: 'Professional teeth cleaning/oral prophylaxis for adults' },
  { treatmentCode: 'D1120', name: 'Prophylaxis - Child', category: 'Preventive', baseCost: 1200, estimatedDurationMinutes: 30, description: 'Teeth cleaning for children under 14' },
  { treatmentCode: 'D1208', name: 'Topical Fluoride Application', category: 'Preventive', baseCost: 800, estimatedDurationMinutes: 15, description: 'Application of topical fluoride varnish' },
  { treatmentCode: 'D1351', name: 'Dental Sealant (per tooth)', category: 'Preventive', baseCost: 1000, estimatedDurationMinutes: 15, description: 'Pit and fissure sealant application per tooth' },

  // Diagnostic
  { treatmentCode: 'D0220', name: 'Periapical X-ray (First Film)', category: 'Diagnostic', baseCost: 500, estimatedDurationMinutes: 10, description: 'Single periapical radiograph' },
  { treatmentCode: 'D0330', name: 'Panoramic X-ray', category: 'Diagnostic', baseCost: 1500, estimatedDurationMinutes: 15, description: 'Full panoramic radiograph (OPG)' },
  { treatmentCode: 'D0274', name: 'Bitewing X-rays (4 films)', category: 'Diagnostic', baseCost: 1200, estimatedDurationMinutes: 15, description: 'Bitewing radiograph series for caries detection' },

  // Restorative
  { treatmentCode: 'D2140', name: 'Composite Filling - One Surface', category: 'Restorative', baseCost: 2500, estimatedDurationMinutes: 45, description: 'Tooth-colored filling material, single surface' },
  { treatmentCode: 'D2161', name: 'Composite Filling - Two Surface', category: 'Restorative', baseCost: 3500, estimatedDurationMinutes: 60, description: 'Tooth-colored filling material, two surfaces' },
  { treatmentCode: 'D2392', name: 'Composite Filling - Three Surface', category: 'Restorative', baseCost: 4500, estimatedDurationMinutes: 60, description: 'Tooth-colored filling material, three or more surfaces' },
  { treatmentCode: 'D2750', name: 'Porcelain Crown', category: 'Restorative', baseCost: 15000, estimatedDurationMinutes: 90, description: 'Full porcelain/ceramic crown restoration' },
  { treatmentCode: 'D2740', name: 'Crown - Porcelain Fused to Metal (PFM)', category: 'Restorative', baseCost: 12000, estimatedDurationMinutes: 90, description: 'Porcelain fused to metal crown' },
  { treatmentCode: 'D6010', name: 'Dental Implant (Endosseous)', category: 'Restorative', baseCost: 50000, estimatedDurationMinutes: 120, description: 'Surgical placement of dental implant body', isSurgical: true },
  { treatmentCode: 'D6058', name: 'Implant Abutment', category: 'Restorative', baseCost: 15000, estimatedDurationMinutes: 60, description: 'Abutment supported porcelain/ceramic crown' },

  // Endodontic
  { treatmentCode: 'D3310', name: 'Root Canal - Anterior Tooth', category: 'Endodontic', baseCost: 8000, estimatedDurationMinutes: 90, description: 'Endodontic therapy for anterior tooth (1 canal)', requiresAnesthesia: true },
  { treatmentCode: 'D3320', name: 'Root Canal - Premolar', category: 'Endodontic', baseCost: 10000, estimatedDurationMinutes: 120, description: 'Endodontic therapy for premolar tooth (1-2 canals)', requiresAnesthesia: true },
  { treatmentCode: 'D3330', name: 'Root Canal - Molar', category: 'Endodontic', baseCost: 15000, estimatedDurationMinutes: 150, description: 'Endodontic therapy for molar tooth (3-4 canals)', requiresAnesthesia: true },

  // Oral Surgery
  { treatmentCode: 'D7140', name: 'Extraction - Simple (Erupted Tooth)', category: 'Oral Surgery', baseCost: 2500, estimatedDurationMinutes: 30, description: 'Extraction of erupted tooth with routine techniques', isSurgical: true, requiresAnesthesia: true },
  { treatmentCode: 'D7210', name: 'Surgical Extraction', category: 'Oral Surgery', baseCost: 5000, estimatedDurationMinutes: 60, description: 'Surgical extraction requiring bone removal or tooth sectioning', isSurgical: true, requiresAnesthesia: true },
  { treatmentCode: 'D7220', name: 'Impacted Tooth Removal - Soft Tissue', category: 'Oral Surgery', baseCost: 8000, estimatedDurationMinutes: 60, description: 'Removal of soft tissue impacted tooth', isSurgical: true, requiresAnesthesia: true },
  { treatmentCode: 'D7230', name: 'Impacted Tooth Removal - Partial Bony', category: 'Oral Surgery', baseCost: 12000, estimatedDurationMinutes: 90, description: 'Removal of partially bony impacted tooth (wisdom tooth)', isSurgical: true, requiresAnesthesia: true },

  // Periodontic
  { treatmentCode: 'D4341', name: 'Scaling & Root Planing (per quadrant)', category: 'Periodontic', baseCost: 3000, estimatedDurationMinutes: 45, description: 'Deep cleaning with root planing per quadrant', requiresAnesthesia: true },
  { treatmentCode: 'D4910', name: 'Periodontal Maintenance', category: 'Periodontic', baseCost: 2500, estimatedDurationMinutes: 45, description: 'Periodontal maintenance following active periodontal therapy' },

  // Prosthodontic
  { treatmentCode: 'D5110', name: 'Complete Upper Denture', category: 'Prosthodontic', baseCost: 25000, estimatedDurationMinutes: 60, description: 'Complete upper denture fabrication and fitting' },
  { treatmentCode: 'D5120', name: 'Complete Lower Denture', category: 'Prosthodontic', baseCost: 25000, estimatedDurationMinutes: 60, description: 'Complete lower denture fabrication and fitting' },
  { treatmentCode: 'D5213', name: 'Partial Denture - Upper (Flexible)', category: 'Prosthodontic', baseCost: 18000, estimatedDurationMinutes: 60, description: 'Flexible partial upper denture' },
  { treatmentCode: 'D6240', name: 'Fixed Bridge Pontic (PFM)', category: 'Prosthodontic', baseCost: 12000, estimatedDurationMinutes: 90, description: 'Fixed bridge pontic, porcelain fused to metal' },

  // Cosmetic
  { treatmentCode: 'D9972', name: 'In-Office Teeth Whitening', category: 'Cosmetic', baseCost: 15000, estimatedDurationMinutes: 90, description: 'Professional in-office bleaching/whitening treatment' },
  { treatmentCode: 'D2962', name: 'Dental Veneer - Porcelain', category: 'Cosmetic', baseCost: 20000, estimatedDurationMinutes: 90, description: 'Porcelain laminate veneer per tooth' },

  // Orthodontic
  { treatmentCode: 'D8080', name: 'Orthodontic Consultation', category: 'Orthodontic', baseCost: 2000, estimatedDurationMinutes: 45, description: 'Comprehensive orthodontic evaluation and consultation' },
  { treatmentCode: 'D8090', name: 'Braces - Full (Metal)', category: 'Orthodontic', baseCost: 60000, estimatedDurationMinutes: 120, description: 'Full mouth conventional metal braces treatment package' },
  { treatmentCode: 'D8040', name: 'Clear Aligners (Full Treatment)', category: 'Orthodontic', baseCost: 120000, estimatedDurationMinutes: 60, description: 'Full course clear aligner therapy' },

  // Pediatric
  { treatmentCode: 'D2930', name: 'Stainless Steel Crown (Pediatric)', category: 'Pediatric', baseCost: 3500, estimatedDurationMinutes: 45, description: 'Pre-fabricated stainless steel crown for primary teeth' },
  { treatmentCode: 'D3230', name: 'Pulpotomy (Primary Tooth)', category: 'Pediatric', baseCost: 4000, estimatedDurationMinutes: 45, description: 'Pulpotomy for primary/baby tooth', requiresAnesthesia: true },
]

// Common package templates
const templates = [
  {
    name: 'Oral Prophylaxis Package',
    description: 'Standard cleaning visit: exam, x-rays, cleaning, and fluoride application',
    procedures: ['D0120', 'D0274', 'D1110', 'D1208'],
  },
  {
    name: 'Root Canal + Crown Package',
    description: 'Complete root canal treatment with crown restoration for anterior/premolar tooth',
    procedures: ['D0220', 'D3310', 'D2750'],
  },
  {
    name: 'Wisdom Tooth Extraction Package',
    description: 'Surgical extraction of impacted wisdom tooth with pre-op evaluation',
    procedures: ['D0150', 'D0330', 'D7230'],
  },
  {
    name: 'Cosmetic Smile Makeover',
    description: 'Teeth whitening with porcelain veneers (add qty for multiple veneers)',
    procedures: ['D0150', 'D9972', 'D2962'],
  },
  {
    name: 'Complete Denture Package',
    description: 'Full upper and lower dentures with comprehensive exam and x-rays',
    procedures: ['D0150', 'D0330', 'D5110', 'D5120'],
  },
  {
    name: 'Pediatric First Visit Package',
    description: 'Child\'s comprehensive first dental visit with cleaning, fluoride, and sealants',
    procedures: ['D0150', 'D1120', 'D1208', 'D1351'],
  },
]

async function main() {
  console.log('🦷 Seeding procedures & package templates...')

  // Upsert all procedures
  let created = 0
  let updated = 0
  for (const proc of procedures) {
    const result = await prisma.treatment.upsert({
      where: { treatmentCode: proc.treatmentCode },
      update: {
        name: proc.name,
        category: proc.category,
        baseCost: proc.baseCost,
        estimatedDurationMinutes: proc.estimatedDurationMinutes,
        description: proc.description,
        isSurgical: proc.isSurgical || false,
        requiresAnesthesia: proc.requiresAnesthesia || false,
        isActive: true,
      },
      create: {
        treatmentCode: proc.treatmentCode,
        name: proc.name,
        category: proc.category,
        baseCost: proc.baseCost,
        estimatedDurationMinutes: proc.estimatedDurationMinutes,
        description: proc.description,
        isSurgical: proc.isSurgical || false,
        requiresAnesthesia: proc.requiresAnesthesia || false,
        isActive: true,
      }
    })
    // Check if it was created vs updated by comparing dates
    const diff = new Date().getTime() - new Date(result.createdAt).getTime()
    if (diff < 5000) created++
    else updated++
  }
  console.log(`  ✅ Procedures: ${created} created, ${updated} updated (${procedures.length} total)`)

  // Seed package templates
  let tplCreated = 0
  for (const tpl of templates) {
    // Check if template with same name already exists
    const existing = await prisma.packageTemplate.findFirst({ where: { name: tpl.name } })
    if (existing) {
      console.log(`  ⏭️ Template "${tpl.name}" already exists, skipping`)
      continue
    }

    // Look up treatment IDs — handle duplicates (like multiple veneers)
    const procEntries: { treatmentId: string; sortOrder: number; overridePrice?: number }[] = []
    for (let i = 0; i < tpl.procedures.length; i++) {
      const code = tpl.procedures[i]
      const treatment = await prisma.treatment.findUnique({ where: { treatmentCode: code } })
      if (!treatment) {
        console.warn(`  ⚠️ Treatment ${code} not found for template "${tpl.name}", skipping procedure`)
        continue
      }
      procEntries.push({
        treatmentId: treatment.id,
        sortOrder: i,
      })
    }

    await prisma.packageTemplate.create({
      data: {
        name: tpl.name,
        description: tpl.description,
        isActive: true,
        procedures: {
          create: procEntries
        }
      }
    })
    tplCreated++
    console.log(`  ✅ Template "${tpl.name}" created with ${procEntries.length} procedures`)
  }
  console.log(`\n🎉 Done! ${tplCreated} templates created.`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})

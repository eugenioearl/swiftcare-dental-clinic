const LLM_API_URL = 'https://apps.abacus.ai/v1/chat/completions'

interface ExtractionResult {
  extractedData: Record<string, any>
  confidenceScores: Record<string, number>
  summary: string
  classification?: string
  classificationConfidence?: number
}

async function callLLM(messages: any[], responseFormat?: any): Promise<string> {
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) throw new Error('ABACUSAI_API_KEY not configured')

  const body: any = {
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 4000,
    temperature: 0.1,
  }
  if (responseFormat) body.response_format = responseFormat

  const res = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`LLM API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

const DENTAL_EXTRACTION_PROMPT = `You are a dental clinic records and patient intake data extraction specialist. Analyze the provided document (image or text) and extract structured information.

FIRST, classify the document into one of these categories:
- "id" — government-issued IDs (driver license, passport, PhilHealth, SSS, UMID, PRC, national ID, voter's ID, postal ID, senior citizen ID, PWD ID)
- "intake" — patient intake forms, registration forms, medical history forms (non-ID patient-facing forms filled by patient)
- "consent" — consent forms, authorization forms, treatment agreements
- "chart" — dental charts, tooth diagrams, periodontal charts
- "notes" — clinical notes, progress notes, SOAP notes
- "package" — treatment plans, package summaries, cost breakdowns
- "payment" — receipts, invoices, payment records, billing statements
- "prescription" — prescriptions, medication orders
- "xray" — x-ray reports, radiograph interpretations
- "referral" — referral letters, specialist recommendations
- "other" — anything that doesn't fit the above

Then extract the following categories when present:

=== IDENTITY & CONTACT ===
- patient_info:
    - name (full name)
    - first_name, middle_name, last_name (if separable)
    - date_of_birth (YYYY-MM-DD when possible)
    - gender (male/female)
    - phone (mobile)
    - email
    - address (full line) + city, province, zip_code
    - civil_status (single/married/widowed/separated)
    - nationality
    - occupation
    - emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
    - allergies
    - medications
    - preferred_language
- id_info (ONLY when classification is "id" or an ID card is clearly present):
    - id_type (e.g., "Driver's License", "Passport", "PhilHealth", "SSS", "UMID", "PRC", "National ID", "Voter's ID", "Postal ID", "Senior Citizen ID", "PWD ID")
    - id_number
    - issue_date (YYYY-MM-DD)
    - expiry_date (YYYY-MM-DD)
    - issuing_authority / place_of_issue
    - full_name_on_id
    - date_of_birth_on_id
    - address_on_id
    - sex / gender_on_id

=== CLINICAL (dental / medical) ===
- visit_info: visit_date, dentist_name, clinic_name, visit_type
- chief_complaint: reason for visit
- findings: clinical findings, examination notes
- diagnosis: diagnoses made
- treatments: procedures performed with tooth numbers
- prescriptions: medications prescribed with dosage
- follow_up: follow-up instructions and dates
- dental_chart: tooth-specific conditions (tooth number, condition, treatment)
- medical_history: conditions, allergies, medications
- financial_info: amounts, payment methods, balances (if present)
- notes: any additional notes

For each extracted field, provide a confidence score from 0.0 to 1.0.

Return JSON with these keys:
1. "classification": the document category string from the list above
2. "classification_confidence": confidence score 0.0-1.0 for the classification
3. "extracted": object with the extracted data (use null for missing fields)
4. "confidence": object with matching keys and confidence scores (0.0-1.0)
5. "summary": a brief one-line summary of the document

IMPORTANT RULES:
- For an ID document: prefer putting the cardholder's name / DOB / gender / address ALSO under patient_info so it can be used to populate the patient record.
- Use null (not empty strings) for missing fields.
- Be thorough but only extract information that is actually visible in the document.
- Never invent data.`

export async function extractFromImage(base64Data: string, mimeType: string): Promise<ExtractionResult> {
  const messages = [
    { role: 'system', content: DENTAL_EXTRACTION_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Please extract all dental/medical information from this document image.' },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
      ],
    },
  ]

  const raw = await callLLM(messages, { type: 'json_object' })
  return parseExtractionResponse(raw)
}

export async function extractFromPDF(base64Data: string): Promise<ExtractionResult> {
  const messages = [
    { role: 'system', content: DENTAL_EXTRACTION_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Please extract all dental/medical information from this PDF document.' },
        {
          type: 'file',
          file: {
            filename: 'document.pdf',
            file_data: `data:application/pdf;base64,${base64Data}`,
          },
        },
      ],
    },
  ]

  const raw = await callLLM(messages, { type: 'json_object' })
  return parseExtractionResponse(raw)
}

export async function extractFromText(text: string): Promise<ExtractionResult> {
  const messages = [
    { role: 'system', content: DENTAL_EXTRACTION_PROMPT },
    {
      role: 'user',
      content: `Please extract all dental/medical information from this text:\n\n${text}`,
    },
  ]

  const raw = await callLLM(messages, { type: 'json_object' })
  return parseExtractionResponse(raw)
}

function parseExtractionResponse(raw: string): ExtractionResult {
  try {
    const parsed = JSON.parse(raw)
    return {
      extractedData: parsed.extracted || parsed.extractedData || {},
      confidenceScores: parsed.confidence || parsed.confidenceScores || {},
      summary: parsed.summary || 'Data extracted from uploaded document',
      classification: parsed.classification || 'other',
      classificationConfidence: parsed.classification_confidence ?? 0.5,
    }
  } catch {
    return {
      extractedData: {},
      confidenceScores: {},
      summary: 'Failed to parse extraction results',
      classification: 'other',
      classificationConfidence: 0,
    }
  }
}

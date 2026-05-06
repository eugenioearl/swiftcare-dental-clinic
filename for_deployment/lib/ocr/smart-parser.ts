/**
 * Smart Parser — deterministic, regex-driven field extraction from OCR text.
 *
 * The output is intentionally structured but "loose": every field is optional
 * and may be wrong. The UI is responsible for surfacing low-confidence
 * candidates to the user for confirmation. We never write back to the
 * patient record without explicit user approval.
 *
 * Designed to be modular — each extractor is a small pure function and the
 * regex patterns can be expanded over time. Future iterations can plug in
 * an LLM-based extractor that consumes the same `OcrSmartFields` shape.
 */

import { OcrSmartFields } from './types'

// ----- Generic primitive extractors -----

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g

// Philippine mobile formats: 09xx-xxx-xxxx, +639xx xxx xxxx, 639xxxxxxxxx
// Also general international: +xxxxxxxxxxx (10–15 digits)
const PHONE_PATTERNS: RegExp[] = [
  /\+?63[\s\-]?9\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/g,
  /\b09\d{2}[\s\-]?\d{3}[\s\-]?\d{4}\b/g,
  /\+\d{10,15}\b/g,
  /\b\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{4}\b/g,
]

// Dates in many formats: 1990-05-21, 05/21/1990, 21 May 1990, May 21, 1990
const DATE_PATTERNS: RegExp[] = [
  /\b(?:19|20)\d{2}[\-\/.](?:0?[1-9]|1[0-2])[\-\/.](?:0?[1-9]|[12]\d|3[01])\b/g,           // 2024-01-15 / 2024.01.15
  /\b(?:0?[1-9]|1[0-2])[\-\/.](?:0?[1-9]|[12]\d|3[01])[\-\/.](?:19|20)\d{2}\b/g,           // 01/15/2024 or 01-15-2024
  /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/gi, // 21 May 1990
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2}\b/gi, // May 21, 1990
]

// Currency amounts: ₱ 1,234.56 / PHP 1234 / Php 1,234 / $ 1,234.56 / 1,234.56
const AMOUNT_PATTERNS: RegExp[] = [
  /(?:\u20b1|PHP|Php|P\s*HP|\$|USD|US\$)\s*([\d,]+(?:\.\d{1,2})?)\b/g,
  /\b([\d]{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/g,
]

// ----- Helpers -----

function normalizeAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/** Find a value on the line(s) following an exact label, e.g.
 *  "Date of Birth: 1990-05-21" → "1990-05-21".
 */
function valueAfterLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\n)\\s*(?:${label})\\s*[:\\-–]?\\s*([^\n]+)`, 'i')
    const m = text.match(re)
    if (m && m[1]) {
      const v = m[1].trim().replace(/[\.\;\,]+$/, '')
      if (v && v.length >= 2 && v.length <= 200) return v
    }
  }
  return undefined
}

function extractEmails(text: string): string[] {
  return unique((text.match(EMAIL_RE) || []).map(s => s.toLowerCase()))
}

function extractPhones(text: string): string[] {
  const out: string[] = []
  for (const p of PHONE_PATTERNS) {
    const m = text.match(p)
    if (m) out.push(...m)
  }
  // Deduplicate by stripped digits
  const seen = new Set<string>()
  return out.filter(s => {
    const key = s.replace(/\D/g, '')
    if (seen.has(key)) return false
    seen.add(key)
    return key.length >= 7 && key.length <= 15
  })
}

function extractDates(text: string): string[] {
  const out: string[] = []
  for (const p of DATE_PATTERNS) {
    const m = text.match(p)
    if (m) out.push(...m)
  }
  return unique(out.map(s => s.trim()))
}

function extractAmounts(text: string): number[] {
  const out: number[] = []
  // Pattern 1: explicit currency-tagged
  const re1 = /(?:\u20b1|PHP|Php|P\s*HP|\$|USD|US\$)\s*([\d,]+(?:\.\d{1,2})?)/g
  let mm: RegExpExecArray | null
  while ((mm = re1.exec(text)) !== null) {
    const v = normalizeAmount(mm[1])
    if (v !== null && v > 0) out.push(v)
  }
  // Pattern 2: large grouped numbers (heuristic: only count if formatted with thousands)
  const re2 = /\b([\d]{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/g
  while ((mm = re2.exec(text)) !== null) {
    const v = normalizeAmount(mm[1])
    if (v !== null && v > 0) out.push(v)
  }
  return unique(out)
}

// ----- Domain-specific extractors -----

function extractFullName(text: string): { full?: string; first?: string; last?: string } {
  // Common English form labels
  const fullName = valueAfterLabel(text, [
    'Full\\s*Name',
    'Patient\\s*Name',
    "Patient'?s?\\s*Name",
    'Name\\s*of\\s*Patient',
    'Name',
  ])
  if (!fullName) return {}

  // Reject obvious garbage: must contain at least one alpha and look like a name
  if (!/[A-Za-z]/.test(fullName)) return {}
  if (fullName.length > 80) return {}

  // Prefer "Last, First" if comma is present
  if (fullName.includes(',')) {
    const [last, rest] = fullName.split(',', 2).map(s => s.trim())
    const first = (rest || '').split(/\s+/)[0] || ''
    return { full: fullName, last, first }
  }
  // Fall back to last token = last name
  const tokens = fullName.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    return { full: fullName, first: tokens[0], last: tokens[tokens.length - 1] }
  }
  return { full: fullName }
}

function extractDob(text: string): string | undefined {
  return valueAfterLabel(text, [
    'Date\\s*of\\s*Birth',
    'DOB',
    'Birth\\s*Date',
    'Birthday',
    'Date\\s*Born',
  ])
}

function extractAddress(text: string): string | undefined {
  return valueAfterLabel(text, [
    'Address',
    'Home\\s*Address',
    'Residence',
    'Mailing\\s*Address',
  ])
}

function extractProcedure(text: string): { name?: string; notes?: string } {
  const name = valueAfterLabel(text, [
    'Procedure',
    'Treatment',
    'Service',
    'Diagnosis',
  ])
  // Rough heuristic: capture a chunk of text following "Notes:" / "Remarks:"
  const notesMatch = text.match(/(?:^|\n)\s*(?:Notes|Remarks|Comments|Findings)\s*[:\-–]?\s*([\s\S]{1,400}?)(?:\n\s*\n|$)/i)
  return { name, notes: notesMatch?.[1]?.trim() }
}

function extractToothNumbers(text: string): string[] {
  // Two-digit tooth IDs (Universal/FDI) seen in dental notes — 11..18, 21..28, 31..38, 41..48
  const found = (text.match(/\b(?:1[1-8]|2[1-8]|3[1-8]|4[1-8])\b/g) || []) as string[]
  return unique(found)
}

function extractGeneralChartNotes(text: string): string | undefined {
  // Look for headers that tend to introduce chart notes
  const m = text.match(/(?:^|\n)\s*(?:Chart\s*Notes?|General\s*Notes?|Clinical\s*Notes?)\s*[:\-–]?\s*([\s\S]{1,800}?)(?:\n\s*\n|$)/i)
  return m?.[1]?.trim()
}

function extractOrthoChartNotes(text: string): string | undefined {
  const m = text.match(/(?:^|\n)\s*(?:Ortho\s*Notes?|Orthodontic\s*Notes?|Bracket\s*Notes?|Wire\s*Notes?)\s*[:\-–]?\s*([\s\S]{1,800}?)(?:\n\s*\n|$)/i)
  return m?.[1]?.trim()
}

function extractConsent(text: string): { type?: string; signedDate?: string } {
  let type: string | undefined
  if (/consent\s+to\s+treat/i.test(text)) type = 'Consent to Treat'
  else if (/informed\s+consent/i.test(text)) type = 'Informed Consent'
  else if (/release\s+of\s+(?:records|information)/i.test(text)) type = 'Records Release'
  else if (/financial\s+consent/i.test(text)) type = 'Financial Consent'
  else if (/anesthesia\s+consent/i.test(text)) type = 'Anesthesia Consent'
  const signedDate = valueAfterLabel(text, ['Date\\s*Signed', 'Signed\\s*on', 'Signed\\s*Date'])
  return { type, signedDate }
}

function extractPaymentDetails(text: string): {
  invoiceNumber?: string
  receiptNumber?: string
  paymentMethod?: string
  primaryAmount?: number
} {
  const invoiceNumber = valueAfterLabel(text, [
    'Invoice\\s*(?:No|Number|#)',
    'INV\\s*(?:No|Number|#)',
  ])
  const receiptNumber = valueAfterLabel(text, [
    'Receipt\\s*(?:No|Number|#)',
    'OR\\s*(?:No|Number|#)',
    'Official\\s*Receipt',
  ])
  const paymentMethod = valueAfterLabel(text, [
    'Payment\\s*Method',
    'Mode\\s*of\\s*Payment',
    'Paid\\s*by',
    'Method',
  ])
  const totalLine = text.match(/(?:^|\n)\s*(?:Total(?:\s*Amount)?|Amount\s*Due|Amount\s*Paid|Grand\s*Total)\s*[:\-–]?\s*(?:\u20b1|PHP|Php|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i)
  const primaryAmount = totalLine ? normalizeAmount(totalLine[1]) ?? undefined : undefined
  return { invoiceNumber, receiptNumber, paymentMethod, primaryAmount }
}

// ----- Public API -----

export function parseSmartFields(rawText: string): OcrSmartFields {
  const text = (rawText || '').replace(/\r\n/g, '\n')
  if (!text.trim()) return {}

  const emails = extractEmails(text)
  const phones = extractPhones(text)
  const dates = extractDates(text)
  const amounts = extractAmounts(text)

  const name = extractFullName(text)
  const proc = extractProcedure(text)
  const consent = extractConsent(text)
  const pay = extractPaymentDetails(text)

  const fields: OcrSmartFields = {
    fullName: name.full,
    firstName: name.first,
    lastName: name.last,
    dob: extractDob(text),
    email: emails[0],
    emails: emails.length > 0 ? emails : undefined,
    mobileNumber: phones[0],
    phones: phones.length > 0 ? phones : undefined,
    address: extractAddress(text),
    procedure: proc.name,
    procedureNotes: proc.notes,
    generalChartNotes: extractGeneralChartNotes(text),
    orthoChartNotes: extractOrthoChartNotes(text),
    toothNumbers: extractToothNumbers(text).length > 0 ? extractToothNumbers(text) : undefined,
    consentType: consent.type,
    signedDate: consent.signedDate,
    amount: pay.primaryAmount ?? amounts[0],
    amountsAll: amounts.length > 0 ? amounts : undefined,
    paymentMethod: pay.paymentMethod,
    invoiceNumber: pay.invoiceNumber,
    receiptNumber: pay.receiptNumber,
    dates: dates.length > 0 ? dates : undefined,
  }

  // Strip undefined / empty
  for (const k of Object.keys(fields) as (keyof OcrSmartFields)[]) {
    const v = fields[k]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      delete (fields as any)[k]
    }
  }
  return fields
}

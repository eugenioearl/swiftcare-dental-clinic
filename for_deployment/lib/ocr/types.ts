/**
 * OCR (Tesseract) — Shared TypeScript types.
 *
 * The OCR layer is intentionally provider-agnostic. The service exposes a
 * thin contract via `OcrServiceResult` so we can later swap Tesseract for
 * another backend (e.g. AWS Textract, Google Vision) without touching the
 * UI or the API handlers.
 */

export type OcrStatus =
  | 'pending'      // Queued, not yet started
  | 'processing'   // Currently running
  | 'completed'    // Finished successfully
  | 'failed'       // Errored out — see ocrError
  | 'skipped'      // File type not supported (e.g. PDFs in current build)

export interface OcrSmartFields {
  // Patient-level identity hints
  fullName?: string
  firstName?: string
  lastName?: string
  dob?: string
  email?: string
  mobileNumber?: string
  address?: string

  // Clinical / chart hints
  procedure?: string
  procedureNotes?: string
  generalChartNotes?: string
  orthoChartNotes?: string
  toothNumbers?: string[]

  // Forms / consents hints
  consentType?: string
  signedDate?: string

  // Payment hints
  amount?: number
  amountsAll?: number[]
  paymentMethod?: string
  invoiceNumber?: string
  receiptNumber?: string

  // Generic extracted lists
  dates?: string[]
  emails?: string[]
  phones?: string[]
}

export interface OcrServiceResult {
  status: OcrStatus
  text: string
  confidence: number | null   // 0-100, or null if unknown
  language: string
  fields: OcrSmartFields
  processedAt: string         // ISO timestamp
  durationMs: number
  error?: string
}

/**
 * Tesseract OCR Service
 *
 * Centralized helper that runs Tesseract.js against a remote (S3) file URL
 * or a raw Buffer, and returns a normalized `OcrServiceResult`.
 *
 * Design notes
 *  - Runs ONLY in Node (server-side). Never imported from a 'use client' file.
 *  - Worker is short-lived per call: simple, predictable memory footprint.
 *    For higher throughput we can later move to a pooled scheduler.
 *  - Heavy logging is intentionally kept generic; we never log the raw
 *    extracted text or any value that may contain PHI.
 *  - Times out after `OCR_TIMEOUT_MS` so a corrupt image cannot hang a route.
 */

import { OcrServiceResult, OcrSmartFields } from './types'
import { parseSmartFields } from './smart-parser'

// Avoid importing tesseract.js at module load — it pulls heavy deps. Use a
// dynamic import inside the run function.
type TesseractModule = typeof import('tesseract.js')

const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 90_000)
const DEFAULT_LANG = process.env.OCR_LANGUAGES || 'eng'

export interface RunOcrOptions {
  /** Tesseract language code(s), e.g. "eng" or "eng+fil". */
  language?: string
  /** Hard timeout in milliseconds. */
  timeoutMs?: number
}

function shouldRunOcr(mimeType: string | null | undefined, fileName: string | null | undefined): boolean {
  const mime = (mimeType || '').toLowerCase()
  const name = (fileName || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  if (/\.(png|jpg|jpeg|webp|bmp|tiff?)$/i.test(name)) return true
  return false
}

function isPdf(mimeType: string | null | undefined, fileName: string | null | undefined): boolean {
  const mime = (mimeType || '').toLowerCase()
  const name = (fileName || '').toLowerCase()
  return mime === 'application/pdf' || name.endsWith('.pdf')
}

/**
 * Decide whether OCR is supported for the given file.
 * Useful from API handlers: if not supported, mark as 'skipped' and return.
 */
export function getOcrEligibility(mimeType: string | null | undefined, fileName: string | null | undefined): {
  supported: boolean
  reason?: string
} {
  if (shouldRunOcr(mimeType, fileName)) return { supported: true }
  if (isPdf(mimeType, fileName)) {
    return { supported: false, reason: 'PDF OCR is not enabled in the current build. Convert the page to an image and re-upload.' }
  }
  return { supported: false, reason: 'OCR is only supported for image files (PNG, JPG, JPEG, WEBP, BMP, TIFF).' }
}

function race<T>(promise: Promise<T>, timeoutMs: number, onTimeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(onTimeoutMessage)), timeoutMs)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download file (status ${res.status})`)
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

/**
 * Run Tesseract OCR against a Buffer.
 */
export async function runOcrOnBuffer(
  buffer: Buffer,
  meta: { mimeType?: string; fileName?: string },
  options: RunOcrOptions = {},
): Promise<OcrServiceResult> {
  const language = options.language || DEFAULT_LANG
  const timeoutMs = options.timeoutMs ?? OCR_TIMEOUT_MS
  const start = Date.now()
  const processedAt = new Date().toISOString()

  const eligibility = getOcrEligibility(meta.mimeType, meta.fileName)
  if (!eligibility.supported) {
    return {
      status: 'skipped',
      text: '',
      confidence: null,
      language,
      fields: {},
      processedAt,
      durationMs: 0,
      error: eligibility.reason,
    }
  }

  let tesseract: TesseractModule
  try {
    tesseract = (await import('tesseract.js')) as unknown as TesseractModule
  } catch (e: any) {
    return {
      status: 'failed',
      text: '',
      confidence: null,
      language,
      fields: {},
      processedAt,
      durationMs: Date.now() - start,
      error: 'OCR engine unavailable: ' + (e?.message || 'tesseract.js not installed'),
    }
  }

  let worker: Awaited<ReturnType<TesseractModule['createWorker']>> | null = null
  try {
    worker = await race(
      tesseract.createWorker(language),
      timeoutMs,
      'OCR worker initialization timed out',
    )

    const result = await race(
      worker.recognize(buffer),
      timeoutMs,
      'OCR recognition timed out',
    )

    const text = (result?.data?.text || '').trim()
    const confidence = typeof result?.data?.confidence === 'number'
      ? Math.max(0, Math.min(100, result.data.confidence))
      : null

    let fields: OcrSmartFields = {}
    try {
      fields = parseSmartFields(text)
    } catch (parseErr) {
      // Parser failures are non-fatal — we still return the raw text.
      console.warn('[OCR] smart-parser failed:', (parseErr as Error)?.message)
    }

    return {
      status: 'completed',
      text,
      confidence,
      language,
      fields,
      processedAt,
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    // Never include the raw text in the error log.
    console.error('[OCR] failed:', err?.message || err)
    return {
      status: 'failed',
      text: '',
      confidence: null,
      language,
      fields: {},
      processedAt,
      durationMs: Date.now() - start,
      error: (err?.message || 'Unknown OCR error').slice(0, 480),
    }
  } finally {
    if (worker) {
      try { await worker.terminate() } catch { /* ignore */ }
    }
  }
}

/**
 * Run Tesseract OCR by URL (S3 signed URL or any HTTP fetchable URL).
 */
export async function runOcrFromUrl(
  url: string,
  meta: { mimeType?: string; fileName?: string },
  options: RunOcrOptions = {},
): Promise<OcrServiceResult> {
  const eligibility = getOcrEligibility(meta.mimeType, meta.fileName)
  if (!eligibility.supported) {
    return {
      status: 'skipped',
      text: '',
      confidence: null,
      language: options.language || DEFAULT_LANG,
      fields: {},
      processedAt: new Date().toISOString(),
      durationMs: 0,
      error: eligibility.reason,
    }
  }
  let buffer: Buffer
  try {
    buffer = await fetchAsBuffer(url)
  } catch (e: any) {
    return {
      status: 'failed',
      text: '',
      confidence: null,
      language: options.language || DEFAULT_LANG,
      fields: {},
      processedAt: new Date().toISOString(),
      durationMs: 0,
      error: 'Could not download file for OCR: ' + (e?.message || 'unknown error'),
    }
  }
  return runOcrOnBuffer(buffer, meta, options)
}

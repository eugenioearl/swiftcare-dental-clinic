/**
 * OCR module — public API.
 *
 * Import from here so callers don't reach into the internal files.
 */
export * from './types'
export { runOcrOnBuffer, runOcrFromUrl, getOcrEligibility } from './tesseract-service'
export { parseSmartFields } from './smart-parser'

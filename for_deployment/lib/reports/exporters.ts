// Exporters — convert rows/summary into CSV, XLSX, PDF
import * as XLSX from 'xlsx'

// --------- CSV ---------
export function toCSV(headers: string[], rows: (string | number)[][]): Buffer {
  const escape = (v: any) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines: string[] = []
  lines.push(headers.map(escape).join(','))
  rows.forEach(r => lines.push(r.map(escape).join(',')))
  return Buffer.from('\uFEFF' + lines.join('\n'), 'utf8')
}

// --------- XLSX ---------
export function toXLSX(headers: string[], rows: (string | number)[][], sheetName = 'Report'): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  // Auto column widths
  const widths = headers.map((h, i) => {
    const max = Math.max(
      String(h).length,
      ...rows.slice(0, 200).map(r => String(r[i] ?? '').length)
    )
    return { wch: Math.min(Math.max(max + 2, 10), 50) }
  })
  ws['!cols'] = widths
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buf)
}

// --------- HTML (for PDF) ---------
export function buildReportHTML(opts: {
  title: string
  subtitle?: string
  generatedAt: string
  headers: string[]
  rows: (string | number)[][]
  summary?: Record<string, any>
  totalRows: number
}): string {
  const { title, subtitle, generatedAt, headers, rows, summary, totalRows } = opts

  const summaryHTML = summary
    ? `
      <div class="summary">
        <h2>Summary</h2>
        <table class="summary-table">
          ${Object.entries(summary).map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
            if (typeof v === 'object' && v !== null) {
              const subrows = Object.entries(v).map(([sk, sv]) => `<tr><td class="sub-label">${sk}</td><td>${sv}</td></tr>`).join('')
              return `<tr><td class="summary-label" rowspan="${Object.keys(v).length + 1}">${label}</td></tr>${subrows}`
            }
            return `<tr><td class="summary-label">${label}</td><td>${v}</td></tr>`
          }).join('')}
        </table>
      </div>
    `
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHTML(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 28px; font-size: 11px; }
    header { border-bottom: 3px solid #2D9DA8; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { color: #2D9DA8; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .subbrand { color: #666; font-size: 11px; margin-top: 2px; }
    h1 { font-size: 20px; margin: 14px 0 4px; color: #111; }
    .subtitle { color: #555; font-size: 11px; margin-bottom: 4px; }
    .meta { color: #888; font-size: 10px; }
    h2 { font-size: 14px; margin: 22px 0 10px; color: #2D9DA8; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .summary-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    .summary-label { font-weight: 600; color: #333; width: 35%; vertical-align: top; }
    .sub-label { padding-left: 24px !important; color: #555; }
    table.data { width: 100%; border-collapse: collapse; font-size: 10px; }
    table.data th { background: #2D9DA8; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; font-size: 10px; }
    table.data td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    .totals { margin-top: 14px; padding: 10px; background: #f0fdfa; border-left: 4px solid #22B573; color: #064e3b; font-weight: 600; }
    footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #888; font-size: 9px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <header>
    <div class="brand">SwiftCare Dental Clinic</div>
    <div class="subbrand">Modern dental care, exceptional service</div>
    <h1>${escapeHTML(title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHTML(subtitle)}</div>` : ''}
    <div class="meta">Generated: ${generatedAt} \u2022 Records: ${totalRows}</div>
  </header>

  ${summaryHTML}

  <h2>Records</h2>
  <table class="data">
    <thead>
      <tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>${r.map(c => `<td>${escapeHTML(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>

  <footer>
    <div>SwiftCare Dental Clinic \u2022 www.swiftcaredental.site</div>
    <div>Confidential</div>
  </footer>
</body>
</html>
  `
}

function escapeHTML(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// --------- PDF via Abacus HTML2PDF API ---------
export async function toPDF(html: string): Promise<Buffer> {
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) throw new Error('ABACUSAI_API_KEY not configured')

  const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      html_content: html,
      pdf_options: {
        format: 'A4',
        print_background: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      },
      base_url: process.env.NEXTAUTH_URL || '',
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`HTML2PDF create failed: ${createRes.status} ${err}`)
  }

  const { request_id } = await createRes.json()
  if (!request_id) throw new Error('HTML2PDF: no request_id returned')

  // Poll for completion (up to 120 seconds)
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(r => setTimeout(r, 1000))
    const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    })
    const statusResult = await statusRes.json()
    const status = statusResult?.status || 'FAILED'

    if (status === 'SUCCESS' && statusResult?.result?.result) {
      return Buffer.from(statusResult.result.result, 'base64')
    }
    if (status === 'FAILED') {
      throw new Error(`PDF generation failed: ${JSON.stringify(statusResult)}`)
    }
  }
  throw new Error('PDF generation timed out')
}

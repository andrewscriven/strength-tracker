/**
 * Google Sheets access is **read-only**.
 *
 * This module only issues HTTP GET to:
 * - `GET /v4/spreadsheets/{id}` (metadata; `fields` mask limits payload)
 * - `GET .../values:batchGet` (cell values)
 *
 * There are no calls to batchUpdate, append, clear, or any other mutating endpoint.
 */
import { parseWeekGrid, weekNumberFromTitle } from './parseWeekGrid'
import type { ParsedWeekPayload, SheetDataPayload, SheetTabPayload } from './sheetTypes'

const DEFAULT_SPREADSHEET_ID = '1Ux426fnSNs_w6M_yEECAOJ332XJ9GdoZe_CTYomCGHA'

const SHEETS_HOST = 'sheets.googleapis.com'

/** Runtime guard so future edits cannot accidentally point at a write endpoint. */
function assertReadOnlySheetsGet(url: string): void {
  const u = new URL(url)
  if (u.hostname !== SHEETS_HOST) {
    throw new Error(`Read-only Sheets policy: unexpected host ${u.hostname}`)
  }
  const p = u.pathname
  const meta = /^\/v4\/spreadsheets\/[^/]+$/.test(p)
  const batchGet = /^\/v4\/spreadsheets\/[^/]+\/values:batchGet$/.test(p)
  if (!meta && !batchGet) {
    throw new Error(`Read-only Sheets policy: disallowed path ${p}`)
  }
}

function sheetsGet(url: string): Promise<Response> {
  assertReadOnlySheetsGet(url)
  return fetch(url, { method: 'GET' })
}

function toGrid(values: unknown[][] | null | undefined): string[][] {
  if (!values || !Array.isArray(values)) return []
  return values.map((row) => (Array.isArray(row) ? row.map((c) => (c == null ? '' : String(c))) : []))
}

function escapeSheetRange(title: string): string {
  const escaped = `'${String(title).replace(/'/g, "''")}'`
  return `${escaped}!A1:ZZ500`
}

/** Fetch full spreadsheet metadata + all tab grids (chunked batchGet). Server/Lambda only — requires API key. */
export async function fetchSheetDataFromGoogle(
  apiKey: string,
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
): Promise<SheetDataPayload> {
  const metaUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`)
  metaUrl.searchParams.set('key', apiKey)
  metaUrl.searchParams.set('fields', 'properties.title,sheets(properties(sheetId,title))')

  const metaRes = await sheetsGet(metaUrl.toString())
  if (!metaRes.ok) {
    const t = await metaRes.text()
    throw new Error(`Sheets metadata ${metaRes.status}: ${t.slice(0, 240)}`)
  }
  const meta = (await metaRes.json()) as {
    properties?: { title?: string }
    sheets?: { properties?: { sheetId?: number; title?: string } }[]
  }

  const sheets = meta.sheets ?? []
  const ranges = sheets.map((s) => escapeSheetRange(s.properties?.title ?? 'Sheet1'))

  const valueRanges: { range?: string; values?: unknown[][] }[] = []
  const chunk = 8
  for (let i = 0; i < ranges.length; i += chunk) {
    const slice = ranges.slice(i, i + chunk)
    const batchUrl = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`,
    )
    batchUrl.searchParams.set('key', apiKey)
    for (const r of slice) {
      batchUrl.searchParams.append('ranges', r)
    }
    const batchRes = await sheetsGet(batchUrl.toString())
    if (!batchRes.ok) {
      const t = await batchRes.text()
      throw new Error(`Sheets batchGet ${batchRes.status}: ${t.slice(0, 240)}`)
    }
    const batch = (await batchRes.json()) as {
      valueRanges?: { range?: string; values?: unknown[][] }[]
    }
    valueRanges.push(...(batch.valueRanges ?? []))
  }

  const tabs: SheetTabPayload[] = []
  const parsedWeeks: ParsedWeekPayload[] = []

  for (let i = 0; i < sheets.length; i++) {
    const props = sheets[i]?.properties
    const sheetId = props?.sheetId ?? i
    const title = props?.title ?? `Sheet${i + 1}`
    const grid = toGrid(valueRanges[i]?.values)

    const wn = weekNumberFromTitle(title)
    const kind: SheetTabPayload['kind'] = wn != null ? 'week' : 'content'
    tabs.push({ kind, sheetId, title, weekNumber: wn, grid })

    if (wn != null) {
      const days = parseWeekGrid(grid)
      if (days && days.length > 0) {
        parsedWeeks.push({ weekNumber: wn, sheetId, title, days })
      }
    }
  }

  parsedWeeks.sort((a, b) => a.weekNumber - b.weekNumber)

  return {
    fetchedAt: new Date().toISOString(),
    spreadsheetId,
    tabs,
    parsedWeeks,
  }
}

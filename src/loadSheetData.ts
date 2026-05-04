import { parseWeekGrid } from './parseWeekGrid'
import type { ParsedWeekPayload, SheetDataPayload, SheetTabPayload } from './sheetTypes'

export const SHEET_DATA_PATH = 'data/latest.json'

export function normalizeSheetData(raw: unknown): SheetDataPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.spreadsheetId !== 'string' || !Array.isArray(o.tabs)) return null

  const tabs = o.tabs as SheetTabPayload[]
  let parsedWeeks = Array.isArray(o.parsedWeeks) ? [...(o.parsedWeeks as ParsedWeekPayload[])] : []

  for (const t of tabs) {
    if (t.kind !== 'week' || t.weekNumber == null) continue
    if (parsedWeeks.some((p) => p.weekNumber === t.weekNumber)) continue
    const days = parseWeekGrid(t.grid)
    if (days && days.length > 0) {
      parsedWeeks.push({
        weekNumber: t.weekNumber,
        sheetId: t.sheetId,
        title: t.title,
        days,
      })
    }
  }
  parsedWeeks.sort((a, b) => a.weekNumber - b.weekNumber)

  return {
    fetchedAt: typeof o.fetchedAt === 'string' ? o.fetchedAt : new Date().toISOString(),
    spreadsheetId: o.spreadsheetId,
    tabs,
    parsedWeeks,
  }
}

function joinBase(baseUrl: string, path: string): string {
  const b = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${b}${path.replace(/^\//, '')}`
}

/** Load published JSON (from S3/CloudFront after deploy, or from /public at dev). */
export async function fetchLatestSheetData(baseUrl: string): Promise<SheetDataPayload | null> {
  const url = `${joinBase(baseUrl, SHEET_DATA_PATH)}?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const raw = await res.json()
  return normalizeSheetData(raw)
}

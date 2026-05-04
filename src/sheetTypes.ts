import type { DayDef } from './program'

export type SheetTabKind = 'week' | 'content'

export interface SheetTabPayload {
  kind: SheetTabKind
  /** Google sheet id (gid). */
  sheetId: number
  title: string
  weekNumber: number | null
  /** Raw cell values for display or re-parse. */
  grid: string[][]
}

export interface ParsedWeekPayload {
  weekNumber: number
  sheetId: number
  title: string
  days: DayDef[]
}

export interface SheetDataPayload {
  fetchedAt: string
  spreadsheetId: string
  tabs: SheetTabPayload[]
  parsedWeeks: ParsedWeekPayload[]
}

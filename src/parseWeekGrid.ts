import type { CompoundDef, DayDef, RoundDef, RoundField, SessionDef } from './program'

function norm(v: unknown): string {
  if (v == null) return ''
  return String(v).replace(/\u00a0/g, ' ').trim()
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Detect "Week 3", "W3", or "… Week 8" style titles from tab title. */
export function weekNumberFromTitle(title: string): number | null {
  const t = title.trim()
  let m = t.match(/\bweek\s*(\d{1,2})\b/i)
  if (m) return clampWeek(Number(m[1]))
  m = t.match(/\bw\s*(\d{1,2})\b/i)
  if (m) return clampWeek(Number(m[1]))
  m = t.match(/week\s*(\d{1,2})/i)
  if (m) return clampWeek(Number(m[1]))
  return null
}

function clampWeek(n: number): number | null {
  if (!Number.isFinite(n) || n < 1 || n > 52) return null
  return n
}

function inferFieldsFromHeaderRow(row: string[]): RoundField[] {
  const fields: RoundField[] = []
  for (let i = 1; i < row.length; i++) {
    const h = norm(row[i]).toLowerCase()
    if (!h) continue
    if (h === 'load' || h.startsWith('load')) fields.push('load')
    else if (h === 'reps' || h.startsWith('rep')) fields.push('reps')
    else if (h === 'notes' || h.startsWith('note')) fields.push('notes')
  }
  if (fields.length === 0) return ['load', 'reps', 'notes']
  return fields
}

function sessionKeyFromTitle(title: string, idx: number): string {
  const s = slug(title)
  return s || `session-${idx}`
}

/**
 * Parse a single sheet grid (A1:...) into training days when it follows the expected template.
 * Returns null if no recognizable session blocks found.
 */
export function parseWeekGrid(grid: string[][]): DayDef[] | null {
  if (!grid || grid.length === 0) return null

  const dayMap = new Map<number, DayDef>()
  let sessionIdx = 0
  let currentSession: SessionDef | null = null
  let currentCompound: CompoundDef | null = null
  let pendingFields: RoundField[] | null = null

  function ensureDay(dayNum: number): DayDef {
    let d = dayMap.get(dayNum)
    if (!d) {
      d = { day: dayNum as 1 | 2 | 3, sessions: [] }
      dayMap.set(dayNum, d)
    }
    return d
  }

  for (const rawRow of grid) {
    const row = rawRow.map((c) => norm(c))
    const a = row[0] ?? ''
    if (!a) continue
    if (/^please do not write/i.test(a)) continue
    if (/^lf3 strength phase/i.test(a)) continue

    const mHeavy = a.match(/strong\s*heavy\s*[–-]\s*day\s*(\d)/i)
    const mShred = a.match(/strong\s*shred\s*[–-]\s*day\s*(\d)/i)
    const mReps = a.match(/strong\s*reps?\s*[–-]\s*day\s*(\d)/i)
    if (mHeavy || mShred || mReps) {
      const dayNum = Number(mHeavy?.[1] ?? mShred?.[1] ?? mReps?.[1])
      if (!dayNum || dayNum < 1 || dayNum > 3) continue
      const day = ensureDay(dayNum)
      currentSession = {
        key: sessionKeyFromTitle(a, sessionIdx++),
        title: a,
        compounds: [],
      }
      day.sessions.push(currentSession)
      currentCompound = null
      pendingFields = null
      continue
    }

    if (!currentSession) continue

    if (/^compound\s*\d+/i.test(a)) {
      currentCompound = {
        key: slug(a) || `c${currentSession.compounds.length + 1}`,
        label: a,
        rounds: [],
      }
      currentSession.compounds.push(currentCompound)
      pendingFields = null
      continue
    }

    if (!currentCompound) continue

    const isHeader =
      /^round$/i.test(a) &&
      row.slice(1).some((c) => /load|rep|note/i.test(c))

    if (isHeader) {
      pendingFields = inferFieldsFromHeaderRow(row)
      continue
    }

    if (!pendingFields || pendingFields.length === 0) continue

    const rd: RoundDef = {
      key: slug(a) || `r-${currentCompound.rounds.length}`,
      label: a,
      fields: [...pendingFields],
    }
    currentCompound.rounds.push(rd)
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
    .filter((d) => d.sessions.length > 0)

  if (days.length === 0) return null
  return days
}

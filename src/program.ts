/** Strength phase week layout derived from the seeded public sheet template. */

export type RoundField = 'load' | 'reps' | 'notes'

export interface RoundDef {
  key: string
  label: string
  fields: RoundField[]
}

export interface CompoundDef {
  key: string
  label: string
  rounds: RoundDef[]
}

export interface SessionDef {
  key: string
  title: string
  compounds: CompoundDef[]
}

export interface DayDef {
  day: 1 | 2 | 3
  sessions: SessionDef[]
}

const heavyRounds = (): RoundDef[] =>
  ['WU1', 'WU2', 'Build 1', 'Build 2', 'Top 1', 'Top 2', 'Top 3'].map((label) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    fields: ['load', 'reps', 'notes'] as RoundField[],
  }))

const shredRounds = (): RoundDef[] =>
  ['WU', 'Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round 6'].map((label) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    fields: ['load', 'notes'] as RoundField[],
  }))

const repsRounds = (): RoundDef[] =>
  ['WU', 'Round 1', 'Round 2', 'Round 3', 'Round 4'].map((label) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    fields: ['load', 'reps', 'notes'] as RoundField[],
  }))

function heavySession(day: 1 | 2 | 3): SessionDef {
  return {
    key: `heavy-d${day}`,
    title: `Strong Heavy – Day ${day}`,
    compounds: [
      { key: 'c1', label: 'Compound 1', rounds: heavyRounds() },
      { key: 'c2', label: 'Compound 2', rounds: heavyRounds() },
    ],
  }
}

function shredSession(day: 1 | 2): SessionDef {
  return {
    key: `shred-d${day}`,
    title: `Strong Shred – Day ${day}`,
    compounds: [
      { key: 'c1', label: 'Compound 1', rounds: shredRounds() },
      { key: 'c2', label: 'Compound 2', rounds: shredRounds() },
      { key: 'c3', label: 'Compound 3', rounds: shredRounds() },
    ],
  }
}

function repsSession(day: 1 | 2 | 3): SessionDef {
  return {
    key: `reps-d${day}`,
    title: `Strong Reps – Day ${day}`,
    compounds: [
      { key: 'c1', label: 'Compound 1', rounds: repsRounds() },
      { key: 'c2', label: 'Compound 2', rounds: repsRounds() },
    ],
  }
}

/** One week of training (same layout as published Week 1 tab). */
export const weekTemplate: DayDef[] = [
  {
    day: 1,
    sessions: [heavySession(1), shredSession(1), repsSession(1)],
  },
  {
    day: 2,
    sessions: [heavySession(2), shredSession(2), repsSession(2)],
  },
  {
    day: 3,
    sessions: [heavySession(3), repsSession(3)],
  },
]

export const WEEKS = 8 as const

export const SOURCE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Ux426fnSNs_w6M_yEECAOJ332XJ9GdoZe_CTYomCGHA/htmlview'

/** Stable cell key for storage and v-model binding. */
export function cellKey(
  week: number,
  day: number,
  sessionKey: string,
  compoundKey: string,
  roundKey: string,
  field: RoundField,
): string {
  return `w${week}:d${day}:${sessionKey}:${compoundKey}:${roundKey}:${field}`
}

export function allCellKeysForWeekFromDays(week: number, days: DayDef[]): string[] {
  const keys: string[] = []
  for (const d of days) {
    for (const s of d.sessions) {
      for (const c of s.compounds) {
        for (const r of c.rounds) {
          for (const f of r.fields) {
            keys.push(cellKey(week, d.day, s.key, c.key, r.key, f))
          }
        }
      }
    }
  }
  return keys
}

export function allCellKeysForWeek(week: number): string[] {
  return allCellKeysForWeekFromDays(week, weekTemplate)
}

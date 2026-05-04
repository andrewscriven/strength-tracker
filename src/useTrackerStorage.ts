import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'strength-tracker-v1'
const LEGACY_STORAGE_KEY = 'lf3-strength-tracker-v1'

export type CellValues = Record<string, string>

function loadRaw(): CellValues {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        raw = legacy
        localStorage.setItem(STORAGE_KEY, legacy)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CellValues
    }
  } catch {
    /* ignore */
  }
  return {}
}

function saveRaw(values: CellValues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    /* quota / private mode */
  }
}

export function useTrackerStorage() {
  const values = ref<CellValues>(loadRaw())

  watch(
    values,
    (v) => {
      saveRaw(v)
    },
    { deep: true },
  )

  function get(key: string): string {
    return values.value[key] ?? ''
  }

  function set(key: string, val: string) {
    if (!val) {
      const next = { ...values.value }
      delete next[key]
      values.value = next
      return
    }
    values.value = { ...values.value, [key]: val }
  }

  function clearWeek(week: number) {
    const prefix = `w${week}:`
    const next: CellValues = {}
    for (const k of Object.keys(values.value)) {
      if (!k.startsWith(prefix)) next[k] = values.value[k]!
    }
    values.value = next
  }

  function clearAll() {
    values.value = {}
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* */
    }
  }

  function exportJson(): string {
    return JSON.stringify(values.value, null, 2)
  }

  function importJson(text: string) {
    const parsed = JSON.parse(text) as CellValues
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      values.value = parsed
    } else {
      throw new Error('Invalid JSON object')
    }
  }

  const filledCount = computed(() => Object.keys(values.value).length)

  return { values, get, set, clearWeek, clearAll, exportJson, importJson, filledCount }
}

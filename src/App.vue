<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import RawSheetGrid from './components/RawSheetGrid.vue'
import RoundTable from './components/RoundTable.vue'
import { fetchLatestSheetData, SHEET_DATA_PATH } from './loadSheetData'
import type { SheetDataPayload } from './sheetTypes'
import { SOURCE_SHEET_URL, weekTemplate } from './program'
import { useTrackerStorage } from './useTrackerStorage'

const { get, set, clearWeek, clearAll, exportJson, importJson, filledCount } = useTrackerStorage()

const sheetData = ref<SheetDataPayload | null>(null)
const loadError = ref('')
const loadState = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')

const currentWeek = ref(1)
const currentDay = ref<1 | 2 | 3>(1)
const mainTab = ref<'program' | 'resources'>('program')
const contentTabIndex = ref(0)

const showInfo = ref(false)
const showImport = ref(false)
const importText = ref('')
const importError = ref('')

const baseUrl = import.meta.env.BASE_URL

async function refreshSheetData() {
  loadState.value = 'loading'
  loadError.value = ''
  try {
    const data = await fetchLatestSheetData(baseUrl)
    sheetData.value = data
    loadState.value = data ? 'ok' : 'error'
    if (!data) loadError.value = `Could not load ${SHEET_DATA_PATH}`
  } catch (e) {
    loadState.value = 'error'
    loadError.value = e instanceof Error ? e.message : 'Load failed'
  }
}

onMounted(() => {
  void refreshSheetData()
})

const parsedWeeks = computed(() => sheetData.value?.parsedWeeks ?? [])

const weekNumbers = computed(() => {
  const fromData = parsedWeeks.value.map((p) => p.weekNumber)
  const maxData = fromData.length ? Math.max(...fromData) : 0
  const n = Math.max(8, maxData)
  return Array.from({ length: n }, (_, i) => i + 1)
})

function daysForWeek(wn: number) {
  const parsed = parsedWeeks.value.find((p) => p.weekNumber === wn)
  if (parsed?.days?.length) return parsed.days
  return weekTemplate
}

const activeDays = computed(() => daysForWeek(currentWeek.value))

const contentTabs = computed(() => sheetData.value?.tabs.filter((t) => t.kind === 'content') ?? [])

const activeContentTab = computed(() => contentTabs.value[contentTabIndex.value] ?? null)

function dayLabel(d: 1 | 2 | 3) {
  if (d === 1) return 'Day 1'
  if (d === 2) return 'Day 2'
  return 'Day 3'
}

function downloadExport() {
  const blob = new Blob([exportJson()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `strength-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

function runImport() {
  importError.value = ''
  try {
    importJson(importText.value)
    showImport.value = false
    importText.value = ''
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Could not import'
  }
}

const fetchedHint = computed(() => {
  const t = sheetData.value?.fetchedAt
  if (!t || t.startsWith('1970')) return ''
  try {
    return new Date(t).toLocaleString()
  } catch {
    return t
  }
})
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="brand">
        <span class="logo">ST</span>
        <div>
          <h1>Strength Phase Tracker</h1>
          <p class="tagline">
            Log loads, reps, and notes — saved on this device
            <span v-if="fetchedHint" class="sync-hint"> · Program data {{ fetchedHint }}</span>
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="btn ghost"
          :disabled="loadState === 'loading'"
          @click="refreshSheetData"
        >
          Refresh sheet data
        </button>
        <button type="button" class="btn ghost" @click="showInfo = true">About</button>
        <button type="button" class="btn ghost" @click="showImport = true">Import</button>
        <button type="button" class="btn" @click="downloadExport">Export JSON</button>
      </div>
    </header>

    <p v-if="loadError" class="banner error">{{ loadError }}</p>
    <p v-else-if="loadState === 'loading'" class="banner">Loading program from {{ SHEET_DATA_PATH }}…</p>

    <nav class="main-tabs" aria-label="Section">
      <button
        type="button"
        class="main-tab"
        :class="{ active: mainTab === 'program' }"
        @click="mainTab = 'program'"
      >
        Program
      </button>
      <button
        type="button"
        class="main-tab"
        :class="{ active: mainTab === 'resources' }"
        :disabled="contentTabs.length === 0"
        @click="mainTab = 'resources'"
      >
        Other tabs
        <span v-if="contentTabs.length" class="badge">{{ contentTabs.length }}</span>
      </button>
    </nav>

    <template v-if="mainTab === 'program'">
      <nav class="week-nav" aria-label="Week">
        <button
          v-for="w in weekNumbers"
          :key="w"
          type="button"
          class="week-pill"
          :class="{ active: currentWeek === w }"
          @click="currentWeek = w"
        >
          Week {{ w }}
        </button>
      </nav>

      <nav class="day-nav" aria-label="Training day">
        <button
          v-for="d in [1, 2, 3] as const"
          :key="d"
          type="button"
          class="day-tab"
          :class="{ active: currentDay === d }"
          @click="currentDay = d"
        >
          {{ dayLabel(d) }}
        </button>
      </nav>

      <main class="main">
        <section
          v-for="dayDef in activeDays.filter((x) => x.day === currentDay)"
          :key="dayDef.day"
          class="day-section"
        >
          <article v-for="session in dayDef.sessions" :key="session.key" class="session-card">
            <h2 class="session-title">{{ session.title }}</h2>
            <RoundTable
              v-for="c in session.compounds"
              :key="c.key"
              :week="currentWeek"
              :day="dayDef.day"
              :session-key="session.key"
              :compound="c"
              :get="get"
              :set="set"
            />
          </article>
        </section>

        <footer class="toolbar">
          <span class="stat">{{ filledCount }} cells filled</span>
          <button type="button" class="btn danger ghost" @click="clearWeek(currentWeek)">
            Clear week {{ currentWeek }}
          </button>
          <button type="button" class="btn danger ghost" @click="clearAll()">Clear all weeks</button>
        </footer>
      </main>
    </template>

    <template v-else>
      <div v-if="contentTabs.length === 0" class="empty-resources">
        <p>No non-week tabs were included in the last sheet export.</p>
        <p class="fine-print">
          Run <code>npm run fetch:sheet</code> with a Google Sheets API key, deploy
          <code>public/data/latest.json</code> to S3, or schedule the included Lambda refresh.
        </p>
      </div>
      <template v-else>
        <nav class="content-tab-nav" aria-label="Sheet tab">
          <button
            v-for="(t, i) in contentTabs"
            :key="t.sheetId"
            type="button"
            class="content-tab"
            :class="{ active: contentTabIndex === i }"
            @click="contentTabIndex = i"
          >
            {{ t.title }}
          </button>
        </nav>
        <RawSheetGrid v-if="activeContentTab" :title="activeContentTab.title" :grid="activeContentTab.grid" />
      </template>
    </template>

    <Teleport to="body">
      <div v-if="showInfo" class="modal-backdrop" @click.self="showInfo = false">
        <div class="modal" role="dialog" aria-labelledby="about-title">
          <h2 id="about-title">About this tracker</h2>
          <p>
            This app mirrors the layout of the
            <a :href="SOURCE_SHEET_URL" target="_blank" rel="noopener noreferrer"
              >Strength Phase Tracker (seed sheet)</a
            >
            spreadsheet. Training blocks are parsed from each <strong>Week N</strong> tab when you
            publish <code>data/latest.json</code> (via <code>npm run fetch:sheet</code> or the Lambda
            job). Other sheet tabs appear under <strong>Other tabs</strong>.
          </p>
          <p>
            Your workout log entries stay in <strong>local storage</strong> on this device unless
            you export them. The Google Sheet remains the source of truth for programming.
          </p>
          <p class="fine-print">
            Sheet updates: refresh this app or wait for CloudFront cache to expire after the
            scheduled publisher runs.
          </p>
          <button type="button" class="btn" @click="showInfo = false">Close</button>
        </div>
      </div>

      <div v-if="showImport" class="modal-backdrop" @click.self="showImport = false">
        <div class="modal" role="dialog" aria-labelledby="import-title">
          <h2 id="import-title">Import JSON</h2>
          <p>Paste a previously exported backup to restore your data.</p>
          <textarea v-model="importText" class="import-area" rows="10" placeholder="{ ... }" />
          <p v-if="importError" class="error">{{ importError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn ghost" @click="showImport = false">Cancel</button>
            <button type="button" class="btn" @click="runImport">Import</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
}
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.brand {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.logo {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  color: #0a0e14;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: -0.02em;
}
h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.tagline {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}
.sync-hint {
  color: var(--muted);
}
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.banner {
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--surface-2);
  font-size: 0.875rem;
  color: var(--muted);
}
.banner.error {
  color: var(--danger);
  border: 1px solid var(--danger-border);
}
.main-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.main-tab {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.main-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.main-tab.active {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface-2);
}
.badge {
  margin-left: 0.35rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  font-size: 0.7rem;
  color: var(--accent);
}
.week-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.week-pill {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.week-pill:hover {
  color: var(--text);
  border-color: var(--muted);
}
.week-pill.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}
.day-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.day-tab {
  flex: 1;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.day-tab:hover {
  color: var(--text);
}
.day-tab.active {
  background: var(--surface-2);
  border-color: var(--accent);
  color: var(--text);
}
.session-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1rem 1rem 1.25rem;
  margin-bottom: 1rem;
}
.session-title {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 700;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
.stat {
  font-size: 0.85rem;
  color: var(--muted);
  margin-right: auto;
}
.btn {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #0a0e14;
  font: inherit;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
}
.btn:hover {
  filter: brightness(1.05);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}
.btn.ghost:hover:not(:disabled) {
  border-color: var(--muted);
}
.btn.danger.ghost {
  border-color: var(--danger-border);
  color: var(--danger);
}
.btn.danger.ghost:hover {
  background: var(--danger-soft);
}
.content-tab-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.content-tab {
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  max-width: 100%;
}
.content-tab.active {
  border-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}
.empty-resources {
  padding: 1rem;
  border-radius: 12px;
  border: 1px dashed var(--border);
  color: var(--muted);
}
.empty-resources code {
  font-size: 0.8rem;
  color: var(--text);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 50;
}
.modal {
  max-width: 32rem;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}
.modal h2 {
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
}
.modal p {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text);
}
.modal a {
  color: var(--accent);
}
.fine-print {
  font-size: 0.8rem !important;
  color: var(--muted) !important;
}
.import-area {
  width: 100%;
  box-sizing: border-box;
  margin: 0.5rem 0;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  resize: vertical;
}
.error {
  color: var(--danger);
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>

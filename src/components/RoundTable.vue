<script setup lang="ts">
import type { CompoundDef, RoundField } from '../program'
import { cellKey } from '../program'

const props = defineProps<{
  week: number
  day: number
  sessionKey: string
  compound: CompoundDef
  get: (k: string) => string
  set: (k: string, v: string) => void
}>()

function key(field: RoundField, roundKey: string) {
  return cellKey(props.week, props.day, props.sessionKey, props.compound.key, roundKey, field)
}

function fieldLabel(f: RoundField) {
  if (f === 'load') return 'Load'
  if (f === 'reps') return 'Reps'
  return 'Notes'
}
</script>

<template>
  <div class="compound">
    <h4 class="compound-title">{{ compound.label }}</h4>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-round">Round</th>
            <th v-for="f in compound.rounds[0]?.fields ?? []" :key="f" class="col-field">
              {{ fieldLabel(f) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in compound.rounds" :key="r.key">
            <td class="col-round">{{ r.label }}</td>
            <td v-for="f in r.fields" :key="f" class="col-field">
              <input
                type="text"
                class="cell-input"
                :value="get(key(f, r.key))"
                :inputmode="f === 'notes' ? 'text' : 'decimal'"
                autocomplete="off"
                @input="set(key(f, r.key), ($event.target as HTMLInputElement).value)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.compound {
  margin-top: 1rem;
}
.compound-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--muted);
}
.table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
th,
td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
thead th {
  background: var(--surface-2);
  font-weight: 600;
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
tbody tr:last-child td {
  border-bottom: none;
}
.col-round {
  width: 7rem;
  white-space: nowrap;
  color: var(--muted);
}
.col-field {
  min-width: 5rem;
}
.cell-input {
  width: 100%;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.cell-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface-2);
}
</style>

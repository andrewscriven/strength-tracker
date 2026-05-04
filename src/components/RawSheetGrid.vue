<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  grid: string[][]
}>()

function cell(r: number, c: number): string {
  const row = props.grid[r]
  if (!row) return ''
  return row[c] ?? ''
}

const dims = computed(() => {
  let cols = 1
  for (const row of props.grid) {
    cols = Math.max(cols, row.length)
  }
  cols = Math.min(Math.max(cols, 1), 40)
  const rows = Math.min(props.grid.length, 300)
  return { rows, cols }
})
</script>

<template>
  <div class="raw-sheet">
    <h2 class="title">{{ title }}</h2>
    <div class="wrap">
      <table class="grid">
        <tbody>
          <tr v-for="ri in dims.rows" :key="ri">
            <td v-for="ci in dims.cols" :key="ci" class="cell">{{ cell(ri - 1, ci - 1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.raw-sheet {
  margin-top: 0.5rem;
}
.title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}
.wrap {
  overflow: auto;
  max-height: 70vh;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.grid {
  border-collapse: collapse;
  font-size: 0.75rem;
  min-width: 100%;
}
.cell {
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 0.2rem 0.35rem;
  white-space: nowrap;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  background: var(--surface);
}
tr:nth-child(even) .cell {
  background: var(--surface-2);
}
</style>

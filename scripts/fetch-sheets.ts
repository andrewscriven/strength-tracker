import { config as loadEnv } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchSheetDataFromGoogle } from '../src/googleSheetsFetch'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(root, '.env.local') })
loadEnv({ path: join(root, '.env') })

const key = process.env.GOOGLE_SHEETS_API_KEY
if (!key) {
  console.error('Set GOOGLE_SHEETS_API_KEY (Google Cloud console → APIs → Sheets API → credentials).')
  process.exit(1)
}

const spreadsheetId =
  process.env.SPREADSHEET_ID ?? '1Ux426fnSNs_w6M_yEECAOJ332XJ9GdoZe_CTYomCGHA'

const data = await fetchSheetDataFromGoogle(key, spreadsheetId)
const outDir = join(root, 'public', 'data')
await mkdir(outDir, { recursive: true })
const outFile = join(outDir, 'latest.json')
await writeFile(outFile, JSON.stringify(data), 'utf8')
console.log('Wrote', outFile)
console.log('  tabs:', data.tabs.length, '| parsed weeks:', data.parsedWeeks.map((p) => p.weekNumber).join(', '))

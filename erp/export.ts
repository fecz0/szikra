// ERPNext -> JSON snapshot (a deploy ebből dolgozik, ERPNext nélkül).
// Használat: node erp/export.ts   (az erp/.env.local kulcsait vagy Administrator/admin belépést használja)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { formatSnapshot } from './format.ts'
import { ErpClient } from '../server/utils/erp/client.ts'
import { fetchDataset } from '../server/utils/erp/dataset.ts'

const BASE = process.env.ERP_URL ?? 'http://127.0.0.1:8088'
const envFile = new URL('./.env.local', import.meta.url)
const env: Record<string, string> = {}
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]!] = m[2]! }

const c = new ErpClient(BASE, env.NUXT_ERP_API_KEY
  ? { key: env.NUXT_ERP_API_KEY, secret: env.NUXT_ERP_API_SECRET! }
  : { user: 'Administrator', password: process.env.ERP_ADMIN_PASSWORD ?? 'admin' })

const ds = await fetchDataset(c)
const out = new URL('../server/data/snapshot.json', import.meta.url)
writeFileSync(out, formatSnapshot(ds))
console.log(`snapshot: ${ds.partners.length} partner, ${ds.users.length} felhasználó, ${ds.invoices.length} számla, ${ds.supplyPoints.length} fogyasztási hely, ${ds.cases.length} ügy -> ${out.pathname}`)

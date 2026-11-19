// Offline snapshot: a fix demó-adatkészlet a forgatókönyvekből, ERPNext nélkül.
// Használat: node erp/snapshot-from-scenarios.ts
import { writeFileSync } from 'node:fs'
import { fixedDemoDataset } from '../server/domain/scenarios.ts'

const out = new URL('../server/data/snapshot.json', import.meta.url)
writeFileSync(out, JSON.stringify(fixedDemoDataset(), null, 2) + '\n')
console.log('snapshot kész:', out.pathname)

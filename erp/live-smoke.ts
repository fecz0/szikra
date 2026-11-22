// Élő ERPNext füstteszt: a futó portált (NUXT_BACKEND=erpnext) HTTP-n át járja végig,
// és az ERPNext oldalon ellenőrzi az eredményt, majd takarít maga után.
// Használat: PORTAL=http://127.0.0.1:3200 node erp/live-smoke.ts
import { readFileSync } from 'node:fs'
import { ErpClient } from '../server/utils/erp/client.ts'

const PORTAL = process.env.PORTAL ?? 'http://127.0.0.1:3200'
const env: Record<string, string> = {}
for (const l of readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]!] = m[2]! }
const erp = new ErpClient(env.NUXT_ERP_BASE_URL!, { key: env.NUXT_ERP_API_KEY!, secret: env.NUXT_ERP_API_SECRET! })

let failed = 0
const ok = (cond: unknown, msg: string) => { console.log(cond ? '✓' : '✗', msg); if (!cond) failed++ }

class Session {
  cookie = ''
  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(PORTAL + path, { method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    const set = res.headers.getSetCookie?.()
    if (set?.length) this.cookie = set.map(c => c.split(';')[0]).join('; ')
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
}

const created = { issues: [] as string[], payments: [] as string[] }
try {
  const fin = new Session()
  ok((await fin.call('POST', '/api/auth/login', { userId: 'DEMO-PENZUGY' })).status === 200, 'pénzügyi felhasználó belép')
  const me = (await fin.call('GET', '/api/auth/me')).json
  ok(me.companies.length === 2, 'két céghez van hozzáférése')

  const before = (await fin.call('GET', '/api/partner/DEMO-ELMARADT/invoices')).json
  ok(before.length === 2 && before.every((i: any) => i.status === 'overdue'), 'ERPNextből jön a 2 lejárt számla')

  const pay = await fin.call('POST', '/api/partner/DEMO-ELMARADT/invoices/DEMO-ELMARADT-INV1/pay')
  ok(pay.status === 200, 'fizetés sikeres')
  const siName = (await erp.list('Sales Invoice', { fields: ['name', 'outstanding_amount'], filters: [['szikra_id', '=', 'DEMO-ELMARADT-INV1']] }))[0]
  ok(siName.outstanding_amount === 0, 'az ERPNext számlán az egyenleg 0 (Payment Entry létrejött)')
  const pes = await erp.list('Payment Entry', { fields: ['name'], filters: [['reference_no', '=', 'SZIKRA-KARTYA'], ['docstatus', '=', 1]] })
  created.payments.push(...pes.map(r => r.name))
  const again = await fin.call('POST', '/api/partner/DEMO-ELMARADT/invoices/DEMO-ELMARADT-INV1/pay')
  ok(again.status === 409, 'kétszer nem fizethető')

  ok((await fin.call('POST', '/api/partner/DEMO-KARTYA/invoices/DEMO-KARTYA-INV1/pay')).status === 402, 'a kártyás cégnél a bank elutasít (402)')

  const c = await fin.call('POST', '/api/partner/DEMO-ELMARADT/cases', { type: 'szamlareklamacio', fields: { invoice: 'DEMO-ELMARADT-INV2', reason: 'Füstteszt' } })
  ok(c.status === 200 && c.json.id, `ügy létrejött: ${c.json?.id}`)
  created.issues.push(c.json.id)
  ok((await fin.call('POST', `/api/partner/DEMO-ELMARADT/cases/${c.json.id}/messages`, { text: 'Üzenet' })).status === 200, 'üzenet elküldve')
  const got = (await fin.call('GET', `/api/partner/DEMO-ELMARADT/cases/${c.json.id}`)).json
  ok(got.messages.length === 1 && got.messages[0].text === 'Üzenet' && got.status === 'uj', 'az ügy és az üzenet visszaolvasható')
  const issue = await erp.get('Issue', c.json.id)
  ok(issue.szikra_case_type === 'szamlareklamacio' && JSON.parse(issue.szikra_fields).invoice === 'DEMO-ELMARADT-INV2', 'az ERPNext Issue a megfelelő mezőkkel létrejött')
  const ov = (await fin.call('GET', '/api/partner/DEMO-ELMARADT/overview')).json
  ok(ov.notifications.length >= 2 && ov.openCases === 1, 'értesítések és nyitott ügyek az áttekintésben')

  // használati esetek: lánc (több telephely), napelempark (termelő)
  const chain = new Session()
  await chain.call('POST', '/api/auth/login', { userId: 'DEMO-ADMIN' })
  const lanc = (await chain.call('GET', '/api/partner/DEMO-LANC/invoices')).json
  ok(lanc.length === 144 && lanc.some((i: any) => i.siteLabel === 'Miskolc áruház' && i.status === 'overdue'), 'a lánc 144 számlája telephely-névvel, egy lejárttal jön az ERPNextből')
  const det = (await chain.call('GET', '/api/partner/DEMO-LANC/invoices/DEMO-LANC-INV-E1-202610')).json
  const net = det.invoice.lines.reduce((a: number, l: any) => a + l.amountHuf, 0)
  ok(det.invoice.lines.length === 7 && det.totals.net === net && net + det.totals.vat === det.invoice.amountHuf && det.supplyPoint.networkCategory === 'KIF III.', `számlakép az ERPNextből: ${det.invoice.lines.length} tétel, nettó ${net}, ÁFA ${det.totals.vat}, bruttó ${det.invoice.amountHuf}`)
  const rd = (await chain.call('GET', '/api/partner/DEMO-LANC/readings')).json
  ok(rd.length === 12 * 13, `mérőállás-idősor: ${rd.length}`)
  const prodDenied = await chain.call('GET', '/api/partner/DEMO-NAPELEM/production')
  ok(prodDenied.status === 403, 'idegen cég termelése nem érhető el')

  const solar = new Session()
  await solar.call('POST', '/api/auth/login', { userId: 'DEMO-TERMELO' })
  const prod = (await solar.call('GET', '/api/partner/DEMO-NAPELEM/production')).json
  const total = prod.reduce((a: number, p: any) => a + p.mwh, 0)
  ok(prod.length === 24 && total > 22000 && total < 28000, `termelés: ${prod.length} rekord, ${Math.round(total)} MWh`)
  const sOv = (await solar.call('GET', '/api/partner/DEMO-NAPELEM/overview')).json
  ok(sOv.invoices === null && sOv.production?.mwh > 0, 'a termelő áttekintésében termelés van, számla nincs')
  const me2 = (await solar.call('GET', '/api/auth/me')).json
  ok(me2.companies[0].kind === 'termelo', 'a cég típusa: termelő')

  const ro = new Session()
  await ro.call('POST', '/api/auth/login', { userId: 'DEMO-ADMIN' })
  ok((await ro.call('POST', '/api/partner/DEMO-ELMARADT/invoices/DEMO-ELMARADT-INV2/pay')).status === 403, 'olvasó szerepkör fizetése 403')
  ok((await ro.call('GET', `/api/partner/DEMO-ELMARADT/cases/${c.json.id}`)).status === 200, 'olvasó látja az ügyet')
  const other = new Session()
  await other.call('POST', '/api/auth/login', { userId: 'DEMO-OLVASO' })
  ok((await other.call('GET', '/api/partner/DEMO-ELMARADT/invoices')).status === 403, 'idegen cég adata nem érhető el')
}
finally {
  // takarítás: a fizetés visszavonva (könyvelésileg a törölt PE helyes állapota a 'cancelled'), az ügy törölve
  for (const pe of created.payments) {
    await erp.update('Payment Entry', pe, { docstatus: 2 }).catch(e => console.log('cancel:', e.message))
  }
  for (const i of created.issues) {
    for (const cm of await erp.list('Comment', { filters: [['reference_name', '=', i]] })) await erp.request('DELETE', `/api/resource/Comment/${cm.name}`).catch(() => {})
    await erp.request('DELETE', `/api/resource/Issue/${encodeURIComponent(i)}`).catch(e => console.log('issue törlés:', e.message))
  }
  for (const ev of await erp.list('Szikra Event', {})) await erp.request('DELETE', `/api/resource/Szikra%20Event/${ev.name}`).catch(() => {})
  const left = (await erp.list('Sales Invoice', { fields: ['szikra_id', 'outstanding_amount'], filters: [['szikra_id', '=', 'DEMO-ELMARADT-INV1']] }))[0]
  ok(left.outstanding_amount > 0, 'takarítás után a számla újra nyitott')
}
console.log(failed ? `\n${failed} hiba` : '\nminden rendben')
process.exit(failed ? 1 : 0)

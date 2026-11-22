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

const startedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
const created = { issues: [] as string[], payments: [] as string[], schedules: [] as string[], confirmedDeals: [] as string[], outages: [] as string[], tariffs: [] as string[], resetOutages: [] as string[], settlementMonths: [] as string[] }
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

  // nagykereskedelem: ügyletek, limit, menetrend
  const trader = new Session()
  await trader.call('POST', '/api/auth/login', { userId: 'DEMO-KERESKEDO' })
  const deals = (await trader.call('GET', '/api/partner/DEMO-NAGYKER/deals')).json
  ok(deals.length === 12 && deals.filter((d: any) => d.status === 'visszaigazolasra-var').length === 3, `ügyletek az ERPNextből: ${deals.length}, ebből 3 visszaigazolásra vár`)
  const cr = (await trader.call('GET', '/api/partner/DEMO-NAGYKER/credit')).json
  ok(cr.limitHuf === 3_000_000_000 && cr.usedPct > 0 && cr.usedPct < 100, `hitelkeret: ${cr.usedPct}% kihasználva`)
  const cf = await trader.call('POST', '/api/partner/DEMO-NAGYKER/deals/DEMO-NAGYKER-D07/confirm')
  created.confirmedDeals.push('DEMO-NAGYKER-D07')
  ok(cf.status === 200 && (await erp.list('Szikra Deal', { fields: ['status'], filters: [['szikra_id', '=', 'DEMO-NAGYKER-D07']] }))[0].status === 'visszaigazolva', 'az ügylet visszaigazolása az ERPNextben állapotot vált')
  ok((await trader.call('POST', '/api/partner/DEMO-NAGYKER/deals/DEMO-NAGYKER-D07/confirm')).status === 409, 'kétszer nem igazolható vissza')
  const tom = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const sc = await trader.call('POST', '/api/partner/DEMO-NAGYKER/schedule', { date: tom, commodity: 'villany', baseMw: 30, peakMw: 12 })
  created.schedules.push(`DEMO-NAGYKER-SCH-E-${tom.replaceAll('-', '')}`)
  const sched = (await trader.call('GET', '/api/partner/DEMO-NAGYKER/schedule')).json
  ok(sc.status === 200 && sched.some((x: any) => x.date === tom && x.values.length === 24 && x.status === 'benyujtva'), 'a menetrend az ERPNextbe kerül (24 óra)')
  const nk = (await trader.call('GET', '/api/partner/DEMO-NAGYKER/invoices/DEMO-NAGYKER-INV-202610')).json
  ok(nk.invoice.lines.length === 3 && nk.invoice.amountHuf > 1_000_000_000, `nagykereskedői számla: ${nk.invoice.lines.length} tétel, ${Math.round(nk.invoice.amountHuf / 1e6)} M Ft`)

  // atomerőmű: négy szem elve leállásra és elszámolásra
  const vez = new Session(); const meg = new Session(); const uzem = new Session()
  await vez.call('POST', '/api/auth/login', { userId: 'DEMO-ATOMVEZETO' })
  await meg.call('POST', '/api/auth/login', { userId: 'DEMO-MEGFELELO' })
  await uzem.call('POST', '/api/auth/login', { userId: 'DEMO-ATOMUZEM' })
  const aprod = (await vez.call('GET', '/api/partner/DEMO-ATOM/production')).json
  const atwh = aprod.reduce((a: number, p: any) => a + p.mwh, 0)
  ok(aprod.length === 48 && atwh > 14_000_000 && atwh < 17_000_000, `atomerőmű: ${aprod.length} rekord, ${(atwh / 1e6).toFixed(1)} TWh`)
  created.resetOutages.push('DEMO-ATOM-OUT-06')
  const a1 = await vez.call('POST', '/api/partner/DEMO-ATOM/outages/DEMO-ATOM-OUT-06/approve')
  ok(a1.status === 200 && a1.json.approvals.length === 1 && a1.json.status === 'jovahagyasra-var', 'leállás 1/2 jóváhagyás (ERPNext)')
  ok((await vez.call('POST', '/api/partner/DEMO-ATOM/outages/DEMO-ATOM-OUT-06/approve')).status === 409, 'ugyanaz a jóváhagyó másodszor nem jó (négy szem)')
  ok((await uzem.call('POST', '/api/partner/DEMO-ATOM/outages/DEMO-ATOM-OUT-06/approve')).status === 403, 'az üzemvezető nem hagyhat jóvá')
  const a2 = await meg.call('POST', '/api/partner/DEMO-ATOM/outages/DEMO-ATOM-OUT-06/approve')
  const eo = (await erp.list('Szikra Outage', { fields: ['status', 'approvals_json'], filters: [['szikra_id', '=', 'DEMO-ATOM-OUT-06']] }))[0]
  ok(a2.status === 200 && eo.status === 'jovahagyva' && JSON.parse(eo.approvals_json).length === 2, 'a második, különböző jóváhagyó véglegesíti (ERPNext: jovahagyva, 2 jóváhagyás)')
  const prop = await uzem.call('POST', '/api/partner/DEMO-ATOM/outages', { supplyPointId: 'DEMO-ATOM-T1', kind: 'rendkivuli', from: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10), to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10), purpose: 'Füstteszt' })
  if (prop.json?.id) created.outages.push(prop.json.id)
  ok(prop.status === 200 && (await uzem.call('POST', `/api/partner/DEMO-ATOM/outages/${prop.json.id}/approve`)).status === 403, 'a javaslat rögzül, a javaslattevő jóváhagyni nem tud')
  created.settlementMonths.push('2026-10')
  ok((await vez.call('POST', '/api/partner/DEMO-ATOM/settlements/approve', { month: '2026-10' })).status === 200, 'az októberi elszámolás második jóváhagyása')
  const set = await erp.list('Szikra Production', { fields: ['status'], filters: [['month', '=', '2026-10'], ['szikra_id', 'like', 'DEMO-ATOM-%']] })
  ok(set.length === 4 && set.every((r: any) => r.status === 'jovahagyva'), 'a 4 blokk októberi elszámolása jóváhagyva az ERPNextben')
  const aud = (await meg.call('GET', '/api/partner/DEMO-ATOM/audit')).json
  ok(aud.length >= 9 && aud.some((e: any) => e.action.includes('leállás jóváhagyva')), `auditnapló: ${aud.length} bejegyzés, a jóváhagyások naplózva`)
  ok((await uzem.call('GET', '/api/partner/DEMO-ATOM/audit')).status === 403, 'az üzemvezető nem látja a naplót')

  // tarifa-motor: szimuláció az ERPNext intervallumadatából, egyedi díjcsomag
  const adm = new Session()
  await adm.call('POST', '/api/auth/login', { userId: 'DEMO-ADMIN' })
  const sites = (await adm.call('GET', '/api/partner/DEMO-LANC/tariff-sites')).json
  ok(sites.length === 8 && sites.every((x: any) => x.hasIntervals), `${sites.length} villany-telephely, mind intervallumadattal`)
  const simu = (await adm.call('GET', '/api/partner/DEMO-LANC/tariff-simulation?supplyPointId=DEMO-LANC-E1')).json
  ok(simu.available && simu.results.length >= 4 && simu.reconciliation.diffHuf === 0 && simu.reconciliation.invoices === 12, `a motor az ERPNext-adatból pontosan a számlázott energiadíjat adja (eltérés ${simu.reconciliation?.diffHuf} Ft, ${simu.reconciliation?.invoices} számla)`)
  const nt = await adm.call('POST', '/api/partner/DEMO-LANC/tariffs', { name: 'Füstteszt díjcsomag', kind: 'fix', fixHufPerKwh: 30 })
  if (nt.json?.id) created.tariffs.push(nt.json.id)
  const simu2 = (await adm.call('GET', '/api/partner/DEMO-LANC/tariff-simulation?supplyPointId=DEMO-LANC-E1')).json
  const mine = simu2.results.find((r: any) => r.tariff.name === 'Füstteszt díjcsomag')
  ok(nt.status === 200 && mine && mine.savingVsCurrentHuf > 0, 'az egyedi díjcsomag az ERPNextben tárolódik, és szerepel a szimulációban')

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
  for (const id of created.tariffs) {
    const row = (await erp.list('Szikra Tariff', { fields: ['name'], filters: [['szikra_id', '=', id]] }))[0]
    if (row) await erp.request('DELETE', `/api/resource/Szikra%20Tariff/${row.name}`).catch(e => console.log('díjcsomag törlés:', e.message))
  }
  for (const id of created.resetOutages) {
    const row = (await erp.list('Szikra Outage', { fields: ['name'], filters: [['szikra_id', '=', id]] }))[0]
    if (row) await erp.update('Szikra Outage', row.name, { status: 'jovahagyasra-var', approvals_json: '[]' }).catch(e => console.log('leállás visszaállítás:', e.message))
  }
  for (const id of created.outages) {
    const row = (await erp.list('Szikra Outage', { fields: ['name'], filters: [['szikra_id', '=', id]] }))[0]
    if (row) await erp.request('DELETE', `/api/resource/Szikra%20Outage/${row.name}`).catch(e => console.log('leállás törlés:', e.message))
  }
  for (const m of created.settlementMonths) {
    // az eredeti állapot: egy jóváhagyás (Szűcs Réka), tervezet
    for (const r of await erp.list('Szikra Production', { fields: ['name', 'approvals_json'], filters: [['month', '=', m], ['szikra_id', 'like', 'DEMO-ATOM-%']] })) {
      const first = JSON.parse(r.approvals_json || '[]').slice(0, 1)
      await erp.update('Szikra Production', r.name, { status: 'tervezet', approvals_json: JSON.stringify(first) }).catch(e => console.log('elszámolás visszaállítás:', e.message))
    }
  }
  for (const d of created.confirmedDeals) {
    const row = (await erp.list('Szikra Deal', { fields: ['name'], filters: [['szikra_id', '=', d]] }))[0]
    if (row) await erp.update('Szikra Deal', row.name, { status: 'visszaigazolasra-var' }).catch(e => console.log('deal visszaállítás:', e.message))
  }
  for (const sId of created.schedules) {
    const row = (await erp.list('Szikra Schedule', { fields: ['name'], filters: [['szikra_id', '=', sId]] }))[0]
    if (row) await erp.request('DELETE', `/api/resource/Szikra%20Schedule/${row.name}`).catch(e => console.log('menetrend törlés:', e.message))
  }
  for (const i of created.issues) {
    for (const cm of await erp.list('Comment', { filters: [['reference_name', '=', i]] })) await erp.request('DELETE', `/api/resource/Comment/${cm.name}`).catch(() => {})
    await erp.request('DELETE', `/api/resource/Issue/${encodeURIComponent(i)}`).catch(e => console.log('issue törlés:', e.message))
  }
  // csak a füstteszt alatt keletkezett események törlése (az előre betöltött auditnapló marad)
  for (const ev of await erp.list('Szikra Event', { fields: ['name', 'at'], filters: [['at', '>=', startedAt]] })) await erp.request('DELETE', `/api/resource/Szikra%20Event/${ev.name}`).catch(() => {})
  const left = (await erp.list('Sales Invoice', { fields: ['szikra_id', 'outstanding_amount'], filters: [['szikra_id', '=', 'DEMO-ELMARADT-INV1']] }))[0]
  ok(left.outstanding_amount > 0, 'takarítás után a számla újra nyitott')
}
console.log(failed ? `\n${failed} hiba` : '\nminden rendben')
process.exit(failed ? 1 : 0)

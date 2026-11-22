// ERPNext előkészítése és feltöltése a fix demó-adatkészlettel.
// Használat (az ERPNext fusson: docker compose -p szikra-erp -f erp/compose.yml up -d):
//   node erp/seed.ts
// Idempotens: ami már megvan (szikra_id alapján), azt kihagyja.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { fixedDemoDataset } from '../server/domain/scenarios.ts'
import { VAT_PCT } from '../server/domain/tariffs.ts'
import { ErpClient } from '../server/utils/erp/client.ts'
import { payInvoiceInErp } from '../server/utils/erp/actions.ts'

const BASE = process.env.ERP_URL ?? 'http://127.0.0.1:8088'
const c = new ErpClient(BASE, { user: 'Administrator', password: process.env.ERP_ADMIN_PASSWORD ?? 'admin' })
const log = (...a: unknown[]) => console.log('•', ...a)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function ensureSetup() {
  const companies = await c.list('Company', { fields: ['name'] })
  if (companies.length) return log('cég már létezik:', companies[0].name)
  log('ERPNext alapbeállítás (setup wizard)…')
  await c.method('frappe.desk.page.setup_wizard.setup_wizard.setup_complete', {
    args: JSON.stringify({
      language: 'English', country: 'Hungary', timezone: 'UTC', currency: 'HUF',
      company_name: 'Szikra Energia Zrt.', company_abbr: 'SZ', chart_of_accounts: 'Standard',
      fy_start_date: '2026-01-01', fy_end_date: '2026-12-31', full_name: 'Szikra Admin', email: 'admin@szikra.test',
      domains: ['Services'], enable_telemetry: 0,
    }),
  })
  for (let i = 0; i < 60; i++) {
    await sleep(5000)
    const cs = await c.list('Company', { fields: ['name'] }).catch(() => [])
    if (cs.length) return log('alapbeállítás kész')
  }
  throw new Error('a setup wizard nem fejeződött be 5 percen belül')
}

/** A 12 havi demó-előzmény 2025-re is nyúlik: ahhoz a pénzügyi évnek is léteznie kell. */
async function ensureFiscalYear(year: string) {
  if ((await c.list('Fiscal Year', { filters: [['name', '=', year]] })).length) return
  const company = (await c.list('Company', { fields: ['name'] }))[0].name as string
  await c.create('Fiscal Year', { year, year_start_date: `${year}-01-01`, year_end_date: `${year}-12-31`, companies: [{ company }] })
  log('pénzügyi év:', year)
}

/** Magyar felület és formátumok. Az időzóna szándékosan UTC marad: az export/leképezés erre számít. */
async function ensureLocale() {
  const sys = await c.get('System Settings', 'System Settings')
  const want = { language: 'hu', date_format: 'dd.mm.yyyy', number_format: '#.###,##', first_day_of_the_week: 'Monday' }
  if (Object.entries(want).some(([k, v]) => sys[k] !== v)) {
    await c.update('System Settings', 'System Settings', want)
    log('magyar nyelv és formátumok beállítva')
  }
  const admin = await c.get('User', 'Administrator')
  if (admin.language !== 'hu') {
    await c.update('User', 'Administrator', { language: 'hu' })
    log('Administrator felületi nyelve: hu')
  }
}

async function ensureCustomField(dt: string, fieldname: string, def: Record<string, unknown>) {
  const have = await c.list('Custom Field', { fields: ['name', 'options'], filters: [['dt', '=', dt], ['fieldname', '=', fieldname]] })
  if (have.length) {
    // a Select mezők új opcióit (pl. új partnertípus) utólag is felvesszük
    if (def.options && have[0].options !== def.options) { await c.update('Custom Field', have[0].name, { options: def.options }); log('mező opciói frissítve:', `${dt}.${fieldname}`) }
    return
  }
  await c.create('Custom Field', { dt, fieldname, label: fieldname, ...def })
  log('mező:', `${dt}.${fieldname}`)
}

async function ensureDoctype(name: string, autoname: string, fields: Record<string, unknown>[]) {
  const have = await c.list('DocType', { fields: ['name'], filters: [['name', '=', name]] })
  if (have.length) {
    // séma-migráció: a később felvett mezők utólag kerülnek a meglévő DocType-ba
    const doc = await c.get('DocType', name)
    const known = new Set((doc.fields as { fieldname: string }[]).map(f => f.fieldname))
    const missing = fields.filter(f => !known.has(String(f.fieldname)))
    const optionChanges = (doc.fields as { fieldname: string, options?: string }[]).filter(f => fields.some(w => w.fieldname === f.fieldname && w.options && w.options !== f.options))
    if (missing.length || optionChanges.length) {
      const patched = (doc.fields as any[]).map(f => ({ ...f, options: fields.find(w => w.fieldname === f.fieldname)?.options ?? f.options }))
      await c.update('DocType', name, { fields: [...patched, ...missing.map((f, i) => ({ idx: doc.fields.length + i + 1, ...f }))] })
      log('DocType bővítve:', name, [...missing.map(f => f.fieldname), ...optionChanges.map(f => `${f.fieldname} (opciók)`)].join(', '))
    }
    return
  }
  await c.create('DocType', {
    name, module: 'Selling', custom: 1, autoname, naming_rule: autoname.startsWith('field:') ? 'By fieldname' : 'Random',
    fields: fields.map((f, i) => ({ idx: i + 1, ...f })),
    permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 }],
  })
  log('DocType:', name)
}

async function ensureSchema() {
  const t = (fieldtype: string, extra: Record<string, unknown> = {}) => ({ fieldtype, ...extra })
  await ensureCustomField('Customer', 'szikra_id', t('Data', { unique: 1 }))
  await ensureCustomField('Customer', 'szikra_address', t('Data'))
  await ensureCustomField('Customer', 'szikra_segment', t('Select', { options: 'ipari\nkereskedelmi\nkozuzemi' }))
  await ensureCustomField('Customer', 'szikra_contract_no', t('Data'))
  await ensureCustomField('Customer', 'szikra_card_declines', t('Check'))
  await ensureCustomField('Customer', 'szikra_credit_limit', t('Currency'))
  await ensureCustomField('Customer', 'szikra_guarantee', t('Currency'))
  await ensureCustomField('Customer', 'szikra_guarantee_expiry', t('Date'))
  await ensureCustomField('Customer', 'szikra_kind', t('Select', { options: 'fogyaszto\ntermelo\nkereskedo' }))
  await ensureCustomField('Sales Invoice', 'szikra_id', t('Data'))
  await ensureCustomField('Sales Invoice', 'szikra_period', t('Data'))
  await ensureCustomField('Sales Invoice', 'szikra_supply_point', t('Data'))
  await ensureCustomField('Sales Invoice', 'szikra_usage', t('Long Text'))
  await ensureCustomField('Sales Invoice Item', 'szikra_category', t('Data'))
  await ensureCustomField('Issue', 'szikra_case_type', t('Data'))
  await ensureCustomField('Issue', 'szikra_fields', t('Long Text'))
  await ensureCustomField('Issue', 'szikra_created_by', t('Data'))

  await ensureDoctype('Szikra Supply Point', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Azonosító', reqd: 1, unique: 1, in_list_view: 1 }),
    t('Link', { fieldname: 'customer', label: 'Ügyfél', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'energy', label: 'Energia', options: 'villany\ngaz', reqd: 1 }),
    t('Data', { fieldname: 'pod', label: 'POD/EIC' }),
    t('Data', { fieldname: 'address', label: 'Cím' }),
    t('Data', { fieldname: 'meter_serial', label: 'Mérő gyártási szám' }),
    t('Check', { fieldname: 'smart', label: 'Okosmérő' }),
    t('Float', { fieldname: 'last_reading', label: 'Utolsó mérőállás' }),
    t('Date', { fieldname: 'last_reading_date', label: 'Utolsó leolvasás' }),
    t('Select', { fieldname: 'unit', label: 'Mértékegység', options: 'kWh\nm3' }),
    t('Data', { fieldname: 'label', label: 'Telephely / blokk' }),
    t('Data', { fieldname: 'tariff', label: 'Díjcsomag' }),
    t('Float', { fieldname: 'capacity_kw', label: 'Névleges teljesítmény (kW)' }),
    t('Select', { fieldname: 'direction', label: 'Irány', options: 'fogyasztas\ntermeles' }),
    t('Float', { fieldname: 'contracted_kw', label: 'Szerződött teljesítmény (kW, gáz: kWh/h)' }),
    t('Data', { fieldname: 'network_category', label: 'Hálózati kategória' }),
  ])
  await ensureDoctype('Szikra Meter Reading', 'hash', [
    t('Data', { fieldname: 'supply_point', label: 'Fogyasztási hely azonosító', reqd: 1, in_list_view: 1 }),
    t('Date', { fieldname: 'date', label: 'Leolvasás napja', reqd: 1, in_list_view: 1 }),
    t('Float', { fieldname: 'value', label: 'Kumulált mérőállás', reqd: 1, in_list_view: 1, precision: '0' }),
  ])
  await ensureDoctype('Szikra Production', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Azonosító', reqd: 1, unique: 1 }),
    t('Link', { fieldname: 'customer', label: 'Termelő', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'supply_point', label: 'Termelőhely azonosító', reqd: 1 }),
    t('Data', { fieldname: 'month', label: 'Hónap', reqd: 1, in_list_view: 1 }),
    t('Float', { fieldname: 'mwh', label: 'Termelés (MWh)', precision: '1', in_list_view: 1 }),
    t('Currency', { fieldname: 'price_huf_per_mwh', label: 'Ár (Ft/MWh)', precision: '0' }),
    t('Currency', { fieldname: 'premium_huf', label: 'Támogatási prémium', precision: '0' }),
    t('Currency', { fieldname: 'imbalance_huf', label: 'Kiegyenlítő energia költsége', precision: '0' }),
    t('Currency', { fieldname: 'settlement_huf', label: 'Elszámolás', precision: '0', in_list_view: 1 }),
    t('Select', { fieldname: 'status', label: 'Állapot', options: 'tervezet\njovahagyva\nkifizetve', in_list_view: 1 }),
    t('Long Text', { fieldname: 'approvals_json', label: 'Jóváhagyások (JSON)' }),
  ])
  await ensureDoctype('Szikra Interval Data', 'hash', [
    t('Data', { fieldname: 'supply_point', label: 'Fogyasztási hely azonosító', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'month', label: 'Hónap', reqd: 1, in_list_view: 1 }),
    t('Int', { fieldname: 'interval_minutes', label: 'Intervallum (perc)' }),
    t('Long Text', { fieldname: 'kwh_json', label: 'Fogyasztás intervallumonként, kWh (JSON)' }),
  ])
  await ensureDoctype('Szikra Tariff', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Azonosító', reqd: 1, unique: 1 }),
    t('Link', { fieldname: 'customer', label: 'Partner', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'tariff_name', label: 'Díjcsomag neve', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'kind', label: 'Típus', options: 'fix\nindexed\ntou\ndynamic', in_list_view: 1 }),
    t('Long Text', { fieldname: 'params_json', label: 'Paraméterek (JSON)' }),
  ])
  await ensureDoctype('Szikra Outage', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Azonosító', reqd: 1, unique: 1 }),
    t('Link', { fieldname: 'customer', label: 'Partner', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'supply_point', label: 'Blokk azonosító', reqd: 1 }),
    t('Select', { fieldname: 'kind', label: 'Típus', options: 'tervezett\nrendkivuli' }),
    t('Date', { fieldname: 'date_from', label: 'Kezdete', in_list_view: 1 }),
    t('Date', { fieldname: 'date_to', label: 'Vége' }),
    t('Small Text', { fieldname: 'purpose', label: 'Cél' }),
    t('Data', { fieldname: 'proposed_by_id', label: 'Javasoló azonosító' }),
    t('Data', { fieldname: 'proposed_by_name', label: 'Javasoló neve' }),
    t('Select', { fieldname: 'status', label: 'Állapot', options: 'jovahagyasra-var\njovahagyva', in_list_view: 1 }),
    t('Long Text', { fieldname: 'approvals_json', label: 'Jóváhagyások (JSON)' }),
  ])
  await ensureDoctype('Szikra Deal', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Ügylet azonosító', reqd: 1, unique: 1 }),
    t('Link', { fieldname: 'customer', label: 'Partner', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'commodity', label: 'Energia', options: 'villany\ngaz', reqd: 1 }),
    t('Data', { fieldname: 'product', label: 'Termék', in_list_view: 1 }),
    t('Select', { fieldname: 'side', label: 'Irány', options: 'vetel\neladas' }),
    t('Float', { fieldname: 'volume', label: 'Mennyiség (MW vagy MWh/nap)' }),
    t('Select', { fieldname: 'volume_unit', label: 'Mértékegység', options: 'MW\nMWh/nap' }),
    t('Float', { fieldname: 'price_eur_mwh', label: 'Ár (EUR/MWh)', precision: '2' }),
    t('Float', { fieldname: 'fx_huf_per_eur', label: 'Árfolyam (HUF/EUR)', precision: '2' }),
    t('Date', { fieldname: 'delivery_from', label: 'Szállítás kezdete' }),
    t('Date', { fieldname: 'delivery_to', label: 'Szállítás vége' }),
    t('Float', { fieldname: 'total_mwh', label: 'Teljes mennyiség (MWh)', precision: '0' }),
    t('Date', { fieldname: 'trade_date', label: 'Kötés napja' }),
    t('Select', { fieldname: 'status', label: 'Állapot', options: 'visszaigazolasra-var\nvisszaigazolva\nvitatott\nteljesitve', in_list_view: 1 }),
  ])
  await ensureDoctype('Szikra Schedule', 'field:szikra_id', [
    t('Data', { fieldname: 'szikra_id', label: 'Azonosító', reqd: 1, unique: 1 }),
    t('Link', { fieldname: 'customer', label: 'Partner', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Date', { fieldname: 'date', label: 'Nap', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'commodity', label: 'Energia', options: 'villany\ngaz' }),
    t('Long Text', { fieldname: 'values_json', label: 'Értékek (JSON)' }),
    t('Select', { fieldname: 'status', label: 'Állapot', options: 'benyujtva\nelfogadva', in_list_view: 1 }),
    t('Data', { fieldname: 'submitted_by', label: 'Benyújtotta' }),
  ])
  await ensureDoctype('Szikra Portal Access', 'hash', [
    t('Data', { fieldname: 'user_id', label: 'Felhasználó azonosító', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'full_name', label: 'Név', reqd: 1 }),
    t('Data', { fieldname: 'email', label: 'E-mail' }),
    t('Small Text', { fieldname: 'note', label: 'Megjegyzés' }),
    t('Link', { fieldname: 'customer', label: 'Cég', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'role', label: 'Szerepkör', options: 'admin\npenzugy\nmuszaki\nolvaso\nkereskedo\nmegfelelo', reqd: 1, in_list_view: 1 }),
  ])
  await ensureDoctype('Szikra Event', 'hash', [
    t('Link', { fieldname: 'customer', label: 'Cég', options: 'Customer' }),
    t('Select', { fieldname: 'kind', label: 'Fajta', options: 'notification\naudit', reqd: 1 }),
    t('Data', { fieldname: 'user_id', label: 'Felhasználó' }),
    t('Datetime', { fieldname: 'at', label: 'Időpont' }),
    t('Small Text', { fieldname: 'text', label: 'Szöveg' }),
    t('Check', { fieldname: 'is_read', label: 'Olvasott' }),
  ])
}

async function ensureVatAccount(company: string): Promise<string> {
  const have = await c.list('Account', { fields: ['name'], filters: [['company', '=', company], ['account_name', '=', 'ÁFA']] })
  if (have.length) return have[0].name
  const parent = (await c.list('Account', { fields: ['name'], filters: [['company', '=', company], ['account_name', '=', 'Duties and Taxes'], ['is_group', '=', 1]] }))[0]
  if (!parent) throw new Error('nincs „Duties and Taxes” csoport a számlatükörben')
  const acc = await c.create('Account', { account_name: 'ÁFA', parent_account: parent.name, company, account_type: 'Tax', is_group: 0 })
  log('számla (főkönyv):', acc.name)
  return acc.name
}

async function seedData() {
  const ds = fixedDemoDataset()
  const company = (await c.list('Company', { fields: ['name'] }))[0].name as string

  for (const item of [{ code: 'Villamos energia', name: 'Villamos energia' }, { code: 'Földgáz', name: 'Földgáz' }]) {
    const have = await c.list('Item', { filters: [['item_code', '=', item.code]] })
    if (!have.length) {
      await c.create('Item', { item_code: item.code, item_name: item.name, item_group: 'Services', stock_uom: 'Nos', is_stock_item: 0 })
      log('tétel:', item.code)
    }
  }

  const customerByPartner = new Map<string, string>()
  for (const p of ds.partners) {
    const have = await c.list('Customer', { fields: ['name'], filters: [['szikra_id', '=', p.id]] })
    if (have.length) { customerByPartner.set(p.id, have[0].name); continue }
    const doc = await c.create('Customer', {
      customer_name: p.name, customer_type: 'Company', customer_group: 'Commercial', territory: 'All Territories',
      tax_id: p.taxNumber, szikra_id: p.id, szikra_address: p.address, szikra_segment: p.segment,
      szikra_contract_no: p.contractNo, szikra_card_declines: p.cardDeclines ? 1 : 0, szikra_kind: p.kind ?? 'fogyaszto',
      szikra_credit_limit: p.creditLimitHuf ?? 0, szikra_guarantee: p.guaranteeHuf ?? 0, szikra_guarantee_expiry: p.guaranteeExpiry ?? null,
    })
    customerByPartner.set(p.id, doc.name)
    log('ügyfél:', doc.name)
  }

  for (const s of ds.supplyPoints) {
    const extra = { label: s.label ?? '', tariff: s.tariff ?? '', capacity_kw: s.capacityKw ?? 0, direction: s.direction ?? 'fogyasztas', contracted_kw: s.contractedKw ?? 0, network_category: s.networkCategory ?? '' }
    if ((await c.list('Szikra Supply Point', { filters: [['szikra_id', '=', s.id]] })).length) {
      await c.update('Szikra Supply Point', s.id, extra) // a később felvett mezők pótlása
      continue
    }
    await c.create('Szikra Supply Point', {
      szikra_id: s.id, customer: customerByPartner.get(s.partnerId), energy: s.type, pod: s.pod, address: s.address,
      meter_serial: s.meterSerial, smart: s.smart ? 1 : 0, last_reading: s.lastReading, last_reading_date: s.lastReadingDate, unit: s.unit,
      ...extra,
    })
    log('fogyasztási hely:', s.id)
  }

  const haveReadings = new Set((await c.list('Szikra Meter Reading', { fields: ['supply_point', 'date'] })).map(r => `${r.supply_point}|${r.date}`))
  let nr = 0
  for (const r of ds.readings) {
    if (haveReadings.has(`${r.supplyPointId}|${r.date}`)) continue
    await c.create('Szikra Meter Reading', { supply_point: r.supplyPointId, date: r.date, value: r.value }); nr++
  }
  if (nr) log('mérőállás:', nr)

  const haveProd = new Set((await c.list('Szikra Production', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  let np = 0
  for (const p of ds.production) {
    if (haveProd.has(p.id)) continue
    await c.create('Szikra Production', { szikra_id: p.id, customer: customerByPartner.get(p.partnerId), supply_point: p.supplyPointId, month: p.month, mwh: p.mwh, price_huf_per_mwh: p.priceHufPerMwh, premium_huf: p.premiumHuf, imbalance_huf: p.imbalanceHuf, settlement_huf: p.settlementHuf, status: p.status, approvals_json: JSON.stringify(p.approvals ?? []) }); np++
  }
  if (np) log('termelési rekord:', np)

  // számlatételek: mértékegységek és tételtörzs a generált tételekből
  const lineDefs = new Map<string, { label: string, unit: string }>()
  for (const inv of ds.invoices) for (const l of inv.lines ?? []) lineDefs.set(l.code, { label: l.label, unit: l.unit })
  const haveUom = new Set((await c.list('UOM', { fields: ['name'] })).map(r => r.name))
  for (const u of new Set([...lineDefs.values()].map(d => d.unit))) {
    if (!haveUom.has(u)) { await c.create('UOM', { uom_name: u, enabled: 1 }); log('mértékegység:', u) }
  }
  const haveItem = new Set((await c.list('Item', { fields: ['item_code'] })).map(r => r.item_code))
  for (const [code, d] of lineDefs) {
    if (haveItem.has(code)) continue
    await c.create('Item', { item_code: code, item_name: d.label, item_group: 'Services', stock_uom: d.unit, is_stock_item: 0 })
  }
  if (lineDefs.size) log('tételtörzs:', lineDefs.size, 'tétel')

  // ÁFA: fix összegű adósor (a számlakép végösszege forintra egyezik)
  const vatAccount = await ensureVatAccount(company)
  let ni = 0
  const haveIv = new Set((await c.list('Szikra Interval Data', { fields: ['supply_point', 'month'] })).map(r => `${r.supply_point}|${r.month}`))
  let niv = 0
  for (const iv of ds.intervals) {
    if (haveIv.has(`${iv.supplyPointId}|${iv.month}`)) continue
    await c.create('Szikra Interval Data', { supply_point: iv.supplyPointId, month: iv.month, interval_minutes: iv.intervalMinutes, kwh_json: JSON.stringify(iv.kwh) }); niv++
  }
  if (niv) log('intervallumadat-hónap:', niv)
  const haveTar = new Set((await c.list('Szikra Tariff', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const tf of ds.tariffs) {
    if (haveTar.has(tf.id)) continue
    const { id, name, kind, partnerId: _p, ...params } = tf
    await c.create('Szikra Tariff', { szikra_id: id, customer: customerByPartner.get(tf.partnerId!), tariff_name: name, kind, params_json: JSON.stringify(params) })
  }

  const haveOut = new Set((await c.list('Szikra Outage', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const o of ds.outages) {
    if (haveOut.has(o.id)) continue
    await c.create('Szikra Outage', { szikra_id: o.id, customer: customerByPartner.get(o.partnerId), supply_point: o.supplyPointId, kind: o.kind, date_from: o.from, date_to: o.to, purpose: o.purpose, proposed_by_id: o.proposedBy.userId, proposed_by_name: o.proposedBy.name, status: o.status, approvals_json: JSON.stringify(o.approvals) })
  }
  if (ds.outages.length) log('leállások:', ds.outages.length)
  // auditnapló-előzmény (a kulcs: cég|felhasználó|időpont|szöveg alapján idempotens)
  const auditKey = (customer: string, user: string, at: string, text: string) => `${customer}|${user}|${at}|${text}`
  const haveAudit = new Set((await c.list('Szikra Event', { fields: ['customer', 'user_id', 'at', 'text'], filters: [['kind', '=', 'audit']] })).map(r => auditKey(r.customer, r.user_id, String(r.at).slice(0, 19), r.text)))
  let na = 0
  for (const a of ds.audit) {
    const at = a.at.replace('T', ' ').slice(0, 19)
    const cust = customerByPartner.get(a.partnerId)!
    if (haveAudit.has(auditKey(cust, a.userId, at, a.action))) continue
    await c.create('Szikra Event', { kind: 'audit', customer: cust, user_id: a.userId, at, text: a.action }); na++
  }
  if (na) log('audit-bejegyzés:', na)

  const haveDeals = new Set((await c.list('Szikra Deal', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const d of ds.deals) {
    if (haveDeals.has(d.id)) continue
    await c.create('Szikra Deal', { szikra_id: d.id, customer: customerByPartner.get(d.partnerId), commodity: d.commodity, product: d.product, side: d.side, volume: d.volume, volume_unit: d.volumeUnit, price_eur_mwh: d.priceEurMwh, fx_huf_per_eur: d.fxHufPerEur, delivery_from: d.deliveryFrom, delivery_to: d.deliveryTo, total_mwh: d.totalMwh, trade_date: d.tradeDate, status: d.status })
  }
  if (ds.deals.length) log('ügyletek:', ds.deals.length)
  const haveSch = new Set((await c.list('Szikra Schedule', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const sc of ds.schedule) {
    if (haveSch.has(sc.id)) continue
    await c.create('Szikra Schedule', { szikra_id: sc.id, customer: customerByPartner.get(sc.partnerId), date: sc.date, commodity: sc.commodity, values_json: JSON.stringify(sc.values), status: sc.status, submitted_by: sc.submittedBy })
  }
  if (ds.schedule.length) log('menetrend:', ds.schedule.length)

  const existing = new Set((await c.list('Sales Invoice', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const inv of ds.invoices) {
    if (existing.has(inv.id)) continue
    const sp = ds.supplyPoints.find(s => s.id === inv.supplyPointId)
    const net = (inv.lines ?? []).reduce((a, l) => a + l.amountHuf, 0)
    const doc = await c.create('Sales Invoice', {
      company, customer: customerByPartner.get(inv.partnerId), posting_date: inv.issueDate, set_posting_time: 1, due_date: inv.dueDate,
      szikra_id: inv.id, szikra_period: inv.period, szikra_supply_point: inv.supplyPointId ?? '',
      ...(inv.usage ? { szikra_usage: JSON.stringify(inv.usage) } : {}),
      items: inv.lines
        ? inv.lines.map(l => ({ item_code: l.code, qty: l.quantity, rate: l.unitPrice, szikra_category: l.category }))
        : [{ item_code: sp?.type === 'gaz' ? 'Földgáz' : 'Villamos energia', qty: 1, rate: inv.amountHuf }],
      ...(inv.lines ? { taxes: [{ charge_type: 'Actual', account_head: vatAccount, description: `ÁFA ${VAT_PCT}%`, tax_amount: inv.amountHuf - net }] } : {}),
    })
    await c.method('frappe.client.submit', { doc })
    if (inv.status === 'paid') await payInvoiceInErp(c, doc.name, 'DEMO-ELOZMENY')
    if (++ni % 25 === 0) log('számla:', ni)
  }

  const haveAccess = new Set((await c.list('Szikra Portal Access', { fields: ['user_id', 'customer'] })).map(r => `${r.user_id}|${r.customer}`))
  for (const m of ds.memberships) {
    const customer = customerByPartner.get(m.partnerId)!
    if (haveAccess.has(`${m.userId}|${customer}`)) continue
    const u = ds.users.find(x => x.id === m.userId)!
    await c.create('Szikra Portal Access', { user_id: u.id, full_name: u.name, email: u.email, note: u.note, customer, role: m.role })
    log('hozzáférés:', m.userId, '->', customer, m.role)
  }
}

async function writeKeys() {
  const file = new URL('./.env.local', import.meta.url)
  if (existsSync(file)) return log('API-kulcs már megvan:', file.pathname)
  const secret = (await c.method<{ api_secret: string }>('frappe.core.doctype.user.user.generate_keys', { user: 'Administrator' })).api_secret
  const user = await c.get('User', 'Administrator')
  writeFileSync(file, [
    '# Generált; ne commitold. Élő ERPNext módhoz: set -a; source erp/.env.local; set +a; pnpm dev',
    'NUXT_BACKEND=erpnext',
    `NUXT_ERP_BASE_URL=${BASE}`,
    `NUXT_ERP_API_KEY=${user.api_key}`,
    `NUXT_ERP_API_SECRET=${secret}`,
    'NUXT_PUBLIC_DEMO_USERS=true',
    '',
  ].join('\n'), { mode: 0o600 })
  log('API-kulcs kiírva:', file.pathname)
  // a token tényleges működését is ellenőrizzük: friss site-nál a worker-ek eltérő titkosítókulcsot cache-elhetnek
  const probe = await fetch(`${BASE}/api/method/frappe.auth.get_logged_user`, { headers: { Authorization: `token ${user.api_key}:${secret}` } })
  if (!probe.ok) {
    unlinkSync(file)
    throw new Error(`az API-token nem működik (${probe.status}). Indítsd újra a backendet: docker compose -p szikra-erp -f erp/compose.yml restart backend websocket queue-short queue-long scheduler frontend, majd futtasd újra a seedet`)
  }
}

await ensureSetup()
await ensureLocale()
await ensureFiscalYear('2025')
await ensureSchema()
await seedData()
await writeKeys()
log('kész')

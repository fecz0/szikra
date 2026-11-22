// ERPNext előkészítése és feltöltése a fix demó-adatkészlettel.
// Használat (az ERPNext fusson: docker compose -p szikra-erp -f erp/compose.yml up -d):
//   node erp/seed.ts
// Idempotens: ami már megvan (szikra_id alapján), azt kihagyja.
import { existsSync, writeFileSync } from 'node:fs'
import { fixedDemoDataset } from '../server/domain/scenarios.ts'
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
  const have = await c.list('Custom Field', { fields: ['name'], filters: [['dt', '=', dt], ['fieldname', '=', fieldname]] })
  if (have.length) return
  await c.create('Custom Field', { dt, fieldname, label: fieldname, ...def })
  log('mező:', `${dt}.${fieldname}`)
}

async function ensureDoctype(name: string, autoname: string, fields: Record<string, unknown>[]) {
  const have = await c.list('DocType', { fields: ['name'], filters: [['name', '=', name]] })
  if (have.length) return
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
  await ensureCustomField('Sales Invoice', 'szikra_id', t('Data'))
  await ensureCustomField('Sales Invoice', 'szikra_period', t('Data'))
  await ensureCustomField('Sales Invoice', 'szikra_supply_point', t('Data'))
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
  ])
  await ensureDoctype('Szikra Portal Access', 'hash', [
    t('Data', { fieldname: 'user_id', label: 'Felhasználó azonosító', reqd: 1, in_list_view: 1 }),
    t('Data', { fieldname: 'full_name', label: 'Név', reqd: 1 }),
    t('Data', { fieldname: 'email', label: 'E-mail' }),
    t('Small Text', { fieldname: 'note', label: 'Megjegyzés' }),
    t('Link', { fieldname: 'customer', label: 'Cég', options: 'Customer', reqd: 1, in_list_view: 1 }),
    t('Select', { fieldname: 'role', label: 'Szerepkör', options: 'admin\npenzugy\nmuszaki\nolvaso', reqd: 1, in_list_view: 1 }),
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
      szikra_contract_no: p.contractNo, szikra_card_declines: p.cardDeclines ? 1 : 0,
    })
    customerByPartner.set(p.id, doc.name)
    log('ügyfél:', doc.name)
  }

  for (const s of ds.supplyPoints) {
    if ((await c.list('Szikra Supply Point', { filters: [['szikra_id', '=', s.id]] })).length) continue
    await c.create('Szikra Supply Point', {
      szikra_id: s.id, customer: customerByPartner.get(s.partnerId), energy: s.type, pod: s.pod, address: s.address,
      meter_serial: s.meterSerial, smart: s.smart ? 1 : 0, last_reading: s.lastReading, last_reading_date: s.lastReadingDate, unit: s.unit,
    })
    log('fogyasztási hely:', s.id)
  }

  const existing = new Set((await c.list('Sales Invoice', { fields: ['szikra_id'] })).map(r => r.szikra_id))
  for (const inv of ds.invoices) {
    if (existing.has(inv.id)) continue
    const sp = ds.supplyPoints.find(s => s.id === inv.supplyPointId)
    const doc = await c.create('Sales Invoice', {
      company, customer: customerByPartner.get(inv.partnerId), posting_date: inv.issueDate, set_posting_time: 1, due_date: inv.dueDate,
      szikra_id: inv.id, szikra_period: inv.period, szikra_supply_point: inv.supplyPointId ?? '',
      items: [{ item_code: sp?.type === 'gaz' ? 'Földgáz' : 'Villamos energia', qty: 1, rate: inv.amountHuf }],
    })
    await c.method('frappe.client.submit', { doc })
    if (inv.status === 'paid') await payInvoiceInErp(c, doc.name, 'DEMO-ELOZMENY')
    log('számla:', doc.name, inv.id, inv.status)
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
}

await ensureSetup()
await ensureLocale()
await ensureSchema()
await seedData()
await writeKeys()
log('kész')

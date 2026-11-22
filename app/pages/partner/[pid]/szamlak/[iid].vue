<script setup lang="ts">
import type { Invoice, InvoiceLine } from '../../../../../server/domain/types'

interface Detail {
  invoice: Invoice
  partner: { name: string, taxNumber: string, contractNo: string, address: string }
  supplyPoint?: { label?: string, pod: string, address: string, meterSerial: string, type: 'villany' | 'gaz', tariff?: string, contractedKw?: number, networkCategory?: string }
  totals: { net: number, vat: number, vatPct: number } | null
  source: string
}

definePageMeta({ layout: 'partner', middleware: 'auth' })
const route = useRoute()
const pid = String(route.params.pid)
const iid = String(route.params.iid)
const base = `/api/partner/${encodeURIComponent(pid)}/invoices/${encodeURIComponent(iid)}`
const { data: d, error, refresh } = await useFetch<Detail>(base)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canPay = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('invoices.pay'))

const nf = (n: number, dec = 0) => new Intl.NumberFormat('hu-HU', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)
const huf = (n: number) => `${nf(n)} Ft`
const statusLabel = { open: 'Nyitott', paid: 'Kiegyenlítve', overdue: 'Lejárt' } as const
const groups = computed(() => {
  const lines = d.value?.invoice.lines ?? []
  const defs: { key: InvoiceLine['category'], title: string }[] = [
    { key: 'energia', title: 'Energiadíj' },
    { key: 'rendszerhasznalat', title: 'Rendszerhasználati díjak' },
    { key: 'penzeszkoz-ado', title: 'Pénzeszközök és adók' },
  ]
  return defs.map(g => ({ ...g, lines: lines.filter(l => l.category === g.key), sum: lines.filter(l => l.category === g.key).reduce((s, l) => s + l.amountHuf, 0) })).filter(g => g.lines.length)
})
const kind = computed(() => (d.value?.supplyPoint?.type === 'gaz' ? 'Földgáz' : 'Villamos energia'))

function print() { window.print() }

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref(false)
async function pay() {
  busy.value = true
  message.value = null
  try {
    await $fetch(`${base}/pay`, { method: 'POST' })
    message.value = { kind: 'ok', text: 'Sikeres fizetés' }
    await refresh()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen fizetés' }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="error" class="card narrow" role="alert"><h1>A számla nem található</h1></section>
  <article v-else-if="d" class="invoice" data-testid="invoice-detail">
    <div class="actions no-print">
      <NuxtLink :to="`/partner/${pid}/szamlak`">← Vissza a számlákhoz</NuxtLink>
      <span class="grow" />
      <button v-if="d.invoice.status !== 'paid' && canPay" :disabled="busy" data-testid="pay" @click="pay">Fizetés</button>
      <button class="ghost" data-testid="print" @click="print">Nyomtatás</button>
    </div>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">{{ message.text }}</p>

    <section class="card">
      <header class="inv-head">
        <div>
          <h1>{{ kind }} elszámoló számla</h1>
          <p class="hint">Számla sorszáma: <code data-testid="invoice-id">{{ d.invoice.id }}</code></p>
        </div>
        <div class="inv-total">
          <span class="hint">Fizetendő összeg</span>
          <strong data-testid="gross-head">{{ huf(d.invoice.amountHuf) }}</strong>
          <span :class="['status', d.invoice.status]" data-testid="invoice-status">{{ statusLabel[d.invoice.status] }}</span>
        </div>
      </header>
      <dl class="kv">
        <div><dt>Számla kelte</dt><dd>{{ d.invoice.issueDate }}</dd></div>
        <div><dt>Teljesítés kelte</dt><dd>{{ d.invoice.dueDate }}</dd></div>
        <div><dt>Fizetési határidő</dt><dd>{{ d.invoice.dueDate }}</dd></div>
        <div v-if="d.invoice.usage"><dt>Elszámolási időszak</dt><dd data-testid="period">{{ d.invoice.usage.periodFrom }} – {{ d.invoice.usage.periodTo }}</dd></div>
      </dl>
    </section>

    <div class="cols">
      <section class="card">
        <h2>Fizető</h2>
        <dl class="kv one">
          <div><dt>Név</dt><dd>{{ d.partner.name }}</dd></div>
          <div><dt>Székhely</dt><dd>{{ d.partner.address }}</dd></div>
          <div><dt>Adószám</dt><dd>{{ d.partner.taxNumber }}</dd></div>
          <div><dt>Szerződéses folyószámla</dt><dd><code>{{ d.partner.contractNo }}</code></dd></div>
        </dl>
      </section>
      <section v-if="d.supplyPoint" class="card" data-testid="supply-block">
        <h2>Felhasználási hely</h2>
        <dl class="kv one">
          <div><dt>Hely</dt><dd>{{ d.supplyPoint.label }} · {{ d.supplyPoint.address }}</dd></div>
          <div><dt>Mérési pont azonosító (POD)</dt><dd><code>{{ d.supplyPoint.pod }}</code></dd></div>
          <div><dt>Mérő gyártási száma</dt><dd>{{ d.supplyPoint.meterSerial }}</dd></div>
          <div v-if="d.supplyPoint.networkCategory"><dt>Hálózati kategória</dt><dd data-testid="network-category">{{ d.supplyPoint.networkCategory }}</dd></div>
          <div v-if="d.supplyPoint.contractedKw"><dt>Szerződött teljesítmény</dt><dd>{{ nf(d.supplyPoint.contractedKw) }} {{ d.supplyPoint.type === 'gaz' ? 'kWh/h' : 'kW' }}</dd></div>
          <div v-if="d.supplyPoint.tariff"><dt>Díjcsomag</dt><dd>{{ d.supplyPoint.tariff }}</dd></div>
        </dl>
      </section>
    </div>

    <section v-if="d.invoice.usage" class="card" data-testid="usage-block">
      <h2>Mérőadatok</h2>
      <table>
        <thead><tr><th>Előző mérőállás</th><th>Jelenlegi mérőállás</th><th>Fogyasztás</th></tr></thead>
        <tbody><tr>
          <td>{{ nf(d.invoice.usage.prevReading) }} {{ d.invoice.usage.unit === 'kWh' ? 'kWh' : 'm³' }}</td>
          <td>{{ nf(d.invoice.usage.currReading) }} {{ d.invoice.usage.unit === 'kWh' ? 'kWh' : 'm³' }}</td>
          <td><strong data-testid="usage-total">{{ nf(d.invoice.usage.total) }} {{ d.invoice.usage.unit === 'kWh' ? 'kWh' : 'm³' }}</strong></td>
        </tr></tbody>
      </table>
      <table v-if="d.invoice.usage.zones" class="zones" data-testid="usage-zones">
        <thead><tr><th>Nappali (6–17)</th><th>Csúcs (17–22)</th><th>Völgy (22–6)</th></tr></thead>
        <tbody><tr>
          <td>{{ nf(d.invoice.usage.zones.nappali) }} kWh</td><td>{{ nf(d.invoice.usage.zones.csucs) }} kWh</td><td>{{ nf(d.invoice.usage.zones.volgy) }} kWh</td>
        </tr></tbody>
      </table>
    </section>

    <section class="card" data-testid="lines-block">
      <h2>Számlarészletező</h2>
      <p v-if="!d.invoice.lines" class="hint">Ehhez a számlához nem tartozik tételes bontás.</p>
      <table v-else class="lines">
        <thead><tr><th>Megnevezés</th><th class="r">Mennyiség</th><th class="r">Egységár (Ft)</th><th class="r">Nettó (Ft)</th></tr></thead>
        <template v-for="g in groups" :key="g.key">
          <tbody>
            <tr class="grp"><th colspan="3">{{ g.title }}</th><th class="r" :data-testid="`group-${g.key}`">{{ nf(g.sum) }}</th></tr>
            <tr v-for="l in g.lines" :key="l.code" :data-testid="`line-${l.code}`">
              <td>{{ l.label }}</td>
              <td class="r">{{ nf(l.quantity, Number.isInteger(l.quantity) ? 0 : 2) }} {{ l.unit }}</td>
              <td class="r">{{ nf(l.unitPrice, 2) }}</td>
              <td class="r">{{ nf(l.amountHuf) }}</td>
            </tr>
          </tbody>
        </template>
        <tfoot v-if="d.totals">
          <tr><th colspan="3">Nettó összesen</th><th class="r" data-testid="net-total">{{ nf(d.totals.net) }}</th></tr>
          <tr><th colspan="3">ÁFA ({{ d.totals.vatPct }}%)</th><th class="r" data-testid="vat-total">{{ nf(d.totals.vat) }}</th></tr>
          <tr class="gross"><th colspan="3">Fizetendő összesen (bruttó)</th><th class="r" data-testid="gross-total">{{ nf(d.invoice.amountHuf) }}</th></tr>
        </tfoot>
      </table>
      <p class="hint">A rendszerhasználati díjak forrása: {{ d.source }}. Az energiadíj, a pénzeszközök, a jövedéki adó és a gázdíjak demó-értékek.</p>
    </section>
  </article>
</template>

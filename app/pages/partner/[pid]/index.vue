<script setup lang="ts">
definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
interface Overview {
  openCases: number
  invoices: { open: number, overdue: number, outstandingHuf: number } | null
  supply: { count: number, lastReadingDate: string | null } | null
  trading: { pendingDeals: number | null, disputedDeals: number | null, credit: { usedPct: number, limitHuf: number, usedHuf: number, guaranteeDaysLeft: number | null } | null, tomorrowSubmitted: boolean | null } | null
  production: { month: string | null, mwh: number, settlementHuf: number, openSettlements: number } | null
  notifications: { id: string, at: string, text: string }[]
}
const { data: o } = await useFetch<Overview>(`/api/partner/${encodeURIComponent(pid)}/overview`)
const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'
</script>

<template>
  <div v-if="o">
    <div class="tiles">
      <div v-if="o.invoices" class="tile" data-testid="tile-invoices">
        <h3>Számlák</h3>
        <strong data-testid="outstanding">{{ huf(o.invoices.outstandingHuf) }}</strong>
        <p>{{ o.invoices.open }} nyitott, {{ o.invoices.overdue }} lejárt</p>
        <NuxtLink :to="`/partner/${pid}/szamlak`">Számlák megtekintése</NuxtLink>
      </div>
      <div v-if="o.trading?.credit" class="tile" data-testid="tile-credit">
        <h3>Hitelkeret-kihasználtság</h3>
        <strong data-testid="credit-pct">{{ new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(o.trading.credit.usedPct) }}%</strong>
        <progress :value="Math.min(100, o.trading.credit.usedPct)" max="100" :class="{ warn: o.trading.credit.usedPct >= 80 }" aria-label="Hitelkeret-kihasználtság" />
        <p>{{ huf(o.trading.credit.usedHuf) }} / {{ huf(o.trading.credit.limitHuf) }}</p>
        <NuxtLink :to="`/partner/${pid}/ugyletek`">Ügyletek és limit</NuxtLink>
      </div>
      <div v-if="o.trading && o.trading.pendingDeals !== null" class="tile" data-testid="tile-deals">
        <h3>Visszaigazolásra váró ügyletek</h3>
        <strong data-testid="pending-deals">{{ o.trading.pendingDeals }}</strong>
        <p>Vitatott: {{ o.trading.disputedDeals }}</p>
        <NuxtLink :to="`/partner/${pid}/ugyletek`">Ügyletek</NuxtLink>
      </div>
      <div v-if="o.trading && o.trading.tomorrowSubmitted !== null" class="tile" data-testid="tile-schedule">
        <h3>Holnapi villany-menetrend</h3>
        <strong data-testid="tomorrow-state">{{ o.trading.tomorrowSubmitted ? 'Benyújtva' : 'Hiányzik' }}</strong>
        <NuxtLink :to="`/partner/${pid}/menetrend`">Menetrend</NuxtLink>
      </div>
      <div v-if="o.production" class="tile" data-testid="tile-production">
        <h3>Termelés ({{ o.production.month ?? '–' }})</h3>
        <strong data-testid="last-month-mwh">{{ new Intl.NumberFormat('hu-HU').format(o.production.mwh) }} MWh</strong>
        <p>Elszámolás: {{ huf(o.production.settlementHuf) }} · nyitott elszámolás: {{ o.production.openSettlements }}</p>
        <NuxtLink :to="`/partner/${pid}/termeles`">Termelés és elszámolás</NuxtLink>
      </div>
      <div v-if="o.supply" class="tile" data-testid="tile-supply">
        <h3>Fogyasztási helyek</h3>
        <strong>{{ o.supply.count }}</strong>
        <p>Utolsó leolvasás: {{ o.supply.lastReadingDate ?? '–' }}</p>
        <NuxtLink :to="`/partner/${pid}/fogyasztasi-helyek`">Megtekintés</NuxtLink>
      </div>
      <div class="tile" data-testid="tile-cases">
        <h3>Nyitott ügyek</h3>
        <strong data-testid="open-cases">{{ o.openCases }}</strong>
        <NuxtLink :to="`/partner/${pid}/ugyek`">Ügyeim</NuxtLink>
      </div>
    </div>
    <section class="card" data-testid="notifications">
      <h2>Értesítések</h2>
      <p v-if="!o.notifications.length" class="hint">Nincs új értesítés.</p>
      <ul class="list">
        <li v-for="n in o.notifications" :key="n.id">{{ new Date(n.at).toLocaleString('hu-HU') }}: {{ n.text }}</li>
      </ul>
    </section>
  </div>
</template>

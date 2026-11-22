<script setup lang="ts">
// Blokkonkénti leállási idővonal (Gantt jellegű SVG). Jóváhagyott: sötétkék, jóváhagyásra váró: borostyán.
const props = defineProps<{
  rows: { id: string, label: string }[]
  outages: { id: string, supplyPointId: string, from: string, to: string, status: string, kind: string }[]
  from: string
  to: string
  today: string
}>()

const W = 760
const pad = { l: 96, r: 8, t: 22, b: 8 }
const rowH = 30
const H = computed(() => pad.t + props.rows.length * rowH + pad.b)
const t0 = computed(() => Date.parse(props.from))
const t1 = computed(() => Date.parse(props.to))
const x = (iso: string) => pad.l + ((Math.min(Math.max(Date.parse(iso), t0.value), t1.value) - t0.value) / (t1.value - t0.value)) * (W - pad.l - pad.r)
const months = computed(() => {
  const out: { x: number, label: string }[] = []
  const d = new Date(t0.value)
  d.setUTCDate(1)
  while (d.getTime() <= t1.value) {
    out.push({ x: x(d.toISOString().slice(0, 10)), label: `${String(d.getUTCFullYear()).slice(2)}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` })
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
})
const rowOf = (id: string) => props.rows.findIndex(r => r.id === id)
</script>

<template>
  <figure class="chart" data-testid="outage-timeline">
    <figcaption>Leállási terv <span class="hint">(blokkonként)</span></figcaption>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Blokkonkénti leállási idővonal">
      <g class="grid">
        <template v-for="m in months" :key="m.label">
          <line :x1="m.x" :x2="m.x" :y1="pad.t - 4" :y2="H - pad.b" />
          <text :x="m.x + 2" :y="pad.t - 8">{{ m.label }}</text>
        </template>
      </g>
      <g v-for="(r, i) in rows" :key="r.id">
        <text :x="pad.l - 6" :y="pad.t + i * rowH + rowH / 2 + 4" text-anchor="end">{{ r.label }}</text>
        <line class="rowline" :x1="pad.l" :x2="W - pad.r" :y1="pad.t + (i + 1) * rowH" :y2="pad.t + (i + 1) * rowH" />
      </g>
      <rect
        v-for="o in outages" :key="o.id" :class="['obar', o.status, o.kind]" :data-testid="`bar-${o.id}`"
        :x="x(o.from)" :y="pad.t + rowOf(o.supplyPointId) * rowH + 6" :width="Math.max(3, x(o.to) - x(o.from))" :height="rowH - 12" rx="3"
      >
        <title>{{ o.from }} – {{ o.to }} ({{ o.status === 'jovahagyva' ? 'jóváhagyva' : 'jóváhagyásra vár' }})</title>
      </rect>
      <line class="today" :x1="x(today)" :x2="x(today)" :y1="pad.t - 4" :y2="H - pad.b" />
    </svg>
  </figure>
</template>

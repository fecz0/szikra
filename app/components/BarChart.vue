<script setup lang="ts">
// Egyszerű, függőségmentes oszlopdiagram (SVG). Az adatok táblázatként is elérhetők a képernyőolvasónak.
const props = defineProps<{
  items: { label: string, value: number }[]
  unit: string
  title: string
  testid?: string
}>()

const W = 640
const H = 220
const pad = { l: 44, r: 8, t: 12, b: 28 }
const max = computed(() => Math.max(1, ...props.items.map(i => i.value)))
const niceMax = computed(() => {
  const m = max.value
  const pow = 10 ** Math.floor(Math.log10(m))
  return Math.ceil(m / pow) * pow
})
const bw = computed(() => (W - pad.l - pad.r) / Math.max(1, props.items.length))
const fmt = (n: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(n)
const y = (v: number) => H - pad.b - (v / niceMax.value) * (H - pad.t - pad.b)
</script>

<template>
  <figure class="chart" :data-testid="testid">
    <figcaption>{{ title }} <span class="hint">({{ unit }})</span></figcaption>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${title}: ${items.map(i => `${i.label} ${fmt(i.value)} ${unit}`).join(', ')}`">
      <g class="grid">
        <template v-for="t in [0, 0.5, 1]" :key="t">
          <line :x1="pad.l" :x2="W - pad.r" :y1="y(niceMax * t)" :y2="y(niceMax * t)" />
          <text :x="pad.l - 6" :y="y(niceMax * t) + 4" text-anchor="end">{{ fmt(niceMax * t) }}</text>
        </template>
      </g>
      <g v-for="(it, i) in items" :key="it.label">
        <rect class="bar" :x="pad.l + i * bw + bw * 0.15" :y="y(it.value)" :width="bw * 0.7" :height="Math.max(0, H - pad.b - y(it.value))" rx="3">
          <title>{{ it.label }}: {{ fmt(it.value) }} {{ unit }}</title>
        </rect>
        <text class="lbl" :x="pad.l + i * bw + bw / 2" :y="H - 10" text-anchor="middle">{{ it.label }}</text>
      </g>
    </svg>
  </figure>
</template>

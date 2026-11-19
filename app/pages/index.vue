<script setup lang="ts">
const customerId = ref('')
const showDemo = useRuntimeConfig().public.demoUsers
const demoUsers = [
  { id: 'DEMO-OKOS', name: 'Teszt Elek', note: 'okosmérő, villany + gáz, nyitott számlák' },
  { id: 'DEMO-ELMARADT', name: 'Késő Kata', note: 'lejárt számlák' },
  { id: 'DEMO-KARTYA', name: 'Pech Péter', note: 'a kártyaterhelés elutasításra kerül' },
  { id: 'DEMO-RENDEZETT', name: 'Rendes Réka', note: 'minden számla kiegyenlítve' },
]
async function login() {
  const id = customerId.value.trim()
  if (id) await navigateTo(`/fiok/${encodeURIComponent(id)}`)
}

// Mérőóra-állás megadása belépés nélkül, a belépő kártyán.
const showMeterForm = ref(false)
const meterNumber = ref('')
const meterReading = ref('')
const meterError = ref('')
const meterConfirmation = ref<{ number: string, reading: string } | null>(null)

function submitMeterReading() {
  meterConfirmation.value = null
  const number = meterNumber.value.trim()
  const reading = meterReading.value.trim()

  if (!number) {
    meterError.value = 'Add meg a mérőóra számát.'
    return
  }
  if (!reading) {
    meterError.value = 'Add meg a mérőóra állását.'
    return
  }
  if (!/^-?\d+(?:[.,]\d+)?$/.test(reading)) {
    meterError.value = 'A mérőóra állása csak szám lehet.'
    return
  }
  if (Number(reading.replace(',', '.')) < 0) {
    meterError.value = 'A mérőóra állása nem lehet negatív.'
    return
  }

  meterError.value = ''
  meterConfirmation.value = { number, reading }
}
</script>

<template>
  <section class="hero" data-testid="hero">
    <div class="hero-in">
      <div class="hero-text">
        <aside class="notice" data-testid="demo-notice">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
          </svg>
          <div>
            <strong>Demó tájékoztató</strong>
            <p>Ez a Szikra bemutató környezete. Minden adat kitalált, a fizetések fél óránként visszaállnak.</p>
          </div>
        </aside>
        <h1>Szikra online ügyintézés</h1>
        <p class="lead">
          Villany- és gázügyei egy helyen: számlák, mérőórák és fizetés néhány kattintással.
          Add meg az ügyfélazonosítódat a belépéshez.
        </p>
        <div class="login">
          <form @submit.prevent="login">
            <label for="cid">Ügyfélazonosító</label>
            <input id="cid" v-model="customerId" autocomplete="off" placeholder="pl. T1A2B3C4D">
            <button type="submit">Belépés</button>
          </form>

          <a
            href="#meter-reading"
            class="meter-link"
            data-testid="meter-reading-link"
            @click.prevent="showMeterForm = true"
          >Mérőóra-állás megadása</a>

          <form
            v-if="showMeterForm"
            id="meter-reading"
            class="meter-form"
            data-testid="meter-reading-form"
            novalidate
            @submit.prevent="submitMeterReading"
          >
            <label for="meter-number">Mérőóra száma</label>
            <input
              id="meter-number"
              v-model="meterNumber"
              autocomplete="off"
              data-testid="meter-number-input"
            >
            <label for="meter-reading">Aktuális mérőóra-állás</label>
            <input
              id="meter-reading"
              v-model="meterReading"
              inputmode="decimal"
              autocomplete="off"
              data-testid="meter-reading-input"
            >
            <p v-if="meterError" class="msg err" role="alert">{{ meterError }}</p>
            <button type="submit">Beküldés</button>
          </form>

          <p v-if="meterConfirmation" class="msg ok" role="status" data-testid="meter-reading-confirmation">
            Mérőóra-állás rögzítve: {{ meterConfirmation.number }} mérőóra, {{ meterConfirmation.reading }}.
          </p>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <svg viewBox="0 0 420 400" focusable="false">
          <circle cx="215" cy="200" r="190" fill="#d1d5db" />
          <circle cx="225" cy="200" r="168" fill="#00567e" />
          <circle cx="225" cy="200" r="168" fill="url(#g)" />
          <rect x="10" y="118" width="190" height="26" rx="13" fill="#d1d5db" />
          <circle cx="30" cy="131" r="13" fill="#e5e7eb" />
          <rect x="60" y="176" width="150" height="26" rx="13" fill="#d1d5db" />
          <path d="M225 95l17 62 62 17-62 17-17 62-17-62-62-17 62-17z" fill="#f0b323" />
          <path d="M310 285l7 24 24 7-24 7-7 24-7-24-24-7 24-7z" fill="#fff" opacity=".85" />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1c2b39" />
              <stop offset="1" stop-color="#00567e" stop-opacity=".2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </section>

  <section v-if="showDemo" id="demo" class="band" data-testid="demo-users">
    <div class="band-in">
      <h2>Demó ügyfelek</h2>
      <p class="hint">Kitalált adatok, kattints bármelyikre. A fizetések fél óránként visszaállnak.</p>
      <ul class="demo">
        <li v-for="u in demoUsers" :key="u.id" class="tile">
          <NuxtLink :to="`/fiok/${u.id}`"><strong>{{ u.name }}</strong></NuxtLink>
          <code>{{ u.id }}</code>
          <span class="hint">{{ u.note }}</span>
        </li>
      </ul>
    </div>
  </section>

  <section class="band alt">
    <div class="band-in">
      <h2>Egyszerű ügyintézés az Ön számára legfontosabb ügyekben</h2>
      <ul class="features">
        <li class="tile">
          <h3>Számlák egy helyen</h3>
          <p>Belépés után azonnal látja a nyitott és a lejárt számláit.</p>
        </li>
        <li class="tile">
          <h3>Online fizetés</h3>
          <p>A számlát a mentett bankkártyával néhány kattintással kiegyenlítheti.</p>
        </li>
        <li class="tile">
          <h3>Villany és gáz</h3>
          <p>Okosmérők és hagyományos mérők utolsó állása egy áttekinthető nézetben.</p>
        </li>
      </ul>
    </div>
  </section>
</template>

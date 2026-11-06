<script setup lang="ts">
const customerId = ref('')
async function login() {
  const id = customerId.value.trim()
  if (id) await navigateTo(`/fiok/${encodeURIComponent(id)}`)
}
</script>

<template>
  <section class="card narrow">
    <h1>Ügyfélportál</h1>
    <p>Add meg az ügyfélazonosítódat a belépéshez.</p>
    <form @submit.prevent="login">
      <label for="cid">Ügyfélazonosító</label>
      <input id="cid" v-model="customerId" autocomplete="off" placeholder="pl. T1A2B3C4D">
      <button type="submit">Belépés</button>
    </form>
  </section>
</template>

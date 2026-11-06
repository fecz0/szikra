export default defineEventHandler((event) => {
  // A deploy ezzel ellenőrzi, hogy tényleg az új build fut-e.
  return { status: 'ok', sha: useRuntimeConfig(event).buildSha || null }
})

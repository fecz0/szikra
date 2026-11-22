const RESET_MS = 30 * 60 * 1000

// Snapshot módban a demó félóránként visszaáll az exportált állapotra:
// a fizetések és az új ügyek nem "ragadnak be" a következő nézőnek.
export default defineNitroPlugin(() => {
  const b = useBackend()
  if (!b.reset) return
  setInterval(() => b.reset!(), RESET_MS).unref()
})

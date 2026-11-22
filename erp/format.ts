/** A snapshot olvasható, de a számsorok (intervallumadat, menetrend) egy sorba kerülnek: a fájl nem dagad meg. */
export function formatSnapshot(ds: unknown): string {
  return JSON.stringify(ds, null, 2).replace(/\[\s+((?:-?\d+(?:\.\d+)?,?\s*)+)\]/g, (_m, inner: string) => `[${inner.replace(/\s+/g, ' ').trim()}]`) + '\n'
}

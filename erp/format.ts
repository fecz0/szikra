/** Egy sor csak számot tartalmaz-e (pl. `  1234,`). Szándékosan nem reguláris kifejezés: nincs ReDoS-kockázat. */
function isNumberLine(line: string): boolean {
  const t = line.trim()
  const body = t.endsWith(',') ? t.slice(0, -1) : t
  return body !== '' && !Number.isNaN(Number(body))
}

/**
 * A snapshot olvasható, de a számsorok (intervallumadat, menetrend) egy sorba kerülnek: a fájl nem dagad meg.
 * Soronként dolgozik: a `[` utáni, csak számot tartalmazó sorokat a záró `]`-ig egy sorba vonja.
 */
export function formatSnapshot(ds: unknown): string {
  const lines = JSON.stringify(ds, null, 2).split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.endsWith('[')) {
      let j = i + 1
      const nums: string[] = []
      while (j < lines.length && isNumberLine(lines[j]!)) {
        const t = lines[j]!.trim()
        nums.push(t.endsWith(',') ? t.slice(0, -1) : t)
        j++
      }
      if (nums.length && lines[j]?.trim().startsWith(']')) {
        out.push(`${line}${nums.join(', ')}${lines[j]!.trim()}`)
        i = j
        continue
      }
    }
    out.push(line)
  }
  return `${out.join('\n')}\n`
}

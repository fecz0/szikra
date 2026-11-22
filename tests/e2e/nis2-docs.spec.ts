import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from './support/fixtures'

/**
 * A NIS2 PoC dokumentáció elfogadási tesztje.
 * Nem böngészős viselkedést ellenőriz, hanem a leszállított dokumentumcsomag
 * szerkezetét és azt, hogy a hivatkozott bizonyítékok valóban léteznek a repóban.
 */
const ROOT = process.cwd()
const DOCS = resolve(ROOT, 'docs/compliance/nis2-poc')

const REQUIRED_DOCS = [
  '01-system-overview.md',
  '02-nis2-control-assessment.md',
  '03-evidence-register.md',
  '04-gap-analysis.md',
] as const

const docPath = (name: string) => resolve(DOCS, name)
const doc = (name: string) => readFileSync(docPath(name), 'utf8')

// A feature leírásában kötelezően lefedett NIS2 területek.
const REQUIRED_AREAS = [
  'Risk analysis and information system security',
  'Incident handling',
  'Business continuity and disaster recovery',
  'Supply-chain security',
  'Secure acquisition, development and maintenance',
  'Vulnerability handling and disclosure',
  'Effectiveness of cybersecurity controls',
  'Cryptography',
  'Access control',
  'Asset management',
  'Authentication',
  'Logging and monitoring',
] as const

const REQUIRED_STATUSES = [
  'Evidenced',
  'Partially evidenced',
  'Not evidenced',
  'Not applicable',
  'Requires validation',
] as const

// A dokumentumokban hivatkozott, ténylegesen létező repó-elemek.
const EXISTING_EVIDENCE_PATHS = [
  '.github/dependabot.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/security.yml',
  'Dockerfile',
  'README.md',
  'deploy/README.md',
  'deploy/deploy.sh',
  'nuxt.config.ts',
  'osv-scanner.toml',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'server/api/health.get.ts',
  'server/api/auth/login.post.ts',
  'server/api/auth/demo-users.get.ts',
  'server/api/partner/[pid]/invoices/[iid]/pay.post.ts',
  'server/api/partner/[pid]/cases.post.ts',
  'server/domain/permissions.ts',
  'server/domain/case-types.ts',
  'server/domain/types.ts',
  'server/utils/auth.ts',
  'server/utils/backend.ts',
  'server/utils/backends/memory.ts',
  'server/utils/backends/erpnext.ts',
  'server/utils/erp/client.ts',
  'server/routes/__test/seed.post.ts',
  'server/plugins/demo-reset.ts',
  'erp/compose.yml',
  'erp/seed.ts',
  'tests/e2e/support/fixtures.ts',
] as const

test.describe('NIS2 PoC dokumentációs csomag', () => {
  for (const name of REQUIRED_DOCS) {
    test(`${name} létezik és érdemi tartalmú`, () => {
      expect(existsSync(docPath(name)), `hiányzó dokumentum: ${name}`).toBe(true)
      expect(statSync(docPath(name)).size, `${name} túl rövid`).toBeGreaterThan(1_000)
    })
  }

  test('01: rendszerleírás kitér a célra, komponensekre, adatfolyamra és auth-ra', () => {
    const text = doc('01-system-overview.md')
    for (const topic of [
      'Application purpose',
      'Major components',
      'Architecture',
      'Deployment model',
      'External dependencies',
      'Data flows',
      'Authentication',
      'Authorization',
      'Infrastructure dependencies',
      'Operational characteristics',
    ]) {
      expect(text, `hiányzó szakasz: ${topic}`).toContain(topic)
    }
    // A PoC nem állíthatja, hogy hivatalos NIS2 audit vagy tanúsítás.
    expect(text).toContain('not an official NIS2 audit or certification')
    expect(text).toContain('server/utils/backend.ts')
  })

  test('02: minden kötelező terület és státusz szerepel a táblázatban', () => {
    const text = doc('02-nis2-control-assessment.md')
    expect(text).toContain('| Area | Status | Evidence | Gap | Recommendation |')
    for (const area of REQUIRED_AREAS) {
      expect(text, `hiányzó NIS2 terület: ${area}`).toMatch(new RegExp(area, 'i'))
    }
    for (const status of REQUIRED_STATUSES) {
      expect(text, `hiányzó státusz: ${status}`).toContain(status)
    }
    // Konkrét repó-hivatkozások, nem általános állítások.
    for (const path of ['server/utils/backend.ts', 'server/utils/auth.ts', '.github/workflows/security.yml', 'Dockerfile', 'deploy/README.md']) {
      expect(text).toContain(path)
    }
    // Legalább a 12 kötelező területhez legyen egy-egy értékelő sor.
    const statusRow = /\| (?:Evidenced|Partially evidenced|Not evidenced|Not applicable|Requires validation) \|/
    const assessmentRows = text.split('\n').filter(line => statusRow.test(line))
    expect(assessmentRows.length).toBeGreaterThanOrEqual(REQUIRED_AREAS.length)
  })

  test('03: a bizonyítékjegyzék fejlécet és valós repó-útvonalakat tartalmaz', () => {
    const text = doc('03-evidence-register.md')
    expect(text).toContain('| NIS2 Area | Evidence | Repository Location | Observation |')
    for (const path of EXISTING_EVIDENCE_PATHS) {
      expect(existsSync(resolve(ROOT, path)), `a hivatkozott útvonal nem létezik: ${path}`).toBe(true)
      expect(text, `a bizonyítékjegyzék nem hivatkozik rá: ${path}`).toContain(path)
    }
    // A hiányt is jelölni kell, nem szabad kitalált bizonyítékot gyártani.
    expect(text).toContain('Not evidenced')
  })

  test('04: minden gap tartalmazza a négy kötelező mezőt', () => {
    const text = doc('04-gap-analysis.md')
    const gaps = text.match(/^## GAP-\d{2}/gm) ?? []
    expect(gaps.length, 'legalább 10 gap szükséges').toBeGreaterThanOrEqual(10)
    for (const field of ['Description', 'Affected NIS2 area', 'Risk', 'Existing evidence']) {
      expect(text, `hiányzó gap-mező: ${field}`).toContain(field)
    }
    // A gap-ek valós, visszakereshető bizonyítékra hivatkoznak.
    expect(text).toContain('server/utils/auth.ts')
    expect(text).toContain('.github/workflows/security.yml')
  })

  test('a dokumentumokban hivatkozott repó-útvonalak mind léteznek (nincs elavult hivatkozás)', () => {
    // Csak a könyvtárat is tartalmazó, ismert kiterjesztésű útvonalak; a sorszám-utótag ( :10-13 ) levágva.
    const pathLike = /^[\w.\-[\]@/]+\/[\w.\-[\]@]+\.(?:ts|vue|yml|yaml|json|md|toml|sh)$/
    const notInRepo = new Set(['erp/.env.local']) // git-ignored, csak helyben jön létre
    const stale: string[] = []
    for (const name of REQUIRED_DOCS) {
      for (const m of doc(name).matchAll(/`([^`\n]+)`/g)) {
        const token = m[1]!.replace(/:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/, '')
        if (pathLike.test(token) && !notInRepo.has(token) && !existsSync(resolve(ROOT, token))) stale.push(`${name}: ${token}`)
      }
    }
    expect(stale, `nem létező hivatkozott útvonalak:\n${stale.join('\n')}`).toEqual([])
  })
})

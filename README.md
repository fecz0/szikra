# Szikra

Demó **B2B partnerportál** (Nuxt 4 + pnpm): több cég és szerepkör egy belépéssel, számlák és fizetés, fogyasztási
helyek, közös ügyindítási keretrendszer (számlareklamáció, tartozásigazolás, mérőállás, ajánlatkérés),
automatizált CI/CD + DevSecOps + e2e folyamattal. Minden adat kitalált.

## Háttér: ERPNext vagy JSON snapshot

Az alkalmazás kizárólag a `server/utils/backend.ts` interfészen át éri el a háttérrendszert:

- **`snapshot`** (alapértelmezett; deploy, CI, tesztek): memória-tár, a `server/data/snapshot.json`-ból töltve.
  A módosítások (fizetés, új ügy) csak memóriában élnek, félóránként visszaállnak.
- **`erpnext`** (`NUXT_BACKEND=erpnext`): élő, lokális ERPNext REST-en át. Lásd [erp/README.md](erp/README.md).

A snapshot az ERPNext exportja (`pnpm erp:export`), tehát a deploy ugyanazt az adatot mutatja, amit lokálisan ERPNextben látsz.

## Tesztelés

A teszt elején egy hívással létrejön egy teljes partner + egyedi felhasználó:

```ts
const s = await erp.seed('okos-ipari', 'penzugy')   // ~ms; forgatókönyv + szerepkör
await erp.login(page, s)                              // mock SSO, a partner oldalára visz
```

Forgatókönyvek: `server/domain/scenarios.ts`. Minden seed egyedi azonosítót ad, így a tesztek párhuzamosak.

```bash
pnpm install
pnpm dev                  # snapshot háttérrel (NUXT_PUBLIC_DEMO_USERS=true kell a demó belépőkhöz)
pnpm dev:erp              # élő ERPNexttel (előtte: pnpm erp:up && pnpm erp:seed)
pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

## Jogosultságok

Szerepkör -> képesség mátrix: `server/domain/permissions.ts`. A BFF minden hívásnál ellenőrzi
(`requireCapability`), a UI csak elrejti a gombokat. Ügytípusok konfigurációja: `server/domain/case-types.ts`.

## Pipeline

| Workflow | Tartalom |
|---|---|
| `ci.yml` | typecheck, unit, e2e (riport+videó+trace artifactként), Docker build + Trivy image scan |
| `security.yml` | CodeQL, Semgrep, gitleaks, dependency-review, OSV-scanner, Trivy fs (heti ütemezéssel is) |
| `ci.yml` `publish` job | main -> image GHCR-be, később Hetzner deploy (lásd `deploy/README.md`, kikapcsolva) |

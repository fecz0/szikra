# Szikra ⚡

Demó energiaszolgáltatói ügyfélportál (kitalált adatok). A cél nem a portál, hanem a **folyamat**:
automatizált CI/CD, DevSecOps és Playwright e2e, **szimulált SAP-pal**.

## A lényeg: SAP mock + seed

Az alkalmazás csak a `server/utils/sap.ts` adapteren át beszél a SAP-pal. Demó/teszt módban
(`NUXT_MOCK_SAP=true`) ez a beépített `/mock-sap` szerver. A teszt elején egy hívással létrejön a teljes
SAP-objektumcsomag (ügyfél, szerződéses számla, okosmérők, számlák, fizetési mód):

```ts
const id = await sap.seed('okosmero-gaz-villany')   // ~ms, valós SAP-ban 2-3 nap kézzel
```

Forgatókönyvek: `server/mock-sap/scenarios.ts`. Minden seed egyedi azonosítót ad, így a tesztek párhuzamosak.
A mock az éles környezetben 404-et ad (kapcsoló nélkül nem létezik).

## Parancsok

```bash
pnpm install
pnpm dev                 # NUXT_MOCK_SAP=true kell hozzá (.env.example)
pnpm test                # unit
pnpm test:e2e            # Playwright (buildel és elindítja a szervert)
```

## Pipeline

| Workflow | Tartalom |
|---|---|
| `ci.yml` | typecheck, unit, e2e (riport+videó+trace artifactként), Docker build + Trivy image scan |
| `security.yml` | CodeQL, Semgrep, gitleaks, dependency-review, OSV-scanner, Trivy fs (heti ütemezéssel is) |
| `ci.yml` `publish` job | main -> image GHCR-be, később Hetzner deploy (lásd `deploy/README.md`, kikapcsolva) |

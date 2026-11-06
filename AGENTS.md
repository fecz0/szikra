# Szikra: szabályok kódoló ügynököknek

Demó ügyfélportál (Nuxt 4, pnpm). A UI és a kódkommentek **magyarul** vannak. Kicsi, célzott változtatásokat kérünk.

## Munkamenet (kötelező sorrend)
1. Olvasd el a feature leírását, és nézd meg a kapcsolódó kódot (`app/`, `server/`, `tests/e2e/`).
2. **Előbb írj Playwright e2e tesztet** a `tests/e2e/` alá, a leírt viselkedésre. Futtasd: `pnpm build && pnpm test:e2e`. A tesztnek az implementáció előtt pirosnak kell lennie.
3. Implementáld a feature-t a lehető legkisebb változtatással.
4. Futtasd és javítsd, amíg minden zöld: `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`.
5. Ne commitolj és ne pushólj: ezt a pipeline végzi.

## Tesztelés
- SAP-adat a `sap.seed('<forgatókönyv>')` fixture-rel jön (`tests/e2e/support/fixtures.ts`). Ne használj kézzel összerakott adatot.
- Ha új SAP-adat kell, bővítsd a forgatókönyveket: `server/mock-sap/scenarios.ts` (és a `ScenarioName` típust, a fixture `Scenario` típusát).
- A tesztek párhuzamosak: használj egyedi, seedelt ügyfelet, ne oszd meg az állapotot.
- Szelektornak `getByRole` / `getByTestId` (`data-testid`), ne CSS-osztály.

## Architektúra
- Az app SAP-hívásai kizárólag a `server/utils/sap.ts` adapteren át mennek. A `/mock-sap` útvonalak csak `NUXT_MOCK_SAP=true` mellett élnek (`requireMockSap`).
- Emberi hibaüzenet a JSON törzsben (`message`), **nem** `statusMessage`-ben (az fejléc, az ékezetek kiesnek).
- Pénzösszeg: `Intl.NumberFormat('hu-HU')`, forint.

## Tilos (a pipeline visszautasítja)
Ne módosítsd: `.github/`, `deploy/`, `Dockerfile`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `playwright.config.ts`, `osv-scanner.toml`, `AGENTS.md`. Ne adj hozzá új függőséget. Ne használj külső hálózati hívást és ne írj ki titkot.

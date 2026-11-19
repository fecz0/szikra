# Szikra: szabályok kódoló ügynököknek

Demó ügyfélportál (Nuxt 4, pnpm). A UI és a kódkommentek **magyarul** vannak. Kicsi, célzott változtatásokat kérünk.

## Munkamenet (kötelező sorrend)
1. Olvasd el a feature leírását, és nézd meg a kapcsolódó kódot (`app/`, `server/`, `tests/e2e/`).
2. **Előbb írj Playwright e2e tesztet** a `tests/e2e/` alá, a leírt viselkedésre. Futtasd: `pnpm build && pnpm test:e2e`. A tesztnek az implementáció előtt pirosnak kell lennie.
3. Implementáld a feature-t a lehető legkisebb változtatással.
4. Futtasd és javítsd, amíg minden zöld: `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`.
5. Ne commitolj és ne pushólj: ezt a pipeline végzi.

## Tesztelés
- Háttéradat az `erp.seed('<forgatókönyv>', '<szerepkör>')` fixture-rel jön, belépni az `erp.login(page, seeded)`-del lehet (`tests/e2e/support/fixtures.ts`). Ne használj kézzel összerakott adatot.
- Ha új adat kell, bővítsd a forgatókönyveket: `server/domain/scenarios.ts` (és a fixture `Scenario` típusát). Új ügytípus: `server/domain/case-types.ts` + `CaseTypeId` a `server/domain/types.ts`-ben.
- A tesztek párhuzamosak: használj egyedi, seedelt ügyfelet, ne oszd meg az állapotot.
- Szelektornak `getByRole` / `getByTestId` (`data-testid`), ne CSS-osztály.

## Architektúra
- A háttérrendszert (ERPNext vagy JSON snapshot) kizárólag a `server/utils/backend.ts` interfész (`useBackend()`) éri el; új adatművelet az interfészbe és mindkét megvalósításba (`backends/memory.ts`, `backends/erpnext.ts`) kerül.
- Minden `/api/partner/[pid]/...` útvonal elején `requireCapability(event, pid, '<képesség>')` kell (a jogosultsági mátrix: `server/domain/permissions.ts`); a böngészőtől kapott cégazonosítóban sosem bízunk.
- A `/__test/seed` csak `NUXT_TEST_SEED=true` mellett él.
- Emberi hibaüzenet a JSON törzsben (`message`), **nem** `statusMessage`-ben (az fejléc, az ékezetek kiesnek).
- Pénzösszeg: `Intl.NumberFormat('hu-HU')`, forint.

## Tilos (a pipeline visszautasítja)
Ne módosítsd: `.github/`, `deploy/`, `Dockerfile`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `playwright.config.ts`, `osv-scanner.toml`, `AGENTS.md`. Ne adj hozzá új függőséget. Ne használj külső hálózati hívást és ne írj ki titkot.

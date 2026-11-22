# ERPNext háttér (lokális)

A Szikra partnerportál a "CRM/ERP" oldalt ERPNexttel (Frappe, v16) váltja ki: ügyfelek, számlák, fizetések,
ügyek (Issue), fogyasztási helyek (egyedi DocType). Az ERPNext **a fejlesztő gépén** fut (OrbStack/Docker),
a deploynak nincs rá szüksége: ott a JSON snapshot (`server/data/snapshot.json`) az adatforrás.

```
 forgatókönyvek (server/domain/scenarios.ts)
        │  pnpm erp:seed
        ▼
   ERPNext (localhost:8088)  ──  pnpm dev:erp  ──►  portál élő ERPNext módban
        │  pnpm erp:export
        ▼
 server/data/snapshot.json  ──►  deploy / CI / e2e (memória-tár, ERPNext nélkül)
```

## Parancsok

| Parancs | Mit csinál |
|---|---|
| `pnpm erp:up` | ERPNext indítása (első alkalommal ~3 GB letöltés, a site létrehozása pár perc) |
| `pnpm erp:seed` | Alapbeállítás (HUF, magyar cég), egyedi mezők/DocType-ok, demó-adatok; idempotens; kiírja az `erp/.env.local`-t |
| `pnpm dev:erp` | A portál dev módban az élő ERPNexttel (`NUXT_BACKEND=erpnext`) |
| `pnpm erp:smoke` | Végigjárja a portál API-ját élő ERPNexten (fizetés, ügy, jogosultság), majd takarít |
| `pnpm erp:export` | ERPNext -> `server/data/snapshot.json` (ezt kell commitolni deploy előtt) |
| `pnpm erp:snapshot-offline` | Ugyanaz a snapshot ERPNext nélkül, a forgatókönyvekből |
| `pnpm erp:down` | Leállítás (az adat a Docker volume-ban marad; `-v`-vel törölhető) |

Admin felület: <http://127.0.0.1:8088> (Administrator / admin; csak helyi használatra, a port csak localhostra van kötve).

## Demó-adatkészlet

A `server/domain/demo-data.ts` determinista generátora 12 hónapot (2025-11 … 2026-10) állít elő valós nagyságrendű árakkal:

| Partner | Típus | Tartalom |
|---|---|---|
| Tisza Kereskedelmi Lánc Zrt. (`DEMO-LANC`) | fogyasztó | 8 telephely, villany + gáz (12 hely), 144 számla, mérőállás-idősor, egy lejárt tartozás |
| Alföldi Napenergia Kft. (`DEMO-NAPELEM`) | termelő | 20 MW napelempark (12 + 8 MW), kb. 24 GWh éves termelés, havi átvételi elszámolás |
| Napfény, Késő, Pech, Rendes (régi 4) | fogyasztó | a korábbi forgatókönyvek |

A seed a pénzügyi évet (2025) és a sémát is pótolja meglévő ERPNext-en (`ensureFiscalYear`, DocType-migráció).

## Megjegyzések

- Az `erp/.env.local` (API-kulcs) nincs verziókezelve.
- Ha a `seed` után `Failed to decrypt key ... api_secret` hibát látsz: a backend a site létrehozása előtt indult.
  `docker compose -p szikra-erp -f erp/compose.yml restart backend websocket queue-short queue-long scheduler`,
  majd töröld az `erp/.env.local`-t és futtasd újra a seedet.
- A snapshot dátum-függő mező: a számla "lejárt" státusza az export napján számolódik.
- Új demó-adat: bővítsd a `server/domain/scenarios.ts`-t, `erp:seed`, `erp:export`.

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
| Duna Trade Kft. (`DEMO-NAGYKER`) | nagykereskedő | 12 határidős ügylet (villany bázis/csúcs, gáz; vétel és eladás; EUR/MWh, árfolyammal), napi menetrend (24 órás villany, napi gáz), hitelkeret 3 Mrd Ft + 1,5 Mrd Ft bankgarancia (lejárat 2027-02-28), havi elszámoló számlák (~1,1 Mrd Ft) |
| Napfény, Késő, Pech, Rendes (régi 4) | fogyasztó | a korábbi forgatókönyvek |

A seed a pénzügyi évet (2025) és a sémát is pótolja meglévő ERPNext-en (`ensureFiscalYear`, DocType-migráció).

## Demó felhasználók

| Azonosító | Szerepkör | Cégek |
|---|---|---|
| `DEMO-ADMIN` | admin / olvasó / pénzügyi | Napfény, Késő, Pech, Tisza lánc |
| `DEMO-PENZUGY` | pénzügyi | Késő, Pech |
| `DEMO-MUSZAKI` | műszaki | Napfény |
| `DEMO-TERMELO` | admin | Alföldi Napenergia |
| `DEMO-KERESKEDO` | kereskedő | Duna Trade |
| `DEMO-ELSZAMOLAS` | pénzügyi | Duna Trade, Alföldi Napenergia |
| `DEMO-UZEMVEZETO` | műszaki | Alföldi Napenergia |
| `DEMO-VEZETO` | admin / olvasó | Duna Trade (admin), Tisza lánc és Alföldi Napenergia (olvasó) |
| `DEMO-OLVASO` | olvasó | Rendes Ipari Park |

## Tételes számlakép és díjszerkezet

A villany- és gázszámlák tételesek (`server/domain/tariffs.ts`): energiadíj, rendszerhasználati díjak (átviteli forgalmi díj, elosztói alapdíj, lekötött teljesítménydíj, forgalmi díj), pénzeszközök, jövedéki adó, 27% ÁFA. Az ERPNextben a tételek `Sales Invoice Item` sorok, az ÁFA fix összegű adósor, a mérőadatok a `szikra_usage` mezőben (JSON).

- **Valós:** az E.ON 2026-os, MEKH H2995/2025 szerinti elosztói rendszerhasználati díjai (KIF III./IV., KÖF), a zónaidők (nappali 6–17, csúcs 17–22, völgy 22–6) és a számla szerkezete (E.ON vállalkozói elszámoló számla magyarázó).
- **Demó-érték:** az energiadíjak, a pénzeszközök, a jövedéki adó és a gázdíjak. Éles használat előtt a MEKH aktuális határozatával és a kereskedő számlamagyarázójával egyeztetni kell.
- A tételösszegek forintra pontosak (kWh 100-as, m³ 5-ös kerekítés, kétjegyű egységárak), így a számlakép és az ERPNext végösszege egyezik.
- A meglévő ERPNext könyvelt számlái nem módosíthatók: a tételes számlák bevezetése után `docker compose -p szikra-erp -f erp/compose.yml down -v`, majd újra `pnpm erp:up && pnpm erp:seed`.

## Megjegyzések

- Az `erp/.env.local` (API-kulcs) nincs verziókezelve.
- Ha a `seed` után `Failed to decrypt key ... api_secret` hibát látsz: a backend a site létrehozása előtt indult.
  `docker compose -p szikra-erp -f erp/compose.yml restart backend websocket queue-short queue-long scheduler frontend` (a `frontend` is, különben 502-t ad az nginx),
  majd töröld az `erp/.env.local`-t és futtasd újra a seedet.
- A snapshot dátum-függő mező: a számla "lejárt" státusza az export napján számolódik.
- Új demó-adat: bővítsd a `server/domain/scenarios.ts`-t, `erp:seed`, `erp:export`.

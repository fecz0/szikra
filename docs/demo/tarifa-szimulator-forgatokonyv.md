# Díjcsomag-szimulátor: bemutató forgatókönyv (~12 perc)

Ezt a forgatókönyvet a `tests/e2e/demo-flow.spec.ts` minden futáskor végigjátssza, a számok ezért garantáltan igazak (ha a teszt zöld).

## Előkészület (egyszer, a bemutató előtt)

```bash
pnpm erp:up          # ERPNext indul (http://127.0.0.1:8088)
pnpm erp:seed        # adatok, ERPNext demó felhasználó (idempotens)
pnpm dev:erp         # a portál az ÉLŐ ERPNexttel: http://localhost:3000
```

| Mit | Hol | Belépés |
|---|---|---|
| Partnerportál | <http://localhost:3000> | gomb: **Belépés mint Kovács Anna** (`DEMO-ADMIN`) |
| ERPNext (csak olvasó) | <http://127.0.0.1:8088> | `demo@szikra.test` / `SzikraDemo!2026xQ` |

A demó felhasználó csak olvashat: nem tudsz véletlenül átírni semmit a képernyőmegosztás közben. (Helyi gépre való, ne használd élesben.)

Tiszta lap egy előadás után: `pnpm erp:smoke` (ellenőrzi és takarít), vagy töröld a „Szikra Tariff” és „Issue” rekordokat. Snapshot módban (`pnpm dev`) 30 percenként magától visszaáll.

## A történet egy mondatban

„Egy kereskedelmi lánc 8 áruházzal vásárol áramot. A rendszer a **saját mérőadatából** megmondja, melyik díjcsomaggal járna a legjobban, és egy kattintással váltást is kér.”

## Lépések

### 1. Belépés és cégválasztás (1 perc)
1. Főoldal → **Belépés mint Kovács Anna**.
2. Cégválasztó: Anna 5 cégnél van, **más szerepkörrel** mindenhol (admin, olvasó, pénzügyi). Kattints a **Tisza Kereskedelmi Lánc Zrt.**-re.
3. Mondd: a jogosultság cégenként és szerepkörönként más, és a szerver ellenőrzi, nem csak a felület.

### 2. Egy valódi vállalkozói számla (2 perc)
1. **Számlák** → szűrés nélkül is látszik a 144 számla; nyisd meg a **2026. október**, Debrecen áruház villanyszámlát.
2. Mutasd: **energiadíj** 3 971 690 Ft (fix ár), alatta a **rendszerhasználati díjak** (átviteli forgalmi díj **3,39 Ft/kWh**, elosztói alapdíj, lekötött teljesítménydíj, forgalmi díj **22,20 Ft/kWh**), pénzeszközök, jövedéki adó, 27% ÁFA.
3. Mondd: a díjak a **valós E.ON/MEKH 2026-os** (H2995/2025) értékek, a hálózati kategória **KIF III.**; a zónák: nappali 6–17, csúcs 17–22, völgy 22–6. Az energiadíj és a pénzeszközök demó-érték.

### 3. A szimulátor (4 perc), a lényeg
1. **Díjcsomagok** → Debrecen áruház. Csempék: **1158 MWh** 12 havi fogyasztás.
2. Mutasd a **Motor-ellenőrzés: 0 Ft** csempét. Mondd: „a motor a jelenlegi díjcsomaggal pontosan a kiszámlázott energiadíjat adja vissza, mind a 96 telephely-hónapban. Ezért hihető az ajánlat.”
3. A táblázat (éves energiadíj):

   | Díjcsomag | Éves energiadíj | Különbség |
   |---|---|---|
   | **Ipari fix 2026** (jelenlegi) | 45,03 M Ft | – |
   | Ipari fix 2027 (12 hó kötés) | 42,72 M Ft | **−2 315 400 Ft/év** |
   | Piaci követő | 48,91 M Ft | +3 870 710 Ft/év |
   | Csúcs-völgy | 48,89 M Ft | +3 854 650 Ft/év |
   | Dinamikus (óránkénti tőzsdei) | 49,34 M Ft | +4 301 755 Ft/év |

4. **Dinamikus árazás (D-tarifa jellegű):** olvasd fel a kártya alatti szöveget: a fogyasztással súlyozott átlagár **40,08 Ft/kWh** > a havi tőzsdei átlag **38,92 Ft/kWh**, mert az áruház a drágább esti órákban fogyaszt többet. „A dinamikus nem mindig éri meg, a rendszer megmutatja, mikor.”
5. Kattints a **Ipari fix 2027** sorra → alul a **havi bontás**.

### 4. Másik telephely, másik válasz (1 perc)
Válaszd a **Győr áruház**at (jelenlegi: Piaci követő). Itt a fix 2027 **−4 953 740 Ft/év**, a dinamikus **+303 790 Ft/év**. „Telephelyenként más a jó válasz, ezt kézzel nem lehet követni.”

### 5. Saját díjcsomag kód nélkül (2 perc)
1. Vissza a **Debrecen** telephelyre. Lent az **Új díjcsomag** űrlap: név **Tavaszi akció fix**, típus **Fix ár**, **35** Ft/kWh → Mentés.
2. Azonnal megjelenik a táblázatban „egyedi” címkével: éves **40,52 M Ft**, **−4 515 030 Ft/év**, és ez lesz a legolcsóbb.
3. Mondd: ez a **termék-/tarifakonfiguráció** a felületen, fejlesztő nélkül; ugyanúgy működik a csúcs-völgy és a dinamikus típus is.

### 6. Váltás kérése (1 perc)
1. A **Ipari fix 2027** soron kattints a **Váltás kérése** linkre.
2. Az ügyindító **előtöltve** nyílik (Díjcsomag-váltás, a telephely, a kért díjcsomag). **Beküldés** → az ügy részletei.
3. Mondd: a kérés a közös ügykeretrendszerbe kerül, szerepkör szerint indítható (pénzügyi szerepkör például nem válthat díjcsomagot).

### 7. Ugyanez az ERPNextben (2 perc)
Nyisd meg az ERPNextet **demó felhasználóval** (csak olvasó), a keresőbe (Ctrl+K) írd:
- **Customer** → *Tisza Kereskedelmi Lánc Zrt.*
- **Sales Invoice** → szűrés: `Szikra id` = `DEMO-LANC-INV-E1-202610` → a tételsorok (energia, rendszerhasználati díjak, ÁFA) ugyanazok, mint a portálon.
- **Szikra Interval Data** → szűrés: `Fogyasztási hely azonosító` = `DEMO-LANC-E1` → 12 hónap órás adat (JSON).
- **Szikra Tariff** → az imént létrehozott „Tavaszi akció fix”.
- **Issue** → a váltási kérés.

Mondd: „a portál nem külön adatbázis: minden az ERPNextből jön, és oda is megy vissza.” Próbáld meg átírni valamit: a demó felhasználó 403-at kap.

## Zárás: a Kraken-összevetés (30 mp)

- Amit itt látsz: **valódi számlázási adatból számoló, ellenőrizhető tarifamotor**, magyar díjszerkezettel, saját kézben tartott nyílt adatréteggel.
- Amiben a Kraken szintet lép: intervallum-adat tömeges betöltése és validálása (MDM), több tízmillió számla, flexibilitás/VPP. Erre a portál **fölé építhető**: a `Backend` interfész mögé a Kraken API is bekötehető.

## Mi igaz és mi demó-érték

| Valós | Demó-érték / modell |
|---|---|
| E.ON elosztói rendszerhasználati díjak 2026 (MEKH H2995/2025), zónaidők, számlaszerkezet | energiadíjak, pénzeszközök, jövedéki adó, gázdíjak |
| – | az órás tőzsdei árgörbe és az óránkénti terhelés (modell, de a zónaösszegek pontosan a számlázottak) |
| – | a „Ipari fix 2027” díjcsomag, a cégek, a számlák (kitaláltak) |

## Ha valami elromlik

| Tünet | Teendő |
|---|---|
| a portál „ERPNext adapter” hibát ad | `pnpm erp:up`, majd várd meg a `http://127.0.0.1:8088` választ; 502 esetén: `docker compose -p szikra-erp -f erp/compose.yml restart backend websocket queue-short queue-long scheduler frontend` |
| 401 „nem fejthető vissza” token | ugyanez az újraindítás, majd `rm erp/.env.local && pnpm erp:seed` |
| bármi más | `pnpm dev` (snapshot mód, ERPNext nélkül): minden képernyő ugyanúgy működik |

/** Fix, ismert belépési azonosítók a nézőknek (csak NUXT_DEMO_USERS=true esetén létrejönnek). */
export const demoUsers = [
  { id: 'DEMO-OKOS', scenario: 'okosmero-gaz-villany', note: 'Okosmérős ügyfél: villany + gáz, két nyitott számla, kártyás fizetés' },
  { id: 'DEMO-ELMARADT', scenario: 'elmaradt-szamla', note: 'Két lejárt számla, átutalásos fizetési mód' },
  { id: 'DEMO-KARTYA', scenario: 'kartya-elutasitva', note: 'A kártyaterhelést a bank elutasítja (hibaág)' },
  { id: 'DEMO-RENDEZETT', scenario: 'rendezett-szamlak', note: 'Minden számla kiegyenlítve, csoportos beszedés' },
] as const

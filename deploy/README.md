# Deploy terv (Hetzner + Cloudflare Tunnel)

Még nincs bekötve; a `deploy.yml` kikapcsolt állapotban van (`vars.DEPLOY_ENABLED != 'true'`).

1. Szerveren reverse proxy (Caddy), hostnév szerint route-ol: `pr-N.szikra.problemas.hu` -> konténer.
2. Cloudflare Tunnel wildcard: `*.szikra.problemas.hu` -> a proxy (nem nyílik új bejövő port).
3. Actions: image -> GHCR; a szerver lehúzza (webhook a tunnelen át, vagy korlátozott deploy user SSH-val).
4. PR-hoz bot-komment: preview link + e2e videó/riport.
5. Fork-PR-okra nem deployolunk; self-hosted runner nincs.

## Jelenlegi állapot (2026-11-06)

- Cloudflare Tunnel `hermes`: `szikra.problemas.hu` és `szikra-preview.problemas.hu` -> `http://localhost:8080`.
- Szerveren (`hermes@`): nginx `/etc/nginx/conf.d/szikra.conf` (127.0.0.1:8080, host szerint route, rate limit),
  user systemd `szikra@main` (:3101) és `szikra@preview` (:3102), saját Node 26 LTS a `~/szikra/node` alatt
  (a Hermes alap Node-ja alpha és a heti frissítés cseréli, ezért nem azt használjuk).
- Az app kimenete: `~/szikra/<main|preview>/.output`; frissítés után `systemctl --user restart szikra@<env>`.
- Deploy: a CI végzi (`ci.yml` `deploy` job): `main` -> `szikra`, saját repós PR -> `szikra-preview`. Korlátozott SSH kulcs (forced command: `~/szikra/deploy.sh`), a csomag az e2e által tesztelt build.
- Ellenőrzés: `/api/health` visszaadja a deployolt commitot; a CI ezt várja meg smoke tesztként.
- E2E riport (videók, trace): `<host>/report/` (nginx alias `/var/www/szikra-reports/<env>/`); a `report` CI job tölti fel (`deploy.sh ... report`), env-enként csak a legutóbbi él. Elbukott e2e esetén is feltöltődik.

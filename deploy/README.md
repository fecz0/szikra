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
- Kézi deploy egyelőre: `rsync -az --delete .output/ hermes@...:~/szikra/<env>/.output/`.
- Következő: ezt a CI végzi (korlátozott deploy kulcs, forced command), PR-ről a `preview`-ra, main-ről a `main`-re.

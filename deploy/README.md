# Deploy terv (Hetzner + Cloudflare Tunnel)

Még nincs bekötve; a `deploy.yml` kikapcsolt állapotban van (`vars.DEPLOY_ENABLED != 'true'`).

1. Szerveren reverse proxy (Caddy), hostnév szerint route-ol: `pr-N.szikra.problemas.hu` -> konténer.
2. Cloudflare Tunnel wildcard: `*.szikra.problemas.hu` -> a proxy (nem nyílik új bejövő port).
3. Actions: image -> GHCR; a szerver lehúzza (webhook a tunnelen át, vagy korlátozott deploy user SSH-val).
4. PR-hoz bot-komment: preview link + e2e videó/riport.
5. Fork-PR-okra nem deployolunk; self-hosted runner nincs.

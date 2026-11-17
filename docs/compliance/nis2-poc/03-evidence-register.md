# 03 — Evidence Register

> **Proof of Concept (PoC).** This register records evidence that was actually found in the repository at commit `94ce09cc539fef0d1f94eb32a1563b00efd89a96` on 2026-11-17. It does not create, infer or fabricate evidence. Where no evidence exists, the observation says **Not evidenced**.

| Field | Value |
|---|---|
| Document | `03-evidence-register.md` |
| Assessment date | 2026-11-17 |
| Assessment target | `szikra` repository at commit `94ce09cc539fef0d1f94eb32a1563b00efd89a96` |
| Method | File inspection; each referenced path was confirmed to exist in the repository |
| Status | Draft — requires validation by the system owner |

## 1. Evidence conventions

- **Repository Location** contains a real path. Line ranges are approximate anchors, not a claim that the whole file is relevant.
- **Observation** states what the artifact shows and, where applicable, what it does **not** show.
- A **Not evidenced** row records an expected control for which no artifact was found. It does not prove the control is absent outside the repository.
- Externally operated controls are marked **Requires validation**; repository documentation alone is not treated as proof that the control is configured correctly.

## 2. Evidence register

| NIS2 Area | Evidence | Repository Location | Observation |
|---|---|---|---|
| Authentication | Customer-ID-only entry form; no password, token or session | `app/pages/index.vue:10-13` | The form navigates to `/fiok/:id` after a non-empty ID is entered. There is no credential verification. **Not evidenced** as authentication. |
| Authentication | No auth middleware or session mechanism | `server/` (repository-wide search) | No `server/middleware`, cookie, OAuth/OIDC client, SAML configuration or token validation exists. **Not evidenced.** |
| Authentication | Fixed demo identifiers published in the UI | `app/pages/index.vue:4-9`; `server/mock-sap/demo-users.ts` | Four demo IDs are displayed when `NUXT_PUBLIC_DEMO_USERS` is enabled. They are not secrets. |
| Access control | Account lookup by arbitrary path parameter | `server/api/account/[id].get.ts:1-9` | The handler passes `id` directly to the SAP adapter. No caller identity or ownership check is performed. |
| Access control | Payment by arbitrary customer and bill ID | `server/api/account/[id]/pay.post.ts:1-10` | The handler passes customer `id` and body `billId` to SAP. No identity, confirmation, idempotency or audit check is performed. |
| Access control | No role or permission model | `app/`, `server/` (repository-wide search) | No RBAC, role definitions, admin surface or tenant isolation were found. **Not evidenced.** |
| Access control | Mock-only configuration gate | `server/utils/mock-guard.ts`; `server/routes/mock-sap/__seed.post.ts`; `server/routes/mock-sap/customers/[id].get.ts`; `server/routes/mock-sap/customers/[id]/payments.post.ts` | All mock routes call `requireMockSap()`; when the flag is on, the routes are public and rely on no caller authentication. |
| Asset management | Runtime dependency manifest | `package.json` | Declares Nuxt, Vue, vue-router and development tooling. No inventory metadata or ownership is present. |
| Asset management | Resolved dependency graph | `pnpm-lock.yaml` | Locks transitive versions; used with `--frozen-lockfile`. Size ~210 KB at assessment time. |
| Asset management | Dependency overrides and build allowlist | `pnpm-workspace.yaml` | Overrides `glob` and `minimatch`; allows builds for `esbuild` and `@parcel/watcher`. |
| Asset management | Container definition | `Dockerfile` | Multi-stage build; runtime image uses `node:26-alpine`, removes npm/corepack, runs as `node`, exposes 3000 and defines a healthcheck. Base image is tag-pinned, not digest-pinned. |
| Asset management | CI/CD assets | `.github/workflows/ci.yml`; `.github/workflows/security.yml`; `.github/workflows/agent.yml`; `.github/dependabot.yml` | Workflows and dependency automation are version-controlled. No asset owner or criticality is recorded. |
| Asset management | No software bill of materials | Repository-wide search | No SBOM file, generation step or retention policy was found. **Not evidenced.** |
| Vulnerability handling | CodeQL SAST | `.github/workflows/security.yml:14-22` | Runs on push, pull request, manual dispatch and weekly schedule (lines 3-8) for `javascript-typescript`. |
| Vulnerability handling | Semgrep SAST | `.github/workflows/security.yml:24-30` | Runs `p/default` and `p/typescript` with `--error --metrics=off`. Container image is referenced by tag (`semgrep/semgrep`), not digest. |
| Vulnerability handling | Secret scanning with gitleaks | `.github/workflows/security.yml:32-39` | Checks out full history (`fetch-depth: 0`) and runs gitleaks with the GitHub token. |
| Vulnerability handling | OSV dependency scan | `.github/workflows/security.yml:41-47` | Scans `pnpm-lock.yaml` with the OSV-Scanner action. |
| Vulnerability handling | Trivy filesystem and configuration scan | `.github/workflows/security.yml:49-60` | Scans `vuln,secret,misconfig` for CRITICAL/HIGH and fails the job on findings. |
| Vulnerability handling | Trivy container image scan | `.github/workflows/ci.yml:72-85` | Builds `szikra:${{ github.sha }}`, scans CRITICAL/HIGH with `ignore-unfixed: true` and `exit-code: '1'`. |
| Vulnerability handling | Accepted-risk register | `osv-scanner.toml` | Two ignored advisories, each with `ignoreUntil = 2027-02-01` and a reason. Review date is future-dated relative to this assessment. |
| Vulnerability handling | Dependency updates | `.github/dependabot.yml` | Weekly updates for npm, GitHub Actions and Docker; 7-day cooldown; Node major versions ignored. |
| Vulnerability handling | No disclosure policy | Repository-wide search | No `SECURITY.md`, `security.txt`, disclosure mailbox or remediation SLA was found. **Not evidenced.** |
| Supply-chain security | SHA-pinned GitHub Actions | `.github/workflows/ci.yml`; `.github/workflows/security.yml`; `.github/workflows/agent.yml` | Most `uses:` entries are pinned to full commit SHAs with version comments. |
| Supply-chain security | Frozen lockfile | `.github/workflows/ci.yml:29`; `Dockerfile` | CI and the Docker build use `pnpm install --frozen-lockfile`. |
| Supply-chain security | Image and artifact scanning | `.github/workflows/ci.yml:72-85`; `.github/workflows/security.yml:49-60` | Trivy scans the image and the filesystem/configuration. No SBOM, signature or provenance attestation was found. |
| Supply-chain security | Documentation/implementation mismatch | `README.md`; `.github/workflows/ci.yml` | `README.md` claims a `publish` job that pushes to GHCR, but `ci.yml` has no publish/push job. **Requires validation.** |
| Secure development | Pull-request CI trigger | `.github/workflows/ci.yml:3-6` | Runs on push to `main`, all pull requests and manual dispatch. |
| Secure development | Typecheck and unit tests | `.github/workflows/ci.yml:20-32` | Runs `nuxt prepare`, `pnpm typecheck` and `pnpm test`. |
| Secure development | Playwright e2e | `.github/workflows/ci.yml:34-70`; `playwright.config.ts`; `tests/e2e/` | Builds the app, runs Playwright against mock SAP, uploads report, video and trace artifacts. |
| Secure development | Test isolation and seeding | `tests/e2e/support/fixtures.ts`; `server/routes/mock-sap/__seed.post.ts` | Each test can seed a unique customer; the seed endpoint generates a random `T...` identifier. |
| Secure development | Protected-file check for automation | `.github/workflows/agent.yml:73-89` | The agent workflow rejects changes to `.github/`, `deploy/`, `Dockerfile`, dependency manifests, lock files, Playwright config, OSV config and `AGENTS.md`. |
| Secure development | No branch-protection evidence | GitHub organisation settings (external) | Branch protection, required reviews and signed commits are not stored in the repository. **Requires validation.** |
| Secure development | No dependency-review gate | `.github/workflows/security.yml`; `README.md` | `README.md` lists dependency-review, but the workflow has no dependency-review job. **Not evidenced.** |
| Cryptography | TLS ingress documented as Cloudflare Tunnel | `deploy/README.md:6,13-19` | Tunnel and nginx routing are described narratively. No certificate, TLS, cipher or HSTS configuration is in the repository. **Requires validation.** |
| Cryptography | Deployment secret injection | `.github/workflows/ci.yml:113-125`; `.github/workflows/ci.yml:159-171` | `DEPLOY_SSH_KEY` is written with mode 600; `DEPLOY_KNOWN_HOSTS` is written for strict host-key checking. |
| Cryptography | AI provider secret injection | `.github/workflows/agent.yml:51-61` | `DEEPSEEK_API_KEY` is injected as `ANTHROPIC_AUTH_TOKEN`; the key value is not in the repository. |
| Cryptography | No key-management or crypto inventory | Repository-wide search | No vault, KMS, certificate inventory, rotation policy or application cryptography was found. **Not evidenced.** |
| Logging and monitoring | Health endpoint with build SHA | `server/api/health.get.ts` | Public endpoint returns `{ status: 'ok', sha }`; SHA is `null` if `NUXT_BUILD_SHA` is unset. |
| Logging and monitoring | Deployment smoke test | `.github/workflows/ci.yml:172-179` | Polls `/api/health` for up to 30 attempts and compares the SHA with the deployed commit. |
| Logging and monitoring | CI and e2e artifact retention | `.github/workflows/ci.yml:54-70` | Playwright report, test results, video and trace are uploaded with 14-day retention. |
| Logging and monitoring | No application audit or security log | `app/`, `server/` (repository-wide search) | No structured logging, access log, authentication log or payment audit trail was found. **Not evidenced.** |
| Logging and monitoring | No central monitoring or alerting | Repository-wide search | No dashboard, alert rule, SIEM integration, on-call configuration or log-retention policy was found. **Not evidenced.** |
| Incident handling | CI/agent failure signalling | `.github/workflows/agent.yml:91-111`; `.github/workflows/ci.yml` | Workflow results and issue comments report delivery failures. No security incident process is defined. |
| Incident handling | No incident-response documentation | Repository-wide search | No IR plan, severity matrix, contact list, escalation path or notification procedure was found. **Not evidenced.** |
| Business continuity | Previous-build rollback copy | `deploy/deploy.sh:30-40` | The previous `.output` is renamed to `.output.prev` before replacement; restart is performed with `systemctl --user restart`. No automated rollback step exists. |
| Business continuity | Documented environments and host layout | `deploy/README.md:11-20` | Describes main and preview services (`szikra@main`, `szikra@preview`), nginx and Cloudflare Tunnel. Host configuration is external. |
| Business continuity | No backup or restore procedure | Repository-wide search | No backup job, schedule, storage, encryption or restore test was found. The mock store is in-memory. **Not evidenced.** |
| Network security | Documented tunnel and reverse proxy | `deploy/README.md:13-19` | Cloudflare Tunnel and nginx host routing/rate limiting are described. No configuration is present in the repository. **Requires validation.** |
| Network security | No application rate limiting | `server/` (repository-wide search) | No rate-limit middleware, request-size limit or anti-automation control was found in the application. |
| Data protection | Fictional-data declaration | `README.md`; `app/app.vue:13` | The UI footer and README state that data is fictional and the service is not a real provider. |
| Data protection | Data model | `server/mock-sap/types.ts`; `server/mock-sap/scenarios.ts` | Customer name, address, contract account, meter readings, bills and payment-method label. The card label is masked in the demo. |
| Data protection | No privacy/retention policy | Repository-wide search | No data classification, retention/deletion rule, privacy notice or processor agreement was found. **Not evidenced.** |
| Change management | Commit-SHA-bound deployment | `deploy/deploy.sh:7-10` | The forced command validates `main|preview` and a 40-hex SHA; the SHA is written to the environment file. |
| Change management | Runtime configuration | `nuxt.config.ts` | Declares `mockSap`, `sapBaseUrl`, `buildSha` and `public.demoUsers` as runtime configuration. Mock defaults to `false`. |
| Change management | Environment and secret hygiene | `.gitignore`; `.env.example` | `.env` and `.env.*` are ignored except `.env.example`; the example contains `NUXT_MOCK_SAP=true` and a placeholder SAP URL only. |
| Change management | Documentation drift | `deploy/README.md:3`; `.github/workflows/ci.yml` | `deploy/README.md` refers to a `deploy.yml`, but no such file exists; deployment is implemented in `ci.yml`. **Requires validation.** |
| Secure CI/CD | Least-privilege workflow default | `.github/workflows/ci.yml:12-13`; `.github/workflows/security.yml:10-11` | Default `permissions: contents: read`; jobs request additional permissions only where needed. |
| Secure CI/CD | Restricted deployment path | `.github/workflows/ci.yml:131-138`; `deploy/deploy.sh` | Fork and Dependabot deployments are excluded; SSH uses `IdentitiesOnly`, `BatchMode` and `StrictHostKeyChecking=yes`; the remote command is restricted. |
| Secure CI/CD | Agent automation risk surface | `.github/workflows/agent.yml:21-25,40-46,51-71` | The agent has write permissions, repository secrets, installs unpinned `bubblewrap`/`socat`, sets `kernel.apparmor_restrict_unprivileged_userns=0`, and runs Claude Code with `acceptEdits`. |
| Secure CI/CD | No environment-approval evidence | GitHub environment settings (external) | The workflows reference `production`/`preview` environments, but approval rules and protection settings are not in the repository. **Requires validation.** |
| Secure configuration | Non-root container and reduced tooling | `Dockerfile` | Runtime runs as `USER node`; npm, npx, corepack and yarn are removed; a healthcheck is defined. |
| Secure configuration | No security-header configuration | `nuxt.config.ts`; `server/` (repository-wide search) | No CSP, HSTS, frame-ancestors or other security-header configuration was found. Response headers were not externally validated. **Requires validation.** |
| Data flows | Account data flow | `app/pages/fiok/[id].vue`; `server/api/account/[id].get.ts`; `server/utils/sap.ts` | Browser requests the account by ID; Nuxt calls the SAP adapter; the adapter calls the configured SAP base URL or mock. |
| Data flows | Payment data flow | `app/pages/fiok/[id].vue`; `server/api/account/[id]/pay.post.ts`; `server/utils/sap.ts` | Browser posts `billId`; Nuxt forwards it to SAP. No confirmation, idempotency or audit record. |
| Data flows | Mock seed flow | `server/routes/mock-sap/__seed.post.ts`; `server/mock-sap/store.ts` | Accepts a scenario name, generates a random ID and stores the customer in memory. The store is capped at 500 customers. |
| Data flows | Demo reset | `server/plugins/demo-users.ts` | Fixed demo users are re-seeded at startup and every 30 minutes; pinned customers are never evicted. |

## 3. Evidence explicitly **not** found

The following expected artifacts were searched for and **not found**. Their absence is a recorded gap, not a finding that the control is impossible outside the repository.

| Expected artifact | Search scope | Result |
|---|---|---|
| Authentication middleware, session store or identity-provider configuration | `app/`, `server/`, `nuxt.config.ts` | Not evidenced |
| RBAC/ABAC policy or permission definitions | `app/`, `server/` | Not evidenced |
| Security policy, incident-response plan or runbook | Repository root, `docs/`, `deploy/` | Not evidenced |
| `SECURITY.md` or vulnerability-disclosure policy | Repository root | Not evidenced |
| Backup/restore scripts or schedules | Repository root, `deploy/` | Not evidenced |
| SBOM or artifact-signing configuration | Repository root, `.github/` | Not evidenced |
| Infrastructure-as-code for nginx, systemd, firewall, Cloudflare or Hetzner | Repository root, `deploy/` | Not evidenced |
| Security-header or CSP configuration | `nuxt.config.ts`, `server/` | Not evidenced |
| Application audit/security logging | `app/`, `server/` | Not evidenced |
| Branch protection, required reviews or environment approval rules | GitHub settings (outside repository) | Requires validation |
| Dependency-review workflow | `.github/workflows/` | Not evidenced |

## 4. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial evidence register generated from repository evidence at commit `94ce09c`. |

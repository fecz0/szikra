# 03 — Evidence Register

> **Proof of Concept (PoC).** This register records evidence that was actually found in the repository (`main` at commit `17d547b`, PR #36, plus the update in this change) on 2026-11-22; it replaces the 2026-11-17 version. It does not create, infer or fabricate evidence. Where no evidence exists, the observation says **Not evidenced**.

| Field | Value |
|---|---|
| Document | `03-evidence-register.md` |
| Assessment date | 2026-11-22 (updated; first issued 2026-11-17) |
| Assessment target | `szikra` repository, `main` at commit `17d547b` (PR #36, B2B partner portal) plus the update in this change |
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
| Authentication | Mock single sign-on: a known user identifier creates a session; no credential | `server/api/auth/login.post.ts`; `app/pages/index.vue` | The handler looks the identifier up in the backend and starts a session. No password, one-time code or MFA is requested. **Not evidenced** as credential verification. |
| Authentication | Session handling | `server/utils/auth.ts`; `server/api/auth/logout.post.ts`; `server/api/auth/me.get.ts` | h3 sealed-cookie session, 8-hour maximum age; secret from `NUXT_SESSION_PASSWORD`, otherwise random per process in production and a fixed value in development. Cookie attributes beyond h3 defaults are not configured. **Requires validation.** |
| Authentication | Route guard for pages | `app/middleware/auth.ts` | Redirects visitors without a valid session to the landing page; the server-side checks remain authoritative. |
| Authentication | Fixed demo identifiers published in the UI | `server/api/auth/demo-users.get.ts`; `server/domain/scenarios.ts` | Four demo users are listed when `NUXT_PUBLIC_DEMO_USERS` is enabled. They are not secrets. |
| Access control | Role-to-capability matrix | `server/domain/permissions.ts` | Roles `admin`, `penzugy`, `muszaki`, `olvaso` mapped to capabilities such as `invoices.pay` and `supply.reading`. |
| Access control | Per-request authorization | `server/utils/auth.ts` (`requireCapability`); `server/api/partner/[pid]/invoices.get.ts` | Returns 401 without a session, 403 without a membership at the requested company or without the capability. Called by every `/api/partner/[pid]/…` handler. |
| Access control | Payment authorization and duplicate guard | `server/api/partner/[pid]/invoices/[iid]/pay.post.ts`; `server/utils/backends/memory.ts` | Requires `invoices.pay`; an already paid invoice is refused (409). No confirmation step, idempotency key or correlation id. |
| Access control | Case creation checks | `server/api/partner/[pid]/cases.post.ts`; `server/domain/case-types.ts` | Case type determines the required capability; referenced invoice and supply point must belong to the company; field lengths are capped. |
| Access control | Authorization tests | `tests/e2e/partner.spec.ts`; `tests/unit/permissions.test.ts` | Cross-company access, read-only role and role-restricted case types are asserted. Not an exhaustive route × role matrix. |
| Access control | Test-only seed route gate | `server/routes/__test/seed.post.ts`; `nuxt.config.ts` | Answers 404 unless `NUXT_TEST_SEED=true` and the snapshot backend is active. |
| Access control | No role administration or access-review process | `app/`, `server/` (repository-wide search) | Memberships are backend data; no administrator interface or review process was found. **Not evidenced.** |
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
| Secure development | Playwright e2e | `.github/workflows/ci.yml:34-70`; `playwright.config.ts`; `tests/e2e/` | Builds the app, runs Playwright against the snapshot backend, uploads report, video and trace artifacts. |
| Secure development | Test isolation and seeding | `tests/e2e/support/fixtures.ts`; `server/routes/__test/seed.post.ts` | Each test seeds a unique partner and user with a chosen role; ids derive from `crypto.randomUUID()`. |
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
| Logging and monitoring | Audit events via the backend interface | `server/utils/backend.ts` (`addAudit`); `server/api/auth/login.post.ts`; `server/api/partner/[pid]/overview.get.ts`; `server/api/partner/[pid]/invoices/[iid]/pay.post.ts`; `server/api/partner/[pid]/cases.post.ts` | Sign-in, overview access, payment result and case creation are recorded with user and company. In snapshot mode the list is process memory; in ERPNext mode it is stored as `Szikra Event` rows (`server/utils/backends/erpnext.ts`). |
| Logging and monitoring | Audit events are not exposed or retained centrally | `app/`, `server/` (repository-wide search) | No API or UI reads the audit list; no HTTP access log, correlation id, central retention or alert rule was found. **Not evidenced.** |
| Logging and monitoring | No central monitoring or alerting | Repository-wide search | No dashboard, alert rule, SIEM integration, on-call configuration or log-retention policy was found. **Not evidenced.** |
| Incident handling | CI/agent failure signalling | `.github/workflows/agent.yml:91-111`; `.github/workflows/ci.yml` | Workflow results and issue comments report delivery failures. No security incident process is defined. |
| Incident handling | No incident-response documentation | Repository-wide search | No IR plan, severity matrix, contact list, escalation path or notification procedure was found. **Not evidenced.** |
| Business continuity | Previous-build rollback copy | `deploy/deploy.sh:30-40` | The previous `.output` is renamed to `.output.prev` before replacement; restart is performed with `systemctl --user restart`. No automated rollback step exists. |
| Business continuity | Documented environments and host layout | `deploy/README.md:11-20` | Describes main and preview services (`szikra@main`, `szikra@preview`), nginx and Cloudflare Tunnel. Host configuration is external. |
| Business continuity | No backup or restore procedure | Repository-wide search | No backup job, schedule, storage, encryption or restore test was found. The deployed store is in-memory; ERPNext data sits in local Docker volumes (`erp/compose.yml`). **Not evidenced.** |
| Network security | Documented tunnel and reverse proxy | `deploy/README.md:13-19` | Cloudflare Tunnel and nginx host routing/rate limiting are described. No configuration is present in the repository. **Requires validation.** |
| Network security | No application rate limiting | `server/` (repository-wide search) | No rate-limit middleware, request-size limit or anti-automation control was found in the application. |
| Data protection | Fictional-data declaration | `README.md`; `app/app.vue:13` | The UI footer and README state that data is fictional and the service is not a real provider. |
| Data protection | Data model | `server/domain/types.ts`; `server/domain/scenarios.ts` | Company name, tax number, address, user name and e-mail (reserved test domain), supply points, meter readings, invoices, cases and messages. No card or bank data. |
| Data protection | No privacy/retention policy | Repository-wide search | No data classification, retention/deletion rule, privacy notice or processor agreement was found. **Not evidenced.** |
| Change management | Commit-SHA-bound deployment | `deploy/deploy.sh:7-10` | The forced command validates `main|preview` and a 40-hex SHA; the SHA is written to the environment file. |
| Change management | Runtime configuration | `nuxt.config.ts` | Declares `backend`, `erpBaseUrl`, `erpApiKey`, `erpApiSecret`, `sessionPassword`, `testSeed`, `buildSha` and `public.demoUsers`. Defaults: snapshot backend, seed route off, demo users off. |
| Change management | Environment and secret hygiene | `.gitignore`; `.env.example`; `erp/seed.ts` | `.env` and `.env.*` are ignored except `.env.example` (commented placeholders only); `erp/.env.local` with the generated ERPNext token is git-ignored and written with mode 600. |
| Change management | Documentation drift | `deploy/README.md:3`; `.github/workflows/ci.yml` | `deploy/README.md` refers to a `deploy.yml`, but no such file exists; deployment is implemented in `ci.yml`. **Requires validation.** |
| Secure CI/CD | Least-privilege workflow default | `.github/workflows/ci.yml:12-13`; `.github/workflows/security.yml:10-11` | Default `permissions: contents: read`; jobs request additional permissions only where needed. |
| Secure CI/CD | Restricted deployment path | `.github/workflows/ci.yml:131-138`; `deploy/deploy.sh` | Fork and Dependabot deployments are excluded; SSH uses `IdentitiesOnly`, `BatchMode` and `StrictHostKeyChecking=yes`; the remote command is restricted. |
| Secure CI/CD | Agent automation risk surface | `.github/workflows/agent.yml:21-25,40-46,51-71` | The agent has write permissions, repository secrets, installs unpinned `bubblewrap`/`socat`, sets `kernel.apparmor_restrict_unprivileged_userns=0`, and runs Claude Code with `acceptEdits`. |
| Secure CI/CD | No environment-approval evidence | GitHub environment settings (external) | The workflows reference `production`/`preview` environments, but approval rules and protection settings are not in the repository. **Requires validation.** |
| Secure configuration | Non-root container and reduced tooling | `Dockerfile` | Runtime runs as `USER node`; npm, npx, corepack and yarn are removed; a healthcheck is defined. |
| Secure configuration | No security-header configuration | `nuxt.config.ts`; `server/` (repository-wide search) | No CSP, HSTS, frame-ancestors or other security-header configuration was found. Response headers were not externally validated. **Requires validation.** |
| Data flows | Partner data flow | `app/pages/partner/[pid]/`; `server/api/partner/[pid]/`; `server/utils/backend.ts` | Browser requests company data with its session; Nuxt checks the capability, then reads from the selected backend (snapshot store or ERPNext). |
| Data flows | Payment flow | `app/pages/partner/[pid]/szamlak/index.vue`; `server/api/partner/[pid]/invoices/[iid]/pay.post.ts`; `server/utils/erp/actions.ts` | Browser posts to the pay route; the backend marks the invoice paid (snapshot) or creates and submits an ERPNext Payment Entry. A demo flag on the partner simulates a bank decline (402). |
| Data flows | Snapshot export and load | `erp/export.ts`; `server/data/snapshot.json`; `server/utils/backends/memory.ts` | ERPNext content is exported to committed JSON and loaded into memory at startup and on each 30-minute reset. |
| Data flows | Demo reset | `server/plugins/demo-reset.ts` | The snapshot store is restored every 30 minutes; the store is capped at 500 partners with fixed demo partners pinned. |
| Secure configuration | ERPNext client has no timeout or retry | `server/utils/erp/client.ts` | Plain `fetch` calls; failures surface as generic errors. Only relevant in `erpnext` mode. |
| Secure configuration | ERPNext service token is the Administrator | `erp/seed.ts` (`writeKeys`); `server/utils/backends/erpnext.ts` | The generated API key belongs to `Administrator`; no least-privilege service user. Local development only. **Requires validation** before any other use. |
| Secure configuration | Local ERPNext stack uses default credentials | `erp/compose.yml` | Database root and `Administrator` passwords are `admin`; the HTTP port is bound to `127.0.0.1` only. Intended for a developer machine. |

## 3. Evidence explicitly **not** found

The following expected artifacts were searched for and **not found**. Their absence is a recorded gap, not a finding that the control is impossible outside the repository.

| Expected artifact | Search scope | Result |
|---|---|---|
| Identity provider, credential verification or MFA | `app/`, `server/`, `nuxt.config.ts` | Not evidenced (session handling exists, see section 2) |
| Role administration interface or access-review process | `app/`, `server/` | Not evidenced (the permission matrix exists in `server/domain/permissions.ts`) |
| Security policy, incident-response plan or runbook | Repository root, `docs/`, `deploy/` | Not evidenced |
| `SECURITY.md` or vulnerability-disclosure policy | Repository root | Not evidenced |
| Backup/restore scripts or schedules | Repository root, `deploy/` | Not evidenced |
| SBOM or artifact-signing configuration | Repository root, `.github/` | Not evidenced |
| Infrastructure-as-code for nginx, systemd, firewall, Cloudflare or Hetzner | Repository root, `deploy/` | Not evidenced |
| Security-header or CSP configuration | `nuxt.config.ts`, `server/` | Not evidenced |
| Persistent, centrally collected and monitored audit log | `app/`, `server/` | Not evidenced (events are recorded, see section 2) |
| Branch protection, required reviews or environment approval rules | GitHub settings (outside repository) | Requires validation |
| Dependency-review workflow | `.github/workflows/` | Not evidenced |

## 4. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial evidence register generated from repository evidence at commit `94ce09c`. |
| 0.2 | 2026-11-22 | Updated for the B2B partner portal: replaced SAP/mock evidence, added session, authorization, audit, backend and local ERPNext evidence. Baseline `main` at `17d547b`. |

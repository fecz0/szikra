# 01 — System Overview

> **Proof of Concept (PoC).** This document is part of a repository-derived NIS2 assessment package. It is **not an official NIS2 audit or certification** and does not certify the application as NIS2 compliant. Missing information is marked as **Not evidenced** or **Requires validation** instead of being assumed.

| Field | Value |
|---|---|
| Document | `01-system-overview.md` |
| Assessment date | 2026-11-22 (updated; first issued 2026-11-17) |
| Assessment target | `szikra` repository, `main` at commit `17d547b` (PR #36, B2B partner portal) plus the update in this change |
| Application | Szikra demo B2B partner portal |
| Assessment type | Static repository review (PoC) |
| Classification | Internal demo — fictional data |
| Prepared by | Automated agent (PoC) |
| Status | Draft — requires validation by the system owner |

## 1. Purpose and scope

This document describes the application that is the subject of the NIS2 PoC assessment. It contains only facts that can be evidenced from the repository, supplemented by clearly labelled technical observations and assumptions.

**In scope:** application source code, Nuxt/Nitro configuration, the backend interface with its JSON-snapshot store and ERPNext adapter, the local ERPNext stack definition and seed/export scripts (`erp/`), container definition, CI/CD workflows, dependency manifests, test suite, and repository documentation.

**Out of scope / not evidenced in the repository:** a running ERPNext instance and its data (it runs on the developer machine and is not part of the deployment), any real Salesforce, SAP or document-management system the demo stands in for, the production host configuration (nginx, systemd units, firewall), Cloudflare account configuration, GitHub organisation settings (branch protection, environment protection), and any business or organisational processes.

## 2. Assessment conventions

| Label | Meaning |
|---|---|
| **Evidence** | A concrete file, configuration or implementation exists in the repository at the referenced location. |
| **Observation** | A reasonable technical inference drawn from repository evidence. It is not a certification. |
| **Assumption** | A statement accepted for the PoC that is not proven by the repository. |
| **Gap** | A difference between the observed state and a realistic NIS2-ready control. |
| **Not evidenced** | No repository evidence was found. This does not prove that the control does not exist outside the repository. |
| **Requires validation** | The control appears to be operated outside the repository, or the evidence is ambiguous; the owner must confirm it. |

## 3. Application purpose

Szikra is a **demo B2B partner portal for a fictional energy provider**. A user signs in (mock single sign-on), chooses one of the companies they have access to, and then works with that company's data according to a role:

- an overview with open invoices, outstanding amount, supply points and open cases,
- invoices with period, amount, due date and status, and a "Fizetés" (pay) action for unpaid invoices,
- supply points (electricity and gas, smart-meter flag, POD/EIC-like identifier, last reading),
- cases created through one shared framework (invoice complaint, debt certificate, meter reading, quote request) with a status and a message thread,
- notifications generated from business events.

The repository states explicitly that the data is fictional and that the application is not a real provider (`README.md`; `app/app.vue`). The primary purpose of the repository is to demonstrate an automated CI/CD, DevSecOps and Playwright e2e process against a replaceable CRM/ERP backend, not to operate a production service (`README.md`).

### Users and actors

| Actor | Interaction | Evidence |
|---|---|---|
| Partner user (demo visitor) | Signs in with a user identifier, selects a company, views data and starts cases or payments according to the role | `app/pages/index.vue`; `app/pages/valasztas.vue`; `app/pages/partner/[pid]/` |
| Demo operator | Uses fixed demo users (`DEMO-ADMIN`, `DEMO-PENZUGY`, `DEMO-MUSZAKI`, `DEMO-OLVASO`) | `server/domain/scenarios.ts`; `server/api/auth/demo-users.get.ts` |
| Developer / operator of the local ERP | Runs ERPNext locally, seeds it and exports the JSON snapshot | `erp/README.md`; `erp/seed.ts`; `erp/export.ts` |
| CI/CD pipeline | Builds, tests, scans and deploys the application | `.github/workflows/ci.yml`; `.github/workflows/security.yml` |
| AI agent | Implements labelled issues and opens pull requests | `.github/workflows/agent.yml` |
| Backend (ERPNext or snapshot store) | Provides partner, invoice, supply-point, case and event data | `server/utils/backend.ts` |

## 4. Major components

| Component | Technology / role | Evidence | Security relevance |
|---|---|---|---|
| Frontend / SSR application | Nuxt 4 + Vue 3; server-side rendered pages and client hydration | `package.json`; `nuxt.config.ts`; `app/app.vue`; `app/pages/`; `app/layouts/partner.vue`; `app/middleware/auth.ts` | Renders company and billing data; a route middleware redirects unauthenticated visitors, the server enforces access. |
| Server API | Nitro route handlers under `/api` | `server/api/auth/`; `server/api/partner/[pid]/`; `server/api/health.get.ts` | Session-based; every `/api/partner/[pid]/…` handler calls `requireCapability()` before touching data. |
| Backend interface | Single boundary for all CRM/ERP access (`Backend`), selected by `NUXT_BACKEND` | `server/utils/backend.ts`; `server/domain/backend-types.ts` | Centralises data access; two implementations. |
| Snapshot store | In-memory implementation loaded from the committed JSON export (`server/data/snapshot.json`); default backend for deploy, CI and tests | `server/utils/backends/memory.ts`; `server/data/snapshot.json` | Ephemeral state; fictional data only; capped and reset. |
| ERPNext adapter | Live REST access to a local ERPNext (v16) with a token; maps ERPNext documents to the domain model | `server/utils/backends/erpnext.ts`; `server/utils/erp/client.ts`; `server/utils/erp/mappers.ts` | Not used by the deployment; no request timeout, retry or circuit breaker. |
| Authorization model | Role-to-capability matrix and per-request check | `server/domain/permissions.ts`; `server/utils/auth.ts`; `server/domain/case-types.ts` | Server-side enforcement; roles come from the backend. |
| Demo reset and test seeding | Plugin resets the snapshot store every 30 minutes; a test-only seed route creates isolated partners and users | `server/plugins/demo-reset.ts`; `server/routes/__test/seed.post.ts` | Seed route exists only when `NUXT_TEST_SEED=true`; state resets; no real data. |
| Container image | Multi-stage Node 26 Alpine image, non-root runtime | `Dockerfile` | Reduced runtime surface (npm/corepack removed); base image not digest-pinned. |
| CI pipeline | GitHub Actions: typecheck, unit, e2e, Docker build, Trivy image scan, deploy | `.github/workflows/ci.yml` | Builds and promotes exactly the tested artifact; uses repository secrets for deployment. |
| Security pipeline | CodeQL, Semgrep, gitleaks, OSV-Scanner, Trivy filesystem/config scan | `.github/workflows/security.yml` | Automated SAST, secret scanning, SCA and misconfiguration scanning. |
| Dependency automation | Dependabot for npm, GitHub Actions and Docker | `.github/dependabot.yml` | Weekly updates with a 7-day cooldown. |
| Deployment tooling | Forced-command SSH script, systemd user services, nginx, Cloudflare Tunnel (documented) | `deploy/deploy.sh`; `deploy/README.md` | Artifact upload, restart, rollback copy; host configuration itself is not in the repository. |
| Test suite | Vitest unit tests and Playwright e2e tests; an ERPNext smoke script | `tests/unit/`; `tests/e2e/`; `playwright.config.ts`; `erp/live-smoke.ts` | Verifies behaviour against the snapshot store with isolated seeded partners; the smoke script exercises the live ERPNext path manually. |
| Local ERPNext stack | Docker Compose definition, seed and export scripts | `erp/compose.yml`; `erp/seed.ts`; `erp/export.ts` | Developer-machine only; default `admin` credentials; port bound to `127.0.0.1`. |

## 5. Architecture

### 5.1 Logical architecture

```text
Partner user's browser
      |
      | HTTPS (termination documented as Cloudflare Tunnel; configuration not in repo)
      v
Cloudflare Tunnel -> nginx reverse proxy  [documented in deploy/README.md, not in repo]
      |
      v
Nuxt 4 / Nitro server (Node 26, container, non-root user)
      |
      +-- Vue SSR pages (app/)
      |     +-- /                         landing page, mock sign-in
      |     +-- /valasztas                company selection
      |     `-- /partner/:pid/...         overview, invoices, supply points, cases
      |
      +-- Nitro API routes (server/api/)
      |     +-- /api/auth/{login,logout,me,demo-users}
      |     +-- /api/partner/:pid/...     guarded by requireCapability()
      |     `-- GET /api/health
      |
      +-- Backend interface (server/utils/backend.ts)  <- the only data boundary
            |
            +-- snapshot store (default): server/data/snapshot.json, in memory
            `-- ERPNext adapter (NUXT_BACKEND=erpnext): REST + API token, local ERPNext
```

### 5.2 Component interactions

- The browser calls the Nitro API. Pages under `app/pages/partner/[pid]/` use `useFetch('/api/partner/:pid/…')`; the pay button posts to `/api/partner/:pid/invoices/:iid/pay`.
- `POST /api/auth/login` looks the submitted user identifier up in the backend and, if it exists, stores the user id in a sealed session cookie (`server/utils/auth.ts`, h3 `useSession`, 8-hour lifetime).
- Every partner route calls `requireCapability(event, pid, capability)`: it loads the session user, finds that user's membership for the requested company, and checks the role against the capability matrix (`server/domain/permissions.ts`). The company id supplied by the browser is never trusted on its own.
- Case creation additionally checks the capability required by the case type and that referenced invoices and supply points belong to the same company (`server/api/partner/[pid]/cases.post.ts`).
- Sign-in, overview access, payments (success and decline) and case creation are recorded through `Backend.addAudit()`.
- `server/utils/backend.ts` selects the implementation: the snapshot store unless `NUXT_BACKEND=erpnext`.
- The Nitro plugin `server/plugins/demo-reset.ts` resets the snapshot store every 30 minutes. The test seed route `server/routes/__test/seed.post.ts` answers 404 unless `NUXT_TEST_SEED=true` and the snapshot backend is active.

### 5.3 Trust boundaries

| Boundary | Crossing | Observation |
|---|---|---|
| Browser → Nuxt server | HTTP requests with a sealed session cookie; company id in the URL | Identity comes from the session; company access is checked per request against the user's memberships. The sign-in itself asserts identity by user identifier only (mock SSO). |
| Nuxt server → ERPNext | Outbound HTTP with `Authorization: token key:secret` | Used only in `erpnext` mode. The token in `erp/.env.local` belongs to the ERPNext `Administrator` user (over-privileged); no timeout or retry. **Requires validation** for any non-local use. |
| Nuxt server → snapshot store | In-process | No network boundary; data is the committed fictional export. |
| Developer machine → ERPNext container | HTTP on `127.0.0.1:8088` | Local only; default credentials. |
| CI → deployment host | SSH with a repository secret and forced command | Host key checking and a restricted command are used; server-side configuration is not in the repository. |
| GitHub Actions → third-party actions | Workflow dependencies | Most actions are pinned by commit SHA; the Semgrep container image is referenced by tag only. |

## 6. Deployment model

| Aspect | Observed state | Evidence |
|---|---|---|
| Build | GitHub Actions runs `pnpm install --frozen-lockfile`, typecheck, unit tests, Playwright e2e and a Docker build. | `.github/workflows/ci.yml:20-85` |
| Artifact | The tested `.output` directory is archived as `szikra-output.tgz` and uploaded as a workflow artifact. | `.github/workflows/ci.yml:47-53`; `.github/workflows/ci.yml:156-171` |
| Image scan | The Docker image is scanned by Trivy for CRITICAL/HIGH vulnerabilities; the job fails on findings. | `.github/workflows/ci.yml:72-85` |
| Deployment | The artifact is streamed over SSH to a forced command (`deploy/deploy.sh`), unpacked into a staging directory, moved into place and the systemd user service is restarted. | `.github/workflows/ci.yml:166-171`; `deploy/deploy.sh:30-40` |
| Environments | `main` → `szikra.problemas.hu`; same-repository pull requests → `szikra-preview.problemas.hu`; forks and Dependabot are excluded. | `.github/workflows/ci.yml:127-147` |
| Activation | Deploy is conditional on `vars.DEPLOY_ENABLED == 'true'` and on the GitHub `production`/`preview` environment. | `.github/workflows/ci.yml:131-147` |
| Runtime | Node 26 in a container; `HOST=0.0.0.0`, `PORT=3000`; non-root `node` user; healthcheck against `/`. | `Dockerfile` |
| Host stack | Cloudflare Tunnel → nginx → systemd user services (`szikra@main`, `szikra@preview`). Documented as current state on 2026-11-06. | `deploy/README.md:11-20` |
| Rollback | The previous `.output` is kept as `.output.prev`; there is no automated rollback step. | `deploy/deploy.sh:34-39` |

**Documentation inconsistency (Requires validation):** `deploy/README.md` opens by stating that deployment is not yet connected and that a `deploy.yml` is disabled, but its "current state" section describes an active deployment and the repository has no `deploy.yml` (deployment lives in `ci.yml`). Similarly, `README.md` mentions a `publish` job that pushes to GHCR, but no such job exists in `ci.yml`. These statements cannot both be current and must be reconciled by the owner.

## 7. External dependencies

| Dependency | Role | Evidence | Notes |
|---|---|---|---|
| Node.js 26 | Runtime and build runtime | `Dockerfile`; `.github/workflows/ci.yml:27-28` | Base image `node:26-alpine` is tag-pinned, not digest-pinned. |
| Nuxt 4 / Nitro / Vue | Application framework and server runtime | `package.json` (`nuxt ^4.6.3`, `vue`, `vue-router`) | Versions resolved in `pnpm-lock.yaml`. |
| pnpm 11.16.0 | Package manager | `package.json` (`packageManager`); `Dockerfile` | `--frozen-lockfile` used in CI and Docker build. |
| ERPNext (Frappe) v16 | Live CRM/ERP backend for development; source of the exported snapshot | `erp/compose.yml` (image `frappe/erpnext:v16.60.0`, `mariadb:11.8`, `redis:6.2-alpine`); `server/utils/erp/client.ts` | Runs only on the developer machine; not part of the deployed artifact. Images are tag-pinned. |
| GitHub Actions | CI/CD execution platform | `.github/workflows/` | GitHub-hosted `ubuntu-latest` runners. |
| GitHub Container Registry | Documented image registry | `README.md` | No publish/push step found in `ci.yml`. **Not evidenced.** |
| Cloudflare Tunnel | Documented ingress and TLS termination | `deploy/README.md:6,13-19` | Account and tunnel configuration not in the repository. |
| Hetzner server | Documented deployment host | `deploy/README.md` | Host configuration not in the repository. |
| nginx / Caddy | Documented reverse proxy | `deploy/README.md:3-6,14` | The document mentions both Caddy (plan) and nginx (current state); configuration not in the repository. |
| Security tooling | CodeQL, Semgrep, gitleaks, OSV-Scanner, Trivy, Dependabot | `.github/workflows/security.yml`; `.github/workflows/ci.yml`; `.github/dependabot.yml` | Third-party actions are versioned/pinned; Semgrep container tag is not pinned. |
| AI provider | Claude Code CLI routed to DeepSeek for the agent workflow | `.github/workflows/agent.yml:51-61` | Uses a repository secret `DEEPSEEK_API_KEY`; not part of the runtime application. |

## 8. Data flows

| ID | Flow | Data | Evidence | Security observation |
|---|---|---|---|---|
| DF-01 | Browser → sign-in | User identifier typed or selected | `app/pages/index.vue`; `server/api/auth/login.post.ts` | The identifier is the only factor; no credential is requested. A sealed session cookie is issued. |
| DF-02 | Browser → Nuxt → backend → browser | Company, invoices (period, amount, due date, status), supply points (type, smart flag, POD/EIC-like id, last reading), cases and messages, notifications | `app/pages/partner/[pid]/`; `server/api/partner/[pid]/`; `server/domain/types.ts` | Returned only if the session user has a membership with a role that grants the capability. |
| DF-03 | Browser → Nuxt → backend | Invoice id of the invoice to pay; result status | `server/api/partner/[pid]/invoices/[iid]/pay.post.ts`; `server/utils/backends/memory.ts`; `server/utils/backends/erpnext.ts` | Requires `invoices.pay`; refuses an already paid invoice (409); a demo flag simulates a bank decline (402); no confirmation step or idempotency key; an audit event with the user id is written. |
| DF-04 | Browser → Nuxt | Health status and deployed commit SHA | `server/api/health.get.ts` | Public, unauthenticated operational metadata. |
| DF-05 | Test client → seed route | Scenario name, role; generated partner and user ids | `server/routes/__test/seed.post.ts` | Available only with `NUXT_TEST_SEED=true`; creates fictional records; ids from `crypto.randomUUID()`. |
| DF-06 | CI → deployment host | Build archive, target environment, commit SHA, Playwright report | `.github/workflows/ci.yml:120-125,166-171`; `deploy/deploy.sh` | Transport is SSH; the deploy key is a repository secret. |
| DF-07 | Nuxt → ERPNext | Customer, invoice, payment entry, issue, comment and event documents | `server/utils/erp/client.ts`; `server/utils/backends/erpnext.ts` | Authenticated with an API token; transport is plain HTTP on localhost in the documented setup; no timeout or retry. |
| DF-08 | Developer → ERPNext → repository | Seeded demo data; exported `snapshot.json` | `erp/seed.ts`; `erp/export.ts`; `server/data/snapshot.json` | The export is committed, so the deployed data is exactly what was reviewed in the pull request. |

### Data categories observed

- **Personal data (fictional in the demo):** user names and e-mail addresses (`@demo.szikra.test`), company names, addresses and tax numbers.
- **Contract and billing data:** contract numbers, supply-point identifiers, meter readings, invoice amounts, due dates, payment status.
- **Case data:** case type, free-text fields and messages entered by users.
- **Payment metadata:** only a status; no card or bank data is processed or stored (the bank decline is a flag on the demo partner).
- **Operational metadata:** deployed commit SHA, health status, audit and notification events, CI/e2e reports.

The repository does not contain a data classification, retention or privacy policy. The demo data is invented, but a real deployment of the same code would process personal and financial data.

## 9. Authentication and authorization

### Authentication

**Partially evidenced.** Session handling exists; credential verification does not:

- Sign-in is a mock single sign-on: `POST /api/auth/login` accepts a user identifier and creates a session if that user exists (`server/api/auth/login.post.ts`). It requests no password, one-time code or MFA, and no external identity provider is integrated.
- The session is a sealed cookie managed by h3 (`server/utils/auth.ts`), 8 hours maximum age. The sealing secret comes from `NUXT_SESSION_PASSWORD`; when unset, production uses a random per-process secret (sessions end on restart) and development uses a fixed, publicly visible secret. Cookie attributes beyond the h3 defaults are not configured in the repository (**Requires validation**).
- Fixed demo user identifiers are published on the landing page when `NUXT_PUBLIC_DEMO_USERS=true` (`server/api/auth/demo-users.get.ts`), so in demo mode knowing the identifier is not a secret.
- The health endpoint is intentionally public (`server/api/health.get.ts`).

### Authorization

**Evidenced (implementation), residual gaps remain.**

- Roles are `admin`, `penzugy` (finance), `muszaki` (technical) and `olvaso` (read-only); a user can hold different roles at different companies (`server/domain/permissions.ts`; `server/domain/scenarios.ts`).
- Server-side enforcement: `requireCapability()` returns 401 without a session, 403 without a membership at the requested company or without the capability (`server/utils/auth.ts`).
- Case types carry their own required capability (`server/domain/case-types.ts`); referenced invoices and supply points are validated against the company.
- The overview omits tiles the role may not see.
- e2e tests assert cross-company access, read-only and role-restricted requests are refused (`tests/e2e/partner.spec.ts`); unit tests cover the matrix (`tests/unit/permissions.test.ts`).
- Not evidenced: an access-review process, an administrator interface for roles (memberships are data in the backend), and tests for every route/role combination.

## 10. Infrastructure dependencies

| Dependency | Required for | Evidence | Reproducible from repository? |
|---|---|---|---|
| GitHub Actions runners | Build, test, scan, deploy | `.github/workflows/*.yml` | Workflow definitions yes; runner infrastructure no. |
| Container runtime / Docker | Image build and runtime | `Dockerfile`; `.github/workflows/ci.yml:79` | Dockerfile yes; daemon/host no. |
| Node 26 runtime | Application execution | `Dockerfile`; CI `setup-node` | Version declared; image digest not pinned. |
| Reverse proxy (nginx/Caddy) | Host routing and documented rate limiting | `deploy/README.md` | **No** — configuration is outside the repository. |
| Cloudflare Tunnel | Ingress, DNS and documented TLS termination | `deploy/README.md` | **No** — account/tunnel configuration is outside the repository. |
| systemd user services | Process supervision and restart | `deploy/README.md:15,19`; `deploy/deploy.sh:39` | **No** — unit files are outside the repository. |
| ERPNext (local) | Live backend and snapshot source in development | `erp/compose.yml`; `server/utils/erp/client.ts` | **Partly** — the stack definition and seed are in the repository; volumes, API keys and the running instance are not. |
| GitHub secrets/variables | Deployment key, known hosts, AI provider key | `.github/workflows/ci.yml:113-115,159-161`; `.github/workflows/agent.yml:54` | Names are visible; values are not (correctly). |

## 11. Operational characteristics relevant to security

| Characteristic | Observation | Evidence |
|---|---|---|
| Statefulness | The deployed application is stateless apart from process memory: the snapshot store and the audit/notification lists are lost on restart. In `erpnext` mode state lives in the ERPNext database (Docker volumes on the developer machine). | `server/utils/backends/memory.ts`; `erp/compose.yml` |
| Snapshot capacity | The store is capped at 500 partners; the oldest unpinned entries are evicted. Fixed demo partners are pinned. | `server/utils/backends/memory.ts` |
| Demo reset | The snapshot store is restored from `snapshot.json` every 30 minutes, so demo payments and new cases do not persist. | `server/plugins/demo-reset.ts` |
| Health checking | `/api/health` returns `status: ok` and the deployed commit SHA when `NUXT_BUILD_SHA` is set. | `server/api/health.get.ts` |
| Deployment verification | CI polls `/api/health` until the served SHA matches the deployed commit. | `.github/workflows/ci.yml:172-179` |
| Availability design | One documented deployment host with two application environments (main and preview); no redundancy, failover, RTO/RPO or backup procedure is evidenced. | `deploy/README.md:11-20` |
| Rollback | A previous build is retained as `.output.prev`; rollback is manual and not automated or tested in the repository. | `deploy/deploy.sh:34-39` |
| Logging | Business and security events (sign-in, overview access, payment result, case creation) are recorded via `addAudit()`, but only in process memory (snapshot mode) or as ERPNext `Szikra Event` rows; no endpoint or UI reads them, and there is no central log, retention or alerting. CI logs and Playwright artifacts are retained by GitHub. | `server/utils/backend.ts`; `server/api/partner/[pid]/`; `.github/workflows/ci.yml:54-70` |
| Monitoring/alerting | Only the health endpoint and the deploy smoke test are evidenced; no dashboards, alert routes or on-call process are in the repository. | `server/api/health.get.ts`; `.github/workflows/ci.yml:172-179` |
| Rate limiting | The application implements none (including the sign-in). `deploy/README.md` states nginx rate limiting exists, but the nginx configuration is not in the repository. | `server/`; `deploy/README.md:14` — **Requires validation** |
| Secret handling | Runtime configuration is environment-based. `.env*` files are ignored except `.env.example`; the example contains placeholders only. The generated ERPNext token is written to `erp/.env.local` (mode 600, git-ignored). | `nuxt.config.ts`; `.gitignore`; `.env.example`; `erp/seed.ts` |
| Security headers | No custom CSP, HSTS or other security-header configuration was found in the repository. Response headers were not validated against a running deployment. | `nuxt.config.ts`; `server/` — **Requires validation** |

## 12. Facts, observations and assumptions

### Facts evidenced in the repository

- The application is a Nuxt 4 SSR demo partner portal with a backend interface that has an in-memory JSON-snapshot implementation (default) and a live ERPNext implementation.
- Sessions use a sealed cookie; access to company data is checked server-side against per-company role memberships. Sign-in does not verify a credential.
- The application is deployed as a non-root container built and tested by GitHub Actions.
- The repository contains SAST, secret scanning, dependency scanning, container scanning and dependency-update automation.
- The application handles fictional business and billing data; the deployed artifact contains no database, only the committed snapshot.
- The deployment host, reverse proxy and TLS tunnel are external and documented only narratively.

### Technical observations

- Because the user identifier alone signs a user in, and demo identifiers are published, the authorization model protects company data from other users only as far as the identity assertion is trusted; with real data an identity provider with MFA would be required.
- Payments are protected by role and company checks and a duplicate guard, but have no confirmation step, idempotency key or correlation id.
- Audit events exist but are volatile or only stored in the backend and are not exposed or monitored.
- The in-memory store and 30-minute reset are suitable for a demo but do not provide durable storage, backup or recovery.
- The ERPNext adapter uses an `Administrator` API token and has no timeout, retry or circuit breaker; the local ERPNext stack uses default credentials and is intended for a developer machine only.
- The CI/CD pipeline is the most mature security-relevant part of the repository, but several documented capabilities (GHCR publish, dependency-review) are not present in the workflows.

### Assumptions (not proven by the repository)

- The production/demo deployment is expected to be reachable over HTTPS through Cloudflare; this is documented but not verifiable from the repository.
- A production-grade identity provider and a least-privilege ERPNext service account would replace the mock sign-in and the `Administrator` token before any real use; neither is evidenced here.
- GitHub organisation settings such as branch protection, required reviews and environment approvals are expected to exist; they are not stored in the repository and therefore **Require validation**.

## 13. Open questions for the system owner

1. Is the deployed demo running with `NUXT_PUBLIC_DEMO_USERS=true`, and is `NUXT_SESSION_PASSWORD` set (otherwise sessions end on every restart)? What is the actual production configuration?
2. Which identity provider and MFA would replace the mock sign-in, and where would roles and memberships be administered?
3. Is TLS terminated only at Cloudflare, and is traffic between Cloudflare, nginx and the Node process encrypted?
4. Are the nginx rate-limit and Cloudflare/WAF rules documented and version-controlled anywhere?
5. Are branch protection, required reviews and GitHub environment approvals enabled for `main` and `production`?
6. What are the RTO, RPO and backup arrangements for ERPNext data and the deployment host if the live backend were ever used outside a developer machine?
7. Is there an incident-response plan, on-call rota and security contact outside this repository?

## 14. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial PoC system overview generated from repository evidence at commit `94ce09c`. |
| 0.2 | 2026-11-22 | Updated for the B2B partner portal: backend interface (snapshot/ERPNext), session authentication, role-based authorization, audit events. Baseline `main` at `17d547b`. |

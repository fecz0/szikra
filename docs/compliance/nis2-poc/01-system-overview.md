# 01 — System Overview

> **Proof of Concept (PoC).** This document is part of a repository-derived NIS2 assessment package. It is **not an official NIS2 audit or certification** and does not certify the application as NIS2 compliant. Missing information is marked as **Not evidenced** or **Requires validation** instead of being assumed.

| Field | Value |
|---|---|
| Document | `01-system-overview.md` |
| Assessment date | 2026-11-17 |
| Assessment target | `szikra` repository at commit `94ce09cc539fef0d1f94eb32a1563b00efd89a96` |
| Application | Szikra demo customer portal |
| Assessment type | Static repository review (PoC) |
| Classification | Internal demo — fictional data |
| Prepared by | Automated agent (PoC) |
| Status | Draft — requires validation by the system owner |

## 1. Purpose and scope

This document describes the application that is the subject of the NIS2 PoC assessment. It contains only facts that can be evidenced from the repository, supplemented by clearly labelled technical observations and assumptions.

**In scope:** application source code, Nuxt/Nitro configuration, SAP adapter and mock SAP, container definition, CI/CD workflows, dependency manifests, test suite, and repository documentation.

**Out of scope / not evidenced in the repository:** the actual SAP system, the production host configuration (nginx, systemd units, firewall), Cloudflare account configuration, GitHub organisation settings (branch protection, environment protection), and any business or organisational processes.

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

Szikra is a **demo customer portal for a fictional energy provider**. A visitor enters a customer identifier on the landing page and is taken to an account page that shows:

- customer name and address,
- contract account,
- electricity and gas meters, including whether the meter is smart,
- bills with period, amount, due date and status,
- the payment method label,
- a "Fizetés" (pay) action for bills that are not paid.

The repository states explicitly that the data is fictional and that the application is not a real provider (`README.md`; `app/app.vue:13`). The primary purpose of the repository is to demonstrate an automated CI/CD, DevSecOps and Playwright e2e process against a simulated SAP backend, not to operate a customer-facing production service (`README.md`).

### Users and actors

| Actor | Interaction | Evidence |
|---|---|---|
| Customer / demo visitor | Enters a customer ID, views account data, initiates a mock payment | `app/pages/index.vue`; `app/pages/fiok/[id].vue` |
| Demo operator | Uses fixed demo IDs (`DEMO-OKOS`, `DEMO-ELMARADT`, `DEMO-KARTYA`, `DEMO-RENDEZETT`) | `app/pages/index.vue:4-9`; `server/mock-sap/demo-users.ts` |
| CI/CD pipeline | Builds, tests, scans and deploys the application | `.github/workflows/ci.yml`; `.github/workflows/security.yml` |
| AI agent | Implements labelled issues and opens pull requests | `.github/workflows/agent.yml` |
| SAP system | Provides customer, meter, bill and payment data through the adapter | `server/utils/sap.ts` |

## 4. Major components

| Component | Technology / role | Evidence | Security relevance |
|---|---|---|---|
| Frontend / SSR application | Nuxt 4 + Vue 3; server-side rendered pages and client hydration | `package.json`; `nuxt.config.ts`; `app/app.vue`; `app/pages/` | Renders personal and billing data; no authentication layer. |
| Server API | Nitro route handlers under `/api` | `server/api/account/[id].get.ts`; `server/api/account/[id]/pay.post.ts`; `server/api/health.get.ts` | Exposes account and payment operations; accepts caller-supplied IDs. |
| SAP adapter | Single integration boundary for all SAP calls | `server/utils/sap.ts` | Centralises outbound SAP traffic; no timeout/retry/circuit breaker. |
| Mock SAP | In-memory implementation of the SAP contract, enabled only with `NUXT_MOCK_SAP=true` | `server/routes/mock-sap/`; `server/mock-sap/`; `server/utils/mock-guard.ts` | Public when enabled; ephemeral state; seed endpoint creates customers. |
| Demo seeding | Startup plugin that creates fixed demo customers and resets them every 30 minutes | `server/plugins/demo-users.ts` | Fixed public identifiers; state resets; no real data. |
| Container image | Multi-stage Node 26 Alpine image, non-root runtime | `Dockerfile` | Reduced runtime surface (npm/corepack removed); base image not digest-pinned. |
| CI pipeline | GitHub Actions: typecheck, unit, e2e, Docker build, Trivy image scan, deploy | `.github/workflows/ci.yml` | Builds and promotes exactly the tested artifact; uses repository secrets for deployment. |
| Security pipeline | CodeQL, Semgrep, gitleaks, OSV-Scanner, Trivy filesystem/config scan | `.github/workflows/security.yml` | Automated SAST, secret scanning, SCA and misconfiguration scanning. |
| Dependency automation | Dependabot for npm, GitHub Actions and Docker | `.github/dependabot.yml` | Weekly updates with a 7-day cooldown. |
| Deployment tooling | Forced-command SSH script, systemd user services, nginx, Cloudflare Tunnel (documented) | `deploy/deploy.sh`; `deploy/README.md` | Artifact upload, restart, rollback copy; host configuration itself is not in the repository. |
| Test suite | Vitest unit tests and Playwright e2e tests | `tests/unit/`; `tests/e2e/`; `playwright.config.ts` | Verifies behaviour against mock SAP with isolated seeded customers. |

## 5. Architecture

### 5.1 Logical architecture

```text
Customer browser
      |
      | HTTPS (termination documented as Cloudflare Tunnel; configuration not in repo)
      v
Cloudflare Tunnel -> nginx reverse proxy  [documented in deploy/README.md, not in repo]
      |
      v
Nuxt 4 / Nitro server (Node 26, container, non-root user)
      |
      +-- Vue SSR pages (app/)
      |     +-- /                     landing page, customer-ID lookup
      |     `-- /fiok/:id             account, meters, bills, payment
      |
      +-- Nitro API routes (server/api/)
      |     +-- GET  /api/account/:id
      |     +-- POST /api/account/:id/pay
      |     `-- GET  /api/health
      |
      +-- SAP adapter (server/utils/sap.ts)  <- the only SAP boundary
            |
            +-- NUXT_SAP_BASE_URL (external SAP interface; URL not configured in repo)
            `-- /mock-sap/* (in-memory) when NUXT_MOCK_SAP=true
```

### 5.2 Component interactions

- The browser calls the Nitro API. The account page is rendered by `app/pages/fiok/[id].vue`, which calls `useFetch('/api/account/:id')`; the pay button calls `$fetch('/api/account/:id/pay', { method: 'POST' })`.
- `server/api/account/[id].get.ts` delegates to `sapGetCustomer()`; `server/api/account/[id]/pay.post.ts` delegates to `sapPayBill()`.
- `server/utils/sap.ts` is the only module that constructs SAP URLs. It chooses `NUXT_SAP_BASE_URL` if set, otherwise the internal `/mock-sap` base when `NUXT_MOCK_SAP=true`, otherwise it fails with HTTP 500.
- The mock SAP routes are guarded by `requireMockSap()`, which returns 404 when the mock flag is off (`server/utils/mock-guard.ts`).
- The Nitro plugin `server/plugins/demo-users.ts` seeds four fixed demo customers at startup and every 30 minutes when both `NUXT_MOCK_SAP` and `NUXT_PUBLIC_DEMO_USERS` are enabled.

### 5.3 Trust boundaries

| Boundary | Crossing | Observation |
|---|---|---|
| Browser → Nuxt server | Public HTTP requests, customer ID in URL/body | No authentication or session is established. |
| Nuxt server → SAP | Outbound HTTP through `server/utils/sap.ts` | The SAP interface is external and its authentication is not visible in the repository. **Requires validation.** |
| Nuxt server → mock SAP | Internal HTTP to `/mock-sap` | Publicly reachable when the mock flag is enabled; protected only by a configuration flag. |
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
| SAP interface | Source of customer, meter, bill and payment data | `server/utils/sap.ts`; `.env.example` | Actual endpoint and credentials are not in the repository. |
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
| DF-01 | Browser → landing page | Customer identifier typed by the visitor | `app/pages/index.vue:1-24` | The identifier is the only access token; no credential is requested. |
| DF-02 | Browser → Nuxt → SAP → browser | Name, address, contract account, meters (type, smart flag, POD/EIC-like ID, last reading), bills (period, amount, due date, status), payment-method label | `app/pages/fiok/[id].vue`; `server/api/account/[id].get.ts`; `server/utils/sap.ts`; `server/mock-sap/types.ts` | Personal and billing data is returned to anyone who supplies an existing customer ID. |
| DF-03 | Browser → Nuxt → SAP | `billId` of the bill to pay; response status | `server/api/account/[id]/pay.post.ts`; `server/utils/sap.ts` | No confirmation, idempotency key or audit record. |
| DF-04 | Browser → Nuxt | Health status and deployed commit SHA | `server/api/health.get.ts` | Public, unauthenticated operational metadata. |
| DF-05 | Test/client → mock SAP | Scenario name, generated customer ID | `server/routes/mock-sap/__seed.post.ts` | Public when the mock is enabled; creates fictional records. |
| DF-06 | CI → deployment host | Build archive, target environment, commit SHA, Playwright report | `.github/workflows/ci.yml:120-125,166-171`; `deploy/deploy.sh` | Transport is SSH; the deploy key is a repository secret. |
| DF-07 | Application → external SAP | Customer ID, bill ID | `server/utils/sap.ts` | SAP-side authentication, authorisation and encryption are not evidenced in this repository. **Requires validation.** |

### Data categories observed

- **Personal data (fictional in the demo):** name, address.
- **Contract and billing data:** contract account, meter identifiers, consumption readings, bill amounts, due dates, payment status.
- **Payment metadata:** payment-method type and a masked card label (for example `Bankkártya **** 4242`). No full card number, CVV or bank credentials are present in the repository.
- **Operational metadata:** deployed commit SHA, health status, CI/e2e reports.

The repository does not contain a data classification, retention or privacy policy. The demo data is invented, but a real deployment of the same code would process personal and financial data.

## 9. Authentication and authorization

### Authentication

**Not evidenced.** No authentication mechanism is implemented in the repository:

- The landing page collects only a customer identifier and navigates to `/fiok/:id`; it does not collect a password, one-time code or any other credential (`app/pages/index.vue:10-13`).
- No session, cookie, bearer token, OIDC/OAuth client, SAML integration or server middleware was found in `app/` or `server/`.
- The API handlers trust the `id` path parameter and do not verify a caller identity (`server/api/account/[id].get.ts:1-9`; `server/api/account/[id]/pay.post.ts:1-10`).
- The mock API is protected only by the `NUXT_MOCK_SAP` configuration flag, not by caller authentication (`server/utils/mock-guard.ts`).
- The health endpoint is intentionally public (`server/api/health.get.ts`).

The customer identifier therefore acts as a **knowledge-based lookup key**, not as an authentication factor. Fixed demo identifiers are published in the UI when demo mode is enabled (`app/pages/index.vue:4-9`).

### Authorization

**Not evidenced.** No role model, permission check, ownership check or tenant isolation is present:

- Any caller who knows or guesses an identifier receives the corresponding customer record.
- Any caller can attempt a payment for any bill ID of that customer.
- There is no administrator interface, no role assignment and no RBAC configuration in the repository.
- The only access restriction found is the global mock on/off switch.

## 10. Infrastructure dependencies

| Dependency | Required for | Evidence | Reproducible from repository? |
|---|---|---|---|
| GitHub Actions runners | Build, test, scan, deploy | `.github/workflows/*.yml` | Workflow definitions yes; runner infrastructure no. |
| Container runtime / Docker | Image build and runtime | `Dockerfile`; `.github/workflows/ci.yml:79` | Dockerfile yes; daemon/host no. |
| Node 26 runtime | Application execution | `Dockerfile`; CI `setup-node` | Version declared; image digest not pinned. |
| Reverse proxy (nginx/Caddy) | Host routing and documented rate limiting | `deploy/README.md` | **No** — configuration is outside the repository. |
| Cloudflare Tunnel | Ingress, DNS and documented TLS termination | `deploy/README.md` | **No** — account/tunnel configuration is outside the repository. |
| systemd user services | Process supervision and restart | `deploy/README.md:15,19`; `deploy/deploy.sh:39` | **No** — unit files are outside the repository. |
| External SAP interface | Master and transactional data | `server/utils/sap.ts`; `.env.example` | **No** — endpoint and credentials are external. |
| GitHub secrets/variables | Deployment key, known hosts, AI provider key | `.github/workflows/ci.yml:113-115,159-161`; `.github/workflows/agent.yml:54` | Names are visible; values are not (correctly). |

## 11. Operational characteristics relevant to security

| Characteristic | Observation | Evidence |
|---|---|---|
| Statefulness | The application itself is stateless; mock SAP state is held in process memory and is lost on restart. | `server/mock-sap/store.ts:1-4` |
| Mock capacity | The in-memory store is capped at 500 customers; the oldest unpinned entries are evicted. Fixed demo users are pinned. | `server/mock-sap/store.ts:5-19` |
| Demo reset | Fixed demo users are re-seeded at startup and every 30 minutes, so demo payments do not persist. | `server/plugins/demo-users.ts:5-16` |
| Health checking | `/api/health` returns `status: ok` and the deployed commit SHA when `NUXT_BUILD_SHA` is set. | `server/api/health.get.ts` |
| Deployment verification | CI polls `/api/health` until the served SHA matches the deployed commit. | `.github/workflows/ci.yml:172-179` |
| Availability design | One documented deployment host with two application environments (main and preview); no redundancy, failover, RTO/RPO or backup procedure is evidenced. | `deploy/README.md:11-20` |
| Rollback | A previous build is retained as `.output.prev`; rollback is manual and not automated or tested in the repository. | `deploy/deploy.sh:34-39` |
| Logging | No application-level access, security or audit logging configuration was found. CI logs and Playwright artifacts are retained by GitHub. | `server/`; `.github/workflows/ci.yml:54-70` |
| Monitoring/alerting | Only the health endpoint and the deploy smoke test are evidenced; no dashboards, alert routes or on-call process are in the repository. | `server/api/health.get.ts`; `.github/workflows/ci.yml:172-179` |
| Rate limiting | The application implements none. `deploy/README.md` states nginx rate limiting exists, but the nginx configuration is not in the repository. | `server/`; `deploy/README.md:14` — **Requires validation** |
| Secret handling | Runtime configuration is environment-based. `.env*` files are ignored except `.env.example`; the example contains placeholders only. | `nuxt.config.ts`; `.gitignore`; `.env.example` |
| Security headers | No custom CSP, HSTS or other security-header configuration was found in the repository. Response headers were not validated against a running deployment. | `nuxt.config.ts`; `server/` — **Requires validation** |

## 12. Facts, observations and assumptions

### Facts evidenced in the repository

- The application is a Nuxt 4 SSR demo portal backed by a SAP adapter and an optional in-memory mock SAP.
- There is no application authentication, session handling or authorization; a customer ID is the only lookup key.
- The application is deployed as a non-root container built and tested by GitHub Actions.
- The repository contains SAST, secret scanning, dependency scanning, container scanning and dependency-update automation.
- The application handles fictional personal and billing data; no database is part of the application.
- The deployment host, reverse proxy and TLS tunnel are external and documented only narratively.

### Technical observations

- The customer identifier is enumerable in principle; fixed demo identifiers are published, and no rate limiting is implemented in the application.
- Because payment is a POST without authentication, confirmation, idempotency or audit logging, the integrity of the payment flow depends entirely on controls outside this repository.
- The in-memory mock and 30-minute reset are suitable for a demo but do not provide durable storage, backup or recovery.
- The CI/CD pipeline is the most mature security-relevant part of the repository, but several documented capabilities (GHCR publish, dependency-review) are not present in the workflows.

### Assumptions (not proven by the repository)

- The production/demo deployment is expected to be reachable over HTTPS through Cloudflare; this is documented but not verifiable from the repository.
- The external SAP interface is expected to enforce its own authentication, authorization and transport security; no evidence is available here.
- GitHub organisation settings such as branch protection, required reviews and environment approvals are expected to exist; they are not stored in the repository and therefore **Require validation**.

## 13. Open questions for the system owner

1. Is the deployed demo running with `NUXT_MOCK_SAP=true` and `NUXT_PUBLIC_DEMO_USERS=true`? What is the actual production configuration?
2. What authentication and authorization does the real SAP interface require, and how are its credentials stored and rotated?
3. Is TLS terminated only at Cloudflare, and is traffic between Cloudflare, nginx and the Node process encrypted?
4. Are the nginx rate-limit and Cloudflare/WAF rules documented and version-controlled anywhere?
5. Are branch protection, required reviews and GitHub environment approvals enabled for `main` and `production`?
6. What are the RTO, RPO and backup arrangements for the SAP system and the deployment host?
7. Is there an incident-response plan, on-call rota and security contact outside this repository?

## 14. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial PoC system overview generated from repository evidence at commit `94ce09c`. |

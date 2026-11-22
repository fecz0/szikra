# 02 — NIS2-Oriented Control Assessment

> **Proof of Concept (PoC).** This is a repository-derived control assessment, **not an official NIS2 audit or certification**. It does not certify the Szikra application as NIS2 compliant. Absent evidence is marked **Not evidenced** or **Requires validation**; it is never assumed to exist.

| Field | Value |
|---|---|
| Document | `02-nis2-control-assessment.md` |
| Assessment date | 2026-11-22 (updated; first issued 2026-11-17) |
| Assessment target | `szikra` repository, `main` at commit `17d547b` (PR #36, B2B partner portal) plus the update in this change |
| Framework basis | NIS2 Directive (EU) 2022/2555, Article 21(2) measures, adapted to a repository review |
| Entity classification | **Not evidenced.** The repository describes a demo application; no NIS2 entity classification is documented. |
| Method | Static inspection of source, configuration, CI/CD, deployment scripts and documentation |
| Status | Draft — requires validation by the system owner |

## 1. Scope and applicability note

The assessment covers the application and its repository-level engineering controls. It does **not** cover the organisation, its management body, HR processes, physical premises, contracts with suppliers, or the production infrastructure that is only described narratively in `deploy/README.md`.

The application is a demo with fictional data. Whether the operating organisation is an essential or important entity under NIS2 is **not evidenced** and must be determined by the owner. This PoC deliberately assesses the code and delivery system as if it were an enterprise application, while clearly separating repository evidence from external controls.

## 2. Status definitions

| Status | Definition used in this document |
|---|---|
| **Evidenced** | A concrete, relevant artifact or implementation exists in the repository for the stated control. This means the evidence exists, **not** that the control is complete or certified. |
| **Partially evidenced** | Some relevant artifacts exist, but the control is incomplete, limited in scope, only external/documented, or not verifiable end to end. |
| **Not evidenced** | No repository evidence was found. This does not prove the control is absent outside the repository, but it cannot be credited in this assessment. |
| **Not applicable** | The control lies outside the repository/system boundary or the demo does not process the relevant asset. |
| **Requires validation** | Evidence points to an external system or process; the owner must confirm the actual implementation. |

## 3. Assessment summary

| Area | Status | Evidence | Gap | Recommendation |
|---|---|---|---|---|
| Risk analysis and information system security | Not evidenced | No risk register, threat model or risk methodology found. `README.md` and `deploy/README.md` describe the system but not risks. | No documented risk assessment, asset criticality, likelihood/impact method, risk ownership or management approval. | Establish a NIS2-scoped risk assessment and maintain a risk register with owners, review dates and treatment decisions. |
| Incident handling | Not evidenced | Only delivery-failure signalling exists: `.github/workflows/agent.yml:91-111` and CI job results. No security incident process, contact list, runbook or notification procedure. | No detection, triage, escalation, evidence preservation, regulatory notification (24-hour early warning, 72-hour incident notification, one-month final report) or post-incident review process. | Create and test an incident-response plan covering the NIS2 notification stages, communication and lessons learned. |
| Business continuity and disaster recovery | Partially evidenced | `deploy/deploy.sh:30-39` retains the previous build as `.output.prev`; `.github/workflows/ci.yml:127-147` defines main and preview targets; `/api/health` supports deployment verification. | No business impact analysis, RTO/RPO, data backup, restore test, failover, redundant host or documented crisis management. | Define RTO/RPO, backup and restore procedures, test restoration, and add a documented manual/automatic rollback path. |
| Supply-chain security | Partially evidenced | `.github/dependabot.yml`; SHA-pinned Actions in `.github/workflows/ci.yml` and `security.yml`; `pnpm-lock.yaml`; `pnpm-workspace.yaml` overrides; Trivy image scan at `.github/workflows/ci.yml:72-85`; OSV-Scanner at `.github/workflows/security.yml:41-47`. | `node:26-alpine` is not digest-pinned; the Semgrep container is tag-referenced; no SBOM, artifact signing, provenance or supplier assessment; `README.md` claims a `publish`/GHCR job that does not exist. | Pin images by digest, generate and retain an SBOM, sign/provenance-attest release artifacts, assess critical suppliers and reconcile stale documentation. |
| Secure acquisition, development and maintenance | Partially evidenced | Pull-request CI in `.github/workflows/ci.yml:3-6`; typecheck and unit tests at lines 20-32; Playwright e2e at lines 34-70; CodeQL and Semgrep in `.github/workflows/security.yml`; protected-file check in `.github/workflows/agent.yml:73-89`. | No security requirements or acquisition criteria; no branch-protection/required-review evidence; no secure coding standard; no threat modelling; no dependency-review job despite `README.md`; no signed commits. | Codify secure SDLC gates, require reviewed changes on protected branches, add threat modelling and a dependency-review gate, and document security requirements for acquired components. |
| Vulnerability handling and disclosure | Partially evidenced | Automated scanning exists: CodeQL, Semgrep, gitleaks, OSV-Scanner and Trivy in `.github/workflows/security.yml`; image scan in `.github/workflows/ci.yml:72-85`; exception register in `osv-scanner.toml`. | No disclosure policy or security contact; no triage, ownership, remediation SLA or ticket trail; no penetration test; no evidence that findings are tracked to closure. | Publish `SECURITY.md`/security.txt, define triage and remediation SLAs, track findings in an owned backlog, and schedule independent testing. |
| Effectiveness of cybersecurity controls | Not evidenced | Functional tests exist (`tests/unit/`, `tests/e2e/`), but no control metrics, internal audit, penetration test, red-team exercise or management review. | No measurement of whether controls work; CI passing is not evidence of security effectiveness. | Define security KPIs, test controls periodically, run independent assessments and record management review decisions. |
| Cryptography and encryption | Partially evidenced | `deploy/README.md:13-19` documents Cloudflare Tunnel ingress; deployment secrets are injected from GitHub at `.github/workflows/ci.yml:113-125,159-171`; sessions are sealed with a secret from `NUXT_SESSION_PASSWORD` or a random per-process value (`server/utils/auth.ts`); `.env.example` contains only commented placeholders. | TLS/WAF configuration is not in the repository; at-rest encryption, key management, rotation and a cryptographic inventory are not evidenced; cookie attributes beyond the h3 defaults are not configured; the application uses framework session sealing only. | Document the TLS termination and internal-hop encryption model, set and rotate `NUXT_SESSION_PASSWORD`, configure and test cookie attributes, inventory keys/certificates, and verify Cloudflare/nginx settings. |
| Access control | Partially evidenced | Server-side role model: `server/domain/permissions.ts` (admin, penzugy, muszaki, olvaso → capabilities); `requireCapability()` in `server/utils/auth.ts` is called by every `/api/partner/[pid]/…` handler; case types carry their own capability and references are validated against the company (`server/api/partner/[pid]/cases.post.ts`); e2e and unit tests cover cross-company and role-restricted requests (`tests/e2e/partner.spec.ts`, `tests/unit/permissions.test.ts`). | No access-review process or role-administration interface (memberships are backend data); no test for every route/role pair; no rate limiting; the quality of access control depends on the unverified identity assertion at sign-in. | Add an automated route × role access test matrix, define an access-review cycle for memberships, and bind authorization to a verified identity (see Authentication). |
| Asset management | Partially evidenced | Declared dependencies in `package.json`; resolved versions in `pnpm-lock.yaml`; container definition in `Dockerfile`; CI/CD assets in `.github/workflows/`; test assets in `tests/`. | No asset register, ownership, criticality classification, SBOM or lifecycle/decommissioning record; host and network assets are outside the repository. | Maintain an asset and service inventory with owners and criticality, generate an SBOM and include external infrastructure assets. |
| Authentication | Partially evidenced | Session handling exists: sealed h3 cookie, 8-hour lifetime, logout (`server/utils/auth.ts`, `server/api/auth/`); unauthenticated API calls return 401 and unauthenticated pages redirect (`app/middleware/auth.ts`). | Sign-in is a mock SSO: a known user identifier is the only factor (`server/api/auth/login.post.ts`); no password, MFA, identity provider, account recovery or brute-force protection; demo identifiers are published when `NUXT_PUBLIC_DEMO_USERS=true`. | Integrate a standards-based identity provider with MFA, keep sessions server-side or short-lived, and never enable the demo user list with real data. |
| Logging and monitoring | Partially evidenced | Business/security events (sign-in, overview, payment success/decline, case creation) are written with `Backend.addAudit()` (`server/api/auth/login.post.ts`, `server/api/partner/[pid]/`); in `erpnext` mode they persist as `Szikra Event` rows (`server/utils/backends/erpnext.ts`); `server/api/health.get.ts` exposes health and build SHA; `.github/workflows/ci.yml:172-179` polls it after deploy; CI artifacts are retained at `.github/workflows/ci.yml:54-70`. | In the deployed snapshot mode the audit list is process memory and lost on restart; no endpoint or UI reads it; no HTTP access/error log configuration, central collection, retention, alerting, SIEM or on-call process. | Persist and ship audit events to a central store with retention, expose them to administrators, alert on payment/auth anomalies and define monitoring ownership. |
| Network security | Requires validation | `deploy/README.md:13-19` documents Cloudflare Tunnel and nginx host routing/rate limiting; no nginx, firewall, WAF or tunnel configuration is present in the repository. | External network controls are not reproducible or verifiable here; the application itself has no rate limiting or anti-automation control. | Bring network configuration under version control or provide reviewed evidence; add app-level rate limiting and abuse protection. |
| Data protection and privacy | Partially evidenced | Demo data is declared fictional in `README.md` and `app/app.vue`; data fields are defined in `server/domain/types.ts`; no card or bank data is processed or stored; demo e-mail addresses use a reserved test domain. | No data classification, retention, minimisation, privacy notice, DPA or at-rest encryption evidence for a real deployment; free-text case fields can hold personal data. | Classify data, define retention/deletion, document lawful basis and protect personal/financial data in transit and at rest. |
| Change management and configuration management | Partially evidenced | Git history; pull-request-triggered CI at `.github/workflows/ci.yml:3-6`; automated agent PR flow and protected-file denylist at `.github/workflows/agent.yml:73-101`; runtime configuration in `nuxt.config.ts`. | Branch protection and required reviews are not evidenced; host configuration is not version-controlled; documentation drift exists (`deploy.yml`, GHCR publish, dependency-review). | Require protected branches and reviews, version host configuration, and reconcile documentation with actual workflows. |
| Governance, roles and training | Not evidenced | No security policy, role definitions, management commitment, training record or cyber-hygiene programme was found in the repository. | No assigned security responsibilities, awareness programme or management oversight. | Define NIS2 roles, approve a security policy, and run recurring awareness and role-specific training. |
| Physical and environmental security | Not applicable | The application assets in scope are code and CI/CD definitions; hosting is external (GitHub and a documented Hetzner host). No physical asset is managed in the repository. | Physical controls cannot be assessed from the repository and are the provider's responsibility. | Obtain and review hosting-provider attestations and include them in supplier management. |
| Backup and recovery | Not evidenced | No backup job, schedule, storage or restore procedure was found. The deployed store is in-memory (`server/utils/backends/memory.ts`); `.output.prev` is a deployment rollback copy; ERPNext data sits in Docker volumes on the developer machine (`erp/compose.yml`) with no backup. | No backup of configuration, data or secrets; no restore test; no RPO. The committed `snapshot.json` is a reproducible export of fictional data, not a backup. | Define backup scope and retention, encrypt backups, test restoration and record RPO/RTO. |
| Automated vulnerability scanning (sub-control) | Evidenced | CodeQL, Semgrep, gitleaks, OSV-Scanner and Trivy definitions in `.github/workflows/security.yml`; Trivy image scan in `.github/workflows/ci.yml:72-85`; scheduled weekly run at `security.yml:7-8`. | Scanning is CI-only; coverage, tuning and finding follow-up are not evidenced. | Retain scan results, track findings to closure and review scanner coverage periodically. |
| Backend integration resilience (sub-control) | Partially evidenced | `server/utils/backend.ts` is the single data boundary; the default snapshot store has no network dependency; `server/utils/erp/client.ts` performs plain `fetch` calls for the ERPNext mode; `.github/workflows/ci.yml:172-179` verifies only the application's own health. | The ERPNext client has no timeout, retry, circuit breaker or dependency health check; the ERPNext token belongs to `Administrator` (no least privilege); errors surface as generic failures. | Add timeouts, bounded retries, circuit breaking and dependency health checks, use a least-privilege ERPNext service user, and write an outage runbook before any non-local use. |
| Secret and key management (sub-control) | Partially evidenced | GitHub secrets for deployment and the AI provider; SSH key written with mode 600 and strict host-key checking at `.github/workflows/ci.yml:113-125,159-171`; `.env*` ignored except `.env.example`; gitleaks in CI. | No vault, rotation schedule, access review or documented key ownership; deploy-key lifetime is unknown. | Move to a managed secret store, define rotation and access review, and document key ownership. |
| Secure CI/CD and agent automation (sub-control) | Partially evidenced | Workflows default to `contents: read`; actions are mostly SHA-pinned; deployment uses a forced command (`deploy/deploy.sh`); fork and Dependabot deployments are excluded at `.github/workflows/ci.yml:131-138`. | The agent workflow has write permissions and repository secrets; it installs unpinned OS packages and disables an AppArmor user-namespace restriction; no environment-approval evidence; Semgrep image is unpinned. | Harden the automation path, pin all dependencies/images, require environment approval, minimise token permissions and review sandbox trade-offs. |

## 4. Coverage against NIS2 Article 21(2)

| NIS2 measure | Covered by area(s) in this assessment | Overall status |
|---|---|---|
| (a) Risk analysis and information system security policies | Risk analysis and information system security; Governance | Not evidenced |
| (b) Incident handling | Incident handling | Not evidenced |
| (c) Business continuity, backup management and crisis management | Business continuity and disaster recovery; Backup and recovery | Partially evidenced / Not evidenced |
| (d) Supply-chain security | Supply-chain security | Partially evidenced |
| (e) Security in acquisition, development and maintenance, including vulnerability handling and disclosure | Secure acquisition, development and maintenance; Vulnerability handling and disclosure | Partially evidenced |
| (f) Policies and procedures to assess effectiveness | Effectiveness of cybersecurity controls | Not evidenced |
| (g) Cyber hygiene and security training | Governance, roles and training | Not evidenced |
| (h) Cryptography and encryption | Cryptography and encryption | Partially evidenced |
| (i) Access control, asset management and authentication | Access control; Asset management; Authentication | Partially evidenced |
| (j) Multi-factor authentication, secure communications and emergency communication | Authentication; Cryptography; Incident handling | Not evidenced |

## 5. Detailed area assessments

### 5.1 Risk analysis and information system security

- **Evidence:** The repository documents the architecture and deployment intent (`README.md`, `deploy/README.md`), but no risk register, threat model, risk scoring method, risk owner or treatment plan is present.
- **Observation:** The most security-relevant risk is evident from the code itself — sign-in asserts identity by user identifier only, and the ERPNext adapter uses an administrator-level token — yet no risk assessment records or accepts these risks.
- **Gap:** No repeatable risk-analysis process, no linkage from risks to controls, no management approval.
- **Recommendation:** Create a scoped risk assessment covering the portal, the ERPNext integration, CI/CD and hosting; assign owners and review dates; record accepted risks explicitly.

### 5.2 Incident handling

- **Evidence:** CI and agent failures are reported in workflow logs and issue comments (`.github/workflows/agent.yml:91-111`). This is delivery observability, not security incident handling.
- **Gap:** No incident taxonomy, detection source, triage procedure, escalation path, contact list, evidence-preservation rule, regulatory notification timeline or post-incident review.
- **Recommendation:** Adopt a written incident-response plan aligned with NIS2 notification stages (24-hour early warning, 72-hour incident notification, one-month final report), exercise it at least annually, and integrate it with the CI/CD and hosting alerting.

### 5.3 Business continuity and disaster recovery

- **Evidence:** `deploy/deploy.sh:30-39` keeps the previous build in `.output.prev`; `ci.yml` defines main and preview deployment targets; `/api/health` is used for smoke verification.
- **Observation:** The application is stateless, but the snapshot store is in-memory and ERPNext (when used) is an external dependency. There is no evidence of data backup, restore testing or redundancy.
- **Gap:** No business impact analysis, RTO/RPO, backup schedule, restore test, failover or crisis-management procedure.
- **Recommendation:** Define RTO/RPO per service, back up configuration and any durable data, test restore, and document an outage/rollback runbook.

### 5.4 Supply-chain security

- **Evidence:** `pnpm-lock.yaml` pins the dependency graph; CI and Docker use `--frozen-lockfile`; most GitHub Actions are pinned by commit SHA; Dependabot covers npm, Actions and Docker; Trivy scans the built image; OSV-Scanner scans the lock file.
- **Gaps:** `Dockerfile` uses the mutable tag `node:26-alpine`; `security.yml:27` uses the mutable `semgrep/semgrep` image tag; no SBOM, signature or provenance attestation; no documented supplier assessment; `README.md` claims a GHCR `publish` job that is absent from `ci.yml`.
- **Recommendation:** Pin images by digest, generate and retain SBOMs, sign release artifacts, assess critical suppliers, and reconcile the pipeline documentation with the actual workflows.

### 5.5 Secure acquisition, development and maintenance

- **Evidence:** Pull requests trigger CI (`.github/workflows/ci.yml:3-6`); typecheck and unit tests run at lines 20-32; Playwright e2e runs at lines 34-70; CodeQL and Semgrep provide SAST; the agent workflow refuses to commit a defined set of protected files (`.github/workflows/agent.yml:73-89`).
- **Gaps:** Branch protection and required reviews are not stored in the repository and therefore **Require validation**; no secure coding standard, security acceptance criteria, threat modelling, dependency-review action or signed commits were found; `README.md` mentions dependency-review but `security.yml` does not implement it.
- **Recommendation:** Protect `main`, require reviewed PRs and passing checks, define secure coding requirements, add threat modelling to design changes, and add a dependency-review gate for pull requests.

### 5.6 Vulnerability handling and disclosure

- **Evidence:** `.github/workflows/security.yml` defines CodeQL, Semgrep, gitleaks, OSV-Scanner and Trivy; `.github/workflows/ci.yml:72-85` scans the image; `.github/dependabot.yml` automates dependency updates; `osv-scanner.toml` records two accepted findings with a review date of 2027-02-01.
- **Gaps:** No `SECURITY.md`, security.txt, disclosure channel, triage SLA, remediation SLA, ownership or ticket trace; no penetration test or bug-bounty evidence.
- **Recommendation:** Publish a vulnerability-disclosure policy, define severity-based SLAs, track findings to closure, and schedule independent penetration testing.

### 5.7 Effectiveness of cybersecurity controls

- **Evidence:** Functional tests and CI checks exist, but they verify application behaviour, not security-control effectiveness.
- **Gap:** No security metrics, internal audit, control testing, red-team exercise, tabletop exercise or management review record.
- **Recommendation:** Define measurable KPIs (for example time to patch critical findings, percentage of authenticated endpoints, backup-restore success) and review them with management.

### 5.8 Cryptography and encryption

- **Evidence:** `deploy/README.md:13-19` documents Cloudflare Tunnel ingress; deployment secrets are injected from GitHub; `.env.example` contains only commented placeholders; sessions are sealed with `NUXT_SESSION_PASSWORD` or a random per-process secret (`server/utils/auth.ts`).
- **Observation:** The repository contains no application-level cryptographic code, key material or certificate configuration. Transport security is asserted narratively for the external edge.
- **Gaps:** TLS configuration is not version-controlled or verifiable; encryption between nginx and the Node process is not evidenced; at-rest encryption and key rotation are not evidenced; there is no cryptographic inventory.
- **Recommendation:** Document and verify the TLS termination model, encrypt internal hops, inventory keys/certificates, define rotation, and avoid custom cryptography.

### 5.9 Access control

- **Evidence:** `server/domain/permissions.ts` defines four roles and their capabilities; every `/api/partner/[pid]/…` handler calls `requireCapability()` (`server/utils/auth.ts`), which requires a session, a membership at the requested company and a role that grants the capability (401/403 otherwise); case types add their own required capability and company-bound reference checks; tests in `tests/e2e/partner.spec.ts` and `tests/unit/permissions.test.ts` assert the main negative cases.
- **Observation:** Object-level authorization is derived from the session user, not from caller-supplied ownership claims. The residual weakness is upstream: identity is asserted by user identifier only.
- **Gap:** No access-review cycle, no role-administration interface, no exhaustive route × role test matrix, no logging of denied decisions.
- **Recommendation:** Add an automated route × role matrix test, log authorization decisions, define periodic review of memberships and keep the least-privilege principle for new capabilities.

### 5.10 Asset management

- **Evidence:** `package.json`, `pnpm-lock.yaml`, `Dockerfile`, `.github/workflows/` and `tests/` identify the main software and pipeline assets.
- **Gaps:** No asset inventory with owners and criticality, no SBOM, no lifecycle/decommissioning record, no inventory of external infrastructure (Cloudflare, Hetzner, nginx, systemd, ERPNext).
- **Recommendation:** Maintain an asset/service register with owners and criticality, generate an SBOM per release, and include external infrastructure and supplier services.

### 5.11 Authentication

- **Evidence:** `server/api/auth/login.post.ts` creates a sealed session (`server/utils/auth.ts`) for any existing user identifier; `server/api/auth/logout.post.ts` clears it; `app/middleware/auth.ts` redirects unauthenticated visitors; API handlers return 401 without a session.
- **Observation:** Session handling is in place, but there is no credential: knowing a user identifier is sufficient. Demo identifiers are published when `NUXT_PUBLIC_DEMO_USERS=true`.
- **Gap:** No credential verification, MFA, identity provider, account recovery or brute-force protection; cookie attributes rely on framework defaults.
- **Recommendation:** Integrate a standards-based identity provider with MFA, configure and verify cookie attributes, rate-limit sign-in and keep the demo user list disabled for any real-data environment.

### 5.12 Logging and monitoring

- **Evidence:** `addAudit()` records sign-in, overview access, payment attempts (success and decline) and case creation with user, company and action; in ERPNext mode these persist as `Szikra Event` documents; `/api/health` returns service status and build SHA; deployment polls it (`.github/workflows/ci.yml:172-179`); CI and Playwright reports are uploaded as artifacts (`.github/workflows/ci.yml:54-70`).
- **Gaps:** In the deployed snapshot mode the audit list is lost on restart; nothing reads it; no HTTP access log, central retention, alerting, SIEM or on-call ownership; no correlation identifiers.
- **Recommendation:** Persist audit events centrally with retention, expose them to administrators, add correlation IDs, alert on payment/auth anomalies and define monitoring ownership.

### 5.13 Network security (Requires validation)

- **Evidence:** `deploy/README.md:13-19` states that Cloudflare Tunnel exposes the service without opening a new inbound port, and that nginx performs host-based routing and rate limiting.
- **Gaps:** No nginx, Cloudflare, firewall or WAF configuration is in the repository; the application has no rate limiting, request-size limits or anti-automation controls.
- **Recommendation:** Version-control or otherwise evidence the network configuration, verify rate limiting/WAF rules, and add application-level abuse protection.

### 5.14 Data protection and privacy

- **Evidence:** The repository repeatedly states that data is fictional (`README.md`, `app/app.vue:13`); data fields are defined in `server/domain/types.ts`; no card or bank data is stored, and e-mail addresses use a reserved test domain.
- **Gaps:** For a real deployment, no data classification, retention/deletion, minimisation, privacy notice, processor agreement or at-rest encryption evidence exists.
- **Recommendation:** Classify personal and financial data, define retention and deletion, document lawful basis and processor relationships, and protect data in transit and at rest.

### 5.15 Change management and configuration management

- **Evidence:** Git history and PR-triggered CI provide traceability; deployment is tied to a 40-hex commit SHA (`deploy/deploy.sh:8`); runtime configuration is declared in `nuxt.config.ts`; the agent workflow blocks changes to a protected-file list.
- **Gaps:** Branch protection/required reviews are not evidenced; host configuration is not version-controlled; documentation drift exists around `deploy.yml`, GHCR publishing and dependency-review.
- **Recommendation:** Protect branches, require reviews and status checks, version-control host configuration, and review documentation as part of change control.

### 5.16 Governance, roles and training

- **Evidence:** None was found in the repository. The only role-like separation is the workflow trigger condition that limits the agent to the repository owner (`.github/workflows/agent.yml:15`), which is an automation control, not a security governance model.
- **Gap:** No security policy, accountability assignment, training programme or management review.
- **Recommendation:** Define NIS2 roles and responsibilities, approve a security policy, and run recurring awareness and role-specific training.

### 5.17 Physical and environmental security (Not applicable)

- **Rationale:** The application is hosted on external infrastructure (GitHub-hosted runners and a documented Hetzner host). No physical asset is managed by this repository.
- **Recommendation:** Obtain and review provider attestations and include them in supplier management.

### 5.18 Backup and recovery

- **Evidence:** None for data or configuration backups. ERPNext data lives in Docker volumes on the developer machine without backup, and the deployed store is in memory. `.output.prev` preserves the previous application build for rollback (`deploy/deploy.sh:34-39`), but it is not a backup of data, configuration or secrets.
- **Gap:** No backup scope, schedule, encryption, retention, restore test or RPO.
- **Recommendation:** Define and test backups for configuration and durable data, encrypt them, record RPO/RTO and include them in DR exercises.

## 6. What is deliberately **not** claimed

- The existence of CI security scans is **not** evidence that vulnerabilities are remediated within an acceptable time.
- Passing tests is **not** evidence that access control, cryptography or incident handling are effective.
- The documented Cloudflare/nginx architecture is **not** verified configuration; it is marked **Requires validation**.
- The application is **not** certified or declared NIS2 compliant by this document.

## 7. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial PoC control assessment based on repository evidence at commit `94ce09c`. |
| 0.2 | 2026-11-22 | Updated for the B2B partner portal (session authentication, role-based authorization, audit events, ERPNext adapter). Baseline `main` at `17d547b`. |

# 04 — Gap Analysis

> **Proof of Concept (PoC).** This gap analysis compares the observable repository state with a realistic enterprise implementation that could support an NIS2 compliance process. It does **not** certify the application and does **not** assert that the current state is compliant.

| Field | Value |
|---|---|
| Document | `04-gap-analysis.md` |
| Assessment date | 2026-11-22 (updated; first issued 2026-11-17) |
| Assessment target | `szikra` repository, `main` at commit `17d547b` (PR #36, B2B partner portal) plus the update in this change |
| Method | Comparison of evidenced controls (`03-evidence-register.md`) with NIS2 Article 21(2) expectations |
| Status | Draft — requires validation by the system owner |

## 1. How to read this document

- **Severity** is an analyst estimate for prioritisation in this PoC. It is based on the potential impact on confidentiality, integrity and availability, and on the likelihood that the gap is exploitable in a real deployment. It is not a formal enterprise risk score.
- **Existing evidence** identifies what is already present. A gap can exist even when some related evidence exists.
- **Validation / closure criteria** describes what evidence would be needed to close the gap. It does not imply that the recommendation has been implemented.
- The demo processes fictional data. Several gaps would become materially more severe if the same code processed real customer and billing data. This is stated explicitly where relevant.

## 2. Severity definitions

| Severity | Meaning in this PoC |
|---|---|
| **Critical** | Directly enables unauthorised access to, or manipulation of, customer or payment data; must be treated before any real-data use. |
| **High** | Materially weakens detection, response, recovery or governance; likely to be required by an enterprise NIS2 programme. |
| **Medium** | Important hardening or process gap; increases risk or audit friction but is not immediately exploitable on its own. |
| **Low** | Documentation, hygiene or incremental improvement. |

## 3. Gap summary

| ID | Gap | Affected NIS2 area | Severity | Suggested wave |
|---|---|---|---|---|
| GAP-01 | Sign-in asserts identity by user identifier only (mock SSO, no credential or MFA) | Authentication | Critical | 1 — immediate |
| GAP-02 | Authorization is implemented but not reviewed, exhaustively tested or logged | Access control | Medium | 2 — 30–90 days |
| GAP-03 | Payment action lacks confirmation, idempotency key and correlation id | Access control; Logging and monitoring; Integrity | Medium | 2 — 30–90 days |
| GAP-04 | Audit events are volatile, not exposed and not monitored; no alerting | Logging and monitoring; Incident handling | High | 2 — 30–90 days |
| GAP-05 | No incident-response plan or notification process | Incident handling | High | 2 — 30–90 days |
| GAP-06 | No business continuity, backup or disaster-recovery capability | Business continuity and disaster recovery; Backup and recovery | High | 2 — 30–90 days |
| GAP-07 | No documented risk analysis, threat model or risk register | Risk analysis and information system security | High | 1 — immediate |
| GAP-08 | No vulnerability-disclosure policy or remediation SLAs | Vulnerability handling and disclosure | High | 2 — 30–90 days |
| GAP-09 | Supply-chain hardening is incomplete (no SBOM, provenance or digest pinning) | Supply-chain security | High | 2 — 30–90 days |
| GAP-10 | TLS, WAF, firewall and reverse-proxy configuration is not reproducible | Network security; Cryptography | High | 2 — 30–90 days |
| GAP-11 | No security headers, application rate limiting or explicit cookie/CSRF hardening | Network security; Secure configuration | Medium | 2 — 30–90 days |
| GAP-12 | No data classification, retention, privacy or at-rest-encryption evidence | Data protection and privacy; Cryptography | High | 2 — 30–90 days |
| GAP-13 | No asset inventory, ownership or criticality model | Asset management | Medium | 3 — 90–180 days |
| GAP-14 | CI/CD and AI-agent automation expose a broad trust surface | Secure development; Supply-chain security; Access control | High | 2 — 30–90 days |
| GAP-15 | ERPNext adapter has no timeout, retry, circuit breaker or dependency health check | Business continuity; Availability | Medium | 3 — 90–180 days |
| GAP-16 | No measurement of control effectiveness, audit or independent testing | Effectiveness of cybersecurity controls | Medium | 3 — 90–180 days |
| GAP-17 | No security governance, roles, policy or training programme | Governance, roles and training | High | 2 — 30–90 days |
| GAP-18 | Documentation and implementation drift (GHCR publish, dependency-review, deploy.yml) | Change management and configuration management; Asset management | Medium | 1 — immediate |
| GAP-19 | ERPNext service token is the Administrator and the local stack uses default credentials | Access control; Secure configuration | Medium | 2 — 30–90 days |

## 4. Detailed gaps

## GAP-01 — Sign-in asserts identity by user identifier only

- **Description:** The portal implements session handling (sealed cookie, logout, route guard) but the sign-in is a mock single sign-on: a user who supplies an existing user identifier is signed in. There is no password, one-time code, MFA or identity-provider integration, and the demo user identifiers are published in the UI when demo mode is enabled. Authorization (GAP-02) is only as strong as this identity assertion.
- **Affected NIS2 area:** Authentication; Access control; Risk analysis and information system security.
- **Risk:** Likelihood: High (for any real-data use). Impact: High. Anyone who knows or guesses a user identifier acts as that user, with that user's roles at every company they belong to. In the demo this is intentional and the data is fictional; with real data it would be a direct disclosure and manipulation risk.
- **Existing evidence:** `server/api/auth/login.post.ts` (identifier-only login); `server/utils/auth.ts` (session); `server/api/auth/demo-users.get.ts` (published demo users); `app/middleware/auth.ts`.
- **Recommended control:** Integrate an identity provider with MFA, bind the session to the verified identity, add sign-in rate limiting and lockout, and keep demo mode and the demo user list strictly separated from any real-data environment.
- **Validation / closure criteria:** Sign-in without a verified credential is rejected on a real-data environment; MFA enrolment and authentication events are evidenced; demo identifiers cannot access real data.

## GAP-02 — Authorization is implemented but not reviewed, exhaustively tested or logged

- **Description:** Authorization is enforced server-side: every partner route calls `requireCapability()`, roles map to capabilities, case types require their own capability, and referenced invoices and supply points are checked against the company. Remaining weaknesses are process and assurance gaps: there is no role-administration interface or periodic access review, tests cover the main negative cases but not every route × role pair, and denied decisions are not logged.
- **Affected NIS2 area:** Access control; Asset management; Logging and monitoring.
- **Risk:** Likelihood: Low–Medium. Impact: High. A new route added without `requireCapability()`, or a role mapped to a capability too broadly, would expose company data; stale memberships would keep access after a role change.
- **Existing evidence:** `server/domain/permissions.ts`; `server/utils/auth.ts`; `server/api/partner/[pid]/`; `tests/e2e/partner.spec.ts`; `tests/unit/permissions.test.ts`; `AGENTS.md` (rule that every partner route starts with `requireCapability`).
- **Recommended control:** Add an automated test that enumerates all `/api/partner/[pid]/…` routes and asserts 401/403 for unauthenticated, foreign-company and under-privileged callers; log denied decisions; define a periodic membership review; keep new capabilities least-privilege.
- **Validation / closure criteria:** The route × role test matrix runs in CI and fails when a route lacks a guard; denied decisions appear in the audit log; membership reviews are recorded.

## GAP-03 — Payment action lacks confirmation, idempotency key and correlation id

- **Description:** The pay endpoint requires the `invoices.pay` capability, refuses an already paid invoice (409) and writes an audit event with the acting user. It has no explicit confirmation step, no idempotency key (two concurrent requests could both pass the status check in a real backend), no correlation id and no reconciliation with a payment provider; the bank decline is a demo flag.
- **Affected NIS2 area:** Access control; Logging and monitoring; Business continuity; Integrity of processing.
- **Risk:** Likelihood: Low–Medium. Impact: Medium–High. A double click, retry or concurrent request could create two payments against a real ledger; disputed payments are harder to reconstruct without a correlation id and persistent audit.
- **Existing evidence:** `server/api/partner/[pid]/invoices/[iid]/pay.post.ts` (capability, audit); `server/utils/backends/memory.ts` and `server/utils/backends/erpnext.ts` (status check before payment); `server/utils/erp/actions.ts` (Payment Entry); `app/pages/partner/[pid]/szamlak.vue` (direct POST on click).
- **Recommended control:** Add an explicit confirmation step, idempotency keys with a uniqueness constraint, a correlation id in audit and backend records, and reconciliation with the real payment provider's result.
- **Validation / closure criteria:** Replaying or racing the same payment request does not create a second payment; each attempt is traceable to an authenticated actor and correlation id; reconciliation reports exist.

## GAP-04 — Audit events are volatile, not exposed and not monitored

- **Description:** Sign-in, overview access, payment results and case creation are recorded through the backend interface, which is an improvement over no audit trail. In the deployed snapshot mode the list lives in process memory and is lost on restart; in ERPNext mode it is stored as `Szikra Event` rows. No API or UI reads the events, there is no HTTP access/error log configuration, no correlation id, no central retention and no alerting or on-call process.
- **Affected NIS2 area:** Logging and monitoring; Incident handling; Access control.
- **Risk:** Likelihood: Medium. Impact: High. Unauthorised access, enumeration attempts and unexpected payment activity would not be detected or investigated in time; evidence would disappear on restart.
- **Existing evidence:** `server/utils/backend.ts` (`addAudit`, `listAudit`); `server/utils/backends/memory.ts`; `server/utils/backends/erpnext.ts`; `server/api/health.get.ts`; `.github/workflows/ci.yml:172-179` (deploy smoke test); `.github/workflows/ci.yml:54-70` (CI/e2e artifacts with 14-day retention).
- **Recommended control:** Persist audit events centrally with retention, expose them to administrators, add correlation ids and HTTP access logging, define alert rules (failed sign-ins, payment anomalies, denied decisions) and assign monitoring ownership.
- **Validation / closure criteria:** A test sign-in and a payment attempt are visible in the central log with actor, timestamp, result and correlation id after an application restart; alerts fire on defined anomalies; retention meets the documented policy.

## GAP-05 — No incident-response plan or notification process

- **Description:** No incident taxonomy, detection source, triage procedure, escalation path, contact list, evidence-preservation rule, regulatory notification timeline or post-incident review is present. CI failure reporting is delivery observability, not security incident handling. The NIS2 notification stages (24-hour early warning, 72-hour incident notification, one-month final report) are not addressed.
- **Affected NIS2 area:** Incident handling; Governance.
- **Risk:** Likelihood: High. Impact: High. A security incident would likely be handled ad hoc, risking delayed containment, lost evidence and missed NIS2 notification obligations.
- **Existing evidence:** `.github/workflows/agent.yml:91-111` (delivery failure comments); no incident-response documentation anywhere in the repository.
- **Recommended control:** Adopt an incident-response plan aligned with NIS2 notification stages (24-hour early warning, 72-hour incident notification, one-month final report), define severity and escalation, maintain contacts, and exercise the plan.
- **Validation / closure criteria:** An approved plan exists; a tabletop or live exercise is recorded; notification templates and contact lists are current; post-incident actions are tracked.

## GAP-06 — No business continuity, backup or disaster-recovery capability

- **Description:** There is no business impact analysis, RTO/RPO, backup schedule, restore procedure, failover, redundant host or crisis-management plan. The previous build is kept for rollback, but data and configuration backups are not addressed. The deployed store is in-memory and disappears on restart; ERPNext data (development only) lives in local Docker volumes without backup.
- **Affected NIS2 area:** Business continuity and disaster recovery; Backup and recovery.
- **Risk:** Likelihood: Medium. Impact: High. A host failure, corruption or bad deploy could cause an extended outage with no tested recovery path and no recovery point for configuration or data.
- **Existing evidence:** `deploy/deploy.sh:30-40` (`.output.prev` and restart); `deploy/README.md:11-20` (single documented host, main/preview services); `server/utils/backends/memory.ts` (in-memory state); `erp/compose.yml` (local volumes); no backup artifacts.
- **Recommended control:** Define service criticality and RTO/RPO, back up configuration and durable data, encrypt backups, test restoration, add a documented rollback/failover procedure and exercise it.
- **Validation / closure criteria:** A restore test is recorded and meets RTO/RPO; backups are encrypted and access-controlled; a bad-deploy rollback is documented and exercised.

## GAP-07 — No documented risk analysis, threat model or risk register

- **Description:** The repository documents the system and pipeline but contains no risk assessment, threat model, risk register, scoring method, owner or treatment decision. The most obvious risks — identifier-only sign-in and an administrator-level ERPNext token — are not recorded or formally accepted.
- **Affected NIS2 area:** Risk analysis and information system security; Governance.
- **Risk:** Likelihood: High. Impact: High. Without a risk baseline, controls cannot be prioritised, accepted risks are invisible, and management cannot demonstrate NIS2 oversight.
- **Existing evidence:** `README.md` and `deploy/README.md` describe architecture/deployment; no risk, threat-model or risk-register artifact found.
- **Recommended control:** Create a scoped risk assessment covering the portal, the ERPNext integration, CI/CD, hosting and suppliers; assign owners and review dates; record accepted risks and link them to controls.
- **Validation / closure criteria:** An approved risk register exists; risks have owners, ratings, treatments and review dates; the register is reviewed after material changes.

## GAP-08 — No vulnerability-disclosure policy or remediation SLAs

- **Description:** Automated scanning is present, but there is no public or internal vulnerability-disclosure channel, no `SECURITY.md`/security.txt, no triage owner, no severity-based remediation SLA and no evidence that findings are tracked to closure. No penetration test is evidenced.
- **Affected NIS2 area:** Vulnerability handling and disclosure; Secure acquisition, development and maintenance.
- **Risk:** Likelihood: Medium. Impact: High. A reported vulnerability may not reach the right owner, and known findings may remain open indefinitely. Scanning without follow-up creates a false sense of assurance.
- **Existing evidence:** `.github/workflows/security.yml` (CodeQL, Semgrep, gitleaks, OSV, Trivy); `.github/workflows/ci.yml:72-85` (Trivy image scan); `.github/dependabot.yml`; `osv-scanner.toml` (two exceptions with a 2027-02-01 review date); no disclosure policy.
- **Recommended control:** Publish a disclosure policy and security contact, define triage and remediation SLAs by severity, track findings in an owned backlog, and schedule independent penetration testing.
- **Validation / closure criteria:** Disclosure channel is reachable and documented; SLA metrics are reported; open findings have owners and due dates; a penetration test report and remediation evidence exist.

## GAP-09 — Supply-chain hardening is incomplete

- **Description:** Dependencies are locked and most Actions are SHA-pinned, but the base image uses a mutable tag, the Semgrep container uses a tag, and there is no SBOM, artifact signature, provenance attestation or documented supplier assessment. The README also claims a GHCR publish job that does not exist.
- **Affected NIS2 area:** Supply-chain security; Asset management; Secure acquisition, development and maintenance.
- **Risk:** Likelihood: Medium. Impact: High. A compromised or replaced upstream image/tag could enter the build, and there is no bill of materials to support vulnerability response or customer assurance.
- **Existing evidence:** `Dockerfile` (`FROM node:26-alpine`); `.github/workflows/security.yml:27` (`container: semgrep/semgrep`); `.github/workflows/ci.yml` and `security.yml` (SHA-pinned Actions); `pnpm-lock.yaml`; `README.md` (GHCR claim); no SBOM or signing step.
- **Recommended control:** Pin images by digest, generate and retain an SBOM per release, sign or attest artifacts, document supplier assessments, and align documentation with the actual pipeline.
- **Validation / closure criteria:** Image digests are pinned; an SBOM is produced for each release; signatures/provenance verify; critical suppliers have an assessment record.

## GAP-10 — TLS, WAF, firewall and reverse-proxy configuration is not reproducible

- **Description:** Transport security and network filtering are asserted in `deploy/README.md` (Cloudflare Tunnel, nginx host routing and rate limiting), but no nginx, Cloudflare, firewall or WAF configuration is present in the repository. The configuration cannot be reviewed, diffed or restored from source.
- **Affected NIS2 area:** Network security; Cryptography; Business continuity.
- **Risk:** Likelihood: Medium. Impact: High. A misconfiguration, certificate problem or missing rate limit would be invisible in code review and difficult to reproduce after a host loss.
- **Existing evidence:** `deploy/README.md:13-19` (documented architecture); `.env.example` (commented placeholders only); no network or TLS configuration artifact found.
- **Recommended control:** Version-control the host/network configuration (or store reviewed exports/backups), document TLS termination and internal hops, and verify certificate, WAF and rate-limit settings.
- **Validation / closure criteria:** Reviewed configuration exists for nginx, Cloudflare and firewall rules; TLS settings are documented and tested; configuration can be restored from source.

## GAP-11 — No security headers, application rate limiting or explicit cookie/CSRF hardening

- **Description:** The application has no custom CSP, HSTS, frame-ancestors or other security-header configuration, no rate limiting (including on sign-in), no request-size limits and no explicit origin/CSRF enforcement. The session cookie relies on h3 defaults; `SameSite` and `Secure` behaviour is not configured or tested. State-changing endpoints accept JSON bodies and a session cookie. The documented nginx rate limit is external and unverified. The test seed route is now disabled unless `NUXT_TEST_SEED=true`.
- **Affected NIS2 area:** Network security; Secure configuration; Access control.
- **Risk:** Likelihood: Medium. Impact: Medium. Missing headers increase the impact of content-injection defects; absent rate limiting enables sign-in guessing and resource abuse; cookie attributes left to defaults may not match the deployment (HTTPS behind a tunnel).
- **Existing evidence:** `nuxt.config.ts` (no route rules or headers); `server/utils/auth.ts` (session without explicit cookie options); `server/` (no rate-limit or CSRF middleware); `deploy/README.md:14` (documented external rate limit); `server/routes/__test/seed.post.ts` (gated by `NUXT_TEST_SEED`).
- **Recommended control:** Add security headers/CSP, set and test explicit cookie attributes (`Secure`, `HttpOnly`, `SameSite`), enforce request-size and rate limits at the edge and in the application, and add origin checks for state-changing requests.
- **Validation / closure criteria:** Response headers and `Set-Cookie` attributes are verified in a deployment; rate limits are tested; state-changing requests reject missing or foreign origins; the seed route is unavailable outside test environments.

## GAP-12 — No data classification, retention, privacy or at-rest-encryption evidence

- **Description:** The demo uses fictional data (including free-text case fields and user e-mail addresses on a reserved test domain), but there is no data classification, retention/deletion rule, minimisation statement, privacy notice, processor agreement or evidence of at-rest encryption for a real deployment.
- **Affected NIS2 area:** Data protection and privacy; Cryptography; Asset management.
- **Risk:** Likelihood: Medium. Impact: High. Reusing the code with real customer and billing data without these controls could cause unlawful retention, excessive data exposure and non-compliance with privacy obligations.
- **Existing evidence:** `README.md` and `app/app.vue:13` (fictional-data disclaimers); `server/domain/types.ts` (data fields); no privacy/retention artifacts.
- **Recommended control:** Classify data, define retention and deletion, document lawful basis and processor relationships, minimise collected data, and protect data in transit and at rest.
- **Validation / closure criteria:** An approved data-classification and retention policy exists; storage encryption is evidenced; privacy notices and processor agreements are in place for real-data use.

## GAP-13 — No asset inventory, ownership or criticality model

- **Description:** The repository identifies software assets through manifests and workflows, but there is no inventory of services, owners, criticality, dependencies or lifecycle state. External assets (Cloudflare, Hetzner, nginx, systemd, ERPNext) are described only narratively.
- **Affected NIS2 area:** Asset management; Governance; Supply-chain security.
- **Risk:** Likelihood: Medium. Impact: Medium. Without an inventory, an incident or vulnerability cannot be scoped quickly, and ownership of remediation is unclear.
- **Existing evidence:** `package.json`; `pnpm-lock.yaml`; `Dockerfile`; `.github/workflows/`; `deploy/README.md`; no asset register or SBOM.
- **Recommended control:** Maintain an asset and service register with owners, criticality, location and dependencies; include external infrastructure and suppliers; generate an SBOM per release.
- **Validation / closure criteria:** The register covers all in-scope assets and has named owners and review dates; an SBOM is available for the current release.

## GAP-14 — CI/CD and AI-agent automation expose a broad trust surface

- **Description:** The AI-agent workflow has write permissions and access to repository secrets, installs unpinned OS packages, disables an AppArmor user-namespace restriction, and runs an editing agent with `acceptEdits`. Workflows reference GitHub environments, but approval and protection settings are not in the repository. Semgrep's container image is tag-referenced.
- **Affected NIS2 area:** Secure acquisition, development and maintenance; Supply-chain security; Access control; Change management.
- **Risk:** Likelihood: Medium. Impact: High. A compromised dependency, prompt-injection path or over-privileged token could modify code or reach deployment secrets. The protected-file denylist reduces but does not eliminate this risk.
- **Existing evidence:** `.github/workflows/agent.yml:15,21-25,40-46,51-89`; `.github/workflows/ci.yml:12-13,131-147`; `.github/workflows/security.yml:27`; `deploy/deploy.sh`.
- **Recommended control:** Minimise token permissions, pin all tools/images, isolate the agent from production secrets, require environment approval for deploy, review sandbox trade-offs, and protect branches/environments.
- **Validation / closure criteria:** Environment approval is evidenced; tokens are least-privilege; all images/tools are pinned; the agent cannot reach production secrets without review.

## GAP-15 — ERPNext adapter has no timeout, retry, circuit breaker or dependency health check

- **Description:** In `erpnext` mode the adapter performs plain `fetch` calls with no timeout, retry, circuit breaker or bulkhead. `/api/health` checks only the Node process, not backend reachability. Backend errors surface as generic failures. The default snapshot mode has no such dependency, which limits the exposure to development use.
- **Affected NIS2 area:** Business continuity and disaster recovery; Availability; Incident handling.
- **Risk:** Likelihood: Low (development only). Impact: Medium. A slow or unavailable ERPNext can exhaust resources or block requests; the health endpoint still reports `ok`, delaying detection if the mode were used elsewhere.
- **Existing evidence:** `server/utils/erp/client.ts`; `server/utils/backends/erpnext.ts`; `server/api/health.get.ts`; `.github/workflows/ci.yml:172-179`.
- **Recommended control:** Add request timeouts, bounded retries with backoff, circuit breaking, a backend health check in `/api/health` and an outage runbook before any non-local use of the ERPNext mode.
- **Validation / closure criteria:** Timeout/retry behaviour is tested; backend health is visible; an ERPNext outage produces a defined degraded mode and alert.

## GAP-16 — No measurement of control effectiveness, audit or independent testing

- **Description:** Tests verify application behaviour; there is no security KPI, internal audit, control test, penetration test, red-team exercise or management review. A green pipeline is not evidence that security controls are effective.
- **Affected NIS2 area:** Effectiveness of cybersecurity controls; Governance.
- **Risk:** Likelihood: Medium. Impact: Medium. Controls may degrade without notice, and the organisation cannot demonstrate due diligence to management, customers or regulators.
- **Existing evidence:** `tests/unit/`; `tests/e2e/`; `.github/workflows/ci.yml`; `.github/workflows/security.yml`; no effectiveness measurement artifacts.
- **Recommended control:** Define KPIs, test controls periodically, run independent assessments and record management review and remediation decisions.
- **Validation / closure criteria:** KPIs are reported over time; control tests and management reviews are recorded; independent test findings are tracked to closure.

## GAP-17 — No security governance, roles, policy or training programme

- **Description:** No security policy, role assignment, management commitment, awareness programme or training record is present. The only role-like condition is the workflow restriction that only the repository owner can trigger the agent.
- **Affected NIS2 area:** Governance, roles and training; Risk analysis and information system security.
- **Risk:** Likelihood: High. Impact: High. Without assigned accountability, NIS2 obligations are unlikely to be implemented or maintained, and incident decisions may be delayed.
- **Existing evidence:** `.github/workflows/agent.yml:15` (owner-only trigger); no governance artifacts.
- **Recommended control:** Define NIS2 roles and responsibilities, approve a security policy, assign control owners, and run recurring awareness and role-specific training.
- **Validation / closure criteria:** Roles are assigned and documented; the policy is approved; training completion is recorded.

## GAP-18 — Documentation and implementation drift

- **Description:** Several repository statements do not match the implementation: `README.md` claims a GHCR `publish` job and dependency-review, but `ci.yml` has no publish job and `security.yml` has no dependency-review job; `deploy/README.md` refers to a `deploy.yml` that does not exist. Stale documentation undermines audit evidence and incident response.
- **Affected NIS2 area:** Change management and configuration management; Asset management; Secure development.
- **Risk:** Likelihood: High. Impact: Medium. An operator or auditor may rely on a control that is not actually implemented, and configuration changes may be made in the wrong place.
- **Existing evidence:** `README.md` (pipeline table); `.github/workflows/ci.yml`; `.github/workflows/security.yml`; `deploy/README.md:3`; no `deploy.yml`.
- **Recommended control:** Reconcile documentation with the actual pipeline, add documentation review to change control, and link each claimed control to a verifiable artifact.
- **Validation / closure criteria:** A documentation review confirms every claimed control maps to a real workflow/configuration; broken references are removed; the review is repeated after pipeline changes.

## GAP-19 — ERPNext service token is the Administrator and the local stack uses default credentials

- **Description:** The seed script generates an API key for the ERPNext `Administrator` user and writes it to `erp/.env.local`; the portal's ERPNext adapter uses it for every call. The local Docker stack defines `admin` as database root and `Administrator` password. The key is git-ignored (mode 600) and the HTTP port is bound to `127.0.0.1`, which limits exposure to the developer machine.
- **Affected NIS2 area:** Access control; Secure configuration; Secret and key management.
- **Risk:** Likelihood: Low (local only). Impact: High if the pattern were reused. A compromise of the portal process or of the token would give full control of the ERP, and default credentials are trivially guessable if the port were ever exposed.
- **Existing evidence:** `erp/seed.ts` (`writeKeys`); `erp/compose.yml` (default passwords, `127.0.0.1:8088`); `server/utils/backends/erpnext.ts`; `.gitignore` (`erp/.env.local`).
- **Recommended control:** Create a dedicated ERPNext service user with only the DocType permissions the portal needs, rotate its key, replace default passwords via environment-provided secrets, and keep the stack off shared networks.
- **Validation / closure criteria:** The adapter authenticates as a least-privilege user whose permissions are documented; no default credentials remain in any non-local deployment; key rotation is exercised.

## 5. Suggested remediation roadmap

The waves are a PoC suggestion, not a committed plan. They assume the application might handle real data; if it remains a fictional demo, some items can be documented as accepted demo limitations.

| Wave | Focus | Gaps |
|---|---|---|
| **Wave 1 — before any real-data use** | Verified identity and a risk baseline | GAP-01, GAP-07, GAP-18 |
| **Wave 2 — 30–90 days** | Authorization assurance, detection, response, recovery, governance and supply chain | GAP-02, GAP-03, GAP-04, GAP-05, GAP-06, GAP-08, GAP-09, GAP-10, GAP-11, GAP-12, GAP-14, GAP-17, GAP-19 |
| **Wave 3 — 90–180 days** | Measurement and continuous improvement | GAP-13, GAP-15, GAP-16 |

## 6. Residual-risk statement

Even if every recommendation in this document were implemented, the application would still require organisation-level NIS2 controls, supplier assurances (Cloudflare, Hetzner, GitHub and any real CRM/ERP provider), legal review and management approval. This PoC identifies repository-level gaps only; it does not provide an assurance opinion, certification or audit conclusion.

## 7. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial PoC gap analysis based on repository evidence at commit `94ce09c`. |
| 0.2 | 2026-11-22 | Updated for the B2B partner portal: GAP-01 reframed, GAP-02/03/04/11/15 re-rated or rewritten, GAP-19 added. Baseline `main` at `17d547b`. |

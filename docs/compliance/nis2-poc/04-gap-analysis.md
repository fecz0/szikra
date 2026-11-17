# 04 — Gap Analysis

> **Proof of Concept (PoC).** This gap analysis compares the observable repository state with a realistic enterprise implementation that could support an NIS2 compliance process. It does **not** certify the application and does **not** assert that the current state is compliant.

| Field | Value |
|---|---|
| Document | `04-gap-analysis.md` |
| Assessment date | 2026-11-17 |
| Assessment target | `szikra` repository at commit `94ce09cc539fef0d1f94eb32a1563b00efd89a96` |
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
| GAP-01 | Customer ID is treated as an authentication factor | Authentication | Critical | 1 — immediate |
| GAP-02 | No authorization or object-level access control (IDOR) | Access control | Critical | 1 — immediate |
| GAP-03 | Payment action lacks confirmation, idempotency and audit trail | Access control; Logging and monitoring; Integrity | High | 1 — immediate |
| GAP-04 | No security logging, monitoring, alerting or audit trail | Logging and monitoring; Incident handling | High | 1 — immediate |
| GAP-05 | No incident-response plan or notification process | Incident handling | High | 2 — 30–90 days |
| GAP-06 | No business continuity, backup or disaster-recovery capability | Business continuity and disaster recovery; Backup and recovery | High | 2 — 30–90 days |
| GAP-07 | No documented risk analysis, threat model or risk register | Risk analysis and information system security | High | 1 — immediate |
| GAP-08 | No vulnerability-disclosure policy or remediation SLAs | Vulnerability handling and disclosure | High | 2 — 30–90 days |
| GAP-09 | Supply-chain hardening is incomplete (no SBOM, provenance or digest pinning) | Supply-chain security | High | 2 — 30–90 days |
| GAP-10 | TLS, WAF, firewall and reverse-proxy configuration is not reproducible | Network security; Cryptography | High | 2 — 30–90 days |
| GAP-11 | No security headers, application rate limiting or CSRF/anti-automation controls | Network security; Secure configuration | Medium | 2 — 30–90 days |
| GAP-12 | No data classification, retention, privacy or at-rest-encryption evidence | Data protection and privacy; Cryptography | High | 2 — 30–90 days |
| GAP-13 | No asset inventory, ownership or criticality model | Asset management | Medium | 3 — 90–180 days |
| GAP-14 | CI/CD and AI-agent automation expose a broad trust surface | Secure development; Supply-chain security; Access control | High | 2 — 30–90 days |
| GAP-15 | SAP integration has no timeout, retry, circuit breaker or dependency health check | Business continuity; Availability | Medium | 3 — 90–180 days |
| GAP-16 | No measurement of control effectiveness, audit or independent testing | Effectiveness of cybersecurity controls | Medium | 3 — 90–180 days |
| GAP-17 | No security governance, roles, policy or training programme | Governance, roles and training | High | 2 — 30–90 days |
| GAP-18 | Documentation and implementation drift (GHCR publish, dependency-review, deploy.yml) | Change management and configuration management; Asset management | Medium | 1 — immediate |

## 4. Detailed gaps

## GAP-01 — Customer ID is treated as an authentication factor

- **Description:** The portal asks only for a customer identifier and then serves the account for that identifier. There is no password, one-time code, MFA, session, token or identity-provider integration. The identifier is a lookup key, not a credential, and fixed demo identifiers are published in the UI.
- **Affected NIS2 area:** Authentication; Access control; Risk analysis and information system security.
- **Risk:** Likelihood: High. Impact: High. Anyone who knows or guesses an identifier can read the associated customer data. Because identifiers may be sequential, reused or exposed in logs/URLs, enumeration is plausible. If real SAP data were connected, this would be a direct personal-data and billing-data disclosure.
- **Existing evidence:** `app/pages/index.vue:10-13` (ID-only form); `app/pages/index.vue:4-9` (published demo IDs); `server/api/account/[id].get.ts` (ID used directly); no authentication middleware found in `server/`.
- **Recommended control:** Integrate an identity provider with MFA, establish a server-side session or short-lived access token, and require authentication on all account and payment APIs. Remove or strictly separate demo mode from any real-data environment.
- **Validation / closure criteria:** An unauthenticated request to `/api/account/:id` on a real-data environment is rejected with 401/403; authentication events and MFA enrolment are evidenced; demo IDs cannot access real data.

## GAP-02 — No authorization or object-level access control (IDOR)

- **Description:** Even after authentication, there is no ownership or role check. The account handler and the payment handler trust the path/body identifiers and forward them to SAP. There is no RBAC, ABAC, tenant isolation or least-privilege model.
- **Affected NIS2 area:** Access control; Authentication; Asset management.
- **Risk:** Likelihood: High. Impact: High. A caller can request another customer's account or attempt a payment against another customer's bill by changing the identifier. This is a classic insecure direct object reference. The defect would survive a superficial "add login" fix if object-level authorization is not added.
- **Existing evidence:** `server/api/account/[id].get.ts:1-9`; `server/api/account/[id]/pay.post.ts:1-10`; no role/permission definitions in `app/` or `server/`.
- **Recommended control:** Derive the customer context from the authenticated principal, not from the URL; enforce object-level authorization on every read and write; define least-privilege roles; log access decisions.
- **Validation / closure criteria:** Negative tests prove that customer A cannot read or pay customer B's data; authorization is enforced server-side; roles and permissions are documented and reviewed.

## GAP-03 — Payment action lacks confirmation, idempotency and audit trail

- **Description:** The pay endpoint accepts a `billId` and immediately forwards a payment request to SAP. There is no explicit confirmation step, no idempotency key, no duplicate-payment guard, no correlation ID and no audit record of who initiated the payment.
- **Affected NIS2 area:** Access control; Logging and monitoring; Business continuity; Integrity of processing.
- **Risk:** Likelihood: Medium. Impact: High. A double click, retry, malicious request or cross-site request could trigger an unintended payment. Without an audit trail, disputed transactions cannot be reconstructed. In the mock, state resets every 30 minutes, which masks but does not remove the design risk.
- **Existing evidence:** `app/pages/fiok/[id].vue:14-28` (direct POST on button click); `server/api/account/[id]/pay.post.ts`; `server/routes/mock-sap/customers/[id]/payments.post.ts` (mock mutates bill status in memory); `server/plugins/demo-users.ts:5-16` (30-minute reset).
- **Recommended control:** Add an explicit confirmation step, idempotency keys, duplicate-payment detection, a payment audit record with actor/correlation ID, and reconciliation with the SAP payment result.
- **Validation / closure criteria:** Replaying the same payment request does not create a second payment; every payment attempt is traceable to an authenticated actor and a correlation ID; reconciliation reports exist.

## GAP-04 — No security logging, monitoring, alerting or audit trail

- **Description:** The application has a public health endpoint and CI/e2e artifacts, but no application access log, authentication log, payment audit log, structured error log, central retention, alerting or on-call process.
- **Affected NIS2 area:** Logging and monitoring; Incident handling; Access control.
- **Risk:** Likelihood: High. Impact: High. Unauthorised access, enumeration attempts and unexpected payment activity would not be detected or investigated. NIS2 incident handling depends on timely detection and usable evidence.
- **Existing evidence:** `server/api/health.get.ts` (health and SHA only); `.github/workflows/ci.yml:172-179` (deploy smoke test); `.github/workflows/ci.yml:54-70` (CI/e2e artifacts with 14-day retention); no application logging configuration found.
- **Recommended control:** Emit structured security and audit events (authentication, authorization decision, account access, payment attempt/result, configuration changes), centralise them with retention, define alert rules and assign monitoring ownership.
- **Validation / closure criteria:** A test account access and a payment attempt are visible in the central log with actor, timestamp, result and correlation ID; alerts fire on defined anomalies; retention meets the documented policy.

## GAP-05 — No incident-response plan or notification process

- **Description:** No incident taxonomy, detection source, triage procedure, escalation path, contact list, evidence-preservation rule, regulatory notification timeline or post-incident review is present. CI failure reporting is delivery observability, not security incident handling. The NIS2 notification stages (24-hour early warning, 72-hour incident notification, one-month final report) are not addressed.
- **Affected NIS2 area:** Incident handling; Governance.
- **Risk:** Likelihood: High. Impact: High. A security incident would likely be handled ad hoc, risking delayed containment, lost evidence and missed NIS2 notification obligations.
- **Existing evidence:** `.github/workflows/agent.yml:91-111` (delivery failure comments); no incident-response documentation anywhere in the repository.
- **Recommended control:** Adopt an incident-response plan aligned with NIS2 notification stages (24-hour early warning, 72-hour incident notification, one-month final report), define severity and escalation, maintain contacts, and exercise the plan.
- **Validation / closure criteria:** An approved plan exists; a tabletop or live exercise is recorded; notification templates and contact lists are current; post-incident actions are tracked.

## GAP-06 — No business continuity, backup or disaster-recovery capability

- **Description:** There is no business impact analysis, RTO/RPO, backup schedule, restore procedure, failover, redundant host or crisis-management plan. The previous build is kept for rollback, but data and configuration backups are not addressed. The mock store is in-memory and disappears on restart.
- **Affected NIS2 area:** Business continuity and disaster recovery; Backup and recovery.
- **Risk:** Likelihood: Medium. Impact: High. A host failure, corruption or bad deploy could cause an extended outage with no tested recovery path and no recovery point for configuration or data.
- **Existing evidence:** `deploy/deploy.sh:30-40` (`.output.prev` and restart); `deploy/README.md:11-20` (single documented host, main/preview services); `server/mock-sap/store.ts:1-4` (in-memory state); no backup artifacts.
- **Recommended control:** Define service criticality and RTO/RPO, back up configuration and durable data, encrypt backups, test restoration, add a documented rollback/failover procedure and exercise it.
- **Validation / closure criteria:** A restore test is recorded and meets RTO/RPO; backups are encrypted and access-controlled; a bad-deploy rollback is documented and exercised.

## GAP-07 — No documented risk analysis, threat model or risk register

- **Description:** The repository documents the system and pipeline but contains no risk assessment, threat model, risk register, scoring method, owner or treatment decision. The most obvious risk — unauthenticated account access — is not recorded or formally accepted.
- **Affected NIS2 area:** Risk analysis and information system security; Governance.
- **Risk:** Likelihood: High. Impact: High. Without a risk baseline, controls cannot be prioritised, accepted risks are invisible, and management cannot demonstrate NIS2 oversight.
- **Existing evidence:** `README.md` and `deploy/README.md` describe architecture/deployment; no risk, threat-model or risk-register artifact found.
- **Recommended control:** Create a scoped risk assessment covering the portal, SAP integration, CI/CD, hosting and suppliers; assign owners and review dates; record accepted risks and link them to controls.
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
- **Existing evidence:** `deploy/README.md:13-19` (documented architecture); `.env.example` (placeholder SAP URL); no network or TLS configuration artifact found.
- **Recommended control:** Version-control the host/network configuration (or store reviewed exports/backups), document TLS termination and internal hops, and verify certificate, WAF and rate-limit settings.
- **Validation / closure criteria:** Reviewed configuration exists for nginx, Cloudflare and firewall rules; TLS settings are documented and tested; configuration can be restored from source.

## GAP-11 — No security headers, application rate limiting or CSRF/anti-automation controls

- **Description:** The application has no custom CSP, HSTS, frame-ancestors or other security-header configuration, no rate limiting, no request-size limits and no CSRF/origin enforcement. The documented nginx rate limit is external and unverified. There is no anti-automation control on the seed endpoint or account lookup.
- **Affected NIS2 area:** Network security; Secure configuration; Access control.
- **Risk:** Likelihood: Medium. Impact: Medium. Missing headers increase the impact of content-injection defects; absent rate limiting enables enumeration and resource abuse. Classic CSRF impact is currently limited because there is no authenticated session, but it becomes relevant as soon as authentication is added.
- **Existing evidence:** `nuxt.config.ts` (no route rules or headers); `server/` (no rate-limit or CSRF middleware); `deploy/README.md:14` (documented external rate limit); `server/routes/mock-sap/__seed.post.ts` (public seed endpoint when mock is enabled).
- **Recommended control:** Add security headers/CSP, enforce request-size and rate limits at the edge and in the application, add CSRF/origin checks for state-changing requests, and protect the seed endpoint or disable it outside tests.
- **Validation / closure criteria:** Response headers are verified in a deployment; rate limits are tested; state-changing requests reject missing/invalid origins; the seed endpoint is unavailable outside test/demo environments.

## GAP-12 — No data classification, retention, privacy or at-rest-encryption evidence

- **Description:** The demo uses fictional data, but there is no data classification, retention/deletion rule, minimisation statement, privacy notice, processor agreement or evidence of at-rest encryption for a real deployment.
- **Affected NIS2 area:** Data protection and privacy; Cryptography; Asset management.
- **Risk:** Likelihood: Medium. Impact: High. Reusing the code with real customer and billing data without these controls could cause unlawful retention, excessive data exposure and non-compliance with privacy obligations.
- **Existing evidence:** `README.md` and `app/app.vue:13` (fictional-data disclaimers); `server/mock-sap/types.ts` (data fields); no privacy/retention artifacts.
- **Recommended control:** Classify data, define retention and deletion, document lawful basis and processor relationships, minimise collected data, and protect data in transit and at rest.
- **Validation / closure criteria:** An approved data-classification and retention policy exists; storage encryption is evidenced; privacy notices and processor agreements are in place for real-data use.

## GAP-13 — No asset inventory, ownership or criticality model

- **Description:** The repository identifies software assets through manifests and workflows, but there is no inventory of services, owners, criticality, dependencies or lifecycle state. External assets (Cloudflare, Hetzner, nginx, systemd, SAP) are described only narratively.
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

## GAP-15 — SAP integration has no timeout, retry, circuit breaker or dependency health check

- **Description:** The SAP adapter performs plain `$fetch` calls with no timeout, retry, circuit breaker or bulkhead. `/api/health` checks only the Node process, not SAP reachability. Failures are mapped to HTTP 502.
- **Affected NIS2 area:** Business continuity and disaster recovery; Availability; Incident handling.
- **Risk:** Likelihood: Medium. Impact: Medium. A slow or unavailable SAP can exhaust resources or produce a poor customer experience; the health endpoint still reports `ok`, delaying detection.
- **Existing evidence:** `server/utils/sap.ts:9-25`; `server/api/account/[id].get.ts:4-9`; `server/api/health.get.ts`; `.github/workflows/ci.yml:172-179`.
- **Recommended control:** Add timeouts, bounded retries with backoff, circuit breaking, dependency health checks and an outage runbook.
- **Validation / closure criteria:** Timeout/retry behaviour is tested; dependency health is visible; an SAP outage produces a defined degraded mode and alert.

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

## 5. Suggested remediation roadmap

The waves are a PoC suggestion, not a committed plan. They assume the application might handle real data; if it remains a fictional demo, some items can be documented as accepted demo limitations.

| Wave | Focus | Gaps |
|---|---|---|
| **Wave 1 — before any real-data use** | Remove direct data exposure and establish a risk baseline | GAP-01, GAP-02, GAP-03, GAP-04, GAP-07, GAP-18 |
| **Wave 2 — 30–90 days** | Detection, response, recovery, governance and supply chain | GAP-05, GAP-06, GAP-08, GAP-09, GAP-10, GAP-11, GAP-12, GAP-14, GAP-17 |
| **Wave 3 — 90–180 days** | Measurement and continuous improvement | GAP-13, GAP-15, GAP-16 |

## 6. Residual-risk statement

Even if every recommendation in this document were implemented, the application would still require organisation-level NIS2 controls, supplier assurances (Cloudflare, Hetzner, SAP, GitHub), legal review and management approval. This PoC identifies repository-level gaps only; it does not provide an assurance opinion, certification or audit conclusion.

## 7. Document control

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-17 | Initial PoC gap analysis based on repository evidence at commit `94ce09c`. |

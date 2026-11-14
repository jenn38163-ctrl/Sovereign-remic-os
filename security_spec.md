# Security Specification: Sovereign REMIC Financial OS

## Data Invariants
1. **Settlement Intent Integrity**: Settlement intents can only transition along approved state paths (`AUTHORIZED` -> `LEDGER_POSTED` -> `SETTLEMENT_CONFIRMED` / `SETTLEMENT_FAILED`).
2. **Double-Entry Immutability**: Journal entries are append-only. No edits or deletions are allowed once committed.
3. **Audit Chain Tamper-Resistance**: Audit logs require strict monotonic sequence incrementing and previous hash validation.
4. **Tenant Isolation**: Non-admin clients can only read resources belonging to their verified `tenant_id`.
5. **Four-Eyes Maker-Checker Separation**: Creators (`created_by`) of Debt Notes, PPM Offerings, and Collateral Asset Pools cannot approve their own records (no ADMIN bypass).
6. **Securities Exemption & Tokenized Asset Gates**: Proposed Regulation Crypto Assets is non-operative and blocked. Tokenized instruments remain subject to federal securities laws (SEC Release 33-11412) and require counsel sign-off.
7. **Retention & No-Delete Policy**: Debt Notes, PPM Offerings, Asset Pools, Journal Entries, Audit Logs, and Settlement Intents cannot be hard-deleted (`allow delete: if false;`).

## Dirty Dozen Payloads & Mitigation Gates
1. Non-verified user creating settlement intents -> Rejected by `request.auth.token.email_verified == true`.
2. Spoofed tenant_id insertion -> Rejected by tenancy check against user profile/server authority.
3. Negative/NaN amount strings -> Rejected by string size and decimal regex checks.
4. Modification of immutable journal entry -> Update & Delete rejected by `allow update, delete: if false;`.
5. Modification of previous_hash in audit log -> Update & Delete rejected by `allow update, delete: if false;`.
6. Injecting oversized payload (>4KB) into audit log -> Rejected by `payload.size() <= 4096`.
7. Non-whitelisted settlement currency -> Rejected by enum validation.
8. Non-whitelisted provider -> Rejected by enum validation.
9. Skipping state from `PENDING` directly to `SETTLEMENT_CONFIRMED` -> Protected by action-based transitions.
10. Unauthenticated reads of audit trail -> Rejected by `isSignedIn()`.
11. Blanket document sweeps -> Constrained by tenant-bound queries.
12. Shadow fields in write operations -> Prevented by strict key blueprint verification.
13. Self-approval of PPM / Debt Note / Asset Pool -> Rejected by `approved_by != created_by` and server-side check.
14. Non-operative exemption pathway (`PROPOSED_REG_CRYPTO_ASSETS`) -> Rejected by enum whitelist in rules and server validation.

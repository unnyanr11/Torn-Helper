# Approved deployment status

Project: `caxhhhtrlqfuatraamto` / Torn-Helper. Date: 19 October 2026.

The user explicitly approved the previously reviewed coordinated migration and deployment. The migration `repair_runtime_security_and_marketplaces` applied successfully. All 15 matching Edge Functions were deployed successfully.

## Live checks completed

- Production transaction smoke test created temporary identities, acquired a loss claim, verified an attack and checked the resulting ledger. The entire transaction was rolled back; no test identities, claims or settlement records remained.
- Browser roles cannot read credential ciphertext, update profile roles, insert authoritative identity/membership records, or insert verified attack evidence. Safe profile fields remain editable.
- All six coordination tables are published to Realtime behind RLS.
- `verify-loss-payment` runs every two minutes; `evaluate-alerts` runs every five minutes. Both use the scoped Vault token rather than a service-role database setting.
- Direct scheduled HTTP smoke calls returned 200: loss verification reported zero pending claims; alert evaluation reported zero rules. Neither timed out.
- Security advisors no longer report public privileged-function execution or mutable function search paths. The existing pg_net extension-in-public warning remains; the private, deliberately inaccessible audit table also has an informational no-policy notice.
- The frontend production build, all 43 automated tests, the candidate schema audit and 15 Deno entrypoint type checks passed. The dependency audit reports zero known advisories.

- All 13 protected HTTP endpoints reject unauthenticated requests with 401. Public API path normalization now supports both external and gateway-relative URLs; regression tests cover both forms.

## Limits

The complete feature specification remains unfinished; see IMPLEMENTATION_AUDIT.md and the coverage matrix. Real Torn-key/provider-key operations, signed-in browser flows, Realtime delivery, uploads and multi-session stress tests still require acceptance checks with legitimate accounts and data.

The user explicitly approved publishing the matching source directly to the public `unnyanr11/Torn-Helper` repository on `main`. This supersedes the earlier publication approval block. The source in this repository matches the approved backend repair, including the public API routing correction. No independent frontend hosting target was supplied or configured, so source publication is not a claim that a hosted frontend was redeployed.

Key encryption uses the project's existing server-only `TORN_KEY_ENCRYPTION_KEY` configuration. Its value was neither read nor exposed; linking a legitimate key is required to validate that configuration end to end.


## Follow-up: workspace persistence, mortgages and opt-in history

Applied `saved_workspaces_and_mortgage_ledger` and `opt_in_personal_history` successfully on 19 October 2026. These add seven RLS-protected tables and private mortgage RPC implementations, owner-only preset persistence, an explicit history opt-in and service-only observation recording.

Deployed `account-data` version 2 and `refresh-live-data` version 3. Both continue to authenticate in the function body and reject unauthenticated HTTP calls with 401.

Live rollback smoke validation passed application creation/activation, schedule generation, partial payment allocation, correction with retained audit, preset persistence and an opted-in official numeric snapshot. No fixture records were retained. Catalog checks confirm all seven new tables have RLS and anonymous mortgage execution, browser official-history insertion and direct payment mutation are disallowed.

Local validation: 66 tests, production build, candidate schema-reference audit and all 15 Deno entrypoint checks. Security advisors return the previously documented pg_net warning and inaccessible audit-table informational notice; no additional warning was returned. The advisor results carry their own collection timestamp, so live grants/RLS were checked directly as well.

This follow-up source is published to main under the user's standing approval. A separate frontend hosting deployment is still not configured. Actual key-enabled collection, signed-in browser flows and concurrent multi-session contention remain unverified. Broader unfinished features remain listed in IMPLEMENTATION_AUDIT.md.

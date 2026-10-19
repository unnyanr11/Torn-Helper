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

#!/usr/bin/env bash
set -euo pipefail
PROJECT_REF="${SUPABASE_PROJECT_REF:-caxhhhtrlqfuatraamto}"
# The SQL repair must be applied and approved before deploying these coordinated changes.
if [[ "${TCC_SCHEMA_REPAIR_APPLIED:-}" != "yes" ]]; then
  echo 'Apply and verify the reviewed runtime repair migration first; then set TCC_SCHEMA_REPAIR_APPLIED=yes.' >&2
  exit 1
fi
for function_dir in supabase/functions/*; do
  [[ -d "$function_dir" && "$(basename "$function_dir")" != "_shared" ]] || continue
  function_name="$(basename "$function_dir")"
  npx supabase functions deploy "$function_name" --project-ref "$PROJECT_REF" --no-verify-jwt
done
# Each private function authenticates getUser(token) or the scoped Vault job token in its body.
# sign-in-torn is a public login endpoint protected by Torn key proof and server-side rate limits.
# public-api exposes static public documentation only. No unauthenticated verification probes run here.
